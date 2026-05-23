import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import {
  PdfCheckEncryptedPayloadSchema,
  PdfPasswordPayloadSchema,
} from '../../shared/types/ipc.types';
import type {
  PdfCheckEncryptedResult,
  PdfPasswordResult,
} from '../../shared/types/ipc.types';
import {
  checkEncrypted,
  decryptWithPassword,
  encryptWithPassword,
  removePassword,
} from '../services/pdf-security.service';
import { log } from '../utils/logger';

export function registerSecurityHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.PDF_CHECK_ENCRYPTED,
    async (_event, payload: unknown): Promise<PdfCheckEncryptedResult> => {
      const parsed = PdfCheckEncryptedPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        return { success: false, error: 'Invalid payload' };
      }

      try {
        const isEncrypted = await checkEncrypted(parsed.data.filePath);
        return { success: true, isEncrypted };
      } catch (err) {
        log.error('pdf:check-encrypted failed', { error: (err as Error).message });
        return { success: false, error: (err as Error).message };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.PDF_APPLY_PASSWORD,
    async (_event, payload: unknown): Promise<PdfPasswordResult> => {
      const parsed = PdfPasswordPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        return { success: false, error: 'Invalid payload' };
      }

      try {
        const data = await decryptWithPassword(parsed.data.filePath, parsed.data.password);
        return { success: true, data };
      } catch (err) {
        log.error('pdf:apply-password failed', { error: (err as Error).message });
        return { success: false, error: (err as Error).message };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.PDF_REMOVE_PASSWORD,
    async (_event, payload: unknown): Promise<PdfPasswordResult> => {
      const parsed = PdfPasswordPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        return { success: false, error: 'Invalid payload' };
      }

      try {
        const data = await removePassword(parsed.data.filePath, parsed.data.password);
        return { success: true, data };
      } catch (err) {
        log.error('pdf:remove-password failed', { error: (err as Error).message });
        return { success: false, error: (err as Error).message };
      }
    }
  );
}

/**
 * Encrypt a PDF buffer with password protection.
 * Called from renderer via a separate flow — reads the source PDF bytes,
 * applies encryption, and returns the encrypted bytes.
 * v1: stub until QPDF is bundled.
 */
export async function handleEncryptPdf(
  pdfData: ArrayBuffer,
  userPassword: string,
  ownerPassword?: string
): Promise<ArrayBuffer> {
  // v1: throws — requires bundled QPDF
  return encryptWithPassword('', userPassword, ownerPassword);
}
