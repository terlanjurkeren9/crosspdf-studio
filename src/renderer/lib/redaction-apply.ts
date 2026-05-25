import { PDFDocument } from 'pdf-lib';

/**
 * Core redaction apply logic: replaces redacted pages with image-only pages,
 * preserves unaffected pages. Separated from worker for testability.
 *
 * @param source Original PDF bytes
 * @param pngs One PNG ArrayBuffer per redacted page (already burned)
 * @param redactedPageNumbers 1-based page numbers that were redacted
 */
export async function applyRedactionsToPdf(
  source: ArrayBuffer,
  pngs: ArrayBuffer[],
  redactedPageNumbers: number[]
): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(source, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();
  const pageIndices = srcDoc.getPageIndices();

  const redactedSet = new Set(redactedPageNumbers.map((p) => p - 1));
  const pngByPageIndex = new Map<number, ArrayBuffer>();
  for (let i = 0; i < redactedPageNumbers.length; i++) {
    pngByPageIndex.set(redactedPageNumbers[i] - 1, pngs[i]);
  }

  const output = await PDFDocument.create();

  for (let i = 0; i < totalPages; i++) {
    const pageIndex = pageIndices[i];

    if (redactedSet.has(i) && pngByPageIndex.has(i)) {
      const pngData = pngByPageIndex.get(i)!;
      const pngImage = await output.embedPng(pngData);

      const srcPage = srcDoc.getPage(pageIndex);
      const { width, height } = srcPage.getSize();

      const newPage = output.addPage([width, height]);
      newPage.drawImage(pngImage, {
        x: 0,
        y: 0,
        width,
        height,
      });
    } else {
      const [copiedPage] = await output.copyPages(srcDoc, [pageIndex]);
      output.addPage(copiedPage);
    }
  }

  output.setProducer('CrossPDF Studio');
  output.setCreator('CrossPDF Studio');
  output.setTitle('');
  output.setSubject('');
  output.setKeywords([]);
  output.setAuthor('');
  output.setProducer('');

  return output.save({ useObjectStreams: true });
}
