import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import {
  DbGetPreferencePayloadSchema,
  DbSetPreferencePayloadSchema,
  RecentUpsertPayloadSchema,
} from '../../shared/types/ipc.types';
import { getPreference, setPreference } from '../database/repositories/preferences.repo';
import { getAllRecent, upsertRecent } from '../database/repositories/recent-documents.repo';
import { log } from '../utils/logger';

export function registerDatabaseHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.DB_GET_PREFERENCE, (_event, payload: unknown) => {
    const parsed = DbGetPreferencePayloadSchema.safeParse(payload);
    if (!parsed.success) {
      log.warn('db:get-preference validation failed', {
        issues: parsed.error.issues,
      });
      return undefined;
    }
    return getPreference(parsed.data.key);
  });

  ipcMain.handle(IPC_CHANNELS.DB_SET_PREFERENCE, (_event, payload: unknown) => {
    const parsed = DbSetPreferencePayloadSchema.safeParse(payload);
    if (!parsed.success) {
      log.warn('db:set-preference validation failed', {
        issues: parsed.error.issues,
      });
      return;
    }
    setPreference(parsed.data.key, parsed.data.value);
  });

  ipcMain.handle(IPC_CHANNELS.RECENT_GET_ALL, () => {
    const rows = getAllRecent(10);
    return rows.map((r) => ({
      id: r.id,
      filePath: r.file_path,
      fileName: r.file_name,
      fileSize: r.file_size,
      pageCount: r.page_count,
      pinned: r.pinned,
      lastOpened: r.last_opened,
    }));
  });

  ipcMain.handle(IPC_CHANNELS.RECENT_UPSERT, (_event, payload: unknown) => {
    const parsed = RecentUpsertPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      log.warn('recent:upsert validation failed', {
        issues: parsed.error.issues,
      });
      return;
    }
    upsertRecent(
      parsed.data.filePath,
      parsed.data.fileName,
      parsed.data.fileSize ?? 0,
      parsed.data.pageCount ?? 0
    );
  });
}
