import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export async function createSinglePagePdf(text?: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);
  page.drawText(text ?? 'Page 1 Content', { x: 72, y: 700, size: 14, font, color: rgb(0, 0, 0) });
  return doc.save();
}

export async function createMultiPagePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([612, 792]);
    page.drawText(`Page ${i + 1} Content`, { x: 72, y: 700, size: 14, font, color: rgb(0, 0, 0) });
  }
  return doc.save();
}

export async function createPdfWithPages(
  pageConfigs: { text: string; width?: number; height?: number }[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const cfg of pageConfigs) {
    const page = doc.addPage([cfg.width ?? 612, cfg.height ?? 792]);
    page.drawText(cfg.text, { x: 72, y: 700, size: 14, font, color: rgb(0, 0, 0) });
  }
  return doc.save();
}

export async function createEncryptedPdf(): Promise<{
  encrypted: Uint8Array;
  decryptedText: string;
}> {
  const secretText = 'PROTECTED_SECRET_CONTENT_' + Math.random().toString(36).slice(2, 8);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);
  page.drawText(secretText, { x: 72, y: 700, size: 14, font, color: rgb(0, 0, 0) });

  const encrypted = await doc.save({ useObjectStreams: true });

  // pdf-lib doesn't do real encryption — real encryption uses QPDF in the packaged app.
  return { encrypted, decryptedText: secretText };
}

export async function pdfBytesToPageCount(bytes: ArrayBuffer): Promise<number> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return doc.getPageCount();
}

export async function extractTextFromPdf(bytes: ArrayBuffer, pageNumber: number): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loadingTask = pdfjsLib.getDocument({ data: bytes.slice(0) });
  const pdfDoc = await loadingTask.promise;
  const page = await pdfDoc.getPage(pageNumber);
  const textContent = await page.getTextContent();
  const text = textContent.items
    .map((item: { str?: string }) => ('str' in item ? item.str : ''))
    .join(' ');
  page.cleanup();
  pdfDoc.destroy();
  return text;
}

export async function createImagePdfWithText(text: string): Promise<Uint8Array> {
  // Creates a PDF with text content that can be used for OCR testing
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);
  page.drawText(text, { x: 72, y: 700, size: 12, font, color: rgb(0, 0, 0) });
  page.drawText('Additional line for OCR verification', {
    x: 72,
    y: 680,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  return doc.save();
}
