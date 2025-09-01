
using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Web.Http;
using LargeFileUpload.Backend.Storage;

namespace LargeFileUpload.Backend.Controllers
{

    public class UploadController : ApiController
    {
        private static readonly string StorageRoot = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "App_Data", "Uploads");
        private static readonly FileChunkStorageService StorageService = new FileChunkStorageService(StorageRoot);

        // POST api/upload/initiate
        [HttpPost]
        [Route("api/upload/initiate")]
        public IHttpActionResult InitiateUpload([FromBody] InitiateUploadRequest request)
        {
            string uploadId = !string.IsNullOrEmpty(request.FileHash) ? request.FileHash : Guid.NewGuid().ToString("N");
            string outputFile = Path.Combine(StorageRoot, uploadId + ".zip");
            if (!string.IsNullOrEmpty(request.FileHash) && System.IO.File.Exists(outputFile))
            {
                // Instant upload: file already exists
                return Ok(new { uploadId, instant = true, filePath = outputFile });
            }
            StorageService.CreateUploadSession(uploadId);
            // Save session metadata
            var meta = new UploadSessionMetadata
            {
                UploadId = uploadId,
                FileName = request.FileName,
                FileSize = request.FileSize,
                FileHash = request.FileHash,
                CreatedAt = DateTime.UtcNow,
                Completed = false
            };
            UploadSessionMetadataManager.SaveMetadata(StorageRoot, meta);
            return Ok(new { uploadId, instant = false });
        }

        // POST api/upload/chunk
        [HttpPost]
        [Route("api/upload/chunk")]
        public IHttpActionResult UploadChunk([FromBody] UploadChunkRequest request)
        {
            if (request.ChunkData == null || request.ChunkData.Length == 0)
                return BadRequest("Chunk data is empty");
            // Validate chunk hash if provided
            if (!string.IsNullOrEmpty(request.ChunkHash))
            {
                string computedHash = ComputeSHA256(request.ChunkData);
                if (!string.Equals(computedHash, request.ChunkHash, StringComparison.OrdinalIgnoreCase))
                {
                    return BadRequest("Chunk hash mismatch");
                }
            }
            StorageService.SaveChunk(request.UploadId, request.ChunkIndex, request.ChunkData);
            return Ok(new { status = "Chunk saved" });
        }
        private static string ComputeSHA256(byte[] data)
        {
            using (SHA256 sha = SHA256.Create())
            {
                byte[] hash = sha.ComputeHash(data);
                StringBuilder sb = new StringBuilder();
                foreach (byte b in hash)
                    sb.Append(b.ToString("x2"));
                return sb.ToString();
            }
        }

        // POST api/upload/complete
        [HttpPost]
        [Route("api/upload/complete")]
        public IHttpActionResult CompleteUpload([FromBody] CompleteUploadRequest request)
        {
            string sessionPath = Path.Combine(StorageRoot, request.UploadId);
            string outputFile = Path.Combine(StorageRoot, request.UploadId + ".zip");
            StorageService.AssembleChunks(request.UploadId, outputFile);
            // Validate final file hash if available
            var meta = UploadSessionMetadataManager.LoadMetadata(StorageRoot, request.UploadId);
            string finalHash = null;
            if (System.IO.File.Exists(outputFile))
            {
                using (var fs = System.IO.File.OpenRead(outputFile))
                {
                    finalHash = ComputeSHA256(fs);
                }
            }
            bool hashMatch = meta != null && !string.IsNullOrEmpty(meta.FileHash) && string.Equals(finalHash, meta.FileHash, StringComparison.OrdinalIgnoreCase);
            // Mark session as completed
            if (meta != null)
            {
                meta.Completed = true;
                UploadSessionMetadataManager.SaveMetadata(StorageRoot, meta);
            }
            return Ok(new { filePath = outputFile, finalHash, hashMatch });
        }
        private static string ComputeSHA256(Stream stream)
        {
            using (SHA256 sha = SHA256.Create())
            {
                byte[] hash = sha.ComputeHash(stream);
                StringBuilder sb = new StringBuilder();
                foreach (byte b in hash)
                    sb.Append(b.ToString("x2"));
                return sb.ToString();
            }
        }

        // GET api/upload/status/{uploadId}
        [HttpGet]
        [Route("api/upload/status/{uploadId}")]
        public IHttpActionResult GetUploadStatus(string uploadId)
        {
            var chunks = StorageService.ListChunks(uploadId);
            return Ok(new { uploadedChunks = chunks });
        }
    }

    // Request DTOs (to be expanded)
    public class InitiateUploadRequest
    {
        public string FileName { get; set; }
        public long FileSize { get; set; }
        public string FileHash { get; set; }
    }

    public class UploadChunkRequest
    {
        public string UploadId { get; set; }
        public int ChunkIndex { get; set; }
        public byte[] ChunkData { get; set; }
        public string ChunkHash { get; set; }
    }

    public class CompleteUploadRequest
    {
        public string UploadId { get; set; }
    }
}
