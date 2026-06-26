import type { DriveRepository } from "../repositories/drive.repository";

export class DriveUseCase {
  constructor(private driveRepository: DriveRepository) {}

  extractFolderId(input: string): string {
    const match = input.match(/\/folders\/([a-zA-Z0-9-_]+)/);
    if (match) return match[1];
    
    const fileMatch = input.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
    if (fileMatch) return fileMatch[1];
    
    return input.trim();
  }

  async scanDrive(folderUrl: string, recursive: boolean): Promise<{ folderId: string; folderName: string; items: any[] }> {
    const folderId = this.extractFolderId(folderUrl);
    
    let result;
    if (recursive) {
      result = await this.driveRepository.scanDriveRecursively(folderId);
    } else {
      result = await this.driveRepository.fetchFolderItems(folderId, '', folderId);
    }

    return {
      folderId,
      folderName: result.folderName,
      items: result.items
    };
  }
}
