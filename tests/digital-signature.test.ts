import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { IPC_CHANNELS } from '../src/shared/ipc-channels';
import { SignDigitalPayloadSchema } from '../src/shared/types/signing.types';
import { signPdfDigital } from '../src/main/services/pdf-signing.service';
import { createSinglePagePdf } from './helpers/pdf-test-fixtures';

const PASSPHRASE = 'crosspdf-test-passphrase';
const hasOpenSsl = (() => {
  try {
    execFileSync('openssl', ['version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

let tempDir: string;

function text(bytes: Uint8Array | Buffer): string {
  return Buffer.from(bytes).toString('latin1');
}

function generateP12(targetPath: string): void {
  const keyPath = path.join(tempDir, 'signing.key');
  const certPath = path.join(tempDir, 'signing.crt');

  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-keyout',
      keyPath,
      '-out',
      certPath,
      '-days',
      '1',
      '-nodes',
      '-subj',
      '/CN=CrossPDF Test Signer',
    ],
    { stdio: 'ignore' }
  );

  execFileSync(
    'openssl',
    [
      'pkcs12',
      '-export',
      '-inkey',
      keyPath,
      '-in',
      certPath,
      '-out',
      targetPath,
      '-passout',
      `pass:${PASSPHRASE}`,
    ],
    { stdio: 'ignore' }
  );
}

describe('Digital signature IPC contract', () => {
  it('defines a stable signing channel', () => {
    expect(IPC_CHANNELS.PDF_SIGN_DIGITAL).toBe('pdf:sign-digital');
  });

  it('accepts a valid P12 signing payload', () => {
    const result = SignDigitalPayloadSchema.safeParse({
      filePath: '/tmp/source.pdf',
      certificatePath: '/tmp/signer.p12',
      passphrase: 'secret',
      outputPath: '/tmp/signed.pdf',
      page: 1,
      widgetRect: [50, 60, 200, 40],
      name: 'CrossPDF Tester',
      reason: 'Approval',
      location: 'Jakarta',
      contactInfo: 'tester@example.com',
    });

    expect(result.success).toBe(true);
  });

  it('rejects empty required signing fields', () => {
    const result = SignDigitalPayloadSchema.safeParse({
      filePath: '',
      certificatePath: '',
      passphrase: '',
      page: 1,
      widgetRect: [50, 60, 200, 40],
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid page numbers', () => {
    const result = SignDigitalPayloadSchema.safeParse({
      filePath: '/tmp/source.pdf',
      certificatePath: '/tmp/signer.p12',
      passphrase: 'secret',
      page: 0,
      widgetRect: [50, 60, 200, 40],
    });

    expect(result.success).toBe(false);
  });

  it('rejects non-positive visible signature dimensions', () => {
    const result = SignDigitalPayloadSchema.safeParse({
      filePath: '/tmp/source.pdf',
      certificatePath: '/tmp/signer.p12',
      passphrase: 'secret',
      page: 1,
      widgetRect: [50, 60, 200, 0],
    });

    expect(result.success).toBe(false);
  });

  it('rejects negative visible signature coordinates', () => {
    const result = SignDigitalPayloadSchema.safeParse({
      filePath: '/tmp/source.pdf',
      certificatePath: '/tmp/signer.p12',
      passphrase: 'secret',
      page: 1,
      widgetRect: [-1, 60, 200, 40],
    });

    expect(result.success).toBe(false);
  });
});

describe('Digital signature service', () => {
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crosspdf-signature-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it.runIf(hasOpenSsl)('returns signed PDF bytes with ByteRange and Contents', async () => {
    const pdfPath = path.join(tempDir, 'source.pdf');
    const certPath = path.join(tempDir, 'signer.p12');
    fs.writeFileSync(pdfPath, await createSinglePagePdf('Digital signature source'));
    generateP12(certPath);

    const result = await signPdfDigital({
      filePath: pdfPath,
      certificatePath: certPath,
      passphrase: PASSPHRASE,
      page: 1,
      widgetRect: [50, 60, 200, 40],
      name: 'CrossPDF Test Signer',
      reason: 'Unit test approval',
      location: 'Jakarta',
      contactInfo: 'signer@example.com',
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeTruthy();

    const signed = Buffer.from(result.data ?? '', 'base64');
    const signedText = text(signed);
    const sourceSize = fs.statSync(pdfPath).size;
    expect(signed.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(signed.length).toBeGreaterThan(sourceSize);
    expect(signedText).toContain('/ByteRange');
    expect(signedText).toContain('/Contents');
    expect(signedText).toContain('/SubFilter /adbe.pkcs7.detached');
  });

  it.runIf(hasOpenSsl)('writes signed outputPath when requested', async () => {
    const pdfPath = path.join(tempDir, 'source.pdf');
    const certPath = path.join(tempDir, 'signer.p12');
    const outputPath = path.join(tempDir, 'signed', 'result.pdf');
    fs.writeFileSync(pdfPath, await createSinglePagePdf('Digital signature output'));
    generateP12(certPath);

    const result = await signPdfDigital({
      filePath: pdfPath,
      certificatePath: certPath,
      passphrase: PASSPHRASE,
      outputPath,
      page: 1,
      widgetRect: [50, 60, 200, 40],
    });

    expect(result).toEqual({ success: true, outputPath });
    expect(fs.existsSync(outputPath)).toBe(true);
    expect(text(fs.readFileSync(outputPath))).toContain('/ByteRange');
  });

  it.runIf(hasOpenSsl)('does not leak the passphrase on signing failure', async () => {
    const pdfPath = path.join(tempDir, 'source.pdf');
    const certPath = path.join(tempDir, 'signer.p12');
    fs.writeFileSync(pdfPath, await createSinglePagePdf('Digital signature failure'));
    generateP12(certPath);

    const result = await signPdfDigital({
      filePath: pdfPath,
      certificatePath: certPath,
      passphrase: 'wrong-passphrase',
      page: 1,
      widgetRect: [50, 60, 200, 40],
    });

    expect(result.success).toBe(false);
    expect(result.error).not.toContain('wrong-passphrase');
  });

  it('returns a clear error for missing PDF files', async () => {
    const result = await signPdfDigital({
      filePath: path.join(tempDir, 'missing.pdf'),
      certificatePath: path.join(tempDir, 'missing.p12'),
      passphrase: PASSPHRASE,
      page: 1,
      widgetRect: [50, 60, 200, 40],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('File not found');
  });
});
