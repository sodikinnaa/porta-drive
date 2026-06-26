import type { DriveRepository } from "../../application/repositories/drive.repository";

interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  createdTime: Date | null;
  modifiedTime: Date | null;
  size: number | null;
  viewUrl: string | null;
  downloadUrl: string | null;
  isFolder: boolean;
  parentId: string | null;
  path: string;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class DriveClientImpl implements DriveRepository {
  async fetchFolderItems(folderId: string, parentPath = '', parentId: string | null = null): Promise<{ folderName: string; items: any[] }> {
    const url = `https://drive.google.com/drive/folders/${folderId}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Google Drive folder. HTTP status: ${response.status}`);
    }

    const html = await response.text();
    const titleMatch = html.match(/<title>(.*?)<\/title>/);
    let folderName = 'Google Drive Folder';
    if (titleMatch) {
      folderName = titleMatch[1].replace(/\s*-\s*Google Drive\s*$/, '').trim();
    }

    const driveIvdMatch = html.match(/window\['_DRIVE_ivd'\]\s*=\s*'(.*?)';/);
    if (!driveIvdMatch) {
      if (html.includes("Google Drive - Page Not Found") || html.includes("Sign in")) {
        throw new Error("Folder not found or is private. Make sure the folder is public.");
      }
      return { items: [], folderName };
    }

    const rawStr = driveIvdMatch[1];
    const unescaped = rawStr.replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

    let parsed;
    try {
      parsed = JSON.parse(unescaped);
    } catch (err) {
      throw new Error("Failed to parse internal Google Drive data payload.");
    }

    const rawItems = parsed[0];
    if (!Array.isArray(rawItems)) {
      return { items: [], folderName };
    }

    const items: DriveItem[] = [];
    for (const item of rawItems) {
      if (!item || !item[0]) continue;

      const id = item[0];
      const name = item[2] || 'Untitled';
      const mimeType = item[3] || '';
      const isFolder = mimeType === 'application/vnd.google-apps.folder';
      const createdTime = item[9] ? new Date(item[9]) : null;
      const modifiedTime = item[10] ? new Date(item[10]) : null;
      const size = typeof item[13] === 'number' ? item[13] : null;
      
      let viewUrl = item[114] || null;
      if (viewUrl) {
        viewUrl = viewUrl.replace(/\\u003d/g, '=').replace(/\\u0026/g, '&');
      }

      const downloadUrl = isFolder ? null : `https://drive.google.com/uc?export=download&id=${id}`;
      const currentPath = parentPath ? `${parentPath}/${name}` : name;

      items.push({
        id, name, mimeType, createdTime, modifiedTime, size, viewUrl, downloadUrl, isFolder, parentId, path: currentPath
      });
    }

    return { items, folderName };
  }

  async scanDriveRecursively(rootFolderId: string): Promise<{ folderName: string; items: any[] }> {
    const allItems: DriveItem[] = [];
    const visited = new Set<string>();
    const queue: { id: string; path: string }[] = [{ id: rootFolderId, path: '' }];
    
    let rootFolderName = 'Google Drive Folder';
    let isRoot = true;

    while (queue.length > 0 && allItems.length < 250) {
      const current = queue.shift()!;
      if (visited.has(current.id)) continue;
      visited.add(current.id);

      try {
        const { items, folderName } = await this.fetchFolderItems(current.id, current.path, current.id);
        if (isRoot) {
          rootFolderName = folderName;
          isRoot = false;
        }
        await delay(400);

        for (const item of items) {
          allItems.push(item);
          if (item.isFolder && allItems.length < 250) {
            queue.push({ id: item.id, path: item.path });
          }
        }
      } catch (err: any) {
        console.error(`Failed to scan folder ${current.path || 'Root'}:`, err.message);
        if (isRoot) throw err;
      }
    }

    return { items: allItems, folderName: rootFolderName };
  }

  async downloadFileContent(
    fileId: string, 
    mimeType: string, 
    geminiApiKey?: string | null, 
    openaiApiKey?: string | null, 
    openaiBaseUrl?: string | null, 
    openaiModel?: string | null
  ): Promise<string> {
    let downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    let finalMimeType = mimeType;

    if (mimeType === 'application/vnd.google-apps.document') {
      downloadUrl = `https://docs.google.com/document/d/${fileId}/export?format=txt`;
      finalMimeType = 'text/plain';
    } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
      downloadUrl = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv`;
      finalMimeType = 'text/csv';
    } else if (mimeType === 'application/vnd.google-apps.presentation') {
      downloadUrl = `https://docs.google.com/presentation/d/${fileId}/export?format=pdf`;
      finalMimeType = 'application/pdf';
    }

    console.log(`[DriveClient] Downloading ID=${fileId}, Mime=${finalMimeType}`);
    const res = await fetch(downloadUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to download file from Google Drive. Status: ${res.status}`);
    }

    // Parse Text Files
    if (
      finalMimeType.startsWith('text/') ||
      finalMimeType === 'application/json' ||
      finalMimeType === 'application/javascript' ||
      finalMimeType === 'text/plain' ||
      finalMimeType === 'text/csv'
    ) {
      const text = await res.text();
      return text.length > 50000 ? text.substring(0, 50000) + "\n\n[Content truncated due to size limits...]" : text;
    }

    // Parse Binary Files (PDFs, Images) using base64 + Vision API
    const buffer = await res.arrayBuffer();

    if (finalMimeType === 'application/pdf') {
      try {
        console.log(`[DriveClient] PDF detected. Attempting local pdftotext extraction...`);
        const tempPath = `/tmp/temp_parse_${fileId}_${Date.now()}.pdf`;
        await Bun.write(tempPath, buffer);
        
        const proc = Bun.spawn(["pdftotext", tempPath, "-"]);
        const text = await new Response(proc.stdout).text();
        
        // Clean up temp file
        const fs = require('fs');
        try {
          fs.unlinkSync(tempPath);
        } catch (e) {}

        if (text && text.trim().length > 0) {
          console.log(`[DriveClient] Local pdftotext extraction succeeded (${text.length} chars).`);
          return text.length > 50000 ? text.substring(0, 50000) + "\n\n[Content truncated due to size limits...]" : text;
        }
        console.log(`[DriveClient] Local pdftotext returned empty content. Falling back to multimodal.`);
      } catch (pdfErr: any) {
        console.error(`[DriveClient] Local pdftotext failed:`, pdfErr.message);
      }
    }

    const base64Data = Buffer.from(buffer).toString('base64');
    
    let prompt = '';
    if (finalMimeType === 'application/pdf') {
      prompt = "Extract all text, sections, and summarize this PDF document in detail. If it is study material, list the questions or key concepts found.";
    } else if (finalMimeType.startsWith('image/')) {
      prompt = "Describe this image in detail. Perform OCR to extract any text, details, tables, or annotations visible in the image.";
    } else {
      prompt = "Analyze this file's contents, extract any text, and summarize it.";
    }

    // Option A: Use Gemini if key is provided (Standard and free)
    if (geminiApiKey) {
      console.log(`[DriveClient Gemini Sub-request] Analyzing binary file...`);
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
      const geminiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inlineData: { mimeType: finalMimeType, data: base64Data } }
            ]
          }]
        })
      });

      if (geminiRes.ok) {
        const geminiData = await geminiRes.json();
        return geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'No description returned from Gemini.';
      }
    }

    // Option B: Use Custom OpenAI compatible endpoint if configured
    if (openaiApiKey && openaiBaseUrl && openaiModel) {
      console.log(`[DriveClient OpenAI-Compatible Sub-request] Analyzing binary file...`);
      const openAIUrl = `${openaiBaseUrl.replace(/\/$/, '')}/chat/completions`;
      
      const openAIRes = await fetch(openAIUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          model: openaiModel,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${finalMimeType};base64,${base64Data}` } }
            ]
          }]
        })
      });

      if (openAIRes.ok) {
        const openAIData = await openAIRes.json();
        return openAIData.choices?.[0]?.message?.content || 'No description returned from OpenAI compatible endpoint.';
      }
    }

    // Default warning fallback
    if (finalMimeType === 'application/pdf') {
      throw new Error('PDF file analysis requires a Gemini API Key to be configured in your settings.');
    } else {
      throw new Error('Multimodal file analysis requires a Gemini API Key or an OpenAI Compatible endpoint with vision support.');
    }
  }
}
