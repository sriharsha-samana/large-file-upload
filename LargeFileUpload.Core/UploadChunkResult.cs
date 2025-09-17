namespace LargeFileUpload.Core
{
    public class UploadChunkResult
    {
        public bool Success { get; set; }
    public string Error { get; set; }
    public int? ChunkIndex { get; set; }
    public string Status { get; set; }
    }
}
