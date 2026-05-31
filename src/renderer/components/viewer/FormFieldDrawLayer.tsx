import { useEffect, useRef, useState } from 'react';
import { screenPointToPdf } from '../../lib/pdf-coordinates';

interface FormFieldDrawLayerProps {
  pageNumber: number;
  zoom: number;
  active: boolean;
  onFormFieldDrawn: (
    pageNumber: number,
    rect: { x: number; y: number; width: number; height: number }
  ) => void;
}

export function FormFieldDrawLayer({
  pageNumber,
  zoom,
  active,
  onFormFieldDrawn,
}: FormFieldDrawLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const activeRef = useRef(active);
  const zoomRef = useRef(zoom);
  const pageNumberRef = useRef(pageNumber);
  const onFormFieldDrawnRef = useRef(onFormFieldDrawn);
  const drawingRef = useRef<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
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
    onFormFieldDrawnRef.current = onFormFieldDrawn;
  });

  const [preview, setPreview] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  function updatePreview(d: typeof drawingRef.current): void {
    if (!d) {
      setPreview(null);
      return;
    }
    const z = zoomRef.current;
    const left = Math.min(d.startX, d.currentX) * z;
    const top = Math.min(d.startY, d.currentY) * z;
    const width = Math.abs(d.currentX - d.startX) * z;
    const height = Math.abs(d.currentY - d.startY) * z;
    setPreview({ left, top, width, height });
  }

  function startDraw(clientX: number, clientY: number) {
    if (!activeRef.current) return;
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const pt = screenPointToPdf(clientX, clientY, rect, zoomRef.current);
    const state = { startX: pt.x, startY: pt.y, currentX: pt.x, currentY: pt.y };
    drawingRef.current = state;
    updatePreview(state);

    container.setPointerCapture(1);
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
    updatePreview(d);
  }

  function endDraw() {
    const d = drawingRef.current;
    drawingRef.current = null;
    updatePreview(null);

    if (!d) return;
    const container = containerRef.current;
    if (container) {
      try {
        container.releasePointerCapture(1);
      } catch {
        /* ignore */
      }
    }

    const x = Math.min(d.startX, d.currentX);
    const y = Math.min(d.startY, d.currentY);
    const w = Math.abs(d.currentX - d.startX);
    const h = Math.abs(d.currentY - d.startY);

    if (w >= 10 && h >= 10) {
      onFormFieldDrawnRef.current(pageNumberRef.current, { x, y, width: w, height: h });
    }
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function onPDown(e: PointerEvent) {
      e.preventDefault();
      startDraw(e.clientX, e.clientY);
    }
    function onPMove(e: PointerEvent) {
      e.preventDefault();
      moveDraw(e.clientX, e.clientY);
    }
    function onPUp(e: PointerEvent) {
      e.preventDefault();
      endDraw();
    }
    function onMDown(e: MouseEvent) {
      e.preventDefault();
      startDraw(e.clientX, e.clientY);
    }
    function onMMove(e: MouseEvent) {
      e.preventDefault();
      moveDraw(e.clientX, e.clientY);
    }
    function onMUp(e: MouseEvent) {
      e.preventDefault();
      endDraw();
    }
    function onCancel() {
      drawingRef.current = null;
      updatePreview(null);
    }

    el.addEventListener('pointerdown', onPDown);
    el.addEventListener('pointermove', onPMove);
    el.addEventListener('pointerup', onPUp);
    el.addEventListener('pointercancel', onCancel);
    el.addEventListener('mousedown', onMDown);
    el.addEventListener('mousemove', onMMove);
    el.addEventListener('mouseup', onMUp);

    return () => {
      el.removeEventListener('pointerdown', onPDown);
      el.removeEventListener('pointermove', onPMove);
      el.removeEventListener('pointerup', onPUp);
      el.removeEventListener('pointercancel', onCancel);
      el.removeEventListener('mousedown', onMDown);
      el.removeEventListener('mousemove', onMMove);
      el.removeEventListener('mouseup', onMUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      {active && preview && preview.width > 0 && preview.height > 0 && (
        <div
          className="absolute border-2 border-blue-500 pointer-events-none"
          style={{
            left: preview.left,
            top: preview.top,
            width: preview.width,
            height: preview.height,
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
          }}
        />
      )}
    </div>
  );
}
