import { useEffect, useRef, useState } from 'react';
import type { Annotation } from '../../types/annotation.types';
import { pdfRectToPixel } from '../../lib/pdf-coordinates';
import type { PdfRect } from '../../types/annotation.types';

const HANDLE_SIZE = 8;
const DRAG_THRESHOLD = 3;
const DOUBLE_CLICK_MS = 350;

type Corner = 'nw' | 'ne' | 'sw' | 'se';

interface DragState {
  annotationId: string;
  type: 'move' | 'resize';
  corner?: Corner;
  startScreenX: number;
  startScreenY: number;
  startRect: { x: number; y: number; width: number; height: number };
}

interface AnnotationInteractionLayerProps {
  zoom: number;
  annotations: Annotation[];
  selectedIds: Set<string>;
  activeTool: string;
  onAnnotationClick?: (id: string) => void;
  onAnnotationDoubleClick?: (id: string) => void;
  onAnnotationMoved: (
    id: string,
    rect: { x: number; y: number; width: number; height: number }
  ) => void;
  onAnnotationResized: (
    id: string,
    rect: { x: number; y: number; width: number; height: number }
  ) => void;
}

const MOVABLE_TYPES = new Set(['stamp', 'sticky-note', 'free-text', 'form-field']);
const RESIZABLE_TYPES = new Set(['stamp', 'free-text', 'form-field']);

function isMovable(ann: Annotation): boolean {
  return MOVABLE_TYPES.has(ann.type);
}

function isResizable(ann: Annotation): boolean {
  return RESIZABLE_TYPES.has(ann.type);
}

export function AnnotationInteractionLayer({
  zoom,
  annotations,
  selectedIds,
  activeTool,
  onAnnotationClick,
  onAnnotationDoubleClick,
  onAnnotationMoved,
  onAnnotationResized,
}: AnnotationInteractionLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const didDragRef = useRef(false);
  const previewRef = useRef<{ id: string; rect: PdfRect } | null>(null);
  const lastClickRef = useRef<{ id: string; time: number }>({ id: '', time: 0 });
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedOnDownRef = useRef<string | null>(null);

  const zoomRef = useRef(zoom);
  const annotationsRef = useRef(annotations);
  const onMovedRef = useRef(onAnnotationMoved);
  const onResizedRef = useRef(onAnnotationResized);
  const onClickRef = useRef(onAnnotationClick);
  const onDoubleClickRef = useRef(onAnnotationDoubleClick);
  const selectedIdsRef = useRef(selectedIds);
  useEffect(() => {
    zoomRef.current = zoom;
  });
  useEffect(() => {
    annotationsRef.current = annotations;
  });
  useEffect(() => {
    onMovedRef.current = onAnnotationMoved;
  });
  useEffect(() => {
    onResizedRef.current = onAnnotationResized;
  });
  useEffect(() => {
    onClickRef.current = onAnnotationClick;
  });
  useEffect(() => {
    onDoubleClickRef.current = onAnnotationDoubleClick;
  });
  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  });

  const [preview, setPreview] = useState<{
    id: string;
    rect: { x: number; y: number; width: number; height: number };
  } | null>(null);

  const isInteractive = activeTool === 'select';

  // Cleanup click timer on unmount
  useEffect(() => {
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const node = containerRef.current!;
    if (!node) return;

    function onPDown(e: PointerEvent) {
      if (!isInteractive) return;
      selectedOnDownRef.current = null;
      const target = e.target as HTMLElement;
      const handleEl = target.closest('[data-annot-handle]') as HTMLElement | null;
      const moveEl = target.closest('[data-annot-move]') as HTMLElement | null;

      if (handleEl) {
        e.preventDefault();
        e.stopPropagation();
        const id = handleEl.dataset.annotHandle!;
        const corner = handleEl.dataset.annotCorner as Corner;
        const ann = annotationsRef.current.find((a) => a.id === id);
        if (!ann || !isResizable(ann)) return;

        dragRef.current = {
          annotationId: id,
          type: 'resize',
          corner,
          startScreenX: e.clientX,
          startScreenY: e.clientY,
          startRect: { ...ann.rect },
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
        const id = moveEl.dataset.annotMove!;
        const ann = annotationsRef.current.find((a) => a.id === id);
        if (!ann || !isMovable(ann)) return;

        const wasSelected = selectedIdsRef.current.has(id);

        dragRef.current = {
          annotationId: id,
          type: 'move',
          corner: undefined,
          startScreenX: e.clientX,
          startScreenY: e.clientY,
          startRect: { ...ann.rect },
        };
        didDragRef.current = false;
        previewRef.current = null;

        if (!wasSelected) {
          onClickRef.current?.(id);
          selectedOnDownRef.current = id;
        }

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
        newRect = { x: r.x + dx, y: r.y + dy, width: r.width, height: r.height };
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
        // Drag completed — commit move or resize
        if (d.type === 'move') {
          onMovedRef.current(d.annotationId, finalPreview.rect);
        } else {
          onResizedRef.current(d.annotationId, finalPreview.rect);
        }
      } else {
        // No drag — could be single click or double click
        handleClickOrDoubleClick(d.annotationId);
      }
    }

    function handleClickOrDoubleClick(id: string) {
      const now = Date.now();
      const last = lastClickRef.current;

      if (last.id === id && now - last.time < DOUBLE_CLICK_MS) {
        // Double-click detected
        if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
        lastClickRef.current = { id: '', time: 0 };
        selectedOnDownRef.current = null;
        onDoubleClickRef.current?.(id);
      } else {
        // First click — wait for possible second click
        if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
        lastClickRef.current = { id, time: now };
        clickTimerRef.current = setTimeout(() => {
          lastClickRef.current = { id: '', time: 0 };
          // Don't fire onClick if already selected on pointerdown
          if (selectedOnDownRef.current !== id) {
            onClickRef.current?.(id);
          }
          selectedOnDownRef.current = null;
        }, DOUBLE_CLICK_MS);
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

  const movableAnnotations = annotations.filter((a) => isMovable(a));
  if (movableAnnotations.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ zIndex: 10, pointerEvents: 'none', touchAction: 'none' }}
    >
      {movableAnnotations.map((ann) => {
        const isSelected = selectedIds.has(ann.id);
        const isPreview = preview && preview.id === ann.id;
        const rect = isPreview ? preview!.rect : ann.rect;
        const pixel = pdfRectToPixel(rect, zoom);
        const hs = HANDLE_SIZE;
        const hh = hs / 2;
        const canResize = isResizable(ann);

        return (
          <div key={ann.id}>
            <div
              data-annot-move={ann.id}
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

            {isSelected && isInteractive && canResize && (
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
                      data-annot-handle={ann.id}
                      data-annot-corner={corner}
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
