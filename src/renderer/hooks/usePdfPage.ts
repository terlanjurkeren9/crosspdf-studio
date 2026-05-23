import { useCallback, useEffect, useRef } from 'react';
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist';

export interface PageRenderState {
  status: 'idle' | 'rendering' | 'done' | 'error';
  error: string | null;
  dims: { width: number; height: number } | null;
}

interface UsePdfPageResult {
  render: (canvas: HTMLCanvasElement, zoom: number) => Promise<PageRenderState>;
  cancel: () => void;
}

export function usePdfPage(
  pdfDocument: PDFDocumentProxy | null,
  pageNumber: number,
  rotation: number = 0
): UsePdfPageResult {
  const renderTaskRef = useRef<RenderTask | null>(null);
  const pageRef = useRef<PDFPageProxy | null>(null);
  const versionRef = useRef(0);

  const cancel = useCallback(() => {
    versionRef.current++;
    renderTaskRef.current?.cancel();
    renderTaskRef.current = null;
    pageRef.current?.cleanup();
    pageRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cancel;
  }, [cancel]);

  const render = useCallback(
    async (canvas: HTMLCanvasElement, zoom: number): Promise<PageRenderState> => {
      const doc = pdfDocument;
      if (!doc) {
        return { status: 'error', error: 'No document', dims: null };
      }

      // Cancel any in-flight previous render started by this hook instance.
      cancel();
      const version = ++versionRef.current;

      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      let page: PDFPageProxy | null = null;

      try {
        page = await doc.getPage(pageNumber);

        // A newer render was started or cancel() was called while we were
        // waiting for getPage().
        if (version !== versionRef.current) {
          page.cleanup();
          return { status: 'idle', error: null, dims: null };
        }

        const viewport = page.getViewport({ scale: zoom * pixelRatio, rotation });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / pixelRatio}px`;
        canvas.style.height = `${viewport.height / pixelRatio}px`;

        pageRef.current = page;
        const renderTask = page.render({ canvas, viewport });
        renderTaskRef.current = renderTask;

        await renderTask.promise;

        return {
          status: 'done',
          error: null,
          dims: {
            width: viewport.width / pixelRatio,
            height: viewport.height / pixelRatio,
          },
        };
      } catch (err) {
        // If our version changed, this render was superseded — silent.
        if (version !== versionRef.current) {
          return { status: 'idle', error: null, dims: null };
        }

        // RenderingCancelledException is normal during navigation / zoom.
        const isCancel = err instanceof Error && err.name === 'RenderingCancelledException';
        if (isCancel) {
          return { status: 'idle', error: null, dims: null };
        }

        const message = err instanceof Error ? err.message : 'Render failed';
        return { status: 'error', error: message, dims: null };
      } finally {
        // Detach the render task ref if it still points to ours.
        if (renderTaskRef.current && version === versionRef.current) {
          renderTaskRef.current = null;
        }
        // Always clean up the page proxy — no longer needed once render
        // completes (success, error, or cancelled).
        page?.cleanup();
        if (pageRef.current === page) {
          pageRef.current = null;
        }
      }
    },
    [pdfDocument, pageNumber, rotation, cancel]
  );

  return { render, cancel };
}
