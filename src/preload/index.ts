import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import type {
  OpenDialogOptions,
  OpenDialogResult,
  RecentDocumentResult,
  SaveDialogOptions,
  SaveDialogResult,
  ReadFileResult,
  WriteFileResult,
  PlatformInfo,
} from '../shared/types/ipc.types';

export interface WindowApi {
  openFileDialog(options?: OpenDialogOptions): Promise<OpenDialogResult>;
  saveFileDialog(options?: SaveDialogOptions): Promise<SaveDialogResult>;
  readFile(filePath: string): Promise<ReadFileResult>;
  writeFile(filePath: string, data: ArrayBuffer): Promise<WriteFileResult>;

  getRecentDocuments(): Promise<RecentDocumentResult[]>;
  upsertRecentDocument(
    filePath: string,
    fileName: string,
    fileSize?: number,
    pageCount?: number
  ): Promise<void>;

  getPlatform(): Promise<PlatformInfo>;
  getAppVersion(): Promise<string>;
  openExternal(url: string): Promise<void>;

  getPreference(key: string): Promise<unknown>;
  setPreference(key: string, value: unknown): Promise<void>;
}

contextBridge.exposeInMainWorld('crosspdf', {
  openFileDialog: (options?: OpenDialogOptions) =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_OPEN_DIALOG, options ?? {}),

  saveFileDialog: (options?: SaveDialogOptions) =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_SAVE_DIALOG, options ?? {}),

  readFile: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.FILE_READ, { filePath }),

  writeFile: (filePath: string, data: ArrayBuffer) =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_WRITE_ATOMIC, { filePath, data }),

  getRecentDocuments: () => ipcRenderer.invoke(IPC_CHANNELS.RECENT_GET_ALL),

  upsertRecentDocument: (
    filePath: string,
    fileName: string,
    fileSize?: number,
    pageCount?: number
  ) =>
    ipcRenderer.invoke(IPC_CHANNELS.RECENT_UPSERT, {
      filePath,
      fileName,
      fileSize,
      pageCount,
    }),

  getPlatform: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_PLATFORM),

  getAppVersion: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_APP_VERSION),

  openExternal: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_OPEN_EXTERNAL, { url }),

  getPreference: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.DB_GET_PREFERENCE, { key }),

  setPreference: (key: string, value: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_SET_PREFERENCE, { key, value }),
} satisfies WindowApi);

declare global {
  interface Window {
    crosspdf: WindowApi;
  }
}
