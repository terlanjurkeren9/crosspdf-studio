import { PDFDocument, StandardFonts, rgb, PDFImage, PDFFont } from 'pdf-lib';

export type TextFormatting = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  fontFamily?: 'helvetica' | 'times' | 'courier';
};

export type PdfObjectEditOperation =
  | {
      id: string;
      type: 'replace-text';
      pageNumber: number;
      rect: { x: number; y: number; width: number; height: number };
      text: string;
      fontSize: number;
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      color?: string;
      fontFamily?: 'helvetica' | 'times' | 'courier';
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

  // Pre-embed all standard fonts
  const fonts = {
    helvetica: await pdfDoc.embedFont(StandardFonts.Helvetica),
    'helvetica-bold': await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    'helvetica-oblique': await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
    'helvetica-bold-oblique': await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique),
    times: await pdfDoc.embedFont(StandardFonts.TimesRoman),
    'times-bold': await pdfDoc.embedFont(StandardFonts.TimesRomanBold),
    'times-italic': await pdfDoc.embedFont(StandardFonts.TimesRomanItalic),
    'times-bold-italic': await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic),
    courier: await pdfDoc.embedFont(StandardFonts.Courier),
    'courier-bold': await pdfDoc.embedFont(StandardFonts.CourierBold),
    'courier-oblique': await pdfDoc.embedFont(StandardFonts.CourierOblique),
    'courier-bold-oblique': await pdfDoc.embedFont(StandardFonts.CourierBoldOblique),
  };

  function resolveFont(op: PdfObjectEditOperation & { type: 'replace-text' }): PDFFont {
    const family = op.fontFamily ?? 'helvetica';
    const bold = op.bold ?? false;
    const italic = op.italic ?? false;

    if (family === 'helvetica') {
      if (bold && italic) return fonts['helvetica-bold-oblique'];
      if (bold) return fonts['helvetica-bold'];
      if (italic) return fonts['helvetica-oblique'];
      return fonts.helvetica;
    }
    if (family === 'times') {
      if (bold && italic) return fonts['times-bold-italic'];
      if (bold) return fonts['times-bold'];
      if (italic) return fonts['times-italic'];
      return fonts.times;
    }
    // courier
    if (bold && italic) return fonts['courier-bold-oblique'];
    if (bold) return fonts['courier-bold'];
    if (italic) return fonts['courier-oblique'];
    return fonts.courier;
  }

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
        const font = resolveFont(op);
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
          font: font,
          color: rgb(r, g, b),
        });

        // Draw underline
        if (op.underline) {
          page.drawLine({
            start: { x: op.rect.x, y: pageHeight - op.rect.y - op.fontSize - 1 },
            end: { x: op.rect.x + op.rect.width, y: pageHeight - op.rect.y - op.fontSize - 1 },
            thickness: 1,
            color: rgb(r, g, b),
          });
        }
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
