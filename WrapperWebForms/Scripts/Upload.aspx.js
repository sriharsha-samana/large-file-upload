// upload.aspx.js - Full-featured chunked upload for ASP.NET Web Forms (.ashx handler endpoints)
// Adapted from upload_old.js

let CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
let CONCURRENCY = 3;
let MAX_RETRIES = 3;
let isPaused = false;
let isAborted = false;
let throttleMs = 0;

function addConfigControls() {
	let configDiv = document.getElementById('uploadConfig');
	if (!configDiv) {
		configDiv = document.createElement('div');
		configDiv.id = 'uploadConfig';
		configDiv.innerHTML = `
			<label>Chunk Size (MB): <input type="number" id="chunkSizeInput" value="${CHUNK_SIZE / (1024 * 1024)}" min="1" max="100" /></label>
			<label>Concurrency: <input type="number" id="concurrencyInput" value="${CONCURRENCY}" min="1" max="10" /></label>
			<label>Max Retries: <input type="number" id="maxRetriesInput" value="${MAX_RETRIES}" min="1" max="10" /></label>
		`;
		document.body.insertBefore(configDiv, document.body.firstChild);
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
}

function setProgress(percent, text, speed, eta, chunkStatus, fileId) {
	let container = document.getElementById('fileProgressContainer');
	if (!container) {
		container = document.createElement('div');
		container.id = 'fileProgressContainer';
		document.body.appendChild(container);
	}
	let bar = document.getElementById('uploadProgress_' + fileId);
	if (!bar) {
		bar = document.createElement('progress');
		bar.id = 'uploadProgress_' + fileId;
		bar.max = 100;
		container.appendChild(bar);
	}
	bar.value = percent;
	let details = text || '';
	if (speed !== undefined && eta !== undefined) {
		details += ` | Speed: ${speed} MB/s | ETA: ${eta}s`;
	}
	bar.textContent = details;
	let label = document.getElementById('progressLabel_' + fileId);
	if (!label) {
		label = document.createElement('div');
		label.id = 'progressLabel_' + fileId;
		container.appendChild(label);
	}
	label.textContent = details;
	let chunkDiv = document.getElementById('chunkProgress_' + fileId);
	if (!chunkDiv) {
		chunkDiv = document.createElement('div');
		chunkDiv.id = 'chunkProgress_' + fileId;
		container.appendChild(chunkDiv);
	}
	if (chunkStatus) {
		chunkDiv.innerHTML = chunkStatus.map((s, i) => `<span style='color:${s==="uploaded"?"green":s==="failed"?"red":"gray"}'>${i+1}</span>`).join(' ');
	}
	const fileInput = document.getElementById('fileInput');
	if (fileInput) fileInput.disabled = percent < 100;
}

function addAbortButton() {
	let btn = document.getElementById('abortBtn');
	if (!btn) {
		btn = document.createElement('button');
		btn.id = 'abortBtn';
		btn.textContent = 'Abort';
		document.body.appendChild(btn);
	}
	btn.onclick = function() {
		isAborted = true;
		setStatus('Upload aborted by user.');
		const fileInput = document.getElementById('fileInput');
		if (fileInput) fileInput.disabled = false;
	};
}

function setStatus(text, errorDetails, fileId) {
	let container = document.getElementById('fileProgressContainer');
	if (!container) {
		container = document.createElement('div');
		container.id = 'fileProgressContainer';
		document.body.appendChild(container);
	}
	let status = document.getElementById('uploadStatus_' + fileId);
	if (!status) {
		status = document.createElement('div');
		status.id = 'uploadStatus_' + fileId;
		container.appendChild(status);
	}
	status.textContent = text;
	if (errorDetails) {
		let errDiv = document.getElementById('errorDetails_' + fileId);
		if (!errDiv) {
			errDiv = document.createElement('div');
			errDiv.id = 'errorDetails_' + fileId;
			errDiv.style.color = 'red';
			container.appendChild(errDiv);
		}
		errDiv.textContent = errorDetails;
	} else {
		let errDiv = document.getElementById('errorDetails_' + fileId);
		if (errDiv) errDiv.textContent = '';
	}
}

function addPauseResumeButton(uploadFn) {
	let btn = document.getElementById('pauseResumeBtn');
	if (!btn) {
		btn = document.createElement('button');
		btn.id = 'pauseResumeBtn';
		btn.textContent = 'Pause';
		document.body.appendChild(btn);
	}
	btn.onclick = function() {
		isPaused = !isPaused;
		btn.textContent = isPaused ? 'Resume' : 'Pause';
		if (!isPaused) uploadFn();
	};
	btn.disabled = false;
}

async function hashChunk(chunk) {
	const hashBuffer = await crypto.subtle.digest('SHA-256', chunk);
	return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function uploadFile(file) {
	addConfigControls();
	if (!file.name.endsWith('.zip')) {
		setStatus('Only .zip files are allowed!', undefined, file.name);
		return;
	}
	if (file.size > 100 * 1024 * 1024 * 1024) {
		setStatus('File is too large!', undefined, file.name);
		return;
	}
	setStatus('Preparing upload...', undefined, file.name);
	isAborted = false;
	const fileId = await hashChunk(await file.slice(0, CHUNK_SIZE).arrayBuffer());
	const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
	let uploadedChunks = new Set();

	let persisted = localStorage.getItem('upload_' + fileId);
	if (persisted) {
		try {
			let arr = JSON.parse(persisted);
			if (Array.isArray(arr)) uploadedChunks = new Set(arr);
		} catch {}
	}

	// Fetch uploaded chunks from .ashx handler for resumable support
	try {
		const resp = await fetch(`Handlers/ChunkUploadHandler.ashx?action=chunks&fileId=${encodeURIComponent(fileId)}`);
		if (resp.ok) {
			const arr = await resp.json();
			if (Array.isArray(arr)) {
				uploadedChunks = new Set(arr);
			}
		}
	} catch (e) {
		setStatus('Could not check uploaded chunks. Starting from scratch.', e.message, fileId);
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

	addPauseResumeButton(() => runQueue());
	addAbortButton();

	async function uploadChunk(i) {
		let attempts = 0;
		let delay = 1000;
		while (attempts < MAX_RETRIES) {
			if (isAborted) throw new Error('Upload aborted');
			if (isPaused) {
				setStatus('Upload paused.', undefined, fileId);
				await new Promise(res => {
					let interval = setInterval(() => {
						if (!isPaused) {
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
				const response = await fetch('Handlers/ChunkUploadHandler.ashx?action=upload', {
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
				setProgress(Math.round((completed / totalChunks) * 100), `Chunk ${i + 1}/${totalChunks} uploaded`, speed, eta, chunkStatus, fileId);
				localStorage.setItem('upload_' + fileId, JSON.stringify(chunkStatus.map((s, idx) => s === 'uploaded' ? idx : null).filter(x => x !== null)));
				if (throttleMs > 0) await new Promise(res => setTimeout(res, throttleMs));
				return i;
			} catch (err) {
				attempts++;
				chunkStatus[i] = 'failed';
				setStatus(`Chunk ${i} failed (attempt ${attempts}): ${err.message}`, err.stack, fileId);
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
		while ((queue.length > 0 || running.size > 0) && !isAborted) {
			while (running.size < CONCURRENCY && queue.length > 0) {
				const i = next();
				if (i !== null) {
					const p = uploadChunk(i).then(idx => running.delete(p));
					running.add(p);
				}
			}
			if (running.size > 0) await Promise.race(Array.from(running));
		}
		if (isAborted) {
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
				setProgress(Math.round((completed / totalChunks) * 100), 'Upload failed', undefined, undefined, chunkStatus, fileId);
				cleanupUI(fileId);
				return;
			}
		}
		setProgress(100, 'Upload complete!', undefined, undefined, chunkStatus, fileId);
		setStatus('Upload complete! Verifying file...', undefined, fileId);
		try {
			const resp = await fetch(`Handlers/ChunkUploadHandler.ashx?action=verify&fileId=${encodeURIComponent(fileId)}`);
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
			setStatus('File uploaded, but verification failed.', e.message, fileId);
		}
		cleanupUI(fileId);
		localStorage.removeItem('upload_' + fileId);
	}

	function cleanupUI(fileId) {
		const fileInput = document.getElementById('fileInput');
		if (fileInput) fileInput.disabled = false;
		const pauseBtn = document.getElementById('pauseResumeBtn');
		if (pauseBtn) pauseBtn.disabled = true;
		const abortBtn = document.getElementById('abortBtn');
		if (abortBtn) abortBtn.disabled = true;
	}

	runQueue();
}

function startUpload() {
	const fileInput = document.getElementById('fileInput');
	const files = Array.from(fileInput.files);
	Promise.all(files.map(file => uploadFile(file)));
}

document.getElementById('fileInput').addEventListener('change', function(e) {
	const files = Array.from(e.target.files);
	Promise.all(files.map(file => uploadFile(file)));
});
