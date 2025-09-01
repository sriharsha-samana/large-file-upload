using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace LargeFileUpload.Backend.Storage
{
    public class FileChunkStorageService
    {
        private readonly string _basePath;
        public FileChunkStorageService(string basePath)
        {
            _basePath = basePath;
            if (!Directory.Exists(_basePath))
                Directory.CreateDirectory(_basePath);
        }

        public string CreateUploadSession(string uploadId)
        {
            string sessionPath = Path.Combine(_basePath, uploadId);
            Directory.CreateDirectory(sessionPath);
            return sessionPath;
        }

        public void SaveChunk(string uploadId, int chunkIndex, byte[] data)
        {
            string sessionPath = Path.Combine(_basePath, uploadId);
            if (!Directory.Exists(sessionPath))
                Directory.CreateDirectory(sessionPath);
            string chunkPath = Path.Combine(sessionPath, $"chunk_{chunkIndex:D6}");
            File.WriteAllBytes(chunkPath, data);
        }

        public byte[] GetChunk(string uploadId, int chunkIndex)
        {
            string chunkPath = Path.Combine(_basePath, uploadId, $"chunk_{chunkIndex:D6}");
            return File.Exists(chunkPath) ? File.ReadAllBytes(chunkPath) : null;
        }

        public List<string> ListChunks(string uploadId)
        {
            string sessionPath = Path.Combine(_basePath, uploadId);
            if (!Directory.Exists(sessionPath))
                return new List<string>();
            return Directory.GetFiles(sessionPath, "chunk_*").OrderBy(f => f).ToList();
        }

        public void AssembleChunks(string uploadId, string outputFilePath)
        {
            var chunkFiles = ListChunks(uploadId);
            using (var output = File.Create(outputFilePath))
            {
                foreach (var chunk in chunkFiles)
                {
                    var data = File.ReadAllBytes(chunk);
                    output.Write(data, 0, data.Length);
                }
            }
        }

        public void DeleteSession(string uploadId)
        {
            string sessionPath = Path.Combine(_basePath, uploadId);
            if (Directory.Exists(sessionPath))
                Directory.Delete(sessionPath, true);
        }
    }
}
