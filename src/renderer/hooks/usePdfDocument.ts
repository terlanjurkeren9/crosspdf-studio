import { useState, useEffect, useRef, useMemo } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFDocumentLoadingTask } from 'pdfjs-dist';

GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

interface UsePdfDocumentResult {
  pdfDocument: PDFDocumentProxy | null;
  numPages: number;
  loading: boolean;
  error: string | null;
}

export function usePdfDocument(data: ArrayBuffer | null): UsePdfDocumentResult {
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);

  const loading = useMemo(
    () => data !== null && pdfDocument === null && error === null,
    [data, pdfDocument, error]
  );

  useEffect(() => {
    if (!data) return;

    const safeData = data;
    let cancelled = false;

    async function load() {
      loadingTaskRef.current?.destroy();
      docRef.current?.destroy();
      loadingTaskRef.current = null;
      docRef.current = null;

      const loadingTask = getDocument({ data: safeData });
      loadingTaskRef.current = loadingTask;

      try {
        const doc = await loadingTask.promise;

        if (cancelled) {
          doc.destroy();
          return;
        }

        docRef.current = doc;
        setPdfDocument(doc);
        setNumPages(doc.numPages);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load PDF document';
          setError(message);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [data]);

  useEffect(() => {
    return () => {
      loadingTaskRef.current?.destroy();
      docRef.current?.destroy();
    };
  }, []);

  return { pdfDocument, numPages, loading, error };
}
