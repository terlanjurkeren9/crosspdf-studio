import { useEffect, useRef, useState } from 'react';
import type { StampAnnotation } from '../../types/annotation.types';
import { pdfRectToPixel } from '../../lib/pdf-coordinates';
import type { PdfRect } from '../../types/annotation.types';

const HANDLE_SIZE = 8;
const DRAG_THRESHOLD = 3;

type Corner = 'nw' | 'ne' | 'sw' | 'se';

interface DragState {
  annotationId: string;
  type: 'move' | 'resize';
  corner?: Corner;
  startScreenX: number;
  startScreenY: number;
  startRect: { x: number; y: number; width: number; height: number };
}

interface StampInteractionLayerProps {
  zoom: number;
  stamps: StampAnnotation[];
  selectedIds: Set<string>;
  activeTool: string;
  onAnnotationClick?: (id: string) => void;
  onStampMoved: (id: string, rect: { x: number; y: number; width: number; height: number }) => void;
  onStampResized: (
    id: string,
    rect: { x: number; y: number; width: number; height: number }
  ) => void;
}

export function StampInteractionLayer({
  zoom,
  stamps,
  selectedIds,
  activeTool,
  onAnnotationClick,
  onStampMoved,
  onStampResized,
}: StampInteractionLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const didDragRef = useRef(false);
  const previewRef = useRef<{ id: string; rect: PdfRect } | null>(null);

  // Ref syncing
  const zoomRef = useRef(zoom);
  const stampsRef = useRef(stamps);
  const onStampMovedRef = useRef(onStampMoved);
  const onStampResizedRef = useRef(onStampResized);
  const onAnnotationClickRef = useRef(onAnnotationClick);
  const selectedIdsRef = useRef(selectedIds);
  useEffect(() => {
    zoomRef.current = zoom;
  });
  useEffect(() => {
    stampsRef.current = stamps;
  });
  useEffect(() => {
    onStampMovedRef.current = onStampMoved;
  });
  useEffect(() => {
    onStampResizedRef.current = onStampResized;
  });
  useEffect(() => {
    onAnnotationClickRef.current = onAnnotationClick;
  });
  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  });

  const [preview, setPreview] = useState<{
    id: string;
    rect: { x: number; y: number; width: number; height: number };
  } | null>(null);

  const isInteractive = activeTool === 'select';

  // ── Attach pointer event listeners (like RedactionDrawLayer pattern) ──
  useEffect(() => {
    const node = containerRef.current!;
    if (!node) return;

    function onPDown(e: PointerEvent) {
      if (!isInteractive) return;
      const target = e.target as HTMLElement;
      const handleEl = target.closest('[data-stamp-handle]') as HTMLElement | null;
      const moveEl = target.closest('[data-stamp-move]') as HTMLElement | null;

      if (handleEl) {
        e.preventDefault();
        e.stopPropagation();
        const id = handleEl.dataset.stampHandle!;
        const corner = handleEl.dataset.stampCorner as Corner;
        const stamp = stampsRef.current.find((s) => s.id === id);
        if (!stamp) return;

        dragRef.current = {
          annotationId: id,
          type: 'resize',
          corner,
          startScreenX: e.clientX,
          startScreenY: e.clientY,
          startRect: { ...stamp.rect },
        };
        didDragRef.current = false;
        previewRef.current = null;
        try {
          node.setPointerCapture(1);
        } catch {
          /* ignore */
        }
      } else if (moveEl) {
        e.preventDefault();
        e.stopPropagation();
        const id = moveEl.dataset.stampMove!;
        const selected = selectedIdsRef.current.has(id);
        if (!selected) {
          onAnnotationClickRef.current?.(id);
          return;
        }
        const stamp = stampsRef.current.find((s) => s.id === id);
        if (!stamp) return;

        dragRef.current = {
          annotationId: id,
          type: 'move',
          corner: undefined,
          startScreenX: e.clientX,
          startScreenY: e.clientY,
          startRect: { ...stamp.rect },
        };
        didDragRef.current = false;
        previewRef.current = null;
        try {
          node.setPointerCapture(1);
        } catch {
          /* ignore */
        }
      }
    }

    function onPMove(e: PointerEvent) {
      const d = dragRef.current;
      if (!d) return;
      e.preventDefault();

      const dx = (e.clientX - d.startScreenX) / zoomRef.current;
      const dy = (e.clientY - d.startScreenY) / zoomRef.current;

      if (
        !didDragRef.current &&
        Math.abs(dx * zoomRef.current) < DRAG_THRESHOLD &&
        Math.abs(dy * zoomRef.current) < DRAG_THRESHOLD
      ) {
        return;
      }
      didDragRef.current = true;

      const r = d.startRect;
      let newRect: { x: number; y: number; width: number; height: number };

      if (d.type === 'move') {
        newRect = {
          x: r.x + dx,
          y: r.y + dy,
          width: r.width,
          height: r.height,
        };
      } else {
        newRect = { x: r.x, y: r.y, width: r.width, height: r.height };
        const minSize = 10 / zoomRef.current;
        switch (d.corner) {
          case 'nw':
            newRect.x = r.x + dx;
            newRect.y = r.y + dy;
            newRect.width = Math.max(minSize, r.width - dx);
            newRect.height = Math.max(minSize, r.height - dy);
            break;
          case 'ne':
            newRect.y = r.y + dy;
            newRect.width = Math.max(minSize, r.width + dx);
            newRect.height = Math.max(minSize, r.height - dy);
            break;
          case 'sw':
            newRect.x = r.x + dx;
            newRect.width = Math.max(minSize, r.width - dx);
            newRect.height = Math.max(minSize, r.height + dy);
            break;
          case 'se':
            newRect.width = Math.max(minSize, r.width + dx);
            newRect.height = Math.max(minSize, r.height + dy);
            break;
        }
      }

      previewRef.current = { id: d.annotationId, rect: newRect };
      setPreview({ id: d.annotationId, rect: newRect });
    }

    function onPUp() {
      const d = dragRef.current;
      dragRef.current = null;

      try {
        node.releasePointerCapture(1);
      } catch {
        /* ignore */
      }

      if (!d) return;

      const finalPreview = previewRef.current;
      previewRef.current = null;
      setPreview(null);

      if (didDragRef.current && finalPreview) {
        if (d.type === 'move') {
          onStampMovedRef.current(d.annotationId, finalPreview.rect);
        } else {
          onStampResizedRef.current(d.annotationId, finalPreview.rect);
        }
      } else {
        onAnnotationClickRef.current?.(d.annotationId);
      }
    }

    function onCancel() {
      dragRef.current = null;
      previewRef.current = null;
      setPreview(null);
    }

    node.addEventListener('pointerdown', onPDown);
    node.addEventListener('pointermove', onPMove);
    node.addEventListener('pointerup', onPUp);
    node.addEventListener('pointercancel', onCancel);

    return () => {
      node.removeEventListener('pointerdown', onPDown);
      node.removeEventListener('pointermove', onPMove);
      node.removeEventListener('pointerup', onPUp);
      node.removeEventListener('pointercancel', onCancel);
    };
  }, [isInteractive]);

  if (stamps.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{
        zIndex: 10,
        pointerEvents: 'none',
        touchAction: 'none',
      }}
    >
      {stamps.map((stamp) => {
        const isSelected = selectedIds.has(stamp.id);
        const isPreview = preview && preview.id === stamp.id;
        const rect = isPreview ? preview!.rect : stamp.rect;
        const pixel = pdfRectToPixel(rect, zoom);
        const hs = HANDLE_SIZE;
        const hh = hs / 2;

        return (
          <div key={stamp.id}>
            {/* Move hit area — covers the full stamp */}
            <div
              data-stamp-move={stamp.id}
              className="absolute"
              style={{
                left: pixel.x,
                top: pixel.y,
                width: Math.max(0, pixel.width),
                height: Math.max(0, pixel.height),
                cursor: isInteractive && isSelected ? 'move' : 'pointer',
                pointerEvents: isInteractive ? 'auto' : 'none',
              }}
            />

            {/* Corner resize handles — only when selected and interactive */}
            {isSelected && isInteractive && (
              <>
                {(['nw', 'ne', 'sw', 'se'] as Corner[]).map((corner) => {
                  let left: number;
                  let top: number;
                  let cursor: string;

                  switch (corner) {
                    case 'nw':
                      left = pixel.x - hh;
                      top = pixel.y - hh;
                      cursor = 'nwse-resize';
                      break;
                    case 'ne':
                      left = pixel.x + pixel.width - hh;
                      top = pixel.y - hh;
                      cursor = 'nesw-resize';
                      break;
                    case 'sw':
                      left = pixel.x - hh;
                      top = pixel.y + pixel.height - hh;
                      cursor = 'nesw-resize';
                      break;
                    case 'se':
                      left = pixel.x + pixel.width - hh;
                      top = pixel.y + pixel.height - hh;
                      cursor = 'nwse-resize';
                      break;
                  }

                  return (
                    <div
                      key={corner}
                      data-stamp-handle={stamp.id}
                      data-stamp-corner={corner}
                      className="absolute rounded-full border-2 bg-white"
                      style={{
                        left,
                        top,
                        width: hs,
                        height: hs,
                        borderColor: '#3b82f6',
                        cursor,
                        pointerEvents: 'auto',
                        zIndex: 11,
                      }}
                    />
                  );
                })}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
