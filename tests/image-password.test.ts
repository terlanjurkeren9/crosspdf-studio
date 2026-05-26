import { describe, expect, it } from 'vitest';

/**
 * Replicate the document-params building logic from image.worker.ts
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

describe('Image worker document params (password forwarding)', () => {
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
 * Replicate the conditional spread logic used in convertPdfToImages for the request.
 */
function buildImageRequest(
  pdfBytes: ArrayBuffer,
  pageNumbers: number[],
  scale: number,
  password?: string
): Record<string, unknown> {
  return {
    id: 'test-id',
    type: 'pdf-to-images',
    pdfBytes,
    pageNumbers,
    scale,
    ...(password ? { password } : {}),
  };
}

describe('Image service request contract', () => {
  const dummyPdf = new ArrayBuffer(8);

  it('builds request without password when omitted', () => {
    const req = buildImageRequest(dummyPdf, [1, 2], 2);
    expect(req).toHaveProperty('id');
    expect(req).toHaveProperty('pdfBytes');
    expect(req).toHaveProperty('pageNumbers', [1, 2]);
    expect(req).toHaveProperty('scale', 2);
    expect(req).not.toHaveProperty('password');
  });

  it('builds request with password when provided', () => {
    const req = buildImageRequest(dummyPdf, [1], 2, 'mypass');
    expect(req).toHaveProperty('password', 'mypass');
  });

  it('builds request without password when empty string', () => {
    const req = buildImageRequest(dummyPdf, [1], 2, '');
    expect(req).not.toHaveProperty('password');
  });

  it('password is not included in default properties', () => {
    const req = buildImageRequest(dummyPdf, [1], 2);
    expect(Object.keys(req).includes('password')).toBe(false);
    expect(Object.keys(req).sort()).toEqual(
      ['id', 'type', 'pdfBytes', 'pageNumbers', 'scale'].sort()
    );
  });

  it('password is included only when truthy', () => {
    const withPass = buildImageRequest(dummyPdf, [1], 2, 'p');
    expect(Object.keys(withPass).includes('password')).toBe(true);

    const withUndefined = buildImageRequest(dummyPdf, [1], 2, undefined);
    expect(Object.keys(withUndefined).includes('password')).toBe(false);
  });
});
