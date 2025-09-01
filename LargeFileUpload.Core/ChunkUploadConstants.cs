using System;
using System.IO;

namespace LargeFileUpload.Core
{
    public static class ChunkUploadConstants
    {
        public static readonly string UploadRoot =
            !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("LARGEFILEUPLOAD_UPLOADROOT"))
                ? Environment.GetEnvironmentVariable("LARGEFILEUPLOAD_UPLOADROOT")
                : Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "App_Data", "Uploads");
        public const int MinChunkSize = 1 * 1024 * 1024;
        public const int MaxChunkSize = 100 * 1024 * 1024;
        public const long MaxFileSize = 100L * 1024 * 1024 * 1024;
    }
}
