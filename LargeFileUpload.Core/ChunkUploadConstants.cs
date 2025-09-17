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
    }
}
