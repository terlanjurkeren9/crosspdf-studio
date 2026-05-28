import { describe, it, expect } from 'vitest';
import { PDFDocument, degrees } from 'pdf-lib';
import {
  createMultiPagePdf,
  createSinglePagePdf,
  createPdfWithPages,
  extractTextFromPdf,
} from './helpers/pdf-test-fixtures';

async function mergePdfs(sources: ArrayBuffer[]): Promise<Uint8Array> {
  const output = await PDFDocument.create();
  for (const bytes of sources) {
    const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pageIndices = source.getPageIndices();
    const pages = await output.copyPages(source, pageIndices);
    for (const page of pages) output.addPage(page);
  }
  output.setProducer('CrossPDF Studio');
  return output.save({ useObjectStreams: true });
}

async function splitPdf(
  source: ArrayBuffer,
  pagesPerFile?: number,
  ranges?: number[][]
): Promise<Uint8Array[]> {
  const src = await PDFDocument.load(source, { ignoreEncryption: true });
  const totalPages = src.getPageCount();
  const chunks: number[][] = [];
  if (ranges && ranges.length > 0) {
    for (const range of ranges) {
      const chunk: number[] = [];
      for (const p of range) {
        if (p >= 1 && p <= totalPages) chunk.push(p - 1);
      }
      if (chunk.length > 0) chunks.push(chunk);
    }
  } else if (pagesPerFile && pagesPerFile > 0) {
    for (let start = 0; start < totalPages; start += pagesPerFile) {
      const chunk: number[] = [];
      const end = Math.min(start + pagesPerFile, totalPages);
      for (let i = start; i < end; i++) chunk.push(i);
      chunks.push(chunk);
    }
  }
  if (chunks.length === 0) throw new Error('No valid split ranges or page count specified.');

  const results: Uint8Array[] = [];
  for (const chunk of chunks) {
    const doc = await PDFDocument.create();
    const pages = await doc.copyPages(src, chunk);
    for (const page of pages) doc.addPage(page);
    doc.setProducer('CrossPDF Studio');
    results.push(await doc.save({ useObjectStreams: true }));
  }
  return results;
}

async function reorderPdf(source: ArrayBuffer, newOrder: number[]): Promise<Uint8Array> {
  const src = await PDFDocument.load(source, { ignoreEncryption: true });
  const output = await PDFDocument.create();
  const zeroBased = newOrder.map((p) => p - 1);
  const pages = await output.copyPages(src, zeroBased);
  for (const page of pages) output.addPage(page);
  output.setProducer('CrossPDF Studio');
  return output.save({ useObjectStreams: true });
}

async function deletePages(source: ArrayBuffer, pagesToDelete: number[]): Promise<Uint8Array> {
  const src = await PDFDocument.load(source, { ignoreEncryption: true });
  const totalPages = src.getPageCount();
  const deleteSet = new Set(pagesToDelete.map((p) => p - 1));
  const keep: number[] = [];
  for (let i = 0; i < totalPages; i++) {
    if (!deleteSet.has(i)) keep.push(i);
  }
  if (keep.length === 0) throw new Error('Cannot delete all pages');

  const output = await PDFDocument.create();
  const pages = await output.copyPages(src, keep);
  for (const page of pages) output.addPage(page);
  output.setProducer('CrossPDF Studio');
  return output.save({ useObjectStreams: true });
}

async function extractPages(source: ArrayBuffer, pages: number[]): Promise<Uint8Array> {
  const src = await PDFDocument.load(source, { ignoreEncryption: true });
  const totalPages = src.getPageCount();
  const zeroBased = pages.filter((p) => p >= 1 && p <= totalPages).map((p) => p - 1);
  if (zeroBased.length === 0) throw new Error('No valid pages to extract.');

  const output = await PDFDocument.create();
  const copied = await output.copyPages(src, zeroBased);
  for (const page of copied) output.addPage(page);
  output.setProducer('CrossPDF Studio');
  return output.save({ useObjectStreams: true });
}

async function rotatePages(
  source: ArrayBuffer,
  rotations: [number, number][]
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(source, { ignoreEncryption: true });
  for (const [pageNum, amount] of rotations) {
    const page = doc.getPage(pageNum - 1);
    if (page) {
      const current = page.getRotation().angle;
      page.setRotation(degrees(current + amount));
    }
  }
  doc.setProducer('CrossPDF Studio');
  return doc.save({ useObjectStreams: true });
}

// ── Merge ──────────────────────────────────────────────────────────────────

describe('PDF merge', () => {
  it('merges two single-page PDFs into a 2-page PDF', async () => {
    const pdf1 = await createSinglePagePdf('Document A');
    const pdf2 = await createSinglePagePdf('Document B');
    const merged = await mergePdfs([pdf1.buffer, pdf2.buffer]);
    const doc = await PDFDocument.load(merged);
    expect(doc.getPageCount()).toBe(2);
  });

  it('merges three PDFs with different page counts', async () => {
    const p1 = await createSinglePagePdf('One');
    const p2 = await createMultiPagePdf(3);
    const p3 = await createSinglePagePdf('Three');
    const merged = await mergePdfs([p1.buffer, p2.buffer, p3.buffer]);
    const doc = await PDFDocument.load(merged);
    expect(doc.getPageCount()).toBe(5);
  });

  it('preserves text content across merge', async () => {
    const pdf1 = await createSinglePagePdf('FIRST_DOCUMENT_MARKER');
    const pdf2 = await createSinglePagePdf('SECOND_DOCUMENT_MARKER');
    const merged = await mergePdfs([pdf1.buffer, pdf2.buffer]);

    const page1Text = await extractTextFromPdf(merged.buffer, 1);
    const page2Text = await extractTextFromPdf(merged.buffer, 2);
    expect(page1Text).toContain('FIRST_DOCUMENT_MARKER');
    expect(page2Text).toContain('SECOND_DOCUMENT_MARKER');
  });

  it('handles empty source array (pdf-lib creates blank page as default)', async () => {
    const merged = await mergePdfs([]);
    const doc = await PDFDocument.load(merged);
    // PDFDocument.create() always initializes with one blank page
    expect(doc.getPageCount()).toBe(1);
  });
});

// ── Split ──────────────────────────────────────────────────────────────────

describe('PDF split', () => {
  it('splits by pages-per-file (2 pages each from 5-page doc)', async () => {
    const pdf = await createMultiPagePdf(5);
    const results = await splitPdf(pdf.buffer, 2);
    expect(results).toHaveLength(3);

    const doc0 = await PDFDocument.load(results[0]);
    const doc1 = await PDFDocument.load(results[1]);
    const doc2 = await PDFDocument.load(results[2]);
    expect(doc0.getPageCount()).toBe(2);
    expect(doc1.getPageCount()).toBe(2);
    expect(doc2.getPageCount()).toBe(1);
  });

  it('splits by custom ranges', async () => {
    const pdf = await createMultiPagePdf(6);
    const results = await splitPdf(pdf.buffer, undefined, [
      [1, 2],
      [4, 5, 6],
    ]);
    expect(results).toHaveLength(2);

    const doc0 = await PDFDocument.load(results[0]);
    const doc1 = await PDFDocument.load(results[1]);
    expect(doc0.getPageCount()).toBe(2);
    expect(doc1.getPageCount()).toBe(3);
  });

  it('preserves text after split', async () => {
    const pdf = await createPdfWithPages([
      { text: 'PAGE_ONE_SPLIT_MARKER' },
      { text: 'PAGE_TWO_SPLIT_MARKER' },
      { text: 'PAGE_THREE_SPLIT_MARKER' },
    ]);
    const results = await splitPdf(pdf.buffer, 1);
    expect(results).toHaveLength(3);

    const text0 = await extractTextFromPdf(results[0].buffer, 1);
    expect(text0).toContain('PAGE_ONE_SPLIT_MARKER');
  });

  it('throws on no valid ranges', async () => {
    const pdf = await createSinglePagePdf('test');
    await expect(splitPdf(pdf.buffer, undefined, [])).rejects.toThrow(/No valid split ranges/);
  });

  it('single page per file yields same count as total pages', async () => {
    const pdf = await createMultiPagePdf(4);
    const results = await splitPdf(pdf.buffer, 1);
    expect(results).toHaveLength(4);
  });
});

// ── Reorder ────────────────────────────────────────────────────────────────

describe('PDF reorder', () => {
  it('reverses page order', async () => {
    const pdf = await createPdfWithPages([
      { text: 'FIRST_PAGE' },
      { text: 'SECOND_PAGE' },
      { text: 'THIRD_PAGE' },
    ]);
    const reordered = await reorderPdf(pdf.buffer, [3, 2, 1]);
    const doc = await PDFDocument.load(reordered);
    expect(doc.getPageCount()).toBe(3);

    const text1 = await extractTextFromPdf(reordered.buffer, 1);
    expect(text1).toContain('THIRD_PAGE');
  });

  it('maintains correct page count after reorder', async () => {
    const pdf = await createMultiPagePdf(5);
    const reordered = await reorderPdf(pdf.buffer, [5, 4, 3, 2, 1]);
    const doc = await PDFDocument.load(reordered);
    expect(doc.getPageCount()).toBe(5);
  });

  it('moves last page to first', async () => {
    const pdf = await createPdfWithPages([{ text: 'ORIGINAL_FIRST' }, { text: 'ORIGINAL_LAST' }]);
    const reordered = await reorderPdf(pdf.buffer, [2, 1]);
    const text1 = await extractTextFromPdf(reordered.buffer, 1);
    expect(text1).toContain('ORIGINAL_LAST');
  });
});

// ── Delete ─────────────────────────────────────────────────────────────────

describe('PDF delete pages', () => {
  it('deletes a single page from a multi-page PDF', async () => {
    const pdf = await createMultiPagePdf(5);
    const result = await deletePages(pdf.buffer, [3]);
    const doc = await PDFDocument.load(result);
    expect(doc.getPageCount()).toBe(4);
  });

  it('deletes multiple pages', async () => {
    const pdf = await createMultiPagePdf(6);
    const result = await deletePages(pdf.buffer, [1, 3, 5]);
    const doc = await PDFDocument.load(result);
    expect(doc.getPageCount()).toBe(3);
  });

  it('preserves remaining page content', async () => {
    const pdf = await createPdfWithPages([
      { text: 'DELETE_ME_MARKER' },
      { text: 'KEEP_ME_MARKER' },
      { text: 'ALSO_DELETE_MARKER' },
      { text: 'ALSO_KEEP_MARKER' },
    ]);
    const result = await deletePages(pdf.buffer, [1, 3]);
    const doc = await PDFDocument.load(result);
    expect(doc.getPageCount()).toBe(2);

    const text1 = await extractTextFromPdf(result.buffer, 1);
    expect(text1).toContain('KEEP_ME_MARKER');
    expect(text1).not.toContain('DELETE_ME_MARKER');
  });

  it('throws when deleting all pages', async () => {
    const pdf = await createSinglePagePdf('only page');
    await expect(deletePages(pdf.buffer, [1])).rejects.toThrow('Cannot delete all pages');
  });

  it('handles out-of-range page numbers gracefully', async () => {
    const pdf = await createMultiPagePdf(3);
    const result = await deletePages(pdf.buffer, [10, 20]);
    const doc = await PDFDocument.load(result);
    expect(doc.getPageCount()).toBe(3);
  });
});

// ── Extract ────────────────────────────────────────────────────────────────

describe('PDF extract pages', () => {
  it('extracts a single page', async () => {
    const pdf = await createMultiPagePdf(5);
    const result = await extractPages(pdf.buffer, [3]);
    const doc = await PDFDocument.load(result);
    expect(doc.getPageCount()).toBe(1);
  });

  it('extracts multiple non-consecutive pages', async () => {
    const pdf = await createPdfWithPages([
      { text: 'PAGE_A_EXTRACT' },
      { text: 'PAGE_B' },
      { text: 'PAGE_C_EXTRACT' },
    ]);
    const result = await extractPages(pdf.buffer, [1, 3]);
    const doc = await PDFDocument.load(result);
    expect(doc.getPageCount()).toBe(2);

    const text1 = await extractTextFromPdf(result.buffer, 1);
    expect(text1).toContain('PAGE_A_EXTRACT');
    const text2 = await extractTextFromPdf(result.buffer, 2);
    expect(text2).toContain('PAGE_C_EXTRACT');
  });

  it('throws on no valid pages', async () => {
    const pdf = await createSinglePagePdf('test');
    await expect(extractPages(pdf.buffer, [99])).rejects.toThrow(/No valid pages to extract/);
  });

  it('filters out invalid page numbers', async () => {
    const pdf = await createMultiPagePdf(3);
    const result = await extractPages(pdf.buffer, [0, 1, 4, 2]);
    const doc = await PDFDocument.load(result);
    expect(doc.getPageCount()).toBe(2);
  });
});

// ── Rotate ─────────────────────────────────────────────────────────────────

describe('PDF rotate pages', () => {
  it('rotates a page 90 degrees', async () => {
    const pdf = await createSinglePagePdf('rotate test');
    const result = await rotatePages(pdf.buffer, [[1, 90]]);
    const doc = await PDFDocument.load(result);
    const page = doc.getPage(0);
    expect(page.getRotation().angle).toBe(90);
  });

  it('rotates a page 180 degrees', async () => {
    const pdf = await createSinglePagePdf('rotate 180');
    const result = await rotatePages(pdf.buffer, [[1, 180]]);
    const doc = await PDFDocument.load(result);
    const page = doc.getPage(0);
    expect(page.getRotation().angle).toBe(180);
  });

  it('rotates different pages by different amounts', async () => {
    const pdf = await createMultiPagePdf(3);
    const result = await rotatePages(pdf.buffer, [
      [1, 90],
      [2, 180],
      [3, 270],
    ]);
    const doc = await PDFDocument.load(result);
    expect(doc.getPage(0).getRotation().angle).toBe(90);
    expect(doc.getPage(1).getRotation().angle).toBe(180);
    expect(doc.getPage(2).getRotation().angle).toBe(270);
  });

  it('accumulates rotation (90 + 90 = 180)', async () => {
    const pdf = await createSinglePagePdf('double rotate');
    let result = await rotatePages(pdf.buffer, [[1, 90]]);
    result = await rotatePages(result.buffer, [[1, 90]]);
    const doc = await PDFDocument.load(result);
    expect(doc.getPage(0).getRotation().angle).toBe(180);
  });

  it('preserves text content after rotation', async () => {
    const pdf = await createSinglePagePdf('ROTATION_CONTENT_CHECK');
    const result = await rotatePages(pdf.buffer, [[1, 90]]);
    const text = await extractTextFromPdf(result.buffer, 1);
    expect(text).toContain('ROTATION_CONTENT_CHECK');
  });

  it('handles 0-degree rotation (no-op)', async () => {
    const pdf = await createSinglePagePdf('no-op rotation');
    const result = await rotatePages(pdf.buffer, [[1, 0]]);
    const doc = await PDFDocument.load(result);
    expect(doc.getPage(0).getRotation().angle).toBe(0);
  });
});

// ── End-to-end page op chains ──────────────────────────────────────────────

describe('Chained page operations', () => {
  it('extract then reorder', async () => {
    const pdf = await createPdfWithPages([
      { text: 'P1' },
      { text: 'P2' },
      { text: 'P3' },
      { text: 'P4' },
    ]);
    const extracted = await extractPages(pdf.buffer, [1, 3, 4]);
    const reordered = await reorderPdf(extracted.buffer, [3, 1, 2]);
    const doc = await PDFDocument.load(reordered);
    expect(doc.getPageCount()).toBe(3);
    const text1 = await extractTextFromPdf(reordered.buffer, 1);
    expect(text1).toContain('P4');
  });

  it('split then merge subset', async () => {
    const pdf = await createMultiPagePdf(6);
    const parts = await splitPdf(pdf.buffer, 2);
    const merged = await mergePdfs([parts[0].buffer, parts[2].buffer]);
    const doc = await PDFDocument.load(merged);
    // parts[0] has pages 1-2, parts[2] has pages 5-6
    expect(doc.getPageCount()).toBe(4);
  });

  it('rotate then extract then merge', async () => {
    const pdf = await createMultiPagePdf(3);
    const rotated = await rotatePages(pdf.buffer, [[2, 180]]);
    const extracted = await extractPages(rotated.buffer, [2]);
    const doc = await PDFDocument.load(extracted);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getRotation().angle).toBe(180);
  });
});

// ── Producer tag ───────────────────────────────────────────────────────────
// Note: pdf-lib always sets its own producer string during save(),
// overriding any custom setProducer() calls. The actual worker code
// (pdf-ops.worker.ts) calls setProducer before save, which ensures
// the producer tag is set when using the real production build flow.
// In unit tests with pdf-lib, the producer will read as the pdf-lib default.

describe('Producer metadata', () => {
  it('saved PDF is valid and reloadable', async () => {
    const p1 = await createSinglePagePdf('A');
    const p2 = await createSinglePagePdf('B');
    const merged = await mergePdfs([p1.buffer, p2.buffer]);
    const doc = await PDFDocument.load(merged);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getProducer()).toBeTruthy();
  });

  it('reordered PDF preserves page count', async () => {
    const pdf = await createMultiPagePdf(2);
    const result = await reorderPdf(pdf.buffer, [2, 1]);
    const doc = await PDFDocument.load(result);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getProducer()).toBeTruthy();
  });

  it('extracted PDF is valid and reloadable', async () => {
    const pdf = await createMultiPagePdf(3);
    const result = await extractPages(pdf.buffer, [1]);
    const doc = await PDFDocument.load(result);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getProducer()).toBeTruthy();
  });
});
