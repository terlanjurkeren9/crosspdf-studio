import { readFileBuffer } from './file.service';
import { log } from '../utils/logger';

/**
 * PDF Security Service
 *
 * v1 foundation: uses pdf-lib for basic encryption detection and
 * password-based open. Full encryption (apply/remove with AES) is
 * stubbed for the bundled QPDF binary integration in a follow-up.
 */

const PDF_HEADER = '%PDF-';

export async function checkEncrypted(filePath: string): Promise<boolean> {
  const buffer = Buffer.from(await readFileBuffer(filePath));
  const header = buffer.subarray(0, 8).toString('latin1');

  if (!header.startsWith(PDF_HEADER)) {
    throw new Error('Not a valid PDF file');
  }

  // Check for encryption dictionary marker in first ~4KB
  const head = buffer.subarray(0, 4096).toString('latin1');
  return head.includes('/Encrypt');
}

export async function decryptWithPassword(
  filePath: string,
  _password: string
): Promise<ArrayBuffer> {
  // v1: returns raw bytes. pdfjs-dist handles password-based decryption
  // in the renderer. When QPDF is available, this will invoke:
  //   qpdf --password=<password> --decrypt <input> <output>
  void _password;

  const buffer = await readFileBuffer(filePath);

  // Validate the file starts with PDF header
  const header = Buffer.from(buffer).subarray(0, 8).toString('latin1');
  if (!header.startsWith(PDF_HEADER)) {
    throw new Error('Not a valid PDF file');
  }

  log.info('Returning PDF bytes for password-based open (pdf-lib path)');
  return buffer;
}

/**
 * Apply password protection to a PDF.
 * v1: stub — returns the input bytes unchanged.
 * When QPDF is bundled, this will invoke:
 *   qpdf --encrypt <user-password> <owner-password> 256 -- <input> <output>
 */
export async function encryptWithPassword(
  filePath: string,
  userPassword: string,
  ownerPassword?: string
): Promise<ArrayBuffer> {
  void filePath;
  void userPassword;
  void ownerPassword;
  throw new Error(
    'Password protection (encryption) requires bundled QPDF. ' +
      'This feature will be enabled in a follow-up release.'
  );
}

/**
 * Remove password protection from a PDF.
 * v1: stub — throws.
 * When QPDF is bundled, this will invoke:
 *   qpdf --password=<password> --decrypt <input> <output>
 */
export async function removePassword(
  filePath: string,
  password: string
): Promise<ArrayBuffer> {
  void filePath;
  void password;
  throw new Error(
    'Password removal requires bundled QPDF. ' +
      'This feature will be enabled in a follow-up release.'
  );
}
