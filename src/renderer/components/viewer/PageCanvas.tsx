import { memo, useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PageRenderState } from '../../hooks/usePdfPage';
import { usePdfPage } from '../../hooks/usePdfPage';
import { PageTextLayer } from './PageTextLayer';
import { SearchHighlightLayer } from './SearchHighlightLayer';
import { AnnotationLayer } from './AnnotationLayer';
import { RedactionDrawLayer } from './RedactionDrawLayer';
import { FreehandDrawLayer } from './FreehandDrawLayer';
import { ShapeDrawLayer } from './ShapeDrawLayer';
import { AnnotationInteractionLayer } from './AnnotationInteractionLayer';
import { FormFieldDrawLayer } from './FormFieldDrawLayer';
import { Spinner } from '../ui/Spinner';
import type { Annotation } from '../../types/annotation.types';

interface PageCanvasProps {
  pdfDocument: PDFDocumentProxy;
  pageNumber: number;
  zoom: number;
  rotation?: number;
  onDimensions?: (dims: { width: number; height: number }) => void;
  onRenderState?: (state: PageRenderState) => void;
  className?: string;
  // Annotation props
  annotations?: Annotation[];
  selectedIds?: Set<string>;
  activeTool?: string;
  onAnnotationClick?: (id: string) => void;
  onAnnotationDoubleClick?: (id: string) => void;
  onPageClick?: (e: React.MouseEvent) => void;
  // Redaction
  onRedactionDrawn?: (
    pageNumber: number,
    rect: { x: number; y: number; width: number; height: number }
  ) => void;
  // Form field draw
  onFormFieldDrawn?: (
    pageNumber: number,
    rect: { x: number; y: number; width: number; height: number }
  ) => void;
  // Freehand draw
  onFreehandDrawn?: (
    pageNumber: number,
    points: number[],
    color: string,
    strokeWidth: number
  ) => void;
  // Shape draw
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
}

const PageCanvasInner = memo(function PageCanvas({
  pdfDocument,
  pageNumber,
  zoom,
  rotation = 0,
  onDimensions,
  onRenderState,
  className = '',
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
}: PageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { render, cancel } = usePdfPage(pdfDocument, pageNumber, rotation);
  const [state, setState] = useState<PageRenderState>({
    status: 'idle',
    error: null,
    dims: null,
  });

  // Sync callbacks to refs via useEffect so the render promise .then()
  // always sees latest values without retriggering the effect.
  const onDimensionsRef = useRef(onDimensions);
  const onRenderStateRef = useRef(onRenderState);
  useEffect(() => {
    onDimensionsRef.current = onDimensions;
  });
  useEffect(() => {
    onRenderStateRef.current = onRenderState;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;

    setState({ status: 'rendering', error: null, dims: null });

    void render(canvas, zoom).then((result) => {
      if (cancelled) return;
      setState(result);
      if (result.dims) {
        onDimensionsRef.current?.(result.dims);
      }
      onRenderStateRef.current?.(result);
    });

    return () => {
      cancelled = true;
      cancel();
    };
    // `render` and `cancel` are stable for a given (pdfDocument, pageNumber)
    // pair.  They only change when the underlying PDF document or page number
    // changes, which is exactly when we want to re-render.
  }, [pageNumber, zoom, render, cancel]);

  return (
    <div className={`relative ${className}`}>
      {state.status === 'rendering' && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-100/70 dark:bg-surface-900/70 rounded z-10">
          <Spinner className="w-6 h-6" />
        </div>
      )}
      {state.status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-surface-100/80 dark:bg-surface-900/80 rounded text-amber-600 dark:text-amber-400 z-10">
          <svg
            className="w-5 h-5"
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
          <span className="text-xs">Render error</span>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="block bg-white shadow-xl shadow-surface-950/20"
        aria-label={`Page ${pageNumber}`}
      />
      {state.status === 'done' && (
        <>
          <PageTextLayer pdfDocument={pdfDocument} pageNumber={pageNumber} zoom={zoom} />
          <SearchHighlightLayer
            pdfDocument={pdfDocument}
            pageNumber={pageNumber}
            zoom={zoom}
            rotation={rotation as 0 | 90 | 180 | 270}
          />
          <AnnotationLayer
            annotations={annotations ?? []}
            pageNumber={pageNumber}
            zoom={zoom}
            pageDims={state.dims}
            selectedIds={selectedIds ?? new Set()}
            activeTool={activeTool ?? 'select'}
            onAnnotationClick={onAnnotationClick}
            onAnnotationDoubleClick={onAnnotationDoubleClick}
            onPageClick={onPageClick}
          />
          {onRedactionDrawn && (
            <RedactionDrawLayer
              pageNumber={pageNumber}
              zoom={zoom}
              active={(activeTool ?? 'select') === 'redaction'}
              onRedactionDrawn={onRedactionDrawn}
            />
          )}
          {onFormFieldDrawn && (
            <FormFieldDrawLayer
              pageNumber={pageNumber}
              zoom={zoom}
              active={(activeTool ?? 'select') === 'form-field'}
              onFormFieldDrawn={onFormFieldDrawn}
            />
          )}
          {onFreehandDrawn && (
            <FreehandDrawLayer
              pageNumber={pageNumber}
              zoom={zoom}
              active={(activeTool ?? 'select') === 'freehand'}
              onFreehandDrawn={onFreehandDrawn}
            />
          )}
          {onShapeDrawn && (
            <ShapeDrawLayer
              pageNumber={pageNumber}
              zoom={zoom}
              active={
                (activeTool ?? 'select') === 'rectangle' ||
                (activeTool ?? 'select') === 'ellipse' ||
                (activeTool ?? 'select') === 'line' ||
                (activeTool ?? 'select') === 'arrow'
              }
              activeTool={(activeTool ?? 'select') as 'rectangle' | 'ellipse' | 'line' | 'arrow'}
              onShapeDrawn={onShapeDrawn}
            />
          )}
          {annotations && onAnnotationMoved && onAnnotationResized && (
            <AnnotationInteractionLayer
              zoom={zoom}
              annotations={annotations.filter((a) => a.pageNumber === pageNumber)}
              selectedIds={selectedIds ?? new Set()}
              activeTool={activeTool ?? 'select'}
              onAnnotationClick={onAnnotationClick}
              onAnnotationDoubleClick={onAnnotationDoubleClick}
              onAnnotationMoved={onAnnotationMoved}
              onAnnotationResized={onAnnotationResized}
            />
          )}
        </>
      )}
    </div>
  );
});
PageCanvasInner.displayName = 'PageCanvas';

export { PageCanvasInner as PageCanvas };
