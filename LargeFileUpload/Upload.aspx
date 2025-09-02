<%@ Page Language="C#" AutoEventWireup="true" CodeBehind="Upload.aspx.cs" Inherits="LargeFileUpload.WebForm1" %>

<!DOCTYPE html>

<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <title>Large File Upload (ASP.NET Web Forms)</title>
    <meta charset="utf-8" />
    <style>
        body { font-family: Arial, sans-serif; margin: 2em; }
        .file-list { margin-top: 1em; }
        .progress-bar { width: 100%; background: #eee; border-radius: 4px; margin: 0.5em 0; }
        .progress { background: #4caf50; height: 18px; border-radius: 4px; width: 0; transition: width 0.2s; }
        .error { color: red; }
    </style>
</head>
<body>
    <h2>Large File Upload (.aspx)</h2>
    <input type="file" id="fileInput" multiple />
    <button onclick="startUpload()">Upload</button>
    <div class="file-list" id="fileList"></div>
    <script src="Upload.js"></script>
</body>
</html>
