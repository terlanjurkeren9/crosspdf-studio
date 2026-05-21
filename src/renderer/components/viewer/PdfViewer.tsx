import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { usePdfDocument } from '../../hooks/usePdfDocument';
import { useResizeObserver } from '../../hooks/useResizeObserver';
import { useDocumentStore } from '../../stores/document.store';
import type { TabState } from '../../stores/document.store';
import { PageList } from './PageList';
import { PageTextLayer } from './PageTextLayer';
import { ViewerToolbar } from './ViewerToolbar';
import { ViewerStatusBar } from './ViewerStatusBar';
import { Spinner } from '../ui/Spinner';
import { Button } from '../ui/Button';
import { clampZoom, computeFitZoom, ZOOM_FACTOR } from '../../lib/zoom';
import type { FitMode, ViewMode, PageDims } from '../../lib/zoom';

type DocState =
  | { status: 'reading-file' }
  | { status: 'loading-doc' }
  | { status: 'ready' }
  | { status: 'error'; message: string };

export interface PdfViewerHandle {
  goToPage: (page: number) => void;
}

interface PdfViewerProps {
  tab: TabState;
  onOpenAnother: () => void;
  onPdfDocumentLoaded?: (doc: PDFDocumentProxy | null) => void;
  viewerRef?: React.RefObject<PdfViewerHandle | null>;
}

export function PdfViewer({ tab, onOpenAnother, onPdfDocumentLoaded, viewerRef }: PdfViewerProps) {
  const updateTabState = useDocumentStore((s) => s.updateTabState);
  const closeTab = useDocumentStore((s) => s.closeTab);

  // ── File + Document ──────────────────────────────────────────

  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [readError, setReadError] = useState<string | null>(null);

  const { pdfDocument, numPages, loading: docLoading, error: docError } = usePdfDocument(pdfData);

  // ── View state (initialized from tab store, then local) ──────

  const [viewMode, setViewMode] = useState<ViewMode>(tab.viewMode);
  const [fitMode, setFitModeState] = useState<FitMode>(tab.fitMode);
  const [zoom, setZoomState] = useState(tab.zoom);
  const [currentPage, setCurrentPage] = useState(tab.currentPage);
  const [pageInput, setPageInput] = useState(String(tab.currentPage));

  // ── Continuous-mode state ────────────────────────────────────

  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());
  const [pageDimsMap, setPageDimsMap] = useState<Map<number, PageDims>>(new Map());
  const [pageDims, setPageDims] = useState<PageDims | null>(null);

  // Reset view state if tab changes (different file)
  const tabIdRef = useRef(tab.id);
  useEffect(() => {
    if (tab.id !== tabIdRef.current) {
      tabIdRef.current = tab.id;
      setViewMode(tab.viewMode);
      setFitModeState(tab.fitMode);
      setZoomState(tab.zoom);
      setCurrentPage(tab.currentPage);
      setPageInput(String(tab.currentPage));
      setPdfData(null);
      setReadError(null);
      setRenderedPages(new Set());
      setPageDimsMap(new Map());
      setPageDims(null);
    }
  }, [tab]);

  // ── Single-page render state ─────────────────────────────────

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const isUserScrollRef = useRef(false);
  const isPageInputFocusedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const containerSize = useResizeObserver(containerRef);

  // ── Persist viewer state to tab store ────────────────────────

  useEffect(() => {
    updateTabState(tab.id, {
      viewMode,
      fitMode,
      zoom,
      currentPage,
    });
  }, [tab.id, viewMode, fitMode, zoom, currentPage, updateTabState]);

  // ── Expose pdfDocument to parent ─────────────────────────────

  useEffect(() => {
    onPdfDocumentLoaded?.(pdfDocument);
    return () => {
      onPdfDocumentLoaded?.(null);
    };
  }, [pdfDocument, onPdfDocumentLoaded]);

  // ── Derived ──────────────────────────────────────────────────

  const docState = useMemo((): DocState => {
    if (readError) return { status: 'error', message: readError };
    if (docError) return { status: 'error', message: docError };
    if (pdfDocument) return { status: 'ready' };
    if (docLoading) return { status: 'loading-doc' };
    return { status: 'reading-file' };
  }, [readError, docError, pdfDocument, docLoading]);

  const effectiveZoom = useMemo(() => {
    if (fitMode === 'custom') return zoom;
    return computeFitZoom(fitMode, pageDims, containerSize.width, containerSize.height) ?? zoom;
  }, [fitMode, zoom, pageDims, containerSize]);

  // ── Read file ────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function readFile() {
      try {
        const result = await window.crosspdf.readFile(tab.filePath);
        if (cancelled) return;

        if (!result.success || !result.data) {
          setReadError(result.error ?? 'Failed to read file');
          return;
        }

        setPdfData(result.data);
      } catch (err) {
        if (!cancelled) {
          setReadError(err instanceof Error ? err.message : 'Failed to read file');
        }
      }
    }

    readFile();

    return () => {
      cancelled = true;
    };
  }, [tab.filePath]);

  // ── Load first-page dimensions for fit-mode calc ─────────────

  useEffect(() => {
    if (!pdfDocument) return;
    let cancelled = false;

    (async () => {
      try {
        const page = await pdfDocument.getPage(1);
        if (cancelled) {
          page.cleanup();
          return;
        }
        const viewport = page.getViewport({ scale: 1 });
        setPageDims({ width: viewport.width, height: viewport.height });
        page.cleanup();
      } catch {
        // Ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfDocument]);

  // ── Single-page render effect ────────────────────────────────

  useEffect(() => {
    if (viewMode !== 'single') return;
    if (docState.status !== 'ready') return;

    const canvas = canvasRef.current;
    const doc = pdfDocument;
    if (!canvas || !doc) return;

    renderTaskRef.current?.cancel();
    renderTaskRef.current = null;

    let cancelled = false;
    let page;
    let renderTask: RenderTask | null = null;

    (async () => {
      try {
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        page = await doc.getPage(currentPage);
        const viewport = page.getViewport({
          scale: effectiveZoom * pixelRatio,
        });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / pixelRatio}px`;
        canvas.style.height = `${viewport.height / pixelRatio}px`;

        renderTask = page.render({ canvas, viewport });
        renderTaskRef.current = renderTask;

        await renderTask.promise;
        if (!cancelled) {
          setRenderError(null);
        }
      } catch (err) {
        if (cancelled) return;
        const isCancel = err instanceof Error && err.name === 'RenderingCancelledException';
        if (!isCancel) {
          setRenderError(err instanceof Error ? err.message : 'Unknown render error');
        }
      } finally {
        if (renderTaskRef.current === renderTask) {
          renderTaskRef.current = null;
        }
        page?.cleanup();
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
      if (renderTaskRef.current === renderTask) {
        renderTaskRef.current = null;
      }
    };
  }, [viewMode, docState.status, currentPage, effectiveZoom, pdfDocument]);

  // ── Unmount cleanup ──────────────────────────────────────────

  useEffect(() => {
    return () => {
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    };
  }, []);

  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      if (mode !== viewMode) {
        setRenderedPages(new Set());
        setPageDimsMap(new Map());
      }
      setViewMode(mode);
    },
    [viewMode]
  );

  // ── Continuous mode helpers ──────────────────────────────────

  const addRenderedPage = useCallback((pageNumber: number) => {
    setRenderedPages((prev) => {
      if (prev.has(pageNumber)) return prev;
      const next = new Set(prev);
      next.add(pageNumber);
      return next;
    });
  }, []);

  const handleVisiblePageChange = useCallback((pageNumber: number) => {
    if (isUserScrollRef.current || isPageInputFocusedRef.current) return;
    setCurrentPage(pageNumber);
    setPageInput(String(pageNumber));
  }, []);

  const handlePageDims = useCallback(
    (pageNumber: number, dims: PageDims) => {
      setPageDimsMap((prev) => {
        const existing = prev.get(pageNumber);
        if (existing && existing.width === dims.width && existing.height === dims.height) {
          return prev;
        }
        const next = new Map(prev);
        next.set(pageNumber, dims);
        return next;
      });
      if (pageNumber === 1 && !pageDims) {
        setPageDims(dims);
      }
    },
    [pageDims]
  );

  // ── Navigation ───────────────────────────────────────────────

  const goToPage = useCallback(
    (page: number) => {
      const clamped = Math.max(1, Math.min(page, numPages));
      setCurrentPage(clamped);
      setPageInput(String(clamped));
      setRenderError(null);

      if (viewMode === 'continuous' && clamped !== currentPage) {
        isUserScrollRef.current = true;
        addRenderedPage(clamped);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const el = document.querySelector(`[data-page-number="${clamped}"]`);
            if (el) {
              el.scrollIntoView({ block: 'start', behavior: 'smooth' });
            }
            setTimeout(() => {
              isUserScrollRef.current = false;
            }, 800);
          });
        });
      }
    },
    [numPages, viewMode, currentPage, addRenderedPage]
  );

  // Expose goToPage to parent via ref
  useImperativeHandle(
    viewerRef,
    () => ({
      goToPage,
    }),
    [goToPage]
  );

  const handlePrevPage = useCallback(() => goToPage(currentPage - 1), [goToPage, currentPage]);
  const handleNextPage = useCallback(() => goToPage(currentPage + 1), [goToPage, currentPage]);
  const handleFirstPage = useCallback(() => goToPage(1), [goToPage]);
  const handleLastPage = useCallback(() => goToPage(numPages), [goToPage, numPages]);

  // ── Page input handlers ──────────────────────────────────────

  const handlePageInputChange = useCallback((value: string) => {
    setPageInput(value);
  }, []);

  const handlePageInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const value = parseInt(e.currentTarget.value, 10);
        if (!isNaN(value)) {
          goToPage(value);
        } else {
          setPageInput(String(currentPage));
        }
      }
    },
    [goToPage, currentPage]
  );

  const handlePageInputFocus = useCallback(() => {
    isPageInputFocusedRef.current = true;
  }, []);

  const handlePageInputBlur = useCallback(() => {
    isPageInputFocusedRef.current = false;
    setPageInput(String(currentPage));
  }, [currentPage]);

  // ── Zoom ─────────────────────────────────────────────────────

  const setFitMode = useCallback(
    (mode: FitMode) => {
      setFitModeState(mode);
      if (mode !== 'custom') {
        const newZoom = computeFitZoom(mode, pageDims, containerSize.width, containerSize.height);
        if (newZoom !== null) {
          setZoomState(newZoom);
        }
      }
    },
    [pageDims, containerSize]
  );

  const setCustomZoom = useCallback((z: number) => {
    const clamped = clampZoom(z);
    setZoomState(clamped);
    setFitModeState('custom');
  }, []);

  const handleZoomIn = useCallback(() => {
    setCustomZoom(zoom * ZOOM_FACTOR);
  }, [zoom, setCustomZoom]);

  const handleZoomOut = useCallback(() => {
    setCustomZoom(zoom / ZOOM_FACTOR);
  }, [zoom, setCustomZoom]);

  // ── Close handler ────────────────────────────────────────────

  const handleClose = useCallback(() => {
    closeTab(tab.id);
  }, [closeTab, tab.id]);

  // ── Keyboard shortcuts ───────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (docState.status !== 'ready') return;

      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const meta = e.ctrlKey || e.metaKey;

      // When the user has an active text selection, skip navigation shortcuts
      // that would destroy the selection (allows Ctrl+C to work naturally).
      const selection = document.getSelection();
      const hasActiveSelection = selection && !selection.isCollapsed && selection.rangeCount > 0;

      if (e.key === 'Home') {
        if (hasActiveSelection) return;
        e.preventDefault();
        handleFirstPage();
      } else if (e.key === 'End') {
        if (hasActiveSelection) return;
        e.preventDefault();
        handleLastPage();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        if (hasActiveSelection) return;
        e.preventDefault();
        handleNextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        if (hasActiveSelection) return;
        e.preventDefault();
        handlePrevPage();
      } else if (e.key === 'PageDown') {
        if (hasActiveSelection) return;
        e.preventDefault();
        handleNextPage();
      } else if (e.key === 'PageUp') {
        if (hasActiveSelection) return;
        e.preventDefault();
        handlePrevPage();
      } else if (meta && e.key === '=') {
        e.preventDefault();
        handleZoomIn();
      } else if (meta && e.key === '-') {
        e.preventDefault();
        handleZoomOut();
      } else if (meta && e.key === '0') {
        e.preventDefault();
        setFitMode('fit-page');
      } else if (meta && e.key === '1') {
        e.preventDefault();
        setFitMode('actual');
      } else if (meta && e.key === '2') {
        e.preventDefault();
        setFitMode('fit-width');
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    docState.status,
    handleFirstPage,
    handleLastPage,
    handleNextPage,
    handlePrevPage,
    handleZoomIn,
    handleZoomOut,
    setFitMode,
  ]);

  const isDisabled = docState.status !== 'ready';

  return (
    <div className="h-full flex flex-col bg-surface-100 dark:bg-surface-900">
      <ViewerToolbar
        fileName={tab.fileName}
        numPages={numPages}
        currentPage={currentPage}
        pageInput={pageInput}
        viewMode={viewMode}
        fitMode={fitMode}
        zoom={effectiveZoom}
        disabled={isDisabled}
        onClose={handleClose}
        onOpenAnother={onOpenAnother}
        onPageInputChange={handlePageInputChange}
        onPageInputKeyDown={handlePageInputKeyDown}
        onPageInputFocus={handlePageInputFocus}
        onPageInputBlur={handlePageInputBlur}
        onPrevPage={handlePrevPage}
        onNextPage={handleNextPage}
        onFirstPage={handleFirstPage}
        onLastPage={handleLastPage}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomChange={setCustomZoom}
        onFitMode={setFitMode}
        onViewMode={handleViewModeChange}
      />

      {/* Content area */}
      <div ref={containerRef} className="flex-1 overflow-hidden">
        {docState.status === 'reading-file' && (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <Spinner />
            <span className="text-sm text-surface-500">Reading file…</span>
          </div>
        )}

        {docState.status === 'loading-doc' && (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <Spinner />
            <span className="text-sm text-surface-500">Loading PDF…</span>
          </div>
        )}

        {docState.status === 'error' && (
          <div className="h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="text-red-500 dark:text-red-400">
              <svg
                className="w-12 h-12 mx-auto"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-surface-700 dark:text-surface-200">
                Failed to open document
              </p>
              <p className="text-xs text-surface-500 mt-1">{docState.message}</p>
            </div>
            <Button onClick={onOpenAnother} className="text-xs">
              Open a different file
            </Button>
          </div>
        )}

        {docState.status === 'ready' && viewMode === 'single' && (
          <div className="h-full overflow-auto flex justify-center bg-surface-200/50 dark:bg-surface-800/50">
            {renderError && (
              <div className="flex flex-col items-center justify-center gap-4 p-8 text-center self-center">
                <div className="text-amber-500 dark:text-amber-400">
                  <svg
                    className="w-12 h-12 mx-auto"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-surface-700 dark:text-surface-200">
                    Failed to render this page
                  </p>
                  <p className="text-xs text-surface-500 mt-1">{renderError}</p>
                </div>
                <p className="text-xs text-surface-400">Try navigating to a different page.</p>
              </div>
            )}

            {!renderError && (
              <div className="p-4">
                <div className="relative">
                  <canvas
                    ref={canvasRef}
                    className="block shadow bg-white"
                    aria-label={`Page ${currentPage} of ${numPages}`}
                  />
                  {pdfDocument && (
                    <PageTextLayer
                      pdfDocument={pdfDocument}
                      pageNumber={currentPage}
                      zoom={effectiveZoom}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {docState.status === 'ready' && viewMode === 'continuous' && pdfDocument && (
          <PageList
            pdfDocument={pdfDocument}
            numPages={numPages}
            zoom={effectiveZoom}
            initialPage={currentPage}
            onVisiblePageChange={handleVisiblePageChange}
            renderedPages={renderedPages}
            onPageRender={addRenderedPage}
            pageDimsMap={pageDimsMap}
            onPageDims={handlePageDims}
          />
        )}
      </div>

      <ViewerStatusBar
        fileName={tab.fileName}
        currentPage={currentPage}
        numPages={numPages}
        zoom={effectiveZoom}
        fitMode={fitMode}
        viewMode={viewMode}
      />
    </div>
  );
}
