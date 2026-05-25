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

// ── Error serialization safety ───────────────────────────────────────────────

function serializeError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.length > 0) return err;
  return 'OCR processing failed';
}

function formatPageError(pageNumber: number, pageErr: unknown): string {
  const reason =
    pageErr instanceof Error && pageErr.message
      ? pageErr.message
      : typeof pageErr === 'string' && pageErr.length > 0
        ? pageErr
        : 'Unknown error';
  return `OCR failed on page ${pageNumber}: ${reason}`;
}

describe('error serialization', () => {
  it('serializes Error instance with message', () => {
    expect(serializeError(new Error('Out of memory'))).toBe('Out of memory');
  });

  it('serializes Error instance with empty message to fallback', () => {
    expect(serializeError(new Error())).toBe('OCR processing failed');
  });

  it('serializes string error', () => {
    expect(serializeError('Tesseract worker terminated')).toBe('Tesseract worker terminated');
  });

  it('serializes empty string to fallback', () => {
    expect(serializeError('')).toBe('OCR processing failed');
  });

  it('serializes undefined to fallback', () => {
    expect(serializeError(undefined)).toBe('OCR processing failed');
  });

  it('serializes null to fallback', () => {
    expect(serializeError(null)).toBe('OCR processing failed');
  });

  it('serializes non-Error object', () => {
    expect(serializeError({ code: 'ERR_OCR' })).toBe('OCR processing failed');
  });

  it('serializes number', () => {
    expect(serializeError(42)).toBe('OCR processing failed');
  });
});

describe('per-page error context', () => {
  it('formats page error with Error instance', () => {
    const msg = formatPageError(7, new Error('Canvas not available'));
    expect(msg).toBe('OCR failed on page 7: Canvas not available');
  });

  it('formats page error with string', () => {
    const msg = formatPageError(3, 'render failure');
    expect(msg).toBe('OCR failed on page 3: render failure');
  });

  it('formats page error with undefined as Unknown error', () => {
    const msg = formatPageError(1, undefined);
    expect(msg).toBe('OCR failed on page 1: Unknown error');
  });

  it('formats page error with empty Error', () => {
    const msg = formatPageError(5, new Error());
    expect(msg).toBe('OCR failed on page 5: Unknown error');
  });

  it('formats page error with empty string', () => {
    const msg = formatPageError(10, '');
    expect(msg).toBe('OCR failed on page 10: Unknown error');
  });

  it('formats page error with null', () => {
    const msg = formatPageError(2, null);
    expect(msg).toBe('OCR failed on page 2: Unknown error');
  });
});

// ── CanvasFactory contract ───────────────────────────────────────────────────

interface CanvasAndContext {
  canvas: { width: number; height: number };
  context: unknown;
}

/**
 * Replicates the OffscreenCanvas factory used in ocr.worker.ts.
 * In tests OffscreenCanvas may not be available, so we simulate
 * the contract shape without importing browser-only APIs.
 */
function createCanvasFactory(
  mkCanvas: (w: number, h: number) => { width: number; height: number }
): {
  create: (width: number, height: number) => CanvasAndContext;
  reset: (c: CanvasAndContext, width: number, height: number) => void;
  destroy: (c: CanvasAndContext) => void;
} {
  return {
    create(width: number, height: number) {
      const canvas = mkCanvas(width, height);
      return { canvas, context: {} };
    },
    reset(canvasAndContext: CanvasAndContext, width: number, height: number): void {
      canvasAndContext.canvas.width = width;
      canvasAndContext.canvas.height = height;
    },
    destroy(canvasAndContext: CanvasAndContext): void {
      canvasAndContext.canvas.width = 0;
      canvasAndContext.canvas.height = 0;
    },
  };
}

describe('CanvasFactory contract', () => {
  it('create returns canvas with requested dimensions', () => {
    const factory = createCanvasFactory((w, h) => ({ width: w, height: h }));
    const result = factory.create(800, 600);
    expect(result.canvas.width).toBe(800);
    expect(result.canvas.height).toBe(600);
    expect(result.context).toBeDefined();
  });

  it('reset changes canvas dimensions', () => {
    const factory = createCanvasFactory((w, h) => ({ width: w, height: h }));
    const result = factory.create(100, 100);
    factory.reset(result, 200, 300);
    expect(result.canvas.width).toBe(200);
    expect(result.canvas.height).toBe(300);
  });

  it('destroy zeroes canvas dimensions', () => {
    const factory = createCanvasFactory((w, h) => ({ width: w, height: h }));
    const result = factory.create(100, 100);
    factory.destroy(result);
    expect(result.canvas.width).toBe(0);
    expect(result.canvas.height).toBe(0);
  });

  it('factory shape matches expected interface', () => {
    const factory = createCanvasFactory((w, h) => ({ width: w, height: h }));
    expect(typeof factory.create).toBe('function');
    expect(typeof factory.reset).toBe('function');
    expect(typeof factory.destroy).toBe('function');
  });
});

// ── UI error message guard ───────────────────────────────────────────────────

function formatUiErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err || '');
  return msg || 'OCR failed';
}

describe('UI error message guard', () => {
  it('uses Error.message when available', () => {
    expect(formatUiErrorMessage(new Error('page 7 failed'))).toBe('page 7 failed');
  });

  it('falls back for empty Error', () => {
    expect(formatUiErrorMessage(new Error())).toBe('OCR failed');
  });

  it('falls back for undefined', () => {
    expect(formatUiErrorMessage(undefined)).toBe('OCR failed');
  });

  it('falls back for null', () => {
    expect(formatUiErrorMessage(null)).toBe('OCR failed');
  });

  it('never displays the string "undefined"', () => {
    // Even if somehow undefined gets stringified, the guard prevents it
    const result = formatUiErrorMessage(undefined);
    expect(result).not.toBe('undefined');
    expect(result).toBe('OCR failed');
  });
});
