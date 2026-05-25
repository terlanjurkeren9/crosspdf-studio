import * as pdfjsLib from 'pdfjs-dist';
import type { RedactionAnnotation } from '../types/annotation.types';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

const REDACTION_DPI = 300;
const PDF_POINTS_PER_INCH = 72;

export interface RenderedRedactedPage {
  pageNumber: number;
  pngData: ArrayBuffer;
}

/**
 * Render each page that has redaction marks at 300 DPI,
 * burn redaction rectangles as solid black filled areas,
 * and return PNG data for each affected page.
 */
export async function renderRedactedPages(
  pdfBytes: ArrayBuffer,
  redactionsByPage: Map<number, RedactionAnnotation[]>,
  totalPages: number
): Promise<RenderedRedactedPage[]> {
  const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
  const pdfDoc = await loadingTask.promise;

  const results: RenderedRedactedPage[] = [];

  try {
    for (const [pageNumber, redactions] of redactionsByPage) {
      if (pageNumber < 1 || pageNumber > totalPages) continue;
      if (redactions.length === 0) continue;

      const scale = REDACTION_DPI / PDF_POINTS_PER_INCH;
      const page = await pdfDoc.getPage(pageNumber);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        page.cleanup();
        continue;
      }

      // Render page content
      await page.render({ canvas, viewport }).promise;

      // Burn redaction rectangles as solid black
      ctx.fillStyle = '#000000';
      for (const redaction of redactions) {
        const x = redaction.rect.x * scale;
        const y = redaction.rect.y * scale;
        const w = redaction.rect.width * scale;
        const h = redaction.rect.height * scale;
        ctx.fillRect(x, y, w, h);
      }

      page.cleanup();

      const blob = await canvasToPngBlob(canvas);
      const pngData = await blob.arrayBuffer();
      results.push({ pageNumber, pngData });
    }
  } finally {
    pdfDoc.destroy();
  }

  return results;
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to convert canvas to PNG'));
      }
    }, 'image/png');
  });
}
