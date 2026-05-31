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
  PdfCheckEncryptedResult,
  PdfPasswordResult,
  ExportSaveTextResult,
  UpdateState,
  UpdateStatusResult,
} from '../shared/types/ipc.types';
import { sanitizeUpdateState } from '../shared/types/ipc.types';

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

  checkEncrypted(filePath: string): Promise<PdfCheckEncryptedResult>;
  applyPassword(filePath: string, password: string): Promise<PdfPasswordResult>;
  encryptPdf(
    filePath: string,
    userPassword: string,
    ownerPassword?: string
  ): Promise<PdfPasswordResult>;
  removePassword(filePath: string, password: string): Promise<PdfPasswordResult>;

  saveTextFile(defaultPath: string, text: string): Promise<ExportSaveTextResult>;

  checkForUpdates(): Promise<UpdateStatusResult>;
  downloadUpdate(): Promise<UpdateStatusResult>;
  quitAndInstall(): void;
  getUpdateState(): Promise<UpdateStatusResult>;
  onUpdateStatus(callback: (state: UpdateState) => void): () => void;
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

  checkEncrypted: (filePath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PDF_CHECK_ENCRYPTED, { filePath }),

  applyPassword: (filePath: string, password: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PDF_APPLY_PASSWORD, { filePath, password }),

  encryptPdf: (filePath: string, userPassword: string, ownerPassword?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PDF_ENCRYPT, {
      filePath,
      userPassword,
      ownerPassword,
    }),

  removePassword: (filePath: string, password: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PDF_REMOVE_PASSWORD, { filePath, password }),

  saveTextFile: (defaultPath: string, text: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_SAVE_TEXT, { defaultPath, text }),

  checkForUpdates: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_CHECK),
  downloadUpdate: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_DOWNLOAD),
  quitAndInstall: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_QUIT_AND_INSTALL),
  getUpdateState: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_GET_STATE),
  onUpdateStatus: (callback: (state: UpdateState) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: unknown) =>
      callback(sanitizeUpdateState(state));
    ipcRenderer.on(IPC_CHANNELS.UPDATE_STATUS, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.UPDATE_STATUS, handler);
    };
  },
} satisfies WindowApi);

declare global {
  interface Window {
    crosspdf: WindowApi;
  }
}
