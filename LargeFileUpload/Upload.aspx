<%@ Page Language="C#" AutoEventWireup="true" CodeBehind="Upload.aspx.cs" Inherits="LargeFileUpload.WebForm1" %>

<!DOCTYPE html>

<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <title>Large File Upload (ASP.NET Web Forms)</title>
    <meta charset="utf-8" />
    <style>
        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            background: #f7f8fa;
            margin: 0;
            padding: 0;
        }

        .container {
            max-width: 700px;
            margin: 3em auto;
            background: #fff;
            border-radius: 16px;
            box-shadow: 0 4px 24px rgba(0,0,0,0.08);
            padding: 2.5em 2em 2em 2em;
        }
        h2 {
            text-align: center;
            color: #333;
            margin-bottom: 1.5em;
        }
        .file-input {
            display: block;
            width: 80%;
            max-width: 400px;
            margin: 2em auto 1.5em auto;
            padding: 1em 1.5em;
            border: 1px solid #d0d7de;
            border-radius: 10px;
            background: #f3f4f6;
            font-size: 1.12em;
            box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .file-list {
            margin-top: 1em;
            font-size: 0.98em;
            color: #555;
        }

        .error {
            color: #d32f2f;
            background: #fff0f0;
            border-radius: 4px;
            padding: 0.5em 1em;
            margin-top: 1em;
        }
        .status {
            margin-top: 1em;
            color: #1976d2;
            font-size: 1em;
        }
    </style>
</head>
<body>
    <style>
        .file-card {
            display: flex;
            flex-direction: column;
            gap: 0.5em;
            background: #f6f8fa;
            border-radius: 10px;
            padding: 1.2em 1em;
            margin-bottom: 1.2em;
            box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .file-progress {
            width: 100%;
            height: 18px;
            margin-bottom: 0.5em;
        }
        .file-name-label {
            font-weight: 600;
            font-size: 1.08em;
            color: #1976d2;
        }
        .file-progress-label {
            font-size: 0.98em;
            color: #555;
            margin-bottom: 0.5em;
        }
        .file-status-label {
            font-size: 0.98em;
            font-weight: 500;
            margin-bottom: 0.5em;
        }
    </style>
    <div class="container">
        <div id="globalProgressLabel" style="font-weight:600;font-size:1.05em;margin-bottom:0.5em;display:none;"></div>
        <progress id="globalProgress" max="100" value="0" style="width:100%;height:20px;margin:1em 0 1.5em 0;display:none;"></progress>
        <h2>Large File Upload</h2>
        <input type="file" id="fileInput" class="file-input" multiple />
        <button id="uploadBtn" class="upload-btn" style="background:#1976d2;color:#fff;border:none;border-radius:6px;padding:0.7em 2em;font-weight:600;font-size:1.1em;cursor:pointer;margin-left:1em;">Upload</button>
        <div class="file-list" id="fileList"></div>
    </div>
    <script src="Upload.js"></script>
</body>
</html>
