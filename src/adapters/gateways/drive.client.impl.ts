import type { DriveRepository } from "../../application/repositories/drive.repository";
// @ts-ignore
import pdf from "pdf-parse/lib/pdf-parse.js";


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
    openaiModel?: string | null,
    page?: number,
    pageRange?: string,
    searchQuery?: string
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
        console.log(`[DriveClient] PDF detected. Attempting local JS pdf-parse extraction...`);
        
        const pageTexts: string[] = [];
        const options = {
          pagerender: async function(pageData: any) {
            const textContent = await pageData.getTextContent({ normalizeWhitespace: true });
            let lastY, text = '';
            for (let item of textContent.items) {
              if (lastY === item.transform[5] || !lastY) {
                text += item.str;
              } else {
                text += '\n' + item.str;
              }
              lastY = item.transform[5];
            }
            pageTexts[pageData.pageIndex] = text;
            return text;
          }
        };

        const parsed = await pdf(Buffer.from(buffer), options);
        const numPages = parsed.numpages;
        const totalTextLength = parsed.text?.length || 0;
        const avgCharsPerPage = numPages > 0 ? totalTextLength / numPages : 0;
        const isScanned = avgCharsPerPage < 120; // Classified as scanned if average page text length is < 120 chars

        if (searchQuery) {
          if (isScanned) {
            return `[WARNING: Scanned PDF Detected] This PDF document appears to contain scanned images of pages and does not have a selectable text layer (average text per page is only ${Math.round(avgCharsPerPage)} characters, mostly watermarks like "lampungtimurkab.bps.go.id"). Because of this, text search for "${searchQuery}" returned 0 matches. Please call "read_file" with a specific "page" number (e.g. page 25) to transcribe and read that page. AI OCR will be performed.`;
          }
          console.log(`[DriveClient] Searching for "${searchQuery}" in PDF (${numPages} pages)...`);
          const matches: string[] = [];
          const queryLower = searchQuery.toLowerCase();
          
          for (let pIdx = 0; pIdx < numPages; pIdx++) {
            const pageText = pageTexts[pIdx] || '';
            if (pageText.toLowerCase().includes(queryLower)) {
              const lines = pageText.split('\n');
              for (const line of lines) {
                if (line.toLowerCase().includes(queryLower)) {
                  matches.push(`Page ${pIdx + 1}: ${line.trim()}`);
                  if (matches.length >= 40) break;
                }
              }
            }
            if (matches.length >= 40) break;
          }
          
          if (matches.length === 0) {
            return `Search query "${searchQuery}" was not found in the PDF document (${numPages} pages scanned).`;
          }
          return `Search results for "${searchQuery}" (found ${matches.length} matches):\n\n` + matches.join('\n');
        }

        if (page) {
          const pIdx = page - 1;
          if (pIdx >= 0 && pIdx < numPages) {
            console.log(`[DriveClient] Extracting PDF page ${page}...`);
            const pageRawText = pageTexts[pIdx] || '';
            
            // If the page contains very little text (e.g., under 100 non-url characters), run AI OCR
            const cleanPageText = pageRawText.replace(/https?:\/\/[\w\.\/\-]+/g, '').trim();
            if (cleanPageText.length < 50) {
              console.log(`[DriveClient] Page ${page} appears scanned (only ${cleanPageText.length} non-url characters). Running AI OCR...`);
              try {
                const singlePageBuffer = await extractPdfPage(buffer, page);
                const singlePageB64 = singlePageBuffer.toString('base64');
                const ocrPrompt = `Perform OCR on this PDF page. Transcribe all text, numbers, and tabular data/tables visible on this page in markdown table format. Do not skip any numbers. Page text should be detailed.`;

                if (geminiApiKey) {
                  console.log(`[DriveClient Gemini OCR] Transcribing scanned page ${page}...`);
                  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
                  const geminiRes = await fetch(geminiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      contents: [{
                        parts: [
                          { text: ocrPrompt },
                          { inlineData: { mimeType: 'application/pdf', data: singlePageB64 } }
                        ]
                      }]
                    })
                  });

                  if (geminiRes.ok) {
                    const geminiData = await geminiRes.json();
                    return `Page ${page} of ${numPages} (AI OCR Transcribed):\n\n` + (geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'No description returned from Gemini.');
                  }
                }
                
                if (openaiApiKey && openaiBaseUrl && openaiModel) {
                  console.log(`[DriveClient OpenAI OCR] Transcribing scanned page ${page}...`);
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
                          { type: 'text', text: ocrPrompt },
                          { type: 'image_url', image_url: { url: `data:application/pdf;base64,${singlePageB64}` } }
                        ]
                      }]
                    })
                  });

                  if (openAIRes.ok) {
                    const openAIData = await openAIRes.json();
                    return `Page ${page} of ${numPages} (AI OCR Transcribed via OpenAI-Compatible):\n\n` + (openAIData.choices?.[0]?.message?.content || '');
                  }
                }

                return `Page ${page} of ${numPages} content (Warning: Scanned page detected, but no AI keys are configured to run OCR transcription):\n\n${pageRawText}`;
              } catch (pdfLibErr: any) {
                console.error("Failed to split PDF page with pdf-lib:", pdfLibErr.message);
              }
            }

            return `Page ${page} of ${numPages} content:\n\n${pageRawText || '[Empty Page]'}`;
          }
          return `Error: Page ${page} is out of range. The document has ${numPages} pages.`;
        }

        if (pageRange) {
          console.log(`[DriveClient] Extracting PDF page range ${pageRange}...`);
          const match = pageRange.match(/^(\d+)-(\d+)$/);
          if (match) {
            const start = Math.max(1, parseInt(match[1]));
            const end = Math.min(numPages, parseInt(match[2]));
            let combinedText = `Page range ${start}-${end} of ${numPages} content:\n\n`;
            for (let p = start; p <= end; p++) {
              combinedText += `--- Page ${p} ---\n${pageTexts[p - 1] || ''}\n\n`;
            }
            return combinedText.length > 80000 ? combinedText.substring(0, 80000) + "\n\n[Content truncated due to size limits...]" : combinedText;
          }
          return `Error: Invalid page range format. Use "start-end" e.g. "5-10".`;
        }

        const text = parsed.text;
        if (text && text.trim().length > 0) {
          console.log(`[DriveClient] Local JS pdf-parse extraction succeeded (${text.length} chars).`);
          return text.length > 50000 ? text.substring(0, 50000) + "\n\n[Content truncated due to size limits...]" : text;
        }
        console.log(`[DriveClient] Local JS pdf-parse returned empty content.`);
      } catch (jsPdfErr: any) {
        console.error(`[DriveClient] Local JS pdf-parse failed:`, jsPdfErr.message);
      }

      try {
        console.log(`[DriveClient] Attempting local pdftotext extraction...`);
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        const tempDir = os.tmpdir();
        const tempPath = path.join(tempDir, `temp_parse_${fileId}_${Date.now()}.pdf`);
        await Bun.write(tempPath, buffer);
        
        const proc = Bun.spawn(["pdftotext", tempPath, "-"]);
        const text = await new Response(proc.stdout).text();
        
        // Clean up temp file
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

async function extractPdfPage(pdfBuffer: ArrayBuffer, pageNumber: number): Promise<Buffer> {
  const { PDFDocument } = require('pdf-lib');
  const srcDoc = await PDFDocument.load(pdfBuffer);
  const newDoc = await PDFDocument.create();
  const [copiedPage] = await newDoc.copyPages(srcDoc, [pageNumber - 1]);
  newDoc.addPage(copiedPage);
  const pdfBytes = await newDoc.save();
  return Buffer.from(pdfBytes);
}
