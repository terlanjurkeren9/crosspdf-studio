import { useCallback, useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist';

const THUMBNAIL_SCALE = 0.2;

interface ThumbnailState {
  status: 'idle' | 'loading' | 'done' | 'error';
  dataUrl: string | null;
  error: string | null;
}

interface UsePdfThumbnailResult {
  state: ThumbnailState;
  render: () => void;
  cancel: () => void;
}

export function usePdfThumbnail(
  pdfDocument: PDFDocumentProxy | null,
  pageNumber: number
): UsePdfThumbnailResult {
  const [state, setState] = useState<ThumbnailState>({
    status: 'idle',
    dataUrl: null,
    error: null,
  });
  const renderTaskRef = useRef<RenderTask | null>(null);
  const pageRef = useRef<PDFPageProxy | null>(null);
  const versionRef = useRef(0);

  // Refs for latest props — keep render/cancel callbacks stable while still
  // using the current document and page number.
  const pdfDocumentRef = useRef(pdfDocument);
  const pageNumberRef = useRef(pageNumber);

  useEffect(() => {
    pdfDocumentRef.current = pdfDocument;
    pageNumberRef.current = pageNumber;
  }, [pdfDocument, pageNumber]);

  const cancelRef = useRef<() => void>(() => {});

  useEffect(() => {
    cancelRef.current = () => {
      versionRef.current++;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
      pageRef.current?.cleanup();
      pageRef.current = null;
    };
  });

  useEffect(() => {
    return () => {
      cancelRef.current();
    };
  }, []);

  const renderRef = useRef<() => void>(() => {});

  useEffect(() => {
    renderRef.current = () => {
      const doc = pdfDocumentRef.current;
      const pn = pageNumberRef.current;

      if (!doc) {
        setState({ status: 'error', dataUrl: null, error: 'No document' });
        return;
      }

      cancelRef.current();
      const version = ++versionRef.current;

      setState({ status: 'loading', dataUrl: null, error: null });

      (async () => {
        try {
          const page = await doc.getPage(pn);
          if (version !== versionRef.current) {
            page.cleanup();
            return;
          }

          pageRef.current = page;

          const viewport = page.getViewport({ scale: THUMBNAIL_SCALE });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            throw new Error('Unable to create thumbnail canvas context');
          }

          const renderTask = page.render({
            canvasContext: ctx,
            viewport,
          } as Parameters<typeof page.render>[0]);
          renderTaskRef.current = renderTask;

          await renderTask.promise;

          if (version !== versionRef.current) return;

          const dataUrl = canvas.toDataURL('image/png');
          setState({ status: 'done', dataUrl, error: null });
        } catch (err) {
          if (version !== versionRef.current) return;

          const isCancel = err instanceof Error && err.name === 'RenderingCancelledException';
          if (isCancel) return;

          setState({
            status: 'error',
            dataUrl: null,
            error: err instanceof Error ? err.message : 'Thumbnail render failed',
          });
        } finally {
          pageRef.current?.cleanup();
          pageRef.current = null;
        }
      })();
    };
  });

  const render = useCallback(() => renderRef.current(), []);
  const cancel = useCallback(() => cancelRef.current(), []);

  return { state, render, cancel };
}
