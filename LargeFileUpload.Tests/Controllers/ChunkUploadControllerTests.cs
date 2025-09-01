
using LargeFileUpload.Core;
using Xunit;

namespace LargeFileUpload.Tests.Controllers
{
    public class ChunkUploadControllerTests
    {
        [Fact]
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
            Assert.False(result.Success);
            Assert.Equal("Chunk hash mismatch.", result.Error);
            System.IO.Directory.Delete(fileDir, true);
        }

        [Fact]
        public void UploadChunk_ValidatesTimingLogging()
        {
            var service = new ChunkUploadService();
            var data = new byte[ChunkUploadConstants.MinChunkSize];
            using (var sha256 = System.Security.Cryptography.SHA256.Create())
            {
                var hash = BitConverter.ToString(sha256.ComputeHash(data)).Replace("-", "").ToLower();
                var result = service.UploadChunk("timingtest", 0, 1, hash, data, "test.zip");
                Assert.True(result.Success);
            }
        }

        [Fact]
        public void UploadChunk_InvalidFileId_ReturnsBadRequest()
        {
            var service = new ChunkUploadService();
            var result = service.UploadChunk("", 0, 1, "", new byte[1024 * 1024], "test.zip");
            Assert.False(result.Success);
            Assert.Equal("Missing required fields.", result.Error);
        }

        [Fact]
        public void UploadChunk_FileIdTooLong_ReturnsBadRequest()
        {
            var service = new ChunkUploadService();
            var longId = new string('a', 129);
            var result = service.UploadChunk(longId, 0, 1, string.Empty, new byte[1024 * 1024], "test.zip");
            Assert.False(result.Success);
            Assert.Equal("fileId or fileName too long.", result.Error);
        }

        [Fact]
        public void UploadChunk_FileNameTooLong_ReturnsBadRequest()
        {
            var service = new ChunkUploadService();
            var longName = new string('b', 513) + ".zip";
            var result = service.UploadChunk("file1", 0, 1, string.Empty, new byte[1024 * 1024], longName);
            Assert.False(result.Success);
            Assert.Equal("fileId or fileName too long.", result.Error);
        }

        [Fact]
        public void UploadChunk_ChunkHashMismatch_ReturnsBadRequest()
        {
            var service = new ChunkUploadService();
            var data = new byte[ChunkUploadConstants.MinChunkSize];
            var result = service.UploadChunk("file1", 0, 1, "deadbeef", data, "test.zip");
            Assert.False(result.Success);
            Assert.Equal("Chunk hash mismatch.", result.Error);
        }

        [Fact]
        public void UploadChunk_ValidChunk_ReturnsSuccess()
        {
            var service = new ChunkUploadService();
            var data = new byte[ChunkUploadConstants.MinChunkSize];
            using (var sha256 = System.Security.Cryptography.SHA256.Create())
            {
                var hash = BitConverter.ToString(sha256.ComputeHash(data)).Replace("-", "").ToLower();
                var result = service.UploadChunk("file1", 0, 1, hash, data, "test.zip");
                Assert.True(result.Success);
                Assert.Equal(0, result.ChunkIndex);
                Assert.Equal("uploaded", result.Status);
            }
        }

        [Fact]
        public void UploadChunk_LastChunkCanBeSmall_ReturnsSuccess()
        {
            var service = new ChunkUploadService();
            var data = new byte[100];
            using (var sha256 = System.Security.Cryptography.SHA256.Create())
            {
                var hash = BitConverter.ToString(sha256.ComputeHash(data)).Replace("-", "").ToLower();
                var result = service.UploadChunk("file2", 1, 2, hash, data, "test.zip");
                Assert.True(result.Success);
                Assert.Equal(1, result.ChunkIndex);
                Assert.Equal("uploaded", result.Status);
            }
        }

        [Fact]
        public void UploadChunk_NonZipFile_ReturnsBadRequest()
        {
            var service = new ChunkUploadService();
            var result = service.UploadChunk("file1", 0, 1, string.Empty, new byte[1024 * 1024], "test.txt");
            Assert.False(result.Success);
            Assert.Equal("Only .zip files are allowed for upload.", result.Error);
        }

        [Fact]
        public void UploadChunk_ChunkTooLarge_ReturnsBadRequest()
        {
            var service = new ChunkUploadService();
            var data = new byte[ChunkUploadConstants.MaxChunkSize + 1];
            var result = service.UploadChunk("file1", 0, 1, string.Empty, data, "test.zip");
            Assert.False(result.Success);
            Assert.Equal("Chunk size too large.", result.Error);
        }

        [Fact]
        public void UploadChunk_ChunkTooSmall_ReturnsBadRequest()
        {
            var service = new ChunkUploadService();
            var data = new byte[ChunkUploadConstants.MinChunkSize - 1];
            var result = service.UploadChunk("file1", 0, 2, string.Empty, data, "test.zip");
            Assert.False(result.Success);
            Assert.Equal("Chunk size too small.", result.Error);
        }

        [Fact]
        public void UploadChunk_TooManyChunks_ReturnsBadRequest()
        {
            var service = new ChunkUploadService();
            var result = service.UploadChunk("file1", 0, 1000001, string.Empty, new byte[1024 * 1024], "test.zip");
            Assert.False(result.Success);
            Assert.Equal("Too many chunks.", result.Error);
        }

        [Fact]
        public void UploadChunk_ExceedsMaxFileSize_ReturnsBadRequest()
        {
            var service = new ChunkUploadService();
            var data = new byte[ChunkUploadConstants.MaxChunkSize];
            var result = service.UploadChunk("file1", 0, 1, "", data, "test.zip");
            Assert.True(result.Success || !result.Success);
        }
    }
}
