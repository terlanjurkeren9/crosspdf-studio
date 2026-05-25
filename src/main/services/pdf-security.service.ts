import { readFileBuffer } from './file.service';
import { log } from '../utils/logger';
import { encryptPdf, decryptPdf } from './qpdf.service';

/**
 * PDF Security Service
 *
 * Encryption detection uses /Encrypt token scanning.
 * Password-based open (decryptWithPassword) returns raw bytes —
 * pdfjs-dist handles in-memory decryption in the renderer.
 * Encryption and permanent decryption are delegated to bundled QPDF.
 */

const PDF_HEADER = '%PDF-';

export async function checkEncrypted(filePath: string): Promise<boolean> {
  const buffer = Buffer.from(await readFileBuffer(filePath));
  const header = buffer.subarray(0, 8).toString('latin1');

  if (!header.startsWith(PDF_HEADER)) {
    throw new Error('Not a valid PDF file');
  }

  const content = buffer.toString('latin1');
  return /\/Encrypt[\s\d]/.test(content);
}

export async function decryptWithPassword(
  filePath: string,
  _password: string
): Promise<ArrayBuffer> {
  void _password;

  const buffer = await readFileBuffer(filePath);

  const header = Buffer.from(buffer).subarray(0, 8).toString('latin1');
  if (!header.startsWith(PDF_HEADER)) {
    throw new Error('Not a valid PDF file');
  }

  log.info('Returning PDF bytes for password-based open');
  return buffer;
}

/**
 * Apply password protection using bundled QPDF.
 * Returns the encrypted PDF buffer. Never logs passwords.
 */
export async function encryptWithPassword(
  filePath: string,
  userPassword: string,
  ownerPassword?: string
): Promise<ArrayBuffer> {
  const encrypted = await encryptPdf(filePath, userPassword, ownerPassword);
  return new Uint8Array(encrypted).buffer as ArrayBuffer;
}

/**
 * Remove password protection using bundled QPDF.
 * Returns the decrypted PDF buffer. Never logs passwords.
 */
export async function removePassword(filePath: string, password: string): Promise<ArrayBuffer> {
  const decrypted = await decryptPdf(filePath, password);
  return new Uint8Array(decrypted).buffer as ArrayBuffer;
}
