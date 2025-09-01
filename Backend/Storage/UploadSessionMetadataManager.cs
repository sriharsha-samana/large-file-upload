using System;
using System.IO;
using System.Runtime.Serialization.Json;
using System.Text;

namespace LargeFileUpload.Backend.Storage
{
    public class UploadSessionMetadata
    {
        public string UploadId { get; set; }
        public string FileName { get; set; }
        public long FileSize { get; set; }
        public string FileHash { get; set; }
        public DateTime CreatedAt { get; set; }
        public bool Completed { get; set; }
    }

    public static class UploadSessionMetadataManager
    {
        public static string GetMetadataPath(string basePath, string uploadId)
        {
            return Path.Combine(basePath, uploadId, "session.json");
        }

        public static void SaveMetadata(string basePath, UploadSessionMetadata meta)
        {
            string path = GetMetadataPath(basePath, meta.UploadId);
            using (var fs = new FileStream(path, FileMode.Create, FileAccess.Write))
            {
                var ser = new DataContractJsonSerializer(typeof(UploadSessionMetadata));
                ser.WriteObject(fs, meta);
            }
        }

        public static UploadSessionMetadata LoadMetadata(string basePath, string uploadId)
        {
            string path = GetMetadataPath(basePath, uploadId);
            if (!File.Exists(path)) return null;
            using (var fs = new FileStream(path, FileMode.Open, FileAccess.Read))
            {
                var ser = new DataContractJsonSerializer(typeof(UploadSessionMetadata));
                return (UploadSessionMetadata)ser.ReadObject(fs);
            }
        }
    }
}
