

		using System;
		using System.Collections.Generic;
		using System.IO;
		using System.Net;
		using System.Net.Http;
		using System.Net.Http.Headers;
		using System.Security.Cryptography;
		using System.Threading.Tasks;
		using System.Web.Http;
		using System.IO.Compression;

		namespace LargeFileUpload.Controllers
		{
			public class ChunkUploadController : ApiController
			{

				[HttpGet]
				[Route("api/upload/verify/{fileId}")]
				public IHttpActionResult VerifyFile(string fileId)
				{
					fileId = SanitizeId(fileId);
					if (string.IsNullOrEmpty(fileId))
						return BadRequest(new { error = "Missing or invalid fileId." });
					var filePath = System.IO.Path.Combine(LargeFileUpload.Core.ChunkUploadConstants.UploadRoot, fileId + ".complete");
					if (!System.IO.File.Exists(filePath))
						return NotFound();
					try
					{
						using (var stream = System.IO.File.OpenRead(filePath))
						using (var sha256 = System.Security.Cryptography.SHA256.Create())
						{
							var hash = sha256.ComputeHash(stream);
							var hashString = BitConverter.ToString(hash).Replace("-", "").ToLower();
							return Ok(new { hash = hashString });
						}
					}
					catch (Exception ex)
					{
						return InternalServerError(new Exception("Error verifying file: " + ex.Message));
					}
				}

		[HttpPost]
		[Route("api/upload/chunk")]
		public IHttpActionResult UploadChunk()
		{
			if (!Request.Content.IsMimeMultipartContent())
				return Content(HttpStatusCode.UnsupportedMediaType, new { error = "Unsupported media type." });

			var provider = new MultipartMemoryStreamProvider();
			Request.Content.ReadAsMultipartAsync(provider).Wait();

			string fileId = null;
			int chunkIndex = -1;
			int totalChunks = -1;
			string chunkHash = null;
			byte[] chunkData = null;
			string fileName = null;

			foreach (var content in provider.Contents)
			{
				var name = content.Headers.ContentDisposition.Name.Trim('"');
				if (name == "fileId")
					fileId = SanitizeId(content.ReadAsStringAsync().Result);
				else if (name == "chunkIndex")
					int.TryParse(content.ReadAsStringAsync().Result, out chunkIndex);
				else if (name == "totalChunks")
					int.TryParse(content.ReadAsStringAsync().Result, out totalChunks);
				else if (name == "chunkHash")
					chunkHash = content.ReadAsStringAsync().Result;
				else if (name == "fileName")
					fileName = SanitizeName(content.ReadAsStringAsync().Result);
				else if (name == "chunk")
					chunkData = content.ReadAsByteArrayAsync().Result;
			}

			if (string.IsNullOrEmpty(fileId) || string.IsNullOrEmpty(fileName) || chunkData == null)
				return BadRequest(new { error = "Missing required fields." });

			var service = new ChunkUploadService();
			var result = service.UploadChunk(fileId, chunkIndex, totalChunks, chunkHash, chunkData, fileName);
			if (!result.Success)
				return BadRequest(new { error = result.Error });
			return Ok(new { chunkIndex = result.ChunkIndex, status = result.Status });
		}

		[HttpGet]
		[Route("api/upload/chunks/{fileId}")]
		public IHttpActionResult GetUploadedChunks(string fileId)
		{
			fileId = SanitizeId(fileId);
			if (string.IsNullOrEmpty(fileId))
				return BadRequest(new { error = "Missing or invalid fileId." });
			var fileDir = System.IO.Path.Combine(LargeFileUpload.Core.ChunkUploadConstants.UploadRoot, fileId);
			if (!Directory.Exists(fileDir))
				return Ok(new int[0]);
			var files = Directory.GetFiles(fileDir, "chunk_*.gz");
			var indices = new List<int>();
			foreach (var file in files)
			{
				var name = Path.GetFileNameWithoutExtension(file); // chunk_000001
				if (name.StartsWith("chunk_"))
				{
					int idx;
					if (int.TryParse(name.Substring(6), out idx))
						indices.Add(idx);
				}
			}
			return Ok(indices);
		}

		[HttpDelete]
		[Route("api/upload/cleanup")]
		public IHttpActionResult CleanupOldUploads(int hours = 24)
		{
			var cutoff = DateTime.UtcNow.AddHours(-hours);
			int deleted = 0;
			var uploadRoot = LargeFileUpload.Core.ChunkUploadConstants.UploadRoot;
			if (Directory.Exists(uploadRoot))
			{
				foreach (var dir in Directory.GetDirectories(uploadRoot))
				{
					var lastWrite = Directory.GetLastWriteTimeUtc(dir);
					if (lastWrite < cutoff)
					{
						Directory.Delete(dir, true);
						deleted++;
					}
				}
			}
			return Ok(new { deleted });
		}

			// Utility: sanitize fileId to prevent path traversal
			private static string SanitizeId(string id)
			{
				if (string.IsNullOrEmpty(id)) return null;
				id = id.Replace("..", "").Replace("/", "").Replace("\\", "");
				return id.Length > 128 ? id.Substring(0, 128) : id;
			}

			// Utility: sanitize fileName to prevent path traversal
			private static string SanitizeName(string name)
			{
				if (string.IsNullOrEmpty(name)) return null;
				name = name.Replace("..", "").Replace("/", "").Replace("\\", "");
				return name.Length > 512 ? name.Substring(0, 512) : name;
			}
	}
}
