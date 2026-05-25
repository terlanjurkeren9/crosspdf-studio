import type { OcrRequest, OcrPageResult, OcrWorkerEvent } from '../workers/ocr.worker';

let workerPromise: Promise<Worker> | null = null;

function getOcrWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = new Promise<Worker>((resolve, reject) => {
      try {
        const worker = new Worker(new URL('../workers/ocr.worker.ts', import.meta.url), {
          type: 'module',
        });
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

export function runOcr(
  pdfBytes: ArrayBuffer,
  pageNumbers: number[],
  language: string,
  dpi: number,
  onProgress: (pageNumber: number, pageIndex: number, totalPages: number) => void,
  password?: string
): Promise<OcrPageResult[]> {
  return new Promise((resolve, reject) => {
    void (async () => {
      try {
        const worker = await getOcrWorker();
        const id = String(++requestIdCounter);

        const handler = (e: MessageEvent<OcrWorkerEvent>) => {
          const event = e.data;
          if (event.id !== id) return;

          if (event.type === 'progress') {
            onProgress(event.pageNumber, event.pageIndex, event.totalPages);
          } else if (event.type === 'complete') {
            worker.removeEventListener('message', handler);
            resolve(event.results);
          } else if (event.type === 'error') {
            worker.removeEventListener('message', handler);
            reject(new Error(event.message || 'OCR processing failed'));
          }
        };

        worker.addEventListener('message', handler);

        const request: OcrRequest = {
          id,
          pdfBytes,
          pageNumbers,
          language,
          dpi,
          ...(password ? { password } : {}),
        };

        worker.postMessage(request, [pdfBytes]);
      } catch (err) {
        reject(err);
      }
    })();
  });
}

export const OCR_LANGUAGES: { code: string; label: string }[] = [
  { code: 'afr', label: 'Afrikaans' },
  { code: 'ara', label: 'Arabic' },
  { code: 'aze', label: 'Azerbaijani' },
  { code: 'bel', label: 'Belarusian' },
  { code: 'ben', label: 'Bengali' },
  { code: 'bul', label: 'Bulgarian' },
  { code: 'cat', label: 'Catalan' },
  { code: 'ces', label: 'Czech' },
  { code: 'chi_sim', label: 'Chinese (Simplified)' },
  { code: 'chi_tra', label: 'Chinese (Traditional)' },
  { code: 'dan', label: 'Danish' },
  { code: 'deu', label: 'German' },
  { code: 'ell', label: 'Greek' },
  { code: 'eng', label: 'English' },
  { code: 'est', label: 'Estonian' },
  { code: 'fin', label: 'Finnish' },
  { code: 'fra', label: 'French' },
  { code: 'heb', label: 'Hebrew' },
  { code: 'hin', label: 'Hindi' },
  { code: 'hrv', label: 'Croatian' },
  { code: 'hun', label: 'Hungarian' },
  { code: 'ind', label: 'Indonesian' },
  { code: 'ita', label: 'Italian' },
  { code: 'jpn', label: 'Japanese' },
  { code: 'kor', label: 'Korean' },
  { code: 'lav', label: 'Latvian' },
  { code: 'lit', label: 'Lithuanian' },
  { code: 'nld', label: 'Dutch' },
  { code: 'nor', label: 'Norwegian' },
  { code: 'pol', label: 'Polish' },
  { code: 'por', label: 'Portuguese' },
  { code: 'ron', label: 'Romanian' },
  { code: 'rus', label: 'Russian' },
  { code: 'slk', label: 'Slovak' },
  { code: 'slv', label: 'Slovenian' },
  { code: 'spa', label: 'Spanish' },
  { code: 'swe', label: 'Swedish' },
  { code: 'tha', label: 'Thai' },
  { code: 'tur', label: 'Turkish' },
  { code: 'ukr', label: 'Ukrainian' },
  { code: 'vie', label: 'Vietnamese' },
];
