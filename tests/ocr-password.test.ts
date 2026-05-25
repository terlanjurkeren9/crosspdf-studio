import { describe, expect, it } from 'vitest';

/**
 * Replicate the document-params building logic from ocr.worker.ts
 * so we can verify password is forwarded when provided and omitted otherwise.
 */
function buildDocParams(pdfBytes: ArrayBuffer, password?: string): Record<string, unknown> {
  const params: Record<string, unknown> = {
    data: pdfBytes.slice(0),
    useWorkerFetch: false,
    useSystemFonts: false,
    disableAutoFetch: true,
    disableStream: true,
  };
  if (password) {
    params.password = password;
  }
  return params;
}

describe('OCR document params (password forwarding)', () => {
  const dummyPdf = new ArrayBuffer(8);

  it('omits password key when not provided', () => {
    const params = buildDocParams(dummyPdf);
    expect(params).not.toHaveProperty('password');
  });

  it('includes password key when provided', () => {
    const params = buildDocParams(dummyPdf, 'secret123');
    expect(params).toHaveProperty('password', 'secret123');
  });

  it('omits password key when empty string is provided', () => {
    const params = buildDocParams(dummyPdf, '');
    expect(params).not.toHaveProperty('password');
  });
});

/**
 * Replicate the conditional spread logic used in runOcr for the OcrRequest.
 */
function buildOcrRequest(
  pdfBytes: ArrayBuffer,
  pageNumbers: number[],
  language: string,
  dpi: number,
  password?: string
): Record<string, unknown> {
  return {
    id: 'test-id',
    pdfBytes,
    pageNumbers,
    language,
    dpi,
    ...(password ? { password } : {}),
  };
}

describe('OCR request contract', () => {
  const dummyPdf = new ArrayBuffer(8);

  it('builds request without password when omitted', () => {
    const req = buildOcrRequest(dummyPdf, [1, 2], 'eng', 300);
    expect(req).toHaveProperty('id');
    expect(req).toHaveProperty('pdfBytes');
    expect(req).toHaveProperty('pageNumbers', [1, 2]);
    expect(req).toHaveProperty('language', 'eng');
    expect(req).toHaveProperty('dpi', 300);
    expect(req).not.toHaveProperty('password');
  });

  it('builds request with password when provided', () => {
    const req = buildOcrRequest(dummyPdf, [1], 'fra', 150, 'mypass');
    expect(req).toHaveProperty('password', 'mypass');
  });

  it('builds request without password when empty string', () => {
    const req = buildOcrRequest(dummyPdf, [1], 'eng', 300, '');
    expect(req).not.toHaveProperty('password');
  });

  it('password is not included in default properties', () => {
    const req = buildOcrRequest(dummyPdf, [1], 'eng', 300);
    expect(Object.keys(req).includes('password')).toBe(false);
    expect(Object.keys(req).sort()).toEqual(
      ['id', 'pdfBytes', 'pageNumbers', 'language', 'dpi'].sort()
    );
  });

  it('password is included only when truthy', () => {
    const withPass = buildOcrRequest(dummyPdf, [1], 'eng', 300, 'p');
    expect(Object.keys(withPass).includes('password')).toBe(true);

    const withUndefined = buildOcrRequest(dummyPdf, [1], 'eng', 300, undefined);
    expect(Object.keys(withUndefined).includes('password')).toBe(false);
  });
});

// ── Regression note ──────────────────────────────────────────────────────────
// Encrypted PDFs opened with a password store the password in the in-memory
// TabState (tab.password). The OCR flow now forwards tab.password through
// OcrDialog → runOcr → OcrRequest → ocr.worker → pdfjsLib.getDocument.
// Without this, pdfjs would throw "No password given" on encrypted PDFs.
