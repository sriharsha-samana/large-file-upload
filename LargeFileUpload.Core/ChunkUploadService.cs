using System;
using System.IO;
using System.IO;
using System.Security.Cryptography;
namespace LargeFileUpload.Core
{
    public class ChunkUploadService
    {
	private const int BufferSize = 81920;

		   public UploadChunkResult UploadChunk(
			   string fileId,
			   int chunkIndex,
			   int totalChunks,
			   string chunkHash,
			   byte[] chunkData,
			   string fileName)
		   {
			   var fileDir = Path.Combine(ChunkUploadConstants.UploadRoot, fileId);
			if (string.IsNullOrWhiteSpace(fileId) || chunkIndex < 0 || totalChunks < 1 || chunkData == null || string.IsNullOrEmpty(fileName))
				return ErrorResult("Missing required fields.");
			if (fileId.Length > 128 || fileName.Length > 512)
				return ErrorResult("fileId or fileName too long.");
			if (totalChunks > 1_000_000)
				return ErrorResult("Too many chunks.");

			// Validate hash before disk write
			if (!IsValidChunkHash(chunkData, chunkHash))
				return ErrorResult("Chunk hash mismatch.");

			try { Directory.CreateDirectory(fileDir); }
			catch (Exception ex) { return ErrorResult($"Error creating upload directory: {ex.Message}"); }

					var chunkPath = Path.Combine(fileDir, $"chunk_{chunkIndex:D6}.part");
				var tempPath = chunkPath + ".tmp";
			   try
			   {
				   using (var fs = new FileStream(tempPath, FileMode.Create, FileAccess.Write, FileShare.None))
				   {
					   fs.Write(chunkData, 0, chunkData.Length);
				   }
				   if (File.Exists(chunkPath)) File.Delete(chunkPath);
				   File.Move(tempPath, chunkPath);
			   }
			   catch (Exception ex) {
				   return ErrorResult($"Error saving chunk: {ex.Message}");
			   }

			string[] chunkFiles;
			try { chunkFiles = Directory.GetFiles(fileDir, "chunk_*.part"); }
			catch (Exception ex) { return ErrorResult($"Error listing chunk files: {ex.Message}"); }

			if (chunkFiles.Length == totalChunks)
			{
				var reassemblingLock = Path.Combine(fileDir, ".reassembling");
				if (File.Exists(reassemblingLock))
				{
					return ErrorResult("Reassembly already in progress");
				}
				if (!TryReassembleFile(fileDir, totalChunks, fileName, chunkFiles, out string reassemblyError))
					return ErrorResult(reassemblyError);
			}

				return new UploadChunkResult { Success = true, ChunkIndex = chunkIndex, Status = "uploaded" };
		}

		private static UploadChunkResult ErrorResult(string error) => new UploadChunkResult { Success = false, Error = error };

		private static bool IsValidChunkHash(byte[] chunkData, string chunkHash)
		{
			if (string.IsNullOrEmpty(chunkHash)) return true;
			using (var sha256 = SHA256.Create())
			{
				var computedHash = BitConverter.ToString(sha256.ComputeHash(chunkData)).Replace("-", "").ToLower();
				return string.Equals(computedHash, chunkHash, StringComparison.OrdinalIgnoreCase);
			}
		}

			private static bool TryReassembleFile(string fileDir, int totalChunks, string fileName, string[] chunkFiles, out string error)
			{
				var finalPath = Path.Combine(fileDir, fileName);
				var reassemblingLock = Path.Combine(fileDir, ".reassembling");
				var logPath = Path.Combine(fileDir, "reassembly_debug.log");
				error = null;
				bool writeSuccess = false;
				try
				{
					// Create a lock file to indicate reassembly in progress
					File.WriteAllText(reassemblingLock, "in progress");
					try
					{
						using (var output = File.Create(finalPath))
						{
							// Ensure all chunks exist and are in order
							for (int i = 0; i < totalChunks; i++)
							{
								var path = Path.Combine(fileDir, $"chunk_{i:D6}.part");
								if (!File.Exists(path))
								{
									return false;
								}
							}
							for (int i = 0; i < totalChunks; i++)
							{
								var path = Path.Combine(fileDir, $"chunk_{i:D6}.part");
								try
								{
									using (var fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read))
									{
										byte[] buffer = new byte[BufferSize];
										int read;
										while ((read = fs.Read(buffer, 0, buffer.Length)) > 0)
										{
											output.Write(buffer, 0, read);
										}
									}
								}
								catch (Exception ex)
								{
									return false;
								}
							}
							writeSuccess = true;
						}
					}
					catch (Exception ex)
					{
						error = $"Error reassembling file: {ex.Message}";
						try { File.Delete(reassemblingLock); } catch { }
						return false;
					}
				}
				catch (Exception ex)
				{
					error = $"Error reassembling file: {ex.Message}";
					try { File.Delete(reassemblingLock); } catch { }
					return false;
				}
				if (writeSuccess)
				{
					File.Delete(reassemblingLock);
				}
				return true;
			}

		// Returns array of uploaded chunk indices for resumable support
		public int[] GetUploadedChunks(string fileId)
		{
			var fileDir = Path.Combine(ChunkUploadConstants.UploadRoot, fileId);
			if (!Directory.Exists(fileDir)) return new int[0];
			var files = Directory.GetFiles(fileDir, "chunk_*.part");
			var indices = new System.Collections.Generic.List<int>();
			foreach (var f in files)
			{
				var name = Path.GetFileNameWithoutExtension(f);
				if (name.StartsWith("chunk_") && int.TryParse(name.Substring(6), out int idx))
					indices.Add(idx);
			}
			return indices.ToArray();
		}

		/// <summary>
		/// Verifies the reassembled file's hash (simple implementation).
		/// </summary>
		/// <param name="fileId">The unique file identifier (required).</param>
		/// <param name="fileName">The original file name (required).</param>
		/// <returns>Object with success and hash or error.</returns>
		public object VerifyFile(string fileId, string fileName)
		{
			var logPath = Path.Combine(ChunkUploadConstants.UploadRoot, fileId, "verify_debug.log");
			if (string.IsNullOrWhiteSpace(fileId) || string.IsNullOrWhiteSpace(fileName))
			{
				return new { success = false, error = "Missing required parameters: fileId and fileName are required." };
			}
			var fileDir = Path.Combine(ChunkUploadConstants.UploadRoot, fileId);
			var finalPath = Path.Combine(fileDir, fileName);
			var reassemblingLock = Path.Combine(fileDir, ".reassembling");
			if (File.Exists(reassemblingLock))
			{
				return new { success = false, status = "reassembling" };
			}
			if (!File.Exists(finalPath))
			{
				// If chunk files are present, treat as reassembling
				var chunkFiles = Directory.GetFiles(fileDir, "chunk_*.part");
				if (chunkFiles.Length > 0)
				{
					return new { success = false, status = "reassembling" };
				}
				return new { success = false, error = "File not found" };
			}
			using (var sha256 = SHA256.Create())
			using (var fs = File.OpenRead(finalPath))
			{
				var hash = BitConverter.ToString(sha256.ComputeHash(fs)).Replace("-", "").ToLower();
				return new { success = true, hash };
			}
		}
	}
}
