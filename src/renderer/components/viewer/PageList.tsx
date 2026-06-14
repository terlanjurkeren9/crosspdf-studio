import { useCallback, useLayoutEffect, useRef } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { PageCanvas } from './PageCanvas';
import type { Annotation } from '../../types/annotation.types';

interface PageListProps {
  pdfDocument: PDFDocumentProxy;
  numPages: number;
  zoom: number;
  rotation?: number;
  /** The page to pre-render on mount (typically currentPage from parent). */
  initialPage?: number;
  onVisiblePageChange: (pageNumber: number) => void;
  renderedPages: Set<number>;
  onPageRender: (pageNumber: number) => void;
  pageDimsMap: Map<number, { width: number; height: number }>;
  onPageDims: (pageNumber: number, dims: { width: number; height: number }) => void;
  // Annotation props
  annotations?: Annotation[];
  selectedIds?: Set<string>;
  activeTool?: string;
  onAnnotationClick?: (id: string) => void;
  onAnnotationDoubleClick?: (id: string) => void;
  onPageClick?: (e: React.MouseEvent) => void;
  onRedactionDrawn?: (
    pageNumber: number,
    rect: { x: number; y: number; width: number; height: number }
  ) => void;
  onFormFieldDrawn?: (
    pageNumber: number,
    rect: { x: number; y: number; width: number; height: number }
  ) => void;
  onFreehandDrawn?: (
    pageNumber: number,
    points: number[],
    color: string,
    strokeWidth: number
  ) => void;
  onShapeDrawn?: (
    pageNumber: number,
    type: 'rectangle' | 'ellipse' | 'line' | 'arrow',
    points: number[],
    color: string,
    strokeWidth: number
  ) => void;
  // Annotation interaction (move/resize for stamp, sticky-note, free-text)
  onAnnotationMoved?: (
    id: string,
    rect: { x: number; y: number; width: number; height: number }
  ) => void;
  onAnnotationResized?: (
    id: string,
    rect: { x: number; y: number; width: number; height: number }
  ) => void;
  // Edit mode for PDF object editing
  editMode?: boolean;
  tabId?: string;
}

export function PageList({
  pdfDocument,
  numPages,
  zoom,
  rotation = 0,
  initialPage,
  onVisiblePageChange,
  renderedPages,
  onPageRender,
  pageDimsMap,
  onPageDims,
  annotations,
  selectedIds,
  activeTool,
  onAnnotationClick,
  onAnnotationDoubleClick,
  onPageClick,
  onRedactionDrawn,
  onFormFieldDrawn,
  onFreehandDrawn,
  onShapeDrawn,
  onAnnotationMoved,
  onAnnotationResized,
  editMode = false,
  tabId = '',
}: PageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const pageElementsRef = useRef<Map<number, HTMLDivElement>>(new Map());

  // Persistent map of intersection ratios for all observed pages.
  // The observer callback updates entries for pages whose ratio changed,
  // then we pick the best page from the *entire* map — not just the
  // current entries batch.  This gives stable scroll sync even when the
  // observer reports a partial batch.
  const visibleRatiosRef = useRef<Map<number, number>>(new Map());

  // useLayoutEffect so callback refs are updated before the browser
  // "update the rendering" step where IntersectionObserver callbacks fire.
  const onPageRenderRef = useRef(onPageRender);
  useLayoutEffect(() => {
    onPageRenderRef.current = onPageRender;
  });

  const onVisiblePageChangeRef = useRef(onVisiblePageChange);
  useLayoutEffect(() => {
    onVisiblePageChangeRef.current = onVisiblePageChange;
  });

  // Pre-render the initialPage so the transition single→continuous shows
  // the active page immediately.
  useLayoutEffect(() => {
    if (initialPage && initialPage >= 1 && initialPage <= numPages) {
      onPageRenderRef.current(initialPage);
    }
    // Only on mount / when numPages first becomes known
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numPages]);

  const defaultHeight = (pageDimsMap.get(1)?.height ?? 792) * zoom;

  // ── IntersectionObserver ──────────────────────────────────────

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    visibleRatiosRef.current.clear();

    const observer = new IntersectionObserver(
      (entries) => {
        // Update persistent ratios from this batch.
        for (const entry of entries) {
          const pageNum = parseInt((entry.target as HTMLElement).dataset.pageNumber ?? '0', 10);
          if (!pageNum) continue;

          visibleRatiosRef.current.set(pageNum, entry.intersectionRatio);

          if (entry.intersectionRatio > 0) {
            onPageRenderRef.current(pageNum);
          }
        }

        // Pick the best page from the complete ratio map.
        let bestPage = 0;
        let bestRatio = 0;
        for (const [pn, ratio] of visibleRatiosRef.current) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestPage = pn;
          }
        }

        if (bestPage > 0 && bestRatio >= 0.1) {
          onVisiblePageChangeRef.current(bestPage);
        }
      },
      {
        root: container,
        rootMargin: '300px 0px',
        threshold: [0, 0.1, 0.25, 0.5, 0.75],
      }
    );

    observerRef.current = observer;

    for (const [, el] of pageElementsRef.current) {
      observer.observe(el);
    }

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [numPages]);

  // ── Element registration ─────────────────────────────────────

  const registerPageElement = useCallback((pageNumber: number, el: HTMLDivElement | null) => {
    const observer = observerRef.current;
    if (el) {
      pageElementsRef.current.set(pageNumber, el);
      observer?.observe(el);
    } else {
      const old = pageElementsRef.current.get(pageNumber);
      if (old) {
        observer?.unobserve(old);
        pageElementsRef.current.delete(pageNumber);
        visibleRatiosRef.current.delete(pageNumber);
      }
    }
  }, []);

  const handleDimensions = useCallback(
    (pageNumber: number, dims: { width: number; height: number }) => {
      onPageDims(pageNumber, dims);
    },
    [onPageDims]
  );

  const handleRenderState = useCallback(() => {
    // Per-page error tracking can be added here later
  }, []);

  return (
    <div
      ref={containerRef}
      className="pdf-workspace h-full overflow-auto flex flex-col items-center"
    >
      <div className="flex w-full flex-col items-center gap-5 py-5">
        {Array.from({ length: numPages }, (_, i) => {
          const pageNumber = i + 1;
          const dims = pageDimsMap.get(pageNumber);
          const height = dims ? dims.height * zoom : defaultHeight;
          const width = dims ? dims.width * zoom : 612 * zoom;

          return (
            <div
              key={pageNumber}
              ref={(el) => registerPageElement(pageNumber, el)}
              data-page-number={pageNumber}
              className="flex-shrink-0"
              style={{ minHeight: Math.max(100, height) }}
            >
              {renderedPages.has(pageNumber) ? (
                <PageCanvas
                  pdfDocument={pdfDocument}
                  pageNumber={pageNumber}
                  zoom={zoom}
                  rotation={rotation}
                  onDimensions={(d) => handleDimensions(pageNumber, d)}
                  onRenderState={handleRenderState}
                  annotations={annotations}
                  selectedIds={selectedIds}
                  activeTool={activeTool}
                  onAnnotationClick={onAnnotationClick}
                  onAnnotationDoubleClick={onAnnotationDoubleClick}
                  onPageClick={onPageClick}
                  onRedactionDrawn={onRedactionDrawn}
                  onFormFieldDrawn={onFormFieldDrawn}
                  onFreehandDrawn={onFreehandDrawn}
                  onShapeDrawn={onShapeDrawn}
                  onAnnotationMoved={onAnnotationMoved}
                  onAnnotationResized={onAnnotationResized}
                  editMode={editMode}
                  tabId={tabId}
                />
              ) : (
                <div
                  className="animate-pulse rounded-sm bg-white/70 shadow-lg shadow-surface-950/10 dark:bg-surface-800"
                  style={{ width, height }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
