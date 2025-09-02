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
            max-width: 520px;
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
            width: 100%;
            padding: 0.75em;
            border: 1px solid #d0d7de;
            border-radius: 8px;
            background: #f3f4f6;
            font-size: 1.08em;
            margin-bottom: 1.5em;
        }
        .upload-btn {
            padding: 0.7em 2em;
            border-radius: 8px;
            border: none;
            font-weight: 600;
            font-size: 1.08em;
            cursor: pointer;
            background: #1976d2;
            color: #fff;
            box-shadow: 0 1px 4px rgba(0,0,0,0.07);
            transition: background 0.2s, color 0.2s, opacity 0.2s;
        }
        .upload-btn:disabled {
            background: #e0e0e0 !important;
            color: #aaa !important;
            cursor: not-allowed !important;
            opacity: 0.7;
        }
        .file-list {
            margin-top: 1em;
            font-size: 0.98em;
            color: #555;
        }
        .progress-bar {
            width: 100%;
            background: #eee;
            border-radius: 8px;
            margin: 0.5em 0;
            height: 20px;
            overflow: hidden;
        }
        .progress {
            background: linear-gradient(90deg, #4caf50 60%, #81c784 100%);
            height: 100%;
            border-radius: 8px;
            width: 0;
            transition: width 0.2s;
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
    <div class="container">
        <h2>Large File Upload</h2>
        <input type="file" id="fileInput" class="file-input" multiple />
        <button class="upload-btn" onclick="startUpload()">Upload</button>
        <div class="file-list" id="fileList"></div>
        <div class="progress-bar" id="mainProgressBar" style="display:none;">
            <div class="progress" id="mainProgress"></div>
        </div>
        <div class="status" id="mainStatus"></div>
        <div class="error" id="mainError" style="display:none;"></div>
    </div>
    <script src="Upload.js"></script>
</body>
</html>
