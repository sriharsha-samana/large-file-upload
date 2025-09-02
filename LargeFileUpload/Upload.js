// upload.aspx.js - Full-featured chunked upload for ASP.NET Web Forms (.ashx handler endpoints)
// Adapted from upload_old.js

let CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
let CONCURRENCY = 3;
let MAX_RETRIES = 3;
let isPaused = false;
let isAborted = false;
let throttleMs = 0;

function addConfigControls() {
    let uploaderCard = document.querySelector('.container');
    if (!uploaderCard) {
        uploaderCard = document.createElement('div');
        uploaderCard.className = 'container';
        uploaderCard.style.maxWidth = '600px';
        uploaderCard.style.width = '100%';
        uploaderCard.style.margin = '40px auto';
        uploaderCard.style.boxShadow = '0 4px 24px rgba(0,0,0,0.08)';
        uploaderCard.style.borderRadius = '16px';
        uploaderCard.style.background = '#fff';
        uploaderCard.style.padding = '2.5em 2em';
        document.body.innerHTML = '';
        document.body.appendChild(uploaderCard);
    }
    let configDiv = document.getElementById('uploadConfig');
    if (!configDiv) {
        configDiv = document.createElement('div');
        configDiv.id = 'uploadConfig';
        configDiv.style.display = 'flex';
        configDiv.style.flexDirection = 'row';
        configDiv.style.alignItems = 'center';
        configDiv.style.justifyContent = 'center';
        configDiv.style.gap = '2em';
        configDiv.style.marginBottom = '1.5em';
        configDiv.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:flex-start;">
                <label style="font-weight:500">Chunk Size (MB)<br>
                    <input type="number" id="chunkSizeInput" value="${CHUNK_SIZE / (1024 * 1024)}" min="1" max="100" style="width:120px;padding:0.5em;border-radius:6px;border:1px solid #d0d7de;" />
                </label>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-start;">
                <label style="font-weight:500">Concurrency<br>
                    <input type="number" id="concurrencyInput" value="${CONCURRENCY}" min="1" max="10" style="width:120px;padding:0.5em;border-radius:6px;border:1px solid #d0d7de;" />
                </label>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-start;">
                <label style="font-weight:500">Max Retries<br>
                    <input type="number" id="maxRetriesInput" value="${MAX_RETRIES}" min="1" max="10" style="width:120px;padding:0.5em;border-radius:6px;border:1px solid #d0d7de;" />
                </label>
            </div>
        `;
        uploaderCard.appendChild(configDiv);
        document.getElementById('chunkSizeInput').addEventListener('change', e => {
            CHUNK_SIZE = parseInt(e.target.value) * 1024 * 1024;
        });
        document.getElementById('concurrencyInput').addEventListener('change', e => {
            CONCURRENCY = parseInt(e.target.value);
        });
        document.getElementById('maxRetriesInput').addEventListener('change', e => {
            MAX_RETRIES = parseInt(e.target.value);
        });
    }
    let fileInput = document.getElementById('fileInput');
    if (!fileInput) {
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'fileInput';
        fileInput.multiple = true;
        fileInput.className = 'file-input';
        fileInput.style.margin = '1.5em 0';
        uploaderCard.appendChild(fileInput);
    }
    fileInput.disabled = false;
    fileInput.value = '';
    fileInput.onchange = function (e) {
        let fileList = document.getElementById('fileList');
        let errorDiv = document.getElementById('mainError');
        // Remove fileList.innerHTML = '' to preserve all file cards
        if (errorDiv) {
            errorDiv.textContent = '';
            errorDiv.style.display = 'none';
        }
        const files = Array.from(e.target.files);
        files.forEach(file => {
            setStatus('Waiting...', undefined, file.name);
            uploadFile(file);
        });
    };
}

function setProgress(percent, text, speed, eta, chunkStatus, fileId, fileName) {
    let container = document.getElementById('fileList');
    if (!container) {
        container = document.createElement('div');
        container.id = 'fileList';
        document.querySelector('.container').appendChild(container);
    }
    let fileCard = document.getElementById('fileCard_' + fileId);
    if (!fileCard) {
        fileCard = document.createElement('div');
        fileCard.id = 'fileCard_' + fileId;
        fileCard.className = 'file-card';
        fileCard.style.display = 'flex';
        fileCard.style.flexDirection = 'column';
        fileCard.style.gap = '0.5em';
        fileCard.style.background = '#f6f8fa';
        fileCard.style.borderRadius = '10px';
        fileCard.style.padding = '1.2em 1em';
        fileCard.style.marginBottom = '1.2em';
        fileCard.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
        container.appendChild(fileCard);
    }
    let nameLabel = document.getElementById('fileName_' + fileId);
    if (!nameLabel) {
        nameLabel = document.createElement('div');
        nameLabel.id = 'fileName_' + fileId;
        nameLabel.style.fontWeight = '600';
        nameLabel.style.fontSize = '1.08em';
        nameLabel.style.color = '#1976d2';
        fileCard.appendChild(nameLabel);
    }
    nameLabel.textContent = fileName || fileId;
    let bar = document.getElementById('uploadProgress_' + fileId);
    if (!bar) {
        bar = document.createElement('progress');
        bar.id = 'uploadProgress_' + fileId;
        bar.max = 100;
        bar.style.width = '100%';
        bar.style.height = '18px';
        bar.style.marginBottom = '0.5em';
        fileCard.appendChild(bar);
    }
    bar.value = percent;
    let label = document.getElementById('progressLabel_' + fileId);
    if (!label) {
        label = document.createElement('div');
        label.id = 'progressLabel_' + fileId;
        label.style.fontSize = '0.98em';
        label.style.color = '#555';
        label.style.marginBottom = '0.5em';
        fileCard.appendChild(label);
    }
    let details = `${percent.toFixed(1)}%`;
    if (speed !== undefined && eta !== undefined && percent < 100) {
        details += ` | Speed: ${speed} MB/s | ETA: ${eta}s`;
    }
    label.textContent = details;
    let statusMsg = document.getElementById('fileStatus_' + fileId);
    if (!statusMsg) {
        statusMsg = document.createElement('div');
        statusMsg.id = 'fileStatus_' + fileId;
        statusMsg.style.fontSize = '0.98em';
        statusMsg.style.fontWeight = '500';
        statusMsg.style.marginBottom = '0.5em';
        fileCard.appendChild(statusMsg);
    }
    if (percent === 100) {
        statusMsg.textContent = 'Upload complete';
        statusMsg.style.color = '#388e3c';
    } else if (details.toLowerCase().includes('failed')) {
        statusMsg.textContent = 'Upload failed';
        statusMsg.style.color = '#d32f2f';
    } else {
        statusMsg.textContent = 'Uploading...';
        statusMsg.style.color = '#1976d2';
    }
    // Controls (pause/abort) inside file card
    let controlsDiv = document.getElementById('fileControls_' + fileId);
    if (!controlsDiv) {
        controlsDiv = document.createElement('div');
        controlsDiv.id = 'fileControls_' + fileId;
        controlsDiv.style.display = 'flex';
        controlsDiv.style.gap = '1em';
        controlsDiv.style.marginTop = '0.5em';
        fileCard.appendChild(controlsDiv);
        // Pause button
        let pauseBtn = document.createElement('button');
        pauseBtn.id = 'pauseBtn_' + fileId;
        pauseBtn.textContent = 'Pause';
        pauseBtn.className = 'upload-btn';
        pauseBtn.style.background = '#1976d2';
        pauseBtn.style.color = '#fff';
        pauseBtn.style.border = 'none';
        pauseBtn.style.borderRadius = '6px';
        pauseBtn.style.padding = '0.5em 1.2em';
        pauseBtn.style.fontWeight = '500';
        pauseBtn.style.cursor = 'pointer';
        controlsDiv.appendChild(pauseBtn);
        pauseBtn.onclick = function () {
            window.fileUploadStates = window.fileUploadStates || {};
            window.fileUploadStates[fileId] = window.fileUploadStates[fileId] || {};
            let state = window.fileUploadStates[fileId];
            state.isPaused = !state.isPaused;
            pauseBtn.textContent = state.isPaused ? 'Resume' : 'Pause';
            // You need to handle pausing/resuming in your upload logic using state.isPaused
        };
        // Abort button
        let abortBtn = document.createElement('button');
        abortBtn.id = 'abortBtn_' + fileId;
        abortBtn.textContent = 'Abort';
        abortBtn.className = 'upload-btn';
        abortBtn.style.background = '#d32f2f';
        abortBtn.style.color = '#fff';
        abortBtn.style.border = 'none';
        abortBtn.style.borderRadius = '6px';
        abortBtn.style.padding = '0.5em 1.2em';
        abortBtn.style.fontWeight = '500';
        abortBtn.style.cursor = 'pointer';
        controlsDiv.appendChild(abortBtn);
        abortBtn.onclick = function () {
            window.fileUploadStates = window.fileUploadStates || {};
            window.fileUploadStates[fileId] = window.fileUploadStates[fileId] || {};
            let state = window.fileUploadStates[fileId];
            state.isAborted = true;
            setStatus('Upload aborted by user.', undefined, fileId);
            // You need to handle aborting in your upload logic using state.isAborted
        };
    }
    // Update button states
    let pauseBtn = document.getElementById('pauseBtn_' + fileId);
    let abortBtn = document.getElementById('abortBtn_' + fileId);
    if (pauseBtn) pauseBtn.disabled = percent === 100;
    if (abortBtn) abortBtn.disabled = percent === 100;
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.disabled = percent < 100;
}

function setStatus(text, errorDetails, fileId) {
    let statusMsg = document.getElementById('fileStatus_' + fileId);
    if (statusMsg) {
        // Show only a crisp, user-friendly error message
        if (text && text.toLowerCase().includes('failed')) {
            let reason = 'Upload failed.';
            const match = text.match(/Chunk \d+ failed: ([^\n]+)/);
            if (match && match[1]) reason = `Upload failed: ${match[1]}`;
            statusMsg.textContent = reason;
            statusMsg.style.color = '#d32f2f';
        } else if (text && text.toLowerCase().includes('aborted')) {
            statusMsg.textContent = 'Upload aborted.';
            statusMsg.style.color = '#d32f2f';
        } else if (text && text.toLowerCase().includes('only .zip files are allowed')) {
            statusMsg.textContent = 'Only .zip files are allowed.';
            statusMsg.style.color = '#d32f2f';
        } else if (text && text.toLowerCase().includes('file is too large')) {
            statusMsg.textContent = 'File is too large.';
            statusMsg.style.color = '#d32f2f';
        } else {
            statusMsg.textContent = text || '';
            statusMsg.style.color = '#1976d2';
        }
    }
    // Hide technical error details from UI
    let errorDiv = document.getElementById('mainError');
    if (errorDiv) {
        errorDiv.textContent = '';
        errorDiv.style.display = 'none';
    }
}

async function hashChunk(chunkOrBuffer) {
    let buffer;
    if (chunkOrBuffer instanceof ArrayBuffer) {
        buffer = chunkOrBuffer;
    } else if (chunkOrBuffer instanceof Blob) {
        buffer = await chunkOrBuffer.arrayBuffer();
    } else if (chunkOrBuffer && chunkOrBuffer.buffer instanceof ArrayBuffer) {
        buffer = chunkOrBuffer.buffer;
    } else if (chunkOrBuffer instanceof Uint8Array) {
        buffer = chunkOrBuffer.buffer;
    } else {
        throw new Error('Invalid chunk type for hashing');
    }
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function uploadFile(file) {
    addConfigControls();
    (async () => {
        let fileId;
        try {
            fileId = await hashChunk(file.slice(0, CHUNK_SIZE));
        } catch {
            fileId = file.name;
        }
        setProgress(0, '', undefined, undefined, [], fileId, file.name);
        // Per-file state
        window.fileUploadStates = window.fileUploadStates || {};
        window.fileUploadStates[fileId] = { isPaused: false, isAborted: false };
        // Show error status in file card for invalid extension or size
        if (!file.name.endsWith('.zip')) {
            setStatus('Only .zip files are allowed!', '', fileId);
            return;
        }
        if (file.size > 100 * 1024 * 1024 * 1024) {
            setStatus('File is too large!', '', fileId);
            return;
        }
        setStatus('Preparing upload...', undefined, fileId);
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        let uploadedChunks = new Set();
        let persisted = localStorage.getItem('upload_' + fileId);
        if (persisted) {
            try {
                let arr = JSON.parse(persisted);
                if (Array.isArray(arr)) uploadedChunks = new Set(arr);
            } catch { }
        }
        try {
            const resp = await fetch(`/FileUploadHandler.ashx?action=chunks&fileId=${encodeURIComponent(fileId)}`);
            if (resp.ok) {
                const arr = await resp.json();
                if (Array.isArray(arr)) {
                    uploadedChunks = new Set(arr);
                }
            }
        } catch (e) {
            setStatus('Could not check uploaded chunks. Starting from scratch.', (e && e.message) ? e.message.split('\n')[0] : '', fileId);
        }
        let queue = [];
        for (let i = 0; i < totalChunks; i++) {
            if (!uploadedChunks.has(i)) queue.push(i);
        }
        let completed = uploadedChunks.size;
        let failedChunks = [];
        let chunkStatus = Array(totalChunks).fill('pending');
        for (let idx of uploadedChunks) chunkStatus[idx] = 'uploaded';
        let startTime = Date.now();
        let bytesUploaded = completed * CHUNK_SIZE;
        async function uploadChunk(i) {
            let attempts = 0;
            let delay = 1000;
            while (attempts < MAX_RETRIES) {
                const state = window.fileUploadStates[fileId];
                if (state.isAborted) throw new Error('Upload aborted');
                if (state.isPaused) {
                    setStatus('Upload paused.', undefined, fileId);
                    await new Promise(res => {
                        let interval = setInterval(() => {
                            if (!state.isPaused) {
                                clearInterval(interval);
                                res();
                            }
                        }, 500);
                    });
                }
                try {
                    const start = i * CHUNK_SIZE;
                    const end = Math.min(file.size, start + CHUNK_SIZE);
                    const chunk = await file.slice(start, end).arrayBuffer();
                    const chunkHash = await hashChunk(chunk);
                    const formData = new FormData();
                    formData.append('fileId', fileId);
                    formData.append('chunkIndex', i);
                    formData.append('totalChunks', totalChunks);
                    formData.append('chunkHash', chunkHash);
                    formData.append('fileName', file.name);
                    formData.append('chunk', new Blob([chunk]));
                    const response = await fetch('/FileUploadHandler.ashx?action=upload', {
                        method: 'POST',
                        body: formData
                    });
                    if (!response.ok) {
                        let errText = await response.text();
                        throw new Error(`Chunk ${i} failed: ${errText}`);
                    }
                    chunkStatus[i] = 'uploaded';
                    completed++;
                    bytesUploaded += (end - start);
                    let elapsed = (Date.now() - startTime) / 1000;
                    let speed = (bytesUploaded / 1024 / 1024 / elapsed).toFixed(2);
                    let eta = ((file.size - bytesUploaded) / 1024 / 1024 / speed).toFixed(0);
                    setProgress(Math.round((completed / totalChunks) * 100), `Chunk ${i + 1}/${totalChunks} uploaded`, speed, eta, chunkStatus, fileId, file.name);
                    localStorage.setItem('upload_' + fileId, JSON.stringify(chunkStatus.map((s, idx) => s === 'uploaded' ? idx : null).filter(x => x !== null)));
                    if (throttleMs > 0) await new Promise(res => setTimeout(res, throttleMs));
                    return i;
                } catch (err) {
                    attempts++;
                    chunkStatus[i] = 'failed';
                    setStatus(`Chunk ${i} failed (attempt ${attempts}): Upload failed.`, '', fileId);
                    if (attempts >= MAX_RETRIES) {
                        failedChunks.push(i);
                        console.error(`Chunk ${i} failed after ${MAX_RETRIES} attempts:`, err);
                        return null;
                    }
                    await new Promise(res => setTimeout(res, delay));
                    delay *= 2;
                }
            }
        }
        async function runQueue() {
            let running = new Set();
            let next = () => queue.length > 0 ? queue.shift() : null;
            let retryCount = 0;
            let maxTotalRetries = 2;
            while ((queue.length > 0 || running.size > 0) && !window.fileUploadStates[fileId].isAborted) {
                while (running.size < CONCURRENCY && queue.length > 0) {
                    const i = next();
                    if (i !== null) {
                        const p = uploadChunk(i).then(idx => running.delete(p));
                        running.add(p);
                    }
                }
                if (running.size > 0) await Promise.race(Array.from(running));
            }
            if (window.fileUploadStates[fileId].isAborted) {
                setStatus('Upload aborted.', undefined, fileId);
                cleanupUI(fileId);
                return;
            }
            if (failedChunks.length > 0) {
                if (retryCount < maxTotalRetries) {
                    retryCount++;
                    setStatus(`Upload finished with errors. Retrying failed chunks: ${failedChunks.join(', ')}`, undefined, fileId);
                    queue = failedChunks.slice();
                    failedChunks = [];
                    await runQueue();
                    return;
                } else {
                    setStatus(`Upload failed. The following chunks could not be uploaded after all retries: ${failedChunks.join(', ')}`, undefined, fileId);
                    setProgress(Math.round((completed / totalChunks) * 100), 'Upload failed.', undefined, undefined, chunkStatus, fileId, file.name);
                    cleanupUI(fileId);
                    return;
                }
            }
            setProgress(100, 'Upload complete!', undefined, undefined, chunkStatus, fileId, file.name);
            setStatus('Upload complete! Verifying file...', undefined, fileId);
            try {
                const resp = await fetch(`/FileUploadHandler.ashx?action=verify&fileId=${encodeURIComponent(fileId)}`);
                if (resp.ok) {
                    const { hash: serverHash } = await resp.json();
                    const clientHash = await hashChunk(await file.arrayBuffer());
                    if (serverHash && clientHash && serverHash === clientHash) {
                        setStatus('File integrity verified!', undefined, fileId);
                    } else {
                        setStatus('File uploaded, but integrity check failed!', undefined, fileId);
                    }
                } else {
                    setStatus('File uploaded, but could not verify integrity.', undefined, fileId);
                }
            } catch (e) {
                setStatus('File uploaded, but verification failed.', '', fileId);
            }
            cleanupUI(fileId);
            localStorage.removeItem('upload_' + fileId);
        }
        function cleanupUI(fileId) {
            const fileInput = document.getElementById('fileInput');
            if (fileInput) fileInput.disabled = false;
            const controlsDiv = document.getElementById('fileControls_' + fileId);
            if (controlsDiv) {
                const pauseBtn = document.getElementById('pauseBtn_' + fileId);
                if (pauseBtn) pauseBtn.disabled = true;
                const abortBtn = document.getElementById('abortBtn_' + fileId);
                if (abortBtn) abortBtn.disabled = true;
            }
        }
        runQueue();
    })();
}

function startUpload() {
	const fileInput = document.getElementById('fileInput');
	const files = Array.from(fileInput.files);
	Promise.all(files.map(file => uploadFile(file)));
}

document.getElementById('fileInput').addEventListener('change', function (e) {
	const files = Array.from(e.target.files);
	Promise.all(files.map(file => uploadFile(file)));
});
