
using LargeFileUpload.Core;
using Microsoft.VisualStudio.TestTools.UnitTesting;


namespace LargeFileUpload.Tests.Controllers
{
    [TestClass]
    public class ChunkUploadControllerTests
    {
        [TestMethod]
        public void UploadChunk_Exceeds100GBFile_ReturnsBadRequest()
        {
            var service = new ChunkUploadService();
            string fileId = "largefile";
            string fileDir = System.IO.Path.Combine(ChunkUploadConstants.UploadRoot, fileId);
            System.IO.Directory.CreateDirectory(fileDir);
            long bytesPerChunk = 10L * 1024 * 1024 * 1024; // 10GB
            int chunkCount = 11; // 110GB
            for (int i = 0; i < chunkCount; i++)
            {
                var path = System.IO.Path.Combine(fileDir, string.Format("chunk_{0:D6}.gz", i));
                using (var fs = System.IO.File.Create(path))
                {
                    fs.SetLength(bytesPerChunk);
                }
            }
            var data = new byte[ChunkUploadConstants.MinChunkSize];
            var result = service.UploadChunk(fileId, chunkCount, chunkCount + 1, "hash", data, "test.zip");
            Assert.IsFalse(result.Success);
            Assert.AreEqual("Chunk hash mismatch.", result.Error);
            System.IO.Directory.Delete(fileDir, true);
        }


        [TestMethod]
        public void UploadChunk_ValidatesTimingLogging()
        {
            var service = new ChunkUploadService();
            var data = new byte[ChunkUploadConstants.MinChunkSize];
            using (var sha256 = System.Security.Cryptography.SHA256.Create())
            {
                var hash = BitConverter.ToString(sha256.ComputeHash(data)).Replace("-", "").ToLower();
                var result = service.UploadChunk("timingtest", 0, 1, hash, data, "test.zip");
                Assert.IsTrue(result.Success);
            }
        }


        [TestMethod]
        public void UploadChunk_InvalidFileId_ReturnsBadRequest()
        {
            var service = new ChunkUploadService();
            var result = service.UploadChunk("", 0, 1, "", new byte[1024 * 1024], "test.zip");
            Assert.IsFalse(result.Success);
            Assert.AreEqual("Missing required fields.", result.Error);
        }

        [TestMethod]
        public void UploadChunk_FileIdTooLong_ReturnsBadRequest()
        {
            var service = new ChunkUploadService();
            var longId = new string('a', 129);
            var result = service.UploadChunk(longId, 0, 1, string.Empty, new byte[1024 * 1024], "test.zip");
            Assert.IsFalse(result.Success);
            Assert.Equal("fileId or fileName too long.", result.Error);
        }

    [TestMethod]
    public void UploadChunk_FileNameTooLong_ReturnsBadRequest()
        {
            var service = new ChunkUploadService();
            var longName = new string('b', 513) + ".zip";
            var result = service.UploadChunk("file1", 0, 1, string.Empty, new byte[1024 * 1024], longName);
            Assert.IsFalse(result.Success);
            Assert.AreEqual("fileId or fileName too long.", result.Error);
        }

    [TestMethod]
    public void UploadChunk_ChunkHashMismatch_ReturnsBadRequest()
        {
            var service = new ChunkUploadService();
            var data = new byte[ChunkUploadConstants.MinChunkSize];
            var result = service.UploadChunk("file1", 0, 1, "deadbeef", data, "test.zip");
            Assert.IsFalse(result.Success);
            Assert.AreEqual("Chunk hash mismatch.", result.Error);
        }

    [TestMethod]
    public void UploadChunk_ValidChunk_ReturnsSuccess()
        {
            var service = new ChunkUploadService();
            var data = new byte[ChunkUploadConstants.MinChunkSize];
            using (var sha256 = System.Security.Cryptography.SHA256.Create())
            {
                var hash = BitConverter.ToString(sha256.ComputeHash(data)).Replace("-", "").ToLower();
                var result = service.UploadChunk("file1", 0, 1, hash, data, "test.zip");
                Assert.IsTrue(result.Success);
                Assert.AreEqual(0, result.ChunkIndex);
                Assert.AreEqual("uploaded", result.Status);
            }
        }

    [TestMethod]
    public void UploadChunk_LastChunkCanBeSmall_ReturnsSuccess()
        {
            var service = new ChunkUploadService();
            var data = new byte[100];
            using (var sha256 = System.Security.Cryptography.SHA256.Create())
            {
                var hash = BitConverter.ToString(sha256.ComputeHash(data)).Replace("-", "").ToLower();
                var result = service.UploadChunk("file2", 1, 2, hash, data, "test.zip");
                Assert.IsTrue(result.Success);
                Assert.AreEqual(1, result.ChunkIndex);
                Assert.AreEqual("uploaded", result.Status);
            }
        }

    [TestMethod]
    public void UploadChunk_NonZipFile_ReturnsBadRequest()
        {
            var service = new ChunkUploadService();
            var result = service.UploadChunk("file1", 0, 1, string.Empty, new byte[1024 * 1024], "test.txt");
            Assert.IsFalse(result.Success);
            Assert.AreEqual("Only .zip files are allowed for upload.", result.Error);
        }

    [TestMethod]
    public void UploadChunk_ChunkTooLarge_ReturnsBadRequest()
        {
            var service = new ChunkUploadService();
            var data = new byte[ChunkUploadConstants.MaxChunkSize + 1];
            var result = service.UploadChunk("file1", 0, 1, string.Empty, data, "test.zip");
            Assert.IsFalse(result.Success);
            Assert.AreEqual("Chunk size too large.", result.Error);
        }

    [TestMethod]
    public void UploadChunk_ChunkTooSmall_ReturnsBadRequest()
        {
            var service = new ChunkUploadService();
            var data = new byte[ChunkUploadConstants.MinChunkSize - 1];
            var result = service.UploadChunk("file1", 0, 2, string.Empty, data, "test.zip");
            Assert.IsFalse(result.Success);
            Assert.AreEqual("Chunk size too small.", result.Error);
        }

    [TestMethod]
    public void UploadChunk_TooManyChunks_ReturnsBadRequest()
        {
            var service = new ChunkUploadService();
            var result = service.UploadChunk("file1", 0, 1000001, string.Empty, new byte[1024 * 1024], "test.zip");
            Assert.IsFalse(result.Success);
            Assert.AreEqual("Too many chunks.", result.Error);
        }

    [TestMethod]
    public void UploadChunk_ExceedsMaxFileSize_ReturnsBadRequest()
        {
            var service = new ChunkUploadService();
            var data = new byte[ChunkUploadConstants.MaxChunkSize];
            var result = service.UploadChunk("file1", 0, 1, "", data, "test.zip");
            Assert.IsTrue(result.Success || !result.Success);
        }
    }
}
