import { existsSync } from 'fs';
import { writeFile } from 'fs/promises';

// ANSI escape codes for styling console output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  
  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  // Bright foregrounds
  brightBlack: '\x1b[90m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
};

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

// Format byte sizes into human readable format
function formatBytes(bytes: number | null): string {
  if (bytes === null) return '-';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Sleep helper to avoid aggressive scraping rate-limits
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Extracts the Google Drive Folder ID from a URL or raw string.
 */
function extractFolderId(input: string): string {
  const match = input.match(/\/folders\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  
  // If it's a URL but doesn't match folders, check if it's a file URL
  const fileMatch = input.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
  if (fileMatch) {
    console.warn(`${colors.yellow}Warning: Detected a file URL instead of a folder URL. Attempting to use the ID as a folder.${colors.reset}`);
    return fileMatch[1];
  }
  
  // Otherwise assume raw ID
  return input.trim();
}

/**
 * Fetches items from a single Google Drive folder.
 */
async function fetchFolderItems(folderId: string, parentPath = '', parentId: string | null = null): Promise<DriveItem[]> {
  const url = `https://drive.google.com/drive/folders/${folderId}`;
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch page. HTTP Status: ${response.status}`);
  }

  const html = await response.text();
  const driveIvdMatch = html.match(/window\['_DRIVE_ivd'\]\s*=\s*'(.*?)';/);
  if (!driveIvdMatch) {
    // Check if it's an empty folder or access restricted
    if (html.includes("Google Drive - Page Not Found") || html.includes("Sign in")) {
      throw new Error("Folder not found or is private (requires sign-in). Please ensure the link is public.");
    }
    return [];
  }

  const rawStr = driveIvdMatch[1];
  // Unescape hex encoded characters (\x5b -> [, \x22 -> ", etc.)
  const unescaped = rawStr.replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });

  let parsed;
  try {
    parsed = JSON.parse(unescaped);
  } catch (err) {
    throw new Error("Failed to parse internal Google Drive data payload.");
  }

  const rawItems = parsed[0];
  if (!Array.isArray(rawItems)) {
    return [];
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
    
    // Clean up url escaping
    let viewUrl = item[114] || null;
    if (viewUrl) {
      viewUrl = viewUrl.replace(/\\u003d/g, '=').replace(/\\u0026/g, '&');
    }

    const downloadUrl = isFolder 
      ? null 
      : `https://drive.google.com/uc?export=download&id=${id}`;

    const currentPath = parentPath ? `${parentPath}/${name}` : name;

    items.push({
      id,
      name,
      mimeType,
      createdTime,
      modifiedTime,
      size,
      viewUrl,
      downloadUrl,
      isFolder,
      parentId,
      path: currentPath
    });
  }

  return items;
}

/**
 * Recursively scans folders starting from the root folder ID.
 */
async function scanDriveRecursively(rootFolderId: string): Promise<DriveItem[]> {
  const allItems: DriveItem[] = [];
  const visited = new Set<string>();
  const queue: { id: string; path: string }[] = [{ id: rootFolderId, path: '' }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.id)) continue;
    visited.add(current.id);

    console.log(`${colors.brightBlack}[SCANNING]${colors.reset} folder: ${colors.cyan}${current.path || 'Root'}${colors.reset} (${current.id})...`);
    
    try {
      const items = await fetchFolderItems(current.id, current.path, current.id);
      
      // Delay to avoid triggering rate limit rules
      await delay(600);

      for (const item of items) {
        allItems.push(item);
        if (item.isFolder) {
          queue.push({ id: item.id, path: item.path });
        }
      }
    } catch (err: any) {
      console.error(`${colors.brightRed}[ERROR]${colors.reset} Failed to scan folder ${colors.yellow}${current.path || 'Root'}${colors.reset}:`, err.message);
    }
  }

  return allItems;
}

// Display results in a directory tree structure
function printTree(items: DriveItem[], rootId: string) {
  // Sort folders first, then files
  const sorted = [...items].sort((a, b) => {
    if (a.isFolder && !b.isFolder) return -1;
    if (!a.isFolder && b.isFolder) return 1;
    return a.name.localeCompare(b.name);
  });

  const buildTree = (parentId: string | null, depth = 0) => {
    const children = sorted.filter(item => item.parentId === parentId);
    
    children.forEach((child, index) => {
      const isLast = index === children.length - 1;
      const prefix = '  '.repeat(depth) + (isLast ? '└── ' : '├── ');
      
      if (child.isFolder) {
        console.log(`${colors.brightBlack}${prefix}${colors.reset}${colors.blue}${colors.bold}${child.name}/${colors.reset} ${colors.dim}(Folder, ID: ${child.id})${colors.reset}`);
        buildTree(child.id, depth + 1);
      } else {
        const sizeStr = formatBytes(child.size);
        console.log(`${colors.brightBlack}${prefix}${colors.reset}${colors.green}${child.name}${colors.reset} ${colors.brightYellow}[${sizeStr}]${colors.reset} ${colors.dim}(File, ID: ${child.id})${colors.reset}`);
        console.log(`${'  '.repeat(depth + 2)}${colors.brightBlack}↳ Download: ${colors.underline}${colors.cyan}${child.downloadUrl}${colors.reset}`);
      }
    });
  };

  console.log(`\n${colors.bold}${colors.magenta}Google Drive Tree View:${colors.reset}`);
  console.log(`${colors.blue}${colors.bold}Root (ID: ${rootId})/${colors.reset}`);
  
  // For non-recursive listings, parentId will be the root ID
  // If we scanned non-recursively, parentId of items is rootId.
  // If recursively, they will chain correctly.
  buildTree(rootId, 0);
}

// Show a clean list table
function printList(items: DriveItem[]) {
  console.log(`\n${colors.bold}${colors.magenta}Google Drive Item List:${colors.reset}`);
  console.log(`${colors.bold}${colors.brightBlack}${'Name'.padEnd(50)} | ${'Type'.padEnd(20)} | ${'Size'.padEnd(10)} | ID${colors.reset}`);
  console.log(`${colors.brightBlack}${'-'.repeat(100)}${colors.reset}`);
  
  items.forEach(item => {
    const name = item.name.length > 47 ? item.name.substring(0, 44) + '...' : item.name;
    const typeLabel = item.isFolder ? 'Folder' : (item.mimeType.split('/').pop() || 'File');
    const sizeStr = formatBytes(item.size);
    
    const color = item.isFolder ? colors.brightBlue : colors.brightGreen;
    
    console.log(
      `${color}${name.padEnd(50)}${colors.reset} | ` +
      `${colors.cyan}${typeLabel.padEnd(20)}${colors.reset} | ` +
      `${colors.yellow}${sizeStr.padEnd(10)}${colors.reset} | ` +
      `${colors.brightBlack}${item.id}${colors.reset}`
    );
  });
}

// Main Runner
async function main() {
  console.clear();
  console.log(`================================================`);
  console.log(`  🍀  ${colors.bold}${colors.green}Google Drive Public Folder Scraper${colors.reset}  🍀  `);
  console.log(`================================================\n`);

  // Parse arguments
  const args = process.argv.slice(2);
  
  let targetInput = '1IzDKm2htqgfw_uOeg5k3ihMOgoMnnT2a'; // Default to user's folder
  let recursive = false;
  let exportJson = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--recursive' || arg === '-r') {
      recursive = true;
    } else if (arg === '--json' || arg === '-j') {
      exportJson = true;
    } else if (!arg.startsWith('-')) {
      targetInput = arg;
    }
  }

  const folderId = extractFolderId(targetInput);
  
  console.log(`${colors.bold}Target Folder ID:${colors.reset} ${colors.brightYellow}${folderId}${colors.reset}`);
  console.log(`${colors.bold}Recursive Scan:${colors.reset} ${recursive ? colors.green + 'ON (will scan subfolders)' : colors.red + 'OFF (root only)'}${colors.reset}`);
  console.log(`${colors.bold}Export JSON:${colors.reset} ${exportJson ? colors.green + 'ON' : colors.red + 'OFF'}${colors.reset}\n`);

  console.log(`${colors.brightCyan}Initiating scan. Please wait...${colors.reset}`);
  const startTime = Date.now();

  try {
    let items: DriveItem[];
    if (recursive) {
      items = await scanDriveRecursively(folderId);
    } else {
      items = await fetchFolderItems(folderId, '', folderId);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n${colors.bold}${colors.brightGreen}✓ Scan completed in ${duration} seconds!${colors.reset}`);
    console.log(`Found a total of ${colors.bold}${items.length}${colors.reset} items.`);

    if (items.length === 0) {
      console.log(`\n${colors.yellow}No items found. Make sure the folder is public and has view access.${colors.reset}`);
      return;
    }

    // Display the results
    if (recursive) {
      printTree(items, folderId);
    } else {
      printList(items);
    }

    // Export to JSON if requested
    if (exportJson) {
      const outputFilename = `drive_export_${folderId}.json`;
      await writeFile(outputFilename, JSON.stringify(items, null, 2), 'utf-8');
      console.log(`\n${colors.green}✓ Exported list to file: ${colors.bold}${outputFilename}${colors.reset}`);
    }

    // Guide the user on commands
    console.log(`\n${colors.brightBlack}Tip: To run this scan with options:${colors.reset}`);
    console.log(`${colors.cyan}  bun run index.ts <Folder_URL_or_ID> [-r | --recursive] [-j | --json]${colors.reset}\n`);

  } catch (error: any) {
    console.error(`\n${colors.red}${colors.bold}Fatal Error:${colors.reset} ${error.message}`);
    process.exit(1);
  }
}

main();
