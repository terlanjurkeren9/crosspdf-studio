import { useEffect, useRef, useState } from 'react';
import { screenPointToPdf } from '../../lib/pdf-coordinates';

interface FreehandDrawLayerProps {
  pageNumber: number;
  zoom: number;
  active: boolean;
  onFreehandDrawn: (
    pageNumber: number,
    points: number[],
    color: string,
    strokeWidth: number
  ) => void;
}

/**
 * Transparent overlay that handles click-drag freehand drawing.
 * Uses refs for all mutable state to avoid stale-closure issues.
 */
export function FreehandDrawLayer({
  pageNumber,
  zoom,
  active,
  onFreehandDrawn,
}: FreehandDrawLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Mutable refs
  const activeRef = useRef(active);
  const zoomRef = useRef(zoom);
  const pageNumberRef = useRef(pageNumber);
  const onFreehandDrawnRef = useRef(onFreehandDrawn);
  const drawingRef = useRef<{
    points: number[];
    pointerId: number;
  } | null>(null);

  // Sync refs on every render
  useEffect(() => {
    activeRef.current = active;
  });
  useEffect(() => {
    zoomRef.current = zoom;
  });
  useEffect(() => {
    pageNumberRef.current = pageNumber;
  });
  useEffect(() => {
    onFreehandDrawnRef.current = onFreehandDrawn;
  });

  // Preview state for rendering the path being drawn
  const [previewPoints, setPreviewPoints] = useState<number[] | null>(null);

  function startDraw(clientX: number, clientY: number, pointerId: number) {
    if (!activeRef.current) return;
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const pt = screenPointToPdf(clientX, clientY, rect, zoomRef.current);
    drawingRef.current = { points: [pt.x, pt.y], pointerId };
    setPreviewPoints([pt.x, pt.y]);

    container.setPointerCapture(pointerId);
  }

  function moveDraw(clientX: number, clientY: number) {
    const d = drawingRef.current;
    if (!d) return;
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const pt = screenPointToPdf(clientX, clientY, rect, zoomRef.current);
    d.points.push(pt.x, pt.y);
    setPreviewPoints([...d.points]);
  }

  function endDraw() {
    const d = drawingRef.current;
    drawingRef.current = null;
    setPreviewPoints(null);

    if (!d) return;
    const container = containerRef.current;
    if (container) {
      try {
        container.releasePointerCapture(d.pointerId);
      } catch {
        /* ignore */
      }
    }

    // Only create annotation if we have enough points (at least one segment)
    if (d.points.length >= 4) {
      onFreehandDrawnRef.current(pageNumberRef.current, d.points, '#000000', 2);
    }
  }

  // Attach/detach from DOM
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function onPDown(e: PointerEvent) {
      e.preventDefault();
      startDraw(e.clientX, e.clientY, e.pointerId);
    }
    function onPMove(e: PointerEvent) {
      e.preventDefault();
      moveDraw(e.clientX, e.clientY);
    }
    function onPUp(e: PointerEvent) {
      e.preventDefault();
      endDraw();
    }
    function onCancel() {
      drawingRef.current = null;
      setPreviewPoints(null);
    }

    el.addEventListener('pointerdown', onPDown);
    el.addEventListener('pointermove', onPMove);
    el.addEventListener('pointerup', onPUp);
    el.addEventListener('pointercancel', onCancel);

    return () => {
      el.removeEventListener('pointerdown', onPDown);
      el.removeEventListener('pointermove', onPMove);
      el.removeEventListener('pointerup', onPUp);
      el.removeEventListener('pointercancel', onCancel);
    };
  }, []);

  // Convert preview points to SVG path for rendering
  // Points are in PDF coordinates; scale by zoom for viewport display
  const previewPath =
    previewPoints && previewPoints.length >= 2
      ? previewPoints.reduce((acc, val, idx) => {
          if (idx % 2 === 0) {
            return acc + (idx === 0 ? `M ${val * zoom} ` : `L ${val * zoom} `);
          } else {
            return acc + `${val * zoom} `;
          }
        }, '')
      : '';

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{
        zIndex: 5,
        cursor: active ? 'crosshair' : undefined,
        touchAction: 'none',
        pointerEvents: active ? 'auto' : 'none',
        background: active ? 'rgba(0,0,0,0.004)' : undefined,
      }}
    >
      {active && previewPath && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
          <path
            d={previewPath}
            fill="none"
            stroke="#000000"
            strokeWidth={2 * zoom}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
}
