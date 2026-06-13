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
import type { SignDigitalPayload, SignDigitalResult } from '../shared/types/signing.types';
import { sanitizeUpdateState } from '../shared/types/ipc.types';

export interface WindowApi {
  isE2E: boolean;
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

  saveSession(tabs: unknown[], activeTabId: string | null): Promise<void>;
  loadSession(): Promise<{ tabs: unknown[]; activeTabId: string | null } | null>;
  validatePdf(filePath: string): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    isPdfA: boolean;
    pdfaLevel?: string;
  }>;

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

  /**
   * Digitally sign a PDF using a P12/PFX certificate.
   * Returns signed PDF bytes (base64) or writes to outputPath.
   */
  signPdf(payload: SignDigitalPayload): Promise<SignDigitalResult>;
}

contextBridge.exposeInMainWorld('crosspdf', {
  isE2E: process.env.CROSSPDF_E2E === '1',

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

  saveSession: (tabs: unknown[], activeTabId: string | null) =>
    ipcRenderer.invoke(IPC_CHANNELS.SESSION_SAVE, { tabs, activeTabId }),

  loadSession: () => ipcRenderer.invoke(IPC_CHANNELS.SESSION_LOAD),

  validatePdf: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.PDF_VALIDATE, { filePath }),

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

  signPdf: (payload: SignDigitalPayload) =>
    ipcRenderer.invoke(IPC_CHANNELS.PDF_SIGN_DIGITAL, payload),
} satisfies WindowApi);

declare global {
  interface Window {
    crosspdf: WindowApi;
  }
}
