import { ipcMain, dialog, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import {
  FileReadPayloadSchema,
  FileWritePayloadSchema,
  OpenDialogOptionsSchema,
  SaveDialogOptionsSchema,
} from '../../shared/types/ipc.types';
import type { ReadFileResult, WriteFileResult } from '../../shared/types/ipc.types';
import { readFileBuffer, writeFileAtomic } from '../services/file.service';
import { log } from '../utils/logger';

export function registerFileHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.FILE_OPEN_DIALOG, async (_event, options: unknown) => {
    const parsed = OpenDialogOptionsSchema.safeParse(options ?? {});
    if (!parsed.success) {
      log.warn('file:open-dialog validation failed', {
        issues: parsed.error.issues,
      });
      return { canceled: true, filePaths: [] };
    }

    const win = BrowserWindow.getFocusedWindow();
    if (!win) return { canceled: true, filePaths: [] };

    const properties = (parsed.data.properties ?? [
      'openFile',
      ...(parsed.data.multiSelections ? ['multiSelections' as const] : []),
    ]) as Electron.OpenDialogOptions['properties'];

    return dialog.showOpenDialog(win, {
      title: parsed.data.title ?? 'Open PDF Document',
      filters: parsed.data.filters ?? [
        { name: 'PDF Documents', extensions: ['pdf'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties,
    });
  });

  ipcMain.handle(IPC_CHANNELS.FILE_SAVE_DIALOG, async (_event, options: unknown) => {
    const parsed = SaveDialogOptionsSchema.safeParse(options ?? {});
    if (!parsed.success) {
      log.warn('file:save-dialog validation failed', {
        issues: parsed.error.issues,
      });
      return { canceled: true, filePath: null };
    }

    const win = BrowserWindow.getFocusedWindow();
    if (!win) return { canceled: true, filePath: null };

    return dialog.showSaveDialog(win, {
      title: 'Save PDF Document',
      defaultPath: parsed.data.defaultPath,
      filters: parsed.data.filters ?? [{ name: 'PDF Documents', extensions: ['pdf'] }],
    });
  });

  ipcMain.handle(
    IPC_CHANNELS.FILE_READ,
    async (_event, payload: unknown): Promise<ReadFileResult> => {
      const parsed = FileReadPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        log.warn('file:read validation failed', { issues: parsed.error.issues });
        return { success: false, error: 'Invalid payload' };
      }

      try {
        const data = await readFileBuffer(parsed.data.filePath);
        return { success: true, data };
      } catch (err) {
        log.error('file:read failed', { error: (err as Error).message });
        return { success: false, error: 'Failed to read file' };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.FILE_WRITE_ATOMIC,
    async (_event, payload: unknown): Promise<WriteFileResult> => {
      const parsed = FileWritePayloadSchema.safeParse(payload);
      if (!parsed.success) {
        log.warn('file:write-atomic validation failed', {
          issues: parsed.error.issues,
        });
        return { success: false, error: 'Invalid payload' };
      }

      try {
        await writeFileAtomic(parsed.data.filePath, parsed.data.data);
        return { success: true };
      } catch (err) {
        log.error('file:write-atomic failed', { error: (err as Error).message });
        return { success: false, error: 'Failed to write file' };
      }
    }
  );
}
