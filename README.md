# Google Drive Public Folder Detector (Scraper) using Bun

A lightweight, zero-dependency command-line utility built with **TypeScript** and **Bun** to recursively or non-recursively list and detect all files and folders in a public Google Drive folder **without needing a Google API Key or OAuth credentials**.

## How It Works

Instead of using the official Google Drive API which requires generating API Keys and setting up a Google Cloud project, this tool requests the public sharing URL of the Google Drive folder and parses the initial payload stored inside the `window['_DRIVE_ivd']` global variable in the HTML. 

This payload is then unescaped and parsed as JSON, exposing the complete metadata of all items inside the directory, including:
- **Item ID**
- **MimeType** (detecting whether it is a folder or file)
- **File Name**
- **File Size**
- **Date Created & Date Modified**
- **Web View Link** & **Direct Download Link**

## Prerequisites

- [Bun](https://bun.sh/) installed on your machine.

## Setup

1. Open a terminal in the project directory.
2. Install the TypeScript type definitions (optional, Bun runs TS directly out of the box):
   ```bash
   bun install
   ```

## Usage

### 1. Default Folder Scan (Root only)
By default, running the program without arguments will scan the Google Drive folder you provided (`1IzDKm2htqgfw_uOeg5k3ihMOgoMnnT2a`):
```bash
bun run index.ts
```

### 2. Scan Custom Folder
You can provide any public Google Drive URL or Folder ID as a command-line argument:
```bash
bun run index.ts "https://drive.google.com/drive/folders/1IzDKm2htqgfw_uOeg5k3ihMOgoMnnT2a"
```

### 3. Recursive Scan (List all nested files & folders)
To scan all nested directories recursively and render them in a hierarchical folder tree structure, add the `-r` or `--recursive` flag:
```bash
bun run index.ts -r
# or for custom URLs:
bun run index.ts "https://drive.google.com/drive/folders/YOUR_FOLDER_ID" -r
```

### 4. Export to JSON
To export the complete file list (including download links) as a JSON file, add the `-j` or `--json` flag:
```bash
bun run index.ts -j
# or recursively and export:
bun run index.ts -r -j
```
This will save the output to `drive_export_<folderId>.json`.

## Features
- **Zero API Keys required**: Completely free and zero-configuration.
- **Hierarchical tree structure** in console print for recursive views.
- **Direct download URLs** generated automatically for all files.
- **Polite scraping**: Uses a 600ms safety delay between directory requests in recursive scanning to avoid hitting Google's anti-scraping limits.
