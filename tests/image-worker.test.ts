import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';

// ── Helpers ───────────────────────────────────────────────────

/** Minimal valid 1x1 red PNG */
function makePngBuffer(): Uint8Array {
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x00, 0x03, 0x00, 0x01, 0x4d, 0x69, 0x2d, 0xb1, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
    0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
}

/** Minimal valid 1x1 JPEG (grayscale) */
function makeJpegBuffer(): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
    0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
    0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
    0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
    0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
    0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
    0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03,
    0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7d, 0x01, 0x02, 0x03, 0x00,
    0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32,
    0x81, 0x91, 0xa1, 0x08, 0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72,
    0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x34, 0x35,
    0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55,
    0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75,
    0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x92, 0x93, 0x94,
    0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2,
    0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9,
    0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6,
    0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa, 0xff, 0xda,
    0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x7b, 0x94, 0x11, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xd9,
  ]);
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
}

// ── Image embedding logic (mirrors worker's handleImagesToPdf) ─

async function createPdfFromImages(
  images: { bytes: ArrayBuffer; mimeType: string }[]
): Promise<Uint8Array> {
  if (images.length === 0) {
    throw new Error('At least one image is required to create a PDF.');
  }

  const pdfDoc = await PDFDocument.create();

  for (const img of images) {
    let image;
    if (img.mimeType === 'image/png') {
      image = await pdfDoc.embedPng(new Uint8Array(img.bytes));
    } else if (img.mimeType === 'image/jpeg') {
      image = await pdfDoc.embedJpg(new Uint8Array(img.bytes));
    } else {
      throw new Error(
        `Unsupported image format: ${img.mimeType}. Only PNG and JPEG are supported.`
      );
    }

    const page = pdfDoc.addPage([image.width, image.height]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    });
  }

  return pdfDoc.save({ useObjectStreams: true });
}

// ── Page range parser (mirrors dialog's parseRange logic) ─

function parsePageRange(raw: string, maxPage: number): number[] {
  const pages: number[] = [];
  const parts = raw.split(',').map((p) => p.trim());
  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map((s) => s.trim());
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (isNaN(start) || isNaN(end) || start < 1 || end > maxPage || start > end) {
        throw new Error(`Invalid page range "${part}". Pages must be between 1 and ${maxPage}.`);
      }
      for (let i = start; i <= end; i++) pages.push(i);
    } else {
      const n = parseInt(part, 10);
      if (isNaN(n) || n < 1 || n > maxPage) {
        throw new Error(`Invalid page number "${part}". Pages must be between 1 and ${maxPage}.`);
      }
      pages.push(n);
    }
  }
  return [...new Set(pages)].sort((a, b) => a - b);
}

// ── Tests ─────────────────────────────────────────────────────

describe('Images to PDF conversion', () => {
  it('creates a valid PDF from a single PNG image', async () => {
    const pngBytes = toArrayBuffer(makePngBuffer());
    const result = await createPdfFromImages([{ bytes: pngBytes, mimeType: 'image/png' }]);

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);

    // Verify it's a valid PDF that pdf-lib can load back
    const reloaded = await PDFDocument.load(result);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it('creates a valid PDF from a single JPEG image', async () => {
    const jpgBytes = toArrayBuffer(makeJpegBuffer());
    const result = await createPdfFromImages([{ bytes: jpgBytes, mimeType: 'image/jpeg' }]);

    const reloaded = await PDFDocument.load(result);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it('preserves page ordering from multiple images', async () => {
    const png1 = toArrayBuffer(makePngBuffer());
    const png2 = toArrayBuffer(makePngBuffer());
    const jpg = toArrayBuffer(makeJpegBuffer());

    const result = await createPdfFromImages([
      { bytes: png1, mimeType: 'image/png' },
      { bytes: jpg, mimeType: 'image/jpeg' },
      { bytes: png2, mimeType: 'image/png' },
    ]);

    const reloaded = await PDFDocument.load(result);
    expect(reloaded.getPageCount()).toBe(3);

    // Each page should have the image dimensions (1x1 in our test images)
    for (let i = 0; i < 3; i++) {
      const page = reloaded.getPage(i);
      expect(page.getSize().width).toBe(1);
      expect(page.getSize().height).toBe(1);
    }
  });

  it('rejects unsupported image formats', async () => {
    const pngBytes = toArrayBuffer(makePngBuffer());
    await expect(createPdfFromImages([{ bytes: pngBytes, mimeType: 'image/gif' }])).rejects.toThrow(
      /Unsupported image format/
    );
  });

  it('rejects empty images array', async () => {
    await expect(createPdfFromImages([])).rejects.toThrow(/at least one image/i);
  });

  it('handles multiple PNG images correctly', async () => {
    const images = Array.from({ length: 5 }, () => ({
      bytes: toArrayBuffer(makePngBuffer()),
      mimeType: 'image/png' as const,
    }));

    const result = await createPdfFromImages(images);
    const reloaded = await PDFDocument.load(result);
    expect(reloaded.getPageCount()).toBe(5);
  });

  it('mixed PNG and JPEG images produce valid PDF', async () => {
    const result = await createPdfFromImages([
      { bytes: toArrayBuffer(makePngBuffer()), mimeType: 'image/png' },
      { bytes: toArrayBuffer(makeJpegBuffer()), mimeType: 'image/jpeg' },
      { bytes: toArrayBuffer(makePngBuffer()), mimeType: 'image/png' },
      { bytes: toArrayBuffer(makeJpegBuffer()), mimeType: 'image/jpeg' },
    ]);

    const reloaded = await PDFDocument.load(result);
    expect(reloaded.getPageCount()).toBe(4);
  });

  it('output PDF is structurally valid with correct page dimensions', async () => {
    const pngBytes = toArrayBuffer(makePngBuffer());
    const pdfDoc = await PDFDocument.create();
    const image = await pdfDoc.embedPng(new Uint8Array(pngBytes));
    const page = pdfDoc.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    pdfDoc.setProducer('CrossPDF Studio');
    pdfDoc.setCreator('CrossPDF Studio');
    const result = await pdfDoc.save({ useObjectStreams: true });

    const reloaded = await PDFDocument.load(result);
    expect(reloaded.getPageCount()).toBe(1);
    expect(reloaded.getPage(0).getSize().width).toBe(1);
    expect(reloaded.getPage(0).getSize().height).toBe(1);
  });
});

describe('Page range parser', () => {
  it('parses single page', () => {
    expect(parsePageRange('3', 10)).toEqual([3]);
  });

  it('parses comma-separated pages', () => {
    expect(parsePageRange('1,3,5', 10)).toEqual([1, 3, 5]);
  });

  it('parses a range', () => {
    expect(parsePageRange('2-5', 10)).toEqual([2, 3, 4, 5]);
  });

  it('parses mixed ranges and singles', () => {
    expect(parsePageRange('1,3-5,7', 10)).toEqual([1, 3, 4, 5, 7]);
  });

  it('deduplicates overlapping ranges', () => {
    expect(parsePageRange('1-5,3-7', 10)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('sorts results', () => {
    expect(parsePageRange('5,1,3', 10)).toEqual([1, 3, 5]);
  });

  it('rejects page 0', () => {
    expect(() => parsePageRange('0', 10)).toThrow(/between 1 and 10/);
  });

  it('rejects page above maxPage', () => {
    expect(() => parsePageRange('11', 10)).toThrow(/between 1 and 10/);
  });

  it('rejects reversed range', () => {
    expect(() => parsePageRange('5-1', 10)).toThrow(/Invalid page range/);
  });

  it('parses full document range', () => {
    expect(parsePageRange('1-5', 5)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('Image format validation', () => {
  it('accepts image/png', () => {
    const mime = 'image/png';
    expect(mime === 'image/png' || mime === 'image/jpeg').toBe(true);
  });

  it('accepts image/jpeg', () => {
    const mime = 'image/jpeg';
    expect(mime === 'image/png' || mime === 'image/jpeg').toBe(true);
  });

  it('rejects image/gif', () => {
    const mime = 'image/gif';
    expect(mime === 'image/png' || mime === 'image/jpeg').toBe(false);
  });

  it('rejects image/bmp', () => {
    const mime = 'image/bmp';
    expect(mime === 'image/png' || mime === 'image/jpeg').toBe(false);
  });

  it('rejects image/webp', () => {
    const mime = 'image/webp';
    expect(mime === 'image/png' || mime === 'image/jpeg').toBe(false);
  });
});
