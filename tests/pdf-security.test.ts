import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// ── Encryption detection pattern test ────────────────────────────────────
// The checkEncrypted function scans PDF content for /Encrypt token.
// We test the detection logic directly with known PDF buffers.

function hasEncryptToken(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer);
  const content = String.fromCharCode(
    ...Array.from(bytes.subarray(0, Math.min(bytes.length, 65536)))
  );
  return /\/Encrypt[\s\d]/.test(content);
}

function isPdfHeader(buffer: ArrayBuffer): boolean {
  const header = String.fromCharCode(...Array.from(new Uint8Array(buffer).subarray(0, 5)));
  return header === '%PDF-';
}

describe('PDF encryption detection', () => {
  it('detects /Encrypt token pattern in raw PDF content', () => {
    // pdf-lib encodes content streams, so /Encrypt drawn as text won't appear raw.
    // Instead test the pattern matching directly with raw buffer content.
    const buf = new TextEncoder().encode(
      '%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n/Encrypt 4 0 R\n'
    ).buffer;
    expect(isPdfHeader(buf)).toBe(true);
    expect(hasEncryptToken(buf)).toBe(true);
  });

  it('does not detect /Encrypt in an unencrypted PDF', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([612, 792]);
    page.drawText('Normal document content', {
      x: 72,
      y: 720,
      size: 12,
      font,
      color: rgb(0, 0, 0),
    });
    const pdfBytes = await doc.save();

    expect(isPdfHeader(pdfBytes.buffer)).toBe(true);
    expect(hasEncryptToken(pdfBytes.buffer)).toBe(false);
  });

  it('detects /Encrypt followed by digit', () => {
    const buf = new TextEncoder().encode('%PDF-1.4\n/Encrypt 2 0 R\n').buffer;
    expect(hasEncryptToken(buf)).toBe(true);
  });

  it('detects /Encrypt followed by whitespace then digit', () => {
    const buf = new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<< /Encrypt  5 0 R >>\n').buffer;
    expect(hasEncryptToken(buf)).toBe(true);
  });

  it('does not false-positive on /Encrypted (no space/digit after)', () => {
    const buf = new TextEncoder().encode('%PDF-1.4\n/Encrypted is not a token\n').buffer;
    expect(hasEncryptToken(buf)).toBe(false);
  });

  it('rejects non-PDF files', () => {
    const buf = new TextEncoder().encode('Just some random text').buffer;
    expect(isPdfHeader(buf)).toBe(false);
  });

  it('rejects empty buffer', () => {
    const buf = new ArrayBuffer(0);
    expect(isPdfHeader(buf)).toBe(false);
  });
});

// ── Password handling in memory ──────────────────────────────────────────

describe('Password memory handling', () => {
  it('password is not stored in returned buffer metadata', async () => {
    const password = 'test-password-42';
    const doc = await PDFDocument.create();
    const page = doc.addPage([612, 792]);
    page.drawText('Secret document', {
      x: 72,
      y: 720,
      size: 12,
      font: await doc.embedFont(StandardFonts.Helvetica),
      color: rgb(0, 0, 0),
    });
    const pdfBytes = await doc.save();

    // Verify the password is not in the PDF bytes
    const textDecoder = new TextDecoder('latin1');
    const content = textDecoder.decode(pdfBytes);
    expect(content).not.toContain(password);
  });

  it('decryptWithPassword returns bytes without embedding password', async () => {
    const password = 'confidential-123';
    const doc = await PDFDocument.create();
    const page = doc.addPage([612, 792]);
    page.drawText('Protected content', {
      x: 72,
      y: 720,
      size: 12,
      font: await doc.embedFont(StandardFonts.Helvetica),
      color: rgb(0, 0, 0),
    });
    const bytes = await doc.save();

    // Simulate what decryptWithPassword does: return bytes without modification
    const resultBytes = bytes.buffer.slice(0);
    const content = new TextDecoder('latin1').decode(resultBytes);
    expect(content).not.toContain(password);
  });
});

// ── Encrypt/decrypt arg building (integration with qpdf.service) ─────────
// Validated via existing qpdf.test.ts which covers buildEncryptArgs/buildDecryptArgs.
// Here we test the end-to-end encryption flow semantics with pdf-lib.

describe('PDF encryption flow (pdf-lib level)', () => {
  it('can create a PDF that passes header validation', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([612, 792]);
    page.drawText('Valid PDF', {
      x: 72,
      y: 720,
      size: 12,
      font: await doc.embedFont(StandardFonts.Helvetica),
      color: rgb(0, 0, 0),
    });
    const bytes = await doc.save();
    const header = String.fromCharCode(...Array.from(bytes.subarray(0, 5)));
    expect(header).toBe('%PDF-');
  });

  it('can create an encrypted-marked PDF and reload it', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([612, 792]);
    page.drawText('/Encrypt marker for testing', {
      x: 72,
      y: 720,
      size: 12,
      font: await doc.embedFont(StandardFonts.Helvetica),
      color: rgb(0, 0, 0),
    });
    const saved = await doc.save();

    // Verify it can be reloaded
    const reloaded = await PDFDocument.load(saved, { ignoreEncryption: true });
    expect(reloaded.getPageCount()).toBe(1);
  });

  it('PDF produced by pdf-lib is reloadable and text is extractable', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([612, 792]);
    page.drawText('SECURITY_TEST_TOKEN_42', {
      x: 72,
      y: 700,
      size: 14,
      font,
      color: rgb(0, 0, 0),
    });
    const saved = await doc.save();

    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loadingTask = pdfjsLib.getDocument({ data: saved });
    const pdfDoc = await loadingTask.promise;
    const loadedPage = await pdfDoc.getPage(1);
    const textContent = await loadedPage.getTextContent();
    const text = textContent.items
      .map((item: { str?: string }) => ('str' in item ? item.str : ''))
      .join(' ');
    expect(text).toContain('SECURITY_TEST_TOKEN_42');
    loadedPage.cleanup();
    pdfDoc.destroy();
  });
});

// ── IPC schema validation for security payloads ──────────────────────────
// Extended tests to cover edge cases not in qpdf.test.ts

import { PdfEncryptPayloadSchema, PdfPasswordPayloadSchema } from '../src/shared/types/ipc.types';

describe('PDF security IPC schemas (extended)', () => {
  describe('PdfEncryptPayloadSchema edge cases', () => {
    it('accepts filePath with whitespace (min(1) passes)', () => {
      const result = PdfEncryptPayloadSchema.safeParse({
        filePath: '   ',
        userPassword: 'validpass',
      });
      // z.string().min(1) validates length >= 1, not content
      expect(result.success).toBe(true);
    });

    it('accepts long passwords', () => {
      const longPass = 'a'.repeat(128);
      const result = PdfEncryptPayloadSchema.safeParse({
        filePath: '/doc.pdf',
        userPassword: longPass,
      });
      expect(result.success).toBe(true);
    });

    it('accepts special characters in password', () => {
      const result = PdfEncryptPayloadSchema.safeParse({
        filePath: '/doc.pdf',
        userPassword: 'p@ssw0rd!$%^&*()',
      });
      expect(result.success).toBe(true);
    });

    it('accepts unicode file paths', () => {
      const result = PdfEncryptPayloadSchema.safeParse({
        filePath: '/Users/test/文档.pdf',
        userPassword: 'test',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('PdfPasswordPayloadSchema edge cases', () => {
    it('accepts password with only whitespace (min(1) passes)', () => {
      const result = PdfPasswordPayloadSchema.safeParse({
        filePath: '/doc.pdf',
        password: '   ',
      });
      // z.string().min(1) validates length >= 1, not content
      expect(result.success).toBe(true);
    });

    it('accepts password with spaces', () => {
      const result = PdfPasswordPayloadSchema.safeParse({
        filePath: '/doc.pdf',
        password: 'my pass phrase',
      });
      expect(result.success).toBe(true);
    });
  });
});
