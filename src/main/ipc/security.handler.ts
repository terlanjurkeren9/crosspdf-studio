import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import {
  PdfCheckEncryptedPayloadSchema,
  PdfPasswordPayloadSchema,
  PdfEncryptPayloadSchema,
} from '../../shared/types/ipc.types';
import type { PdfCheckEncryptedResult, PdfPasswordResult } from '../../shared/types/ipc.types';
import {
  checkEncrypted,
  decryptWithPassword,
  encryptWithPassword,
  removePassword,
} from '../services/pdf-security.service';
import { validatePdf } from '../services/qpdf.service';
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
    IPC_CHANNELS.PDF_ENCRYPT,
    async (_event, payload: unknown): Promise<PdfPasswordResult> => {
      const parsed = PdfEncryptPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        return { success: false, error: 'Invalid payload' };
      }

      try {
        const data = await encryptWithPassword(
          parsed.data.filePath,
          parsed.data.userPassword,
          parsed.data.ownerPassword
        );
        return { success: true, data };
      } catch (err) {
        const msg = (err as Error).message;
        // Guard: error message must not contain raw password
        log.error('pdf:encrypt failed', { error: msg });
        return { success: false, error: msg };
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
        const msg = (err as Error).message;
        log.error('pdf:remove-password failed', { error: msg });
        return { success: false, error: msg };
      }
    }
  );

  ipcMain.handle(IPC_CHANNELS.PDF_VALIDATE, async (_event, payload: unknown) => {
    const parsed = PdfCheckEncryptedPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return { valid: false, errors: ['Invalid payload'], warnings: [], isPdfA: false };
    }

    try {
      return await validatePdf(parsed.data.filePath);
    } catch (err) {
      log.error('pdf:validate failed', { error: (err as Error).message });
      return {
        valid: false,
        errors: [(err as Error).message],
        warnings: [],
        isPdfA: false,
      };
    }
  });
}

/**
 * Encrypt a PDF buffer with password protection.
 * Used when the caller already has the PDF in memory.
 */
export async function handleEncryptPdf(
  pdfData: ArrayBuffer,
  userPassword: string,
  ownerPassword?: string
): Promise<ArrayBuffer> {
  // Write to temp, encrypt, return result
  const fs = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');
  const tmpDir = os.tmpdir();
  const tmpInput = path.join(tmpDir, `crosspdf-encrypt-in-${Date.now()}.pdf`);
  try {
    await fs.writeFile(tmpInput, Buffer.from(pdfData));
    return await encryptWithPassword(tmpInput, userPassword, ownerPassword);
  } finally {
    try {
      await fs.unlink(tmpInput);
    } catch {
      /* ignore cleanup errors */
    }
  }
}
