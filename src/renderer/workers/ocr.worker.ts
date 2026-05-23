import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

export interface OcrRequest {
  id: string;
  pdfBytes: ArrayBuffer;
  pageNumbers: number[];
  language: string;
  dpi: number;
}

export interface OcrProgressEvent {
  id: string;
  type: 'progress';
  pageNumber: number;
  pageIndex: number;
  totalPages: number;
  progress: number;
}

export interface OcrPageResult {
  pageNumber: number;
  text: string;
  confidence: number;
}

export interface OcrCompleteEvent {
  id: string;
  type: 'complete';
  results: OcrPageResult[];
}

export interface OcrErrorEvent {
  id: string;
  type: 'error';
  message: string;
}

export type OcrWorkerEvent = OcrProgressEvent | OcrCompleteEvent | OcrErrorEvent;

async function renderPageToImage(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  dpi: number
): Promise<ImageData> {
  const page = await pdfDoc.getPage(pageNumber);
  // PDF points to pixels: 1 point = 1/72 inch, so scale = dpi/72
  const scale = dpi / 72;
  const viewport = page.getViewport({ scale });

  const canvas = new OffscreenCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('OffscreenCanvas 2d context not available');
  }

  await page.render({ canvasContext: ctx, viewport } as unknown as Parameters<
    typeof page.render
  >[0]).promise;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  page.cleanup();
  return imageData;
}

/**
 * Simple pre-processing: convert to grayscale for better OCR accuracy.
 */
function preprocessForOcr(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;
  const gray = new Uint8ClampedArray(width * height * 4);

  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    // Weighted grayscale
    const v = 0.299 * r + 0.587 * g + 0.114 * b;
    gray[i * 4] = v;
    gray[i * 4 + 1] = v;
    gray[i * 4 + 2] = v;
    gray[i * 4 + 3] = data[i * 4 + 3];
  }

  return new ImageData(gray, width, height);
}

/**
 * Convert ImageData to a BMP data URL for Tesseract.js (which prefers
 * image URLs or canvas elements).
 */
function imageDataToBlob(imageData: ImageData): Promise<Blob> {
  const { width, height } = imageData;

  return new Promise((resolve, reject) => {
    try {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        const canvas2 = new OffscreenCanvas(width, height);
        const ctx2 = canvas2.getContext('2d');
        if (!ctx2) {
          reject(new Error('OffscreenCanvas 2d context not available'));
          return;
        }
        ctx2.putImageData(imageData, 0, 0);
        canvas2.convertToBlob({ type: 'image/png' }).then(resolve, reject);
        return;
      }
      ctx.putImageData(imageData, 0, 0);
      canvas.convertToBlob({ type: 'image/png' }).then(resolve, reject);
    } catch (err) {
      reject(err);
    }
  });
}

async function processOcrRequest(request: OcrRequest): Promise<void> {
  const { id, pdfBytes, pageNumbers, language } = request;
  let pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;
  let tesseractWorker: Awaited<ReturnType<TesseractWorkerFactory>> | null = null;

  try {
    // Load PDF
    const loadingTask = pdfjsLib.getDocument({
      data: pdfBytes.slice(0),
      useWorkerFetch: false,
      useSystemFonts: false,
      disableAutoFetch: true,
      disableStream: true,
    });
    pdfDoc = await loadingTask.promise;

    if (!pdfDoc || pdfDoc.numPages <= 0) {
      throw new Error('Failed to load PDF document: empty or invalid.');
    }
    // Dynamic import of Tesseract
    const tesseractModule = await import('tesseract.js');
    const createWorker = tesseractModule.createWorker as unknown as TesseractWorkerFactory;

    tesseractWorker = await createWorker(language, 1, {
      logger: () => {
        // Progress reported per-page below
      },
    });

    const results: OcrPageResult[] = [];
    const totalPages = pageNumbers.length;

    for (let i = 0; i < totalPages; i++) {
      const pageNumber = pageNumbers[i];

      // Report progress start
      self.postMessage({
        id,
        type: 'progress',
        pageNumber,
        pageIndex: i,
        totalPages,
        progress: 0,
      } satisfies OcrProgressEvent);

      // Render page at configured DPI
      const imageData = await renderPageToImage(pdfDoc, pageNumber, request.dpi);

      // Preprocess for better OCR
      const processed = preprocessForOcr(imageData);

      // Convert to blob for Tesseract
      const blob = await imageDataToBlob(processed);

      // Report rendering done
      self.postMessage({
        id,
        type: 'progress',
        pageNumber,
        pageIndex: i,
        totalPages,
        progress: 0.3,
      } satisfies OcrProgressEvent);

      // Run OCR
      const { data } = await tesseractWorker.recognize(blob);

      // Tesseract returns confidence 0–100; normalize to 0–1 for internal contract.
      const rawConfidence = data.confidence ?? 0;
      const confidence =
        Number.isFinite(rawConfidence) && rawConfidence > 1
          ? rawConfidence / 100
          : Number.isFinite(rawConfidence)
            ? rawConfidence
            : 0;

      results.push({
        pageNumber,
        text: data.text,
        confidence: Math.max(0, Math.min(1, confidence)),
      });

      // Report page done
      self.postMessage({
        id,
        type: 'progress',
        pageNumber,
        pageIndex: i,
        totalPages,
        progress: 1.0,
      } satisfies OcrProgressEvent);
    }

    self.postMessage({
      id,
      type: 'complete',
      results,
    } satisfies OcrCompleteEvent);
  } catch (err) {
    self.postMessage({
      id,
      type: 'error',
      message: err instanceof Error ? err.message : 'OCR processing failed',
    } satisfies OcrErrorEvent);
  } finally {
    if (tesseractWorker) await tesseractWorker.terminate().catch(() => {});
    if (pdfDoc) await pdfDoc.destroy().catch(() => {});
  }
}

type TesseractWorkerFactory = (...args: unknown[]) => Promise<{
  recognize: (blob: Blob) => Promise<{ data: { text: string; confidence?: number } }>;
  terminate: () => Promise<void>;
}>;

self.onmessage = (event: MessageEvent<OcrRequest>) => {
  const request = event.data;
  processOcrRequest(request);
};
