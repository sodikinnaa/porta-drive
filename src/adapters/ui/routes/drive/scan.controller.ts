import type { Context } from "hono";
import type { BaseController } from "../base.controller";
import type { DriveUseCase } from "../../../../application/usecases/drive.usecase";

export class ScanDriveController implements BaseController {
  constructor(private driveUseCase: DriveUseCase) {}

  async main(c: Context): Promise<Response> {
    const userId = c.get('userId');
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);

    try {
      const { folderUrl, recursive } = await c.req.json();
      if (!folderUrl) {
        return c.json({ error: 'Folder URL or ID is required' }, 400);
      }

      const result = await this.driveUseCase.scanDrive(folderUrl, recursive);
      return c.json({
        folderId: result.folderId,
        folderName: result.folderName,
        items: result.items
      });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  }
}
