/**
 * Helper to get or create an element by id and class, and append to parent if created.
 * @param {string} id - The element id.
 * @param {string} tag - The tag name (e.g., 'div', 'progress').
 * @param {string} className - The class name(s) to assign.
 * @param {Element} parent - The parent to append to if created.
 * @returns {Element}
 */
function getOrCreateElem(id, tag, className, parent) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement(tag);
    el.id = id;
    if (className) el.className = className;
    if (parent) parent.appendChild(el);
  }
  return el;
}

// Large File Upload Client for ASP.NET Web Forms (.ashx handler endpoints)
//
// Upload Flow:
// 1. User selects one or more .zip files using the file input.
// 2. User clicks the Upload button to start uploading selected files.
// 3. Each file is split into chunks and uploaded sequentially/concurrently.
// 4. Progress and status are shown for each file.
// 5. After all chunks are uploaded, the server verifies file integrity.
// 6. The UI displays success or error messages for each file.
//
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB (default, not user-configurable)
const CONCURRENCY = 3; // default

function wireUploadEvents() {
  const input = document.getElementById("fileInput");
  const button = document.getElementById("uploadBtn");
  const list = document.getElementById("fileList");
  if (!input || !button || !list) return;
  input.disabled = false;
  input.value = "";
  // Reference global progress bar and label (assume present in HTML)
  const globalProgress = document.getElementById("globalProgress");
  const globalLabel = document.getElementById("globalProgressLabel");
  if (!globalProgress) {
    console.warn(
      'Global progress bar element with id "globalProgress" not found in the DOM. Global progress will not be shown.'
    );
  }
  if (!globalLabel) {
    console.warn(
      'Global progress label element with id "globalProgressLabel" not found in the DOM. Global progress label will not be shown.'
    );
  }
  input.onchange = function (e) {
    list.innerHTML = "";
    if (globalProgress) {
      globalProgress.value = 0;
      globalProgress.max = 100;
      globalProgress.style.display = "none";
    }
    if (globalLabel) {
      globalLabel.style.display = "none";
    }
  };

  button.onclick = async function () {
    const files = Array.from(input.files);
    if (!files.length) return;
    list.innerHTML = "";
    for (const file of files) {
      setStatus("Waiting...", file.name);
    }
    if (globalProgress) {
      globalProgress.value = 0;
      globalProgress.max = 100;
      globalProgress.style.display = "";
    }
    if (globalLabel) {
      globalLabel.textContent = "Uploading files...";
      globalLabel.style.display = "";
    }
    button.disabled = true;
    input.disabled = true;
    let completed = 0;
    const startTime = Date.now();
    for (const file of files) {
      await uploadFile(file);
      completed++;
      if (globalProgress)
        globalProgress.value = Math.round((completed / files.length) * 100);
      if (globalLabel)
        globalLabel.textContent = `Uploaded ${completed} of ${
          files.length
        } files (${globalProgress ? globalProgress.value : 0}%)`;
    }
    const totalTime = (Date.now() - startTime) / 1000;
    let timeStr = "";
    if (totalTime < 60) {
      timeStr = `${totalTime.toFixed(1)}s`;
    } else {
      const min = Math.floor(totalTime / 60);
      const sec = Math.round(totalTime % 60);
      timeStr = `${min}m ${sec}s`;
    }
    if (globalLabel)
      globalLabel.textContent = `All uploads complete! Total time: ${timeStr}`;
    setTimeout(() => {
      if (globalProgress) globalProgress.style.display = "none";
      if (globalLabel) globalLabel.style.display = "none";
      button.disabled = false;
      input.disabled = false;
    }, 3000);
  };
}

/**
 * Updates or creates the UI elements for a file's upload progress and status.
 * @param {number} percent - Upload progress percentage.
 * @param {number} speed - Upload speed in MB/s.
 * @param {number} eta - Estimated time remaining in seconds.
 * @param {string} fileId - Unique identifier for the file.
 * @param {string} fileName - Name of the file.
 */
function setProgress(percent, speed, eta, fileId, fileName) {
  const container = document.getElementById("fileList");
  const fileCard = getOrCreateElem(
    "fileCard_" + fileId,
    "div",
    "file-card",
    container
  );
  const nameLabel = getOrCreateElem(
    "fileName_" + fileId,
    "div",
    "file-name-label",
    fileCard
  );
  nameLabel.textContent = fileName || fileId;
  let bar = document.getElementById("uploadProgress_" + fileId);
  if (!bar) {
    bar = document.createElement("progress");
    bar.id = "uploadProgress_" + fileId;
    bar.max = 100;
    bar.className = "file-progress";
    fileCard.appendChild(bar);
  }
  bar.value = percent;
  const label = getOrCreateElem(
    "progressLabel_" + fileId,
    "div",
    "file-progress-label",
    fileCard
  );
  let details = `${percent.toFixed(1)}%`;
  if (speed !== undefined && eta !== undefined && percent < 100) {
    const etaSec = parseInt(eta, 10);
    let etaStr = "";
    if (isNaN(etaSec) || etaSec < 0) {
      etaStr = "calculating...";
    } else if (etaSec < 60) {
      etaStr = `${etaSec}s`;
    } else {
      const min = Math.floor(etaSec / 60);
      const sec = etaSec % 60;
      etaStr = `${min}m ${sec}s`;
    }
    details += ` | Speed: ${speed} MB/s | Remaining Time: ${etaStr}`;
  }
  label.textContent = details;
  const statusMsg = getOrCreateElem(
    "fileStatus_" + fileId,
    "div",
    "file-status-label",
    fileCard
  );
  if (percent === 100) {
    statusMsg.textContent = "Upload complete";
    statusMsg.style.color = "#388e3c";
  } else {
    statusMsg.textContent = "Uploading...";
    statusMsg.style.color = "#1976d2";
  }
  const fileInput = document.getElementById("fileInput");
  if (fileInput) fileInput.disabled = percent < 100;
}

/**
 * Updates the status message for a file in the UI.
 * @param {string} text - Status message to display.
 * @param {string} fileId - Unique identifier for the file.
 * @param {'info'|'error'|'success'} [type] - Status type for styling.
 */
function setStatus(text, fileId, type = "info") {
  let statusMsg = document.getElementById("fileStatus_" + fileId);
  if (statusMsg) {
    statusMsg.textContent = text || "";
    if (type === "error") {
      statusMsg.style.color = "#d32f2f";
    } else if (type === "success") {
      statusMsg.style.color = "#388e3c";
    } else {
      statusMsg.style.color = "#1976d2";
    }
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
    throw new Error("Invalid chunk type for hashing");
  }
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Handles the upload process for a single file, including chunking, progress, and verification.
 * @param {File} file - The file to upload.
 * @returns {Promise<void>} Resolves when upload and verification are complete.
 */
async function uploadFile(file) {
  // Use a UUID for fileId instead of a hash
  const fileId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now() + '_' + Math.random().toString(16).slice(2));
  setProgress(0, undefined, undefined, fileId, file.name);
  // Accept only files with a .zip extension (case-insensitive, not just ending with .zip)
  const zipPattern = /.zip$/i;
  if (!zipPattern.test(file.name)) {
    setStatus("Only .zip files are allowed!", fileId, "error");
    return;
  }
  if (file.size > 100 * 1024 * 1024 * 1024) {
    setStatus("File is too large!", fileId, "error");
    return;
  }
  setStatus("Preparing upload...", fileId, "info");
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  let uploadedChunks = new Set();
  try {
    const resp = await fetch(
      `/FileUploadHandler.ashx?action=chunks&fileId=${encodeURIComponent(
        fileId
      )}`
    );
    if (resp.ok) {
      const arr = await resp.json();
      if (Array.isArray(arr)) {
        uploadedChunks = new Set(arr);
      }
    }
  } catch (e) {
    setStatus(
      "Could not check uploaded chunks. Starting from scratch.",
      fileId,
      "error"
    );
  }
  let queue = [];
  for (let i = 0; i < totalChunks; i++) {
    if (!uploadedChunks.has(i)) queue.push(i);
  }
  let completed = uploadedChunks.size;
  let failedChunks = [];
  let chunkStatus = Array(totalChunks).fill("pending");
  for (let idx of uploadedChunks) chunkStatus[idx] = "uploaded";
  let startTime = Date.now();
  let bytesUploaded = completed * CHUNK_SIZE;
  async function uploadChunk(i) {
    try {
      const start = i * CHUNK_SIZE;
      const end = Math.min(file.size, start + CHUNK_SIZE);
      const chunk = await file.slice(start, end).arrayBuffer();
      const chunkHash = await hashChunk(chunk);
      const formData = new FormData();
      formData.append("fileId", fileId);
      formData.append("chunkIndex", i);
      formData.append("totalChunks", totalChunks);
      formData.append("chunkHash", chunkHash);
      formData.append("fileName", file.name);
      formData.append('chunk', new Blob([chunk]));
      const response = await fetch("/FileUploadHandler.ashx?action=upload", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        let errText = await response.text();
        throw new Error(`Chunk ${i} failed: ${errText}`);
      }
      chunkStatus[i] = "uploaded";
      completed++;
      bytesUploaded += end - start;
      let elapsed = (Date.now() - startTime) / 1000;
      let speedNum = bytesUploaded / 1024 / 1024 / elapsed;
      let speed = speedNum.toFixed(2);
      let eta =
        speedNum > 0 ? (file.size - bytesUploaded) / 1024 / 1024 / speedNum : 0;
      setProgress(
        Math.round((completed / totalChunks) * 100),
        speed,
        eta,
        fileId,
        file.name
      );
      return i;
    } catch (err) {
      chunkStatus[i] = "failed";
      setStatus(
        `Chunk ${i} failed: ${
          err && err.message ? err.message : "Upload failed."
        }`,
        fileId,
        "error"
      );
      failedChunks.push(i);
      console.error(`Chunk ${i} failed:`, err.message || err);
      return null;
    }
  }
  async function runQueue() {
    let running = new Set();
    let next = () => (queue.length > 0 ? queue.shift() : null);
    while (queue.length > 0 || running.size > 0) {
      while (running.size < CONCURRENCY && queue.length > 0) {
        const i = next();
        if (i !== null) {
          const p = uploadChunk(i);
          running.add(p);
        }
      }
      if (running.size > 0) {
        const finished = await Promise.race(Array.from(running));
        // Remove the finished promise from the set
        for (const p of running) {
          // Only remove the promise that resolved to finished
          // (since uploadChunk returns the chunk index or null)
          if (p instanceof Promise) {
            // We can't directly compare resolved value, so just remove the first finished
            running.delete(p);
            break;
          }
        }
      }
    }
    if (failedChunks.length > 0) {
      setStatus(
        "Upload failed. Some chunks could not be uploaded.",
        fileId,
        "error"
      );
      setProgress(
        Math.round((completed / totalChunks) * 100),
        undefined,
        undefined,
        fileId,
        file.name
      );
      cleanupUI();
      return;
    }
    setProgress(100, undefined, undefined, fileId, file.name);
    setStatus("Upload complete! Verifying file...", fileId, "info");
    // Poll verify endpoint until file is ready or error
    async function pollVerify(retries = 60, delayMs = 2000) {
      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          const resp = await fetch(
            `/FileUploadHandler.ashx?action=verify&fileId=${encodeURIComponent(fileId)}&fileName=${encodeURIComponent(file.name)}`
          );
          if (resp.ok) {
            const result = await resp.json();
            if (result && result.success) {
              setStatus("File integrity verified!", fileId, "success");
              cleanupUI();
              return;
            } else if (result && result.status === "reassembling") {
              setStatus("Server is finalizing file...", fileId, "info");
              await new Promise(r => setTimeout(r, delayMs));
              continue;
            } else {
              setStatus(
                result && result.error
                  ? `Verification failed: ${result.error}`
                  : "File uploaded, but integrity check failed!",
                fileId,
                "error"
              );
              cleanupUI();
              return;
            }
          } else {
            setStatus(
              "File uploaded, but could not verify integrity.",
              fileId,
              "error"
            );
            cleanupUI();
            return;
          }
        } catch (e) {
          setStatus("File uploaded, but verification failed.", fileId, "error");
          cleanupUI();
          return;
        }
      }
      setStatus("Verification timed out. Please try again.", fileId, "error");
      cleanupUI();
    }
    await pollVerify();
    // ...existing code...
  }
  function cleanupUI() {
    const fileInput = document.getElementById("fileInput");
    if (fileInput) fileInput.disabled = false;
  }
  await runQueue();
}

// Ensure controls are rendered on page load
window.addEventListener("DOMContentLoaded", wireUploadEvents);
