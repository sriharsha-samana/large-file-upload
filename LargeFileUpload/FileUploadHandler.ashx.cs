using System;
using System.Web;
using LargeFileUpload.Core;
using Newtonsoft.Json;

namespace LargeFileUpload.FileUploadHandler
{
    public class ChunkUploadHandler : IHttpHandler
    {
        public void ProcessRequest(HttpContext context)
        {
            string action = context.Request["action"] ?? context.Request.QueryString["action"];
            var service = new ChunkUploadService();
            context.Response.ContentType = "application/json";
            if (string.Equals(action, "upload", StringComparison.OrdinalIgnoreCase) && context.Request.HttpMethod == "POST")
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
                var result = service.UploadChunk(fileId, chunkIndex, totalChunks, chunkHash, chunkData, fileName);
                context.Response.Write(Newtonsoft.Json.JsonConvert.SerializeObject(result));
            }
            else if (string.Equals(action, "verify", StringComparison.OrdinalIgnoreCase) && (context.Request.HttpMethod == "GET" || context.Request.HttpMethod == "POST"))
            {
                string fileId = context.Request["fileId"] ?? context.Request.QueryString["fileId"];
                string fileName = context.Request["fileName"] ?? context.Request.QueryString["fileName"];
                var result = service.VerifyFile(fileId, fileName);
                context.Response.Write(Newtonsoft.Json.JsonConvert.SerializeObject(result));
            }
            else if (string.Equals(action, "chunks", StringComparison.OrdinalIgnoreCase) && context.Request.HttpMethod == "GET")
            {
                string fileId = context.Request["fileId"] ?? context.Request.QueryString["fileId"];
                var result = service.GetUploadedChunks(fileId); // Implement this method in your service
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
