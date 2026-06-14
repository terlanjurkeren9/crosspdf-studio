type ImageRequestParams =
  | {
      type: 'pdf-to-images';
      pdfBytes: ArrayBuffer;
      pageNumbers: number[];
      scale: number;
      password?: string;
      format?: 'png' | 'jpeg';
      quality?: number;
    }
  | { type: 'images-to-pdf'; images: { bytes: ArrayBuffer; mimeType: string }[] };

interface PdfToImagesResult {
  images: { pageNumber: number; bytes: ArrayBuffer; mimeType: string }[];
}

type ImageResponse =
  | {
      id: string;
      type: 'success-images';
      images: { pageNumber: number; bytes: ArrayBuffer; mimeType: string }[];
    }
  | { id: string; type: 'success-pdf'; pdfBytes: ArrayBuffer }
  | { id: string; type: 'error'; message: string };

let workerPromise: Promise<Worker> | null = null;

const DEFAULT_TIMEOUT = 120_000;

export function resetImageWorker(): void {
  workerPromise = null;
}

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = new Promise<Worker>((resolve, reject) => {
      try {
        const worker = new Worker(new URL('../workers/image.worker.ts', import.meta.url), {
          type: 'module',
        });
        worker.onerror = () => {
          workerPromise = null;
        };
        resolve(worker);
      } catch (err) {
        workerPromise = null;
        reject(err);
      }
    });
  }
  return workerPromise;
}

let requestIdCounter = 0;

function safeClone(buffer: ArrayBuffer): ArrayBuffer {
  try {
    return buffer.slice(0);
  } catch {
    throw new Error('Source buffer is no longer available; reload the document and try again.');
  }
}

function sendRequest(worker: Worker, params: ImageRequestParams): Promise<ImageResponse> {
  const id = String(++requestIdCounter);

  return new Promise((resolve, reject) => {
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const handler = (e: MessageEvent<ImageResponse>) => {
      if (e.data.id === id) {
        settled = true;
        if (timeoutId !== null) clearTimeout(timeoutId);
        worker.removeEventListener('message', handler);
        resolve(e.data);
      }
    };

    worker.addEventListener('message', handler);

    timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      worker.removeEventListener('message', handler);
      worker.terminate();
      workerPromise = null;
      reject(new Error('Image conversion timed out.'));
    }, DEFAULT_TIMEOUT);

    if (params.type === 'pdf-to-images') {
      const pdfCopy = safeClone(params.pdfBytes);
      worker.postMessage({ ...params, pdfBytes: pdfCopy, id }, [pdfCopy]);
    } else {
      const imageCopies = params.images.map((img) => ({
        mimeType: img.mimeType,
        bytes: safeClone(img.bytes),
      }));
      const transferables = imageCopies.map((img) => img.bytes);
      worker.postMessage({ ...params, images: imageCopies, id }, transferables);
    }
  });
}

export async function convertPdfToImages(
  pdfBytes: ArrayBuffer,
  pageNumbers: number[],
  scale: number = 2,
  password?: string,
  format: 'png' | 'jpeg' = 'png',
  quality: number = 0.92
): Promise<PdfToImagesResult> {
  const worker = await getWorker();
  const result = await sendRequest(worker, {
    type: 'pdf-to-images',
    pdfBytes,
    pageNumbers,
    scale,
    ...(password ? { password } : {}),
    format,
    quality,
  });
  if (result.type === 'error') throw new Error(result.message);
  if (result.type === 'success-pdf') throw new Error('Unexpected PDF result');
  return { images: result.images };
}

export async function createPdfFromImages(
  images: { bytes: ArrayBuffer; mimeType: string }[]
): Promise<ArrayBuffer> {
  if (images.length === 0) {
    throw new Error('At least one image is required to create a PDF.');
  }
  const worker = await getWorker();
  const result = await sendRequest(worker, {
    type: 'images-to-pdf',
    images,
  });
  if (result.type === 'error') throw new Error(result.message);
  if (result.type === 'success-images') throw new Error('Unexpected images result');
  return result.pdfBytes;
}
