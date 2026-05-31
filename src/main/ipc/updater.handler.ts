import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import * as updaterService from '../services/updater.service';
import { log } from '../utils/logger';

export function registerUpdaterHandlers(): void {
  // Forward status changes to all renderer windows
  updaterService.onStatusChange((state) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.UPDATE_STATUS, state);
      }
    }
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_CHECK, async () => {
    log.debug('ipc:update:check');
    const state = await updaterService.checkForUpdates();
    return { state };
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_DOWNLOAD, async () => {
    log.debug('ipc:update:download');
    const state = await updaterService.downloadUpdate();
    return { state };
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_QUIT_AND_INSTALL, () => {
    log.debug('ipc:update:quit-and-install');
    updaterService.quitAndInstall();
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_GET_STATE, () => {
    log.debug('ipc:update:get-state');
    return { state: updaterService.getState() };
  });
}
