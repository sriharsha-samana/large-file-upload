using System;
using System.IO;
using System.IO.Compression;
using System.Security.Cryptography;
using LargeFileUpload.Core;



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
		var sw = System.Diagnostics.Stopwatch.StartNew();
		if (string.IsNullOrWhiteSpace(fileId) || chunkIndex < 0 || totalChunks < 1 || chunkData == null || string.IsNullOrEmpty(fileName))
			return ErrorResult("Missing required fields.");
		if (fileId.Length > 128 || fileName.Length > 512)
			return ErrorResult("fileId or fileName too long.");
		if (totalChunks > 1_000_000)
			return ErrorResult("Too many chunks.");
		if (!fileName.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
			return ErrorResult("Only .zip files are allowed for upload.");
		if (chunkData.Length < ChunkUploadConstants.MinChunkSize && chunkIndex != totalChunks - 1)
			return ErrorResult("Chunk size too small.");
		if (chunkData.Length > ChunkUploadConstants.MaxChunkSize)
			return ErrorResult("Chunk size too large.");

		// Validate hash before disk write
		if (!IsValidChunkHash(chunkData, chunkHash))
			return ErrorResult("Chunk hash mismatch.");

		var fileDir = Path.Combine(ChunkUploadConstants.UploadRoot, fileId);
		try
		{
			Directory.CreateDirectory(fileDir);
		}
		catch (Exception ex)
		{
			return ErrorResult($"Error creating upload directory: {ex.Message}");
		}
		var chunkPath = Path.Combine(fileDir, $"chunk_{chunkIndex:D6}.gz");
		var tempPath = chunkPath + ".tmp";
		try
		{
			using (var fs = new FileStream(tempPath, FileMode.Create, FileAccess.Write, FileShare.None))
			{
				using (var gzip = new GZipStream(fs, CompressionMode.Compress))
				{
					gzip.Write(chunkData, 0, chunkData.Length);
				}
			}
			if (File.Exists(chunkPath)) File.Delete(chunkPath);
			File.Move(tempPath, chunkPath);
		}
		catch (Exception ex)
		{
			return ErrorResult($"Error saving chunk: {ex.Message}");
		}

		string[] chunkFiles;
		try
		{
			chunkFiles = Directory.GetFiles(fileDir, "chunk_*.gz");
		}
		catch (Exception ex)
		{
			return ErrorResult($"Error listing chunk files: {ex.Message}");
		}

		if (chunkFiles.Length == totalChunks)
		{
			if (!TryReassembleFile(fileDir, totalChunks, fileId, chunkFiles, out string reassemblyError))
				return ErrorResult(reassemblyError);
		}

		sw.Stop();
		System.Diagnostics.Trace.WriteLine($"ChunkUploadService.UploadChunk: fileId={fileId}, chunkIndex={chunkIndex}, elapsed={sw.ElapsedMilliseconds}ms");
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

	private static bool TryReassembleFile(string fileDir, int totalChunks, string fileId, string[] chunkFiles, out string error)
	{
		error = null;
		var finalPath = Path.Combine(ChunkUploadConstants.UploadRoot, fileId + ".complete");
		try
		{
			using (var output = File.Create(finalPath))
			{
				// Ensure all chunks exist and are in order
				for (int i = 0; i < totalChunks; i++)
				{
					var path = Path.Combine(fileDir, $"chunk_{i:D6}.gz");
					if (!File.Exists(path))
					{
						error = $"Missing chunk file: chunk_{i:D6}.gz";
						return false;
					}
				}

				// Optionally: parallelize reading chunks for very large files (advanced)
				for (int i = 0; i < totalChunks; i++)
				{
					var path = Path.Combine(fileDir, $"chunk_{i:D6}.gz");
					try
					{
						using (var fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read))
						{
							using (var gzip = new GZipStream(fs, CompressionMode.Decompress))
							{
								byte[] buffer = new byte[BufferSize];
								int read;
								while ((read = gzip.Read(buffer, 0, buffer.Length)) > 0)
								{
									output.Write(buffer, 0, read);
								}
							}
						}
					}
					catch (Exception ex)
					{
						error = $"Error reading chunk {i}: {ex.Message}";
						return false;
					}
				}
				var finalInfo = new FileInfo(finalPath);
				if (finalInfo.Length > ChunkUploadConstants.MaxFileSize)
				{
					File.Delete(finalPath);
					foreach (var f in chunkFiles) File.Delete(f);
					error = "File exceeds maximum allowed size of 100GB after reassembly.";
					return false;
				}
			}
		}
		catch (Exception ex)
		{
			error = $"Error reassembling file: {ex.Message}";
			return false;
		}
		return true;
	}
}
