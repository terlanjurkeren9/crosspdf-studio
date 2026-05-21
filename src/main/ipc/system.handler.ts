import { ipcMain, app, shell } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { SystemOpenExternalPayloadSchema } from '../../shared/types/ipc.types';
import type { PlatformInfo } from '../../shared/types/ipc.types';
import { log } from '../utils/logger';

export function registerSystemHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SYSTEM_GET_PLATFORM, (): PlatformInfo => {
    return {
      platform: process.platform,
      arch: process.arch,
      version: app.getVersion(),
      electronVersion: process.versions.electron!,
      chromeVersion: process.versions.chrome!,
      nodeVersion: process.versions.node!,
    };
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_GET_APP_VERSION, () => {
    return app.getVersion();
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_OPEN_EXTERNAL, async (_event, payload: unknown) => {
    const parsed = SystemOpenExternalPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      log.warn('system:open-external validation failed', {
        issues: parsed.error.issues,
      });
      return;
    }

    const { url } = parsed.data;
    if (url.startsWith('https://') || url.startsWith('http://')) {
      await shell.openExternal(url);
    }
  });
}
