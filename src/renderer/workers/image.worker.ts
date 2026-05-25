import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { PDFDocument } from 'pdf-lib';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

// ── Request / Response types ──────────────────────────────────

interface PdfToImagesRequest {
  id: string;
  type: 'pdf-to-images';
  pdfBytes: ArrayBuffer;
  pageNumbers: number[];
  scale: number; // e.g. 2 for 144 DPI (2 * 72)
}

interface ImagesToPdfRequest {
  id: string;
  type: 'images-to-pdf';
  images: { bytes: ArrayBuffer; mimeType: string }[];
}

type ImageWorkerRequest = PdfToImagesRequest | ImagesToPdfRequest;

interface PdfToImagesSuccess {
  id: string;
  type: 'success-images';
  images: { pageNumber: number; pngBytes: ArrayBuffer }[];
}

interface ImagesToPdfSuccess {
  id: string;
  type: 'success-pdf';
  pdfBytes: ArrayBuffer;
}

interface ImageWorkerError {
  id: string;
  type: 'error';
  message: string;
}

type ImageWorkerResponse = PdfToImagesSuccess | ImagesToPdfSuccess | ImageWorkerError;

// ── PDF to Images ─────────────────────────────────────────────

async function handlePdfToImages(
  pdfBytes: ArrayBuffer,
  pageNumbers: number[],
  scale: number
): Promise<{ pageNumber: number; pngBytes: ArrayBuffer }[]> {
  const loadingTask = pdfjsLib.getDocument({
    data: pdfBytes.slice(0),
    useWorkerFetch: false,
    useSystemFonts: false,
    disableAutoFetch: true,
    disableStream: true,
  });
  const pdfDoc = await loadingTask.promise;

  if (!pdfDoc || pdfDoc.numPages <= 0) {
    throw new Error('Failed to load PDF document: empty or invalid.');
  }

  const results: { pageNumber: number; pngBytes: ArrayBuffer }[] = [];

  for (const pageNum of pageNumbers) {
    if (pageNum < 1 || pageNum > pdfDoc.numPages) {
      throw new Error(`Page ${pageNum} is out of range (1–${pdfDoc.numPages}).`);
    }

    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = new OffscreenCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('OffscreenCanvas 2d context not available');
    }

    await page.render({
      canvasContext: ctx,
      viewport,
    } as unknown as Parameters<typeof page.render>[0]).promise;

    const blob = await canvas.convertToBlob({ type: 'image/png' });
    const pngBytes = await blob.arrayBuffer();

    results.push({ pageNumber: pageNum, pngBytes });
    page.cleanup();
  }

  return results;
}

// ── Images to PDF ─────────────────────────────────────────────

async function handleImagesToPdf(
  images: { bytes: ArrayBuffer; mimeType: string }[]
): Promise<ArrayBuffer> {
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

  pdfDoc.setProducer('CrossPDF Studio');
  pdfDoc.setCreator('CrossPDF Studio');
  const saved = await pdfDoc.save({ useObjectStreams: true });
  return saved.buffer as ArrayBuffer;
}

// ── Message dispatch ──────────────────────────────────────────

self.onmessage = async (event: MessageEvent<ImageWorkerRequest>) => {
  const msg = event.data;

  try {
    switch (msg.type) {
      case 'pdf-to-images': {
        const images = await handlePdfToImages(msg.pdfBytes, msg.pageNumbers, msg.scale);
        self.postMessage({
          id: msg.id,
          type: 'success-images',
          images,
        } satisfies ImageWorkerResponse);
        break;
      }
      case 'images-to-pdf': {
        const pdfBytes = await handleImagesToPdf(msg.images);
        self.postMessage({
          id: msg.id,
          type: 'success-pdf',
          pdfBytes,
        } satisfies ImageWorkerResponse);
        break;
      }
      default:
        throw new Error(`Unknown operation: ${(msg as ImageWorkerRequest).type}`);
    }
  } catch (err) {
    self.postMessage({
      id: msg.id,
      type: 'error',
      message: err instanceof Error ? err.message : 'Unknown error',
    } satisfies ImageWorkerResponse);
  }
};
