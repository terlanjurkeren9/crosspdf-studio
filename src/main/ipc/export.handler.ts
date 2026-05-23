import { ipcMain, dialog, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { ExportSaveTextPayloadSchema } from '../../shared/types/ipc.types';
import type { ExportSaveTextResult } from '../../shared/types/ipc.types';
import { writeFileAtomic } from '../services/file.service';
import { log } from '../utils/logger';

export function registerExportHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.EXPORT_SAVE_TEXT,
    async (_event, payload: unknown): Promise<ExportSaveTextResult> => {
      const parsed = ExportSaveTextPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        return { success: false, error: 'Invalid payload' };
      }

      try {
        const win = BrowserWindow.getFocusedWindow();
        if (!win) return { success: false, error: 'No focused window' };

        const result = await dialog.showSaveDialog(win, {
          title: 'Export OCR Text',
          defaultPath: parsed.data.defaultPath,
          filters: [
            { name: 'Text Files', extensions: ['txt'] },
            { name: 'All Files', extensions: ['*'] },
          ],
        });

        if (result.canceled || !result.filePath) {
          return { success: false, error: 'Canceled' };
        }

        const encoder = new TextEncoder();
        const data = encoder.encode(parsed.data.text).buffer;
        await writeFileAtomic(result.filePath, data);

        return { success: true, filePath: result.filePath };
      } catch (err) {
        log.error('export:save-text failed', { error: (err as Error).message });
        return { success: false, error: (err as Error).message };
      }
    }
  );
}
