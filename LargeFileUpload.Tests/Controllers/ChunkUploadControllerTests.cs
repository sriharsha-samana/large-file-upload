
using System;
using LargeFileUpload.Core;
using Microsoft.VisualStudio.TestTools.UnitTesting;


namespace LargeFileUpload.Tests.Controllers
{
    [TestClass]
    public class ChunkUploadControllerTests
    {




        [TestMethod]
        public void UploadChunk_InvalidFileId_ReturnsBadRequest()
        {
            var service = new ChunkUploadService();
            var result = service.UploadChunk("", 0, 1, "", new byte[1024 * 1024], "test.zip");
            Assert.IsFalse(result.Success);
            Assert.AreEqual("Missing required fields.", result.Error);
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
        public void UploadChunk_TooManyChunks_ReturnsBadRequest()
        {
            var service = new ChunkUploadService();
            var result = service.UploadChunk("file1", 0, 1000001, string.Empty, new byte[1024 * 1024], "test.zip");
            Assert.IsFalse(result.Success);
            Assert.AreEqual("Too many chunks.", result.Error);
        }

        [TestMethod]
        public void UploadChunk_AnyFileTypeAndSize_ReturnsSuccess()
        {
            var service = new ChunkUploadService();
            var data = new byte[1];
            var result1 = service.UploadChunk("file1", 0, 1, "", data, "test.zip");
            var result2 = service.UploadChunk("file2", 0, 1, "", data, "test.txt");
            var result3 = service.UploadChunk("file3", 0, 1, "", new byte[100_000_000], "bigfile.bin");
            Assert.IsTrue(result1.Success);
            Assert.IsTrue(result2.Success);
            Assert.IsTrue(result3.Success);
        }
    }
}
