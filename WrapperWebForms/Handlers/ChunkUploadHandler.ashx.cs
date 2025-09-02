using System;
using System.Web;
using LargeFileUpload.Core;

namespace WrapperWebForms.Handlers
{
    public class ChunkUploadHandler : IHttpHandler
    {
        public void ProcessRequest(HttpContext context)
        {
            // Example: handle POST for chunk upload
            if (context.Request.HttpMethod == "POST")
            {
                string fileId = context.Request.Form["fileId"];
                int chunkIndex = int.TryParse(context.Request.Form["chunkIndex"], out var idx) ? idx : -1;
                int totalChunks = int.TryParse(context.Request.Form["totalChunks"], out var tc) ? tc : -1;
                string chunkHash = context.Request.Form["chunkHash"];
                string fileName = context.Request.Form["fileName"];
                byte[] chunkData = null;
                if (context.Request.Files.Count > 0)
                {
                    var file = context.Request.Files[0];
                    using (var ms = new System.IO.MemoryStream())
                    {
                        file.InputStream.CopyTo(ms);
                        chunkData = ms.ToArray();
                    }
                }
                else if (context.Request.InputStream != null)
                {
                    using (var ms = new System.IO.MemoryStream())
                    {
                        context.Request.InputStream.CopyTo(ms);
                        chunkData = ms.ToArray();
                    }
                }
                var service = new ChunkUploadService();
                var result = service.UploadChunk(fileId, chunkIndex, totalChunks, chunkHash, chunkData, fileName);
                context.Response.ContentType = "application/json";
                context.Response.Write(Newtonsoft.Json.JsonConvert.SerializeObject(result));
            }
            else
            {
                context.Response.StatusCode = 405;
                context.Response.Write("Method Not Allowed");
            }
        }

        public bool IsReusable { get { return false; } }
    }
}
