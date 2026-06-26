export interface DriveRepository {
  fetchFolderItems(folderId: string, parentPath?: string, parentId?: string | null): Promise<{ folderName: string; items: any[] }>;
  scanDriveRecursively(rootFolderId: string): Promise<{ folderName: string; items: any[] }>;
  downloadFileContent(
    fileId: string,
    mimeType: string,
    geminiApiKey?: string | null,
    openaiApiKey?: string | null,
    openaiBaseUrl?: string | null,
    openaiModel?: string | null,
    page?: number,
    pageRange?: string,
    searchQuery?: string
  ): Promise<string>;
}
