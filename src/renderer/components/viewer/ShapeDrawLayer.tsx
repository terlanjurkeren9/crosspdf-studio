import { useEffect, useRef, useState } from 'react';
import { screenPointToPdf } from '../../lib/pdf-coordinates';
import type { AnnotationTool } from '../../types/annotation.types';

interface ShapeDrawLayerProps {
  pageNumber: number;
  zoom: number;
  active: boolean;
  activeTool: AnnotationTool;
  onShapeDrawn: (
    pageNumber: number,
    type: 'rectangle' | 'ellipse' | 'line' | 'arrow',
    points: number[],
    color: string,
    strokeWidth: number
  ) => void;
}

/**
 * Transparent overlay that handles click-drag shape drawing (rectangle, ellipse, line, arrow).
 */
export function ShapeDrawLayer({
  pageNumber,
  zoom,
  active,
  activeTool,
  onShapeDrawn,
}: ShapeDrawLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const activeRef = useRef(active);
  const zoomRef = useRef(zoom);
  const pageNumberRef = useRef(pageNumber);
  const activeToolRef = useRef(activeTool);
  const onShapeDrawnRef = useRef(onShapeDrawn);
  const drawingRef = useRef<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    pointerId: number;
  } | null>(null);

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
    activeToolRef.current = activeTool;
  });
  useEffect(() => {
    onShapeDrawnRef.current = onShapeDrawn;
  });

  const [preview, setPreview] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    tool: AnnotationTool;
  } | null>(null);

  function startDraw(clientX: number, clientY: number, pointerId: number) {
    if (!activeRef.current) return;
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const pt = screenPointToPdf(clientX, clientY, rect, zoomRef.current);
    drawingRef.current = { startX: pt.x, startY: pt.y, currentX: pt.x, currentY: pt.y, pointerId };
    setPreview({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y, tool: activeToolRef.current });

    container.setPointerCapture(pointerId);
  }

  function moveDraw(clientX: number, clientY: number) {
    const d = drawingRef.current;
    if (!d) return;
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const pt = screenPointToPdf(clientX, clientY, rect, zoomRef.current);
    d.currentX = pt.x;
    d.currentY = pt.y;
    setPreview({ x1: d.startX, y1: d.startY, x2: pt.x, y2: pt.y, tool: activeToolRef.current });
  }

  function endDraw() {
    const d = drawingRef.current;
    drawingRef.current = null;
    setPreview(null);

    if (!d) return;
    const container = containerRef.current;
    if (container) {
      try {
        container.releasePointerCapture(d.pointerId);
      } catch {
        /* ignore */
      }
    }

    const x1 = d.startX;
    const y1 = d.startY;
    const x2 = d.currentX;
    const y2 = d.currentY;
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);

    // Minimum size check: allow horizontal lines (dy=0) and vertical lines (dx=0)
    const tool = activeToolRef.current;
    const isLineTool = tool === 'line' || tool === 'arrow';
    const minDistance = 5;
    const hasMinimumDistance = isLineTool
      ? (dx >= minDistance || dy >= minDistance) && dx + dy >= minDistance
      : dx >= minDistance && dy >= minDistance;

    if (hasMinimumDistance) {
      onShapeDrawnRef.current(
        pageNumberRef.current,
        tool as 'rectangle' | 'ellipse' | 'line' | 'arrow',
        [x1, y1, x2, y2],
        '#000000',
        2
      );
    }
  }

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
      setPreview(null);
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

  const renderPreview = () => {
    if (!preview) return null;
    const { x1, y1, x2, y2, tool } = preview;
    const z = zoom;

    if (tool === 'rectangle' || tool === 'ellipse') {
      const left = Math.min(x1, x2) * z;
      const top = Math.min(y1, y2) * z;
      const width = Math.abs(x2 - x1) * z;
      const height = Math.abs(y2 - y1) * z;
      return (
        <div
          className="absolute border-2 border-blue-500 pointer-events-none"
          style={{
            left,
            top,
            width,
            height,
            borderRadius: tool === 'ellipse' ? '50%' : undefined,
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
          }}
        />
      );
    }

    if (tool === 'line' || tool === 'arrow') {
      const vx1 = x1 * z;
      const vy1 = y1 * z;
      const vx2 = x2 * z;
      const vy2 = y2 * z;

      // Calculate angle for arrowhead
      const angle = Math.atan2(vy2 - vy1, vx2 - vx1);
      const headLen = 10 * z;
      const arrowX1 = vx2 - headLen * Math.cos(angle - Math.PI / 6);
      const arrowY1 = vy2 - headLen * Math.sin(angle - Math.PI / 6);
      const arrowX2 = vx2 - headLen * Math.cos(angle + Math.PI / 6);
      const arrowY2 = vy2 - headLen * Math.sin(angle + Math.PI / 6);

      return (
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
          <line x1={vx1} y1={vy1} x2={vx2} y2={vy2} stroke="#3b82f6" strokeWidth={2 * z} />
          {tool === 'arrow' && (
            <polygon
              points={`${vx2},${vy2} ${arrowX1},${arrowY1} ${arrowX2},${arrowY2}`}
              fill="#3b82f6"
            />
          )}
        </svg>
      );
    }

    return null;
  };

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
      {active && renderPreview()}
    </div>
  );
}
