// Large File Upload Client (JavaScript)
// Assumes backend API is running at http://localhost:5000/api/upload/

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
const CONCURRENCY = 3;

const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const progressDiv = document.getElementById('progress');

function sha256(buffer) {
    // Browser crypto.subtle returns ArrayBuffer, convert to hex string
    return crypto.subtle.digest('SHA-256', buffer).then(hash => {
        return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    });
}

async function computeFileHash(file) {
    // For demo: read file in chunks and hash sequentially
    const chunkSize = 64 * 1024 * 1024; // 64MB
    const sha = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return Array.from(new Uint8Array(sha)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function initiateUpload(file, fileHash) {
    const res = await fetch('http://localhost:5000/api/upload/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            fileName: file.name,
            fileSize: file.size,
            fileHash: fileHash
        })
    });
    return res.json();
}

async function getUploadedChunks(uploadId) {
    const res = await fetch(`http://localhost:5000/api/upload/status/${uploadId}`);
    const data = await res.json();
    return (data.uploadedChunks || []).map(path => {
        const m = /chunk_(\d+)/.exec(path);
        return m ? parseInt(m[1], 10) : null;
    }).filter(idx => idx !== null);
}

async function uploadChunk(uploadId, chunkIndex, chunkData, chunkHash) {
    await fetch('http://localhost:5000/api/upload/chunk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            uploadId,
            chunkIndex,
            chunkData: Array.from(new Uint8Array(chunkData)),
            chunkHash
        })
    });
}

async function completeUpload(uploadId) {
    const res = await fetch('http://localhost:5000/api/upload/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId })
    });
    return res.json();
}

uploadBtn.onclick = async () => {
    const file = fileInput.files[0];
    if (!file) return alert('Please select a ZIP file.');
    progressDiv.textContent = 'Calculating file hash...';
    const fileHash = await computeFileHash(file);
    progressDiv.textContent = 'Initiating upload...';
    const { uploadId, instant, filePath } = await initiateUpload(file, fileHash);
    if (instant) {
        progressDiv.textContent = 'Instant upload! File already exists on server.';
        return;
    }
    // Get already uploaded chunks for resumable upload
    const uploadedChunks = new Set(await getUploadedChunks(uploadId));
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    let uploaded = uploadedChunks.size;
    progressDiv.textContent = `Uploading... (${uploaded}/${totalChunks})`;

    // Prepare chunk upload queue
    let queue = [];
    for (let i = 0; i < totalChunks; i++) {
        if (!uploadedChunks.has(i)) queue.push(i);
    }

    let active = 0;
    let next = 0;
    let errors = 0;

    async function uploadNext() {
        if (next >= queue.length) return;
        const idx = queue[next++];
        active++;
        const start = idx * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        const chunkBuffer = await chunk.arrayBuffer();
        const chunkHash = await sha256(chunkBuffer);
        try {
            await uploadChunk(uploadId, idx, chunkBuffer, chunkHash);
            uploaded++;
            progressDiv.textContent = `Uploading... (${uploaded}/${totalChunks})`;
        } catch (e) {
            errors++;
            queue.push(idx); // retry failed chunk
        }
        active--;
        if (next < queue.length) uploadNext();
    }

    // Start concurrent uploads
    for (let i = 0; i < CONCURRENCY && i < queue.length; i++) uploadNext();

    // Wait for all uploads to finish
    while (uploaded < totalChunks && errors < 10) {
        await new Promise(r => setTimeout(r, 500));
    }
    if (errors >= 10) {
        progressDiv.textContent = 'Upload failed after multiple retries.';
        return;
    }
    progressDiv.textContent = 'Finalizing upload...';
    const result = await completeUpload(uploadId);
    if (result.hashMatch) {
        progressDiv.textContent = 'Upload complete and verified!';
    } else {
        progressDiv.textContent = 'Upload complete, but hash mismatch!';
    }
};
