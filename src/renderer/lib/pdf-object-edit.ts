import { PDFDocument, StandardFonts, rgb, PDFImage } from 'pdf-lib';

export type PdfObjectEditOperation =
  | {
      id: string;
      type: 'replace-text';
      pageNumber: number;
      rect: { x: number; y: number; width: number; height: number };
      text: string;
      fontSize: number;
      color?: string;
    }
  | {
      id: string;
      type: 'remove-area';
      pageNumber: number;
      rect: { x: number; y: number; width: number; height: number };
      fillColor?: string;
    }
  | {
      id: string;
      type: 'replace-image';
      pageNumber: number;
      rect: { x: number; y: number; width: number; height: number };
      imageBytes: ArrayBuffer;
      mimeType: 'image/png' | 'image/jpeg';
    };

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  return {
    r: ((bigint >> 16) & 255) / 255,
    g: ((bigint >> 8) & 255) / 255,
    b: (bigint & 255) / 255,
  };
}

function parseFillColor(color: string | undefined): { r: number; g: number; b: number } {
  if (color) {
    const { r, g, b } = hexToRgb(color);
    return { r, g, b };
  }
  return { r: 1, g: 1, b: 1 }; // white
}

/**
 * Apply visual content edits to a PDF using pdf-lib.
 *
 * Limitations:
 * - This performs visual overlay editing, NOT true content-stream rewriting.
 * - Original text remains extractable; this is not secure redaction.
 * - No reflow is performed; replacement text is drawn at fixed position.
 * - Image replacement embeds a new image but does not modify original image XObject references.
 */
export async function applyPdfObjectEdits(
  source: ArrayBuffer | Uint8Array,
  operations: PdfObjectEditOperation[]
): Promise<ArrayBuffer> {
  const pdfDoc = await PDFDocument.load(source, { ignoreEncryption: true });
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Group operations by page
  const opsByPage = new Map<number, PdfObjectEditOperation[]>();
  for (const op of operations) {
    const pageOps = opsByPage.get(op.pageNumber) ?? [];
    pageOps.push(op);
    opsByPage.set(op.pageNumber, pageOps);
  }

  for (const [pageNumber, pageOps] of opsByPage) {
    const pageIndex = pageNumber - 1;
    if (pageIndex < 0 || pageIndex >= pdfDoc.getPageCount()) continue;

    const page = pdfDoc.getPage(pageIndex);
    const pageHeight = page.getHeight();

    for (const op of pageOps) {
      if (op.type === 'remove-area') {
        // Draw white filled rectangle over the area (visual removal, not secure redaction)
        const { r, g, b } = parseFillColor(op.fillColor);
        const pdfRect = {
          x: op.rect.x,
          y: pageHeight - op.rect.y - op.rect.height, // convert from top-left to bottom-left
          width: op.rect.width,
          height: op.rect.height,
        };
        page.drawRectangle({
          ...pdfRect,
          color: rgb(r, g, b),
          opacity: 1,
        });
      } else if (op.type === 'replace-text') {
        // Draw white rectangle over original area, then draw replacement text
        const { r, g, b } = hexToRgb(op.color ?? '#000000');
        const pdfRect = {
          x: op.rect.x,
          y: pageHeight - op.rect.y - op.rect.height,
          width: op.rect.width,
          height: op.rect.height,
        };

        // Clear area with white
        page.drawRectangle({
          ...pdfRect,
          color: rgb(1, 1, 1),
          opacity: 1,
        });

        // Draw replacement text
        page.drawText(op.text, {
          x: op.rect.x,
          y: pageHeight - op.rect.y - op.fontSize, // baseline adjustment
          size: op.fontSize,
          font: helveticaFont,
          color: rgb(r, g, b),
        });
      } else if (op.type === 'replace-image') {
        // Draw white rectangle over area, embed and draw new image
        const pdfRect = {
          x: op.rect.x,
          y: pageHeight - op.rect.y - op.rect.height,
          width: op.rect.width,
          height: op.rect.height,
        };

        // Clear area with white
        page.drawRectangle({
          ...pdfRect,
          color: rgb(1, 1, 1),
          opacity: 1,
        });

        // Embed image
        let embeddedImage: PDFImage;
        if (op.mimeType === 'image/png') {
          embeddedImage = await pdfDoc.embedPng(new Uint8Array(op.imageBytes));
        } else {
          embeddedImage = await pdfDoc.embedJpg(new Uint8Array(op.imageBytes));
        }

        // Draw image in rect
        page.drawImage(embeddedImage, {
          x: op.rect.x,
          y: pageHeight - op.rect.y - op.rect.height,
          width: op.rect.width,
          height: op.rect.height,
        });
      }
    }
  }

  const bytes = await pdfDoc.save();
  return ownedArrayBuffer(bytes);
}

function ownedArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export { ownedArrayBuffer };
