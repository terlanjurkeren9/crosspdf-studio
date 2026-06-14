import { useCallback, useEffect, useRef, useState } from 'react';
import { usePdfObjectEditStore } from '../../stores/pdf-object-edit.store';
import type { PdfObjectEditOperation } from '../../lib/pdf-object-edit';

interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TextSelection {
  text: string;
  rect: { x: number; y: number; width: number; height: number };
  fontSize: number;
}

interface AreaSelection {
  rect: SelectionRect;
}

interface Props {
  pageNumber: number;
  zoom: number;
  editMode: boolean;
  tabId: string;
  disabled?: boolean;
}

export function PdfObjectEditLayer({ pageNumber, zoom, editMode, tabId, disabled = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [textSelection, setTextSelection] = useState<TextSelection | null>(null);
  const [areaSelection, setAreaSelection] = useState<AreaSelection | null>(null);
  const [isDrawingArea, setIsDrawingArea] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentDrawRect, setCurrentDrawRect] = useState<SelectionRect | null>(null);
  const currentDrawRectRef = useRef<SelectionRect | null>(null);
  const [inlineText, setInlineText] = useState('');
  const [showAreaMenu, setShowAreaMenu] = useState(false);
  const [pageDims, setPageDims] = useState<{ width: number; height: number } | null>(null);

  const addOperation = usePdfObjectEditStore((s) => s.addOperation);

  // Track page dimensions
  useEffect(() => {
    const container = containerRef.current?.closest('[class*="page"]') as HTMLElement | null;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setPageDims({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Handle click in edit mode - use elementFromPoint to hit test text spans underneath
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!editMode || disabled) return;

      // Temporarily disable pointer events on overlay to allow elementFromPoint to hit underlying elements
      const overlay = containerRef.current;
      if (!overlay) return;

      const wasPointerEvents = overlay.style.pointerEvents;
      overlay.style.pointerEvents = 'none';

      const element = document.elementFromPoint(e.clientX, e.clientY);

      overlay.style.pointerEvents = wasPointerEvents;

      if (!element) return;

      // Ignore clicks on the edit popups themselves (Apply/Cancel buttons)
      if (element.closest?.('button') || element.closest?.('[data-edit-popup]')) {
        overlay.style.pointerEvents = wasPointerEvents;
        return;
      }

      const span = element.closest?.('.textLayer span') as HTMLElement | null;
      if (!span) {
        setTextSelection(null);
        return;
      }

      e.stopPropagation();

      // Get text content and approximate position
      const text = span.textContent ?? '';
      const rect = span.getBoundingClientRect();
      const containerRect = overlay.getBoundingClientRect();
      if (!containerRect) return;

      // Calculate position relative to page (PDF coordinates)
      const relX = (rect.left - containerRect.left) / zoom;
      const relY = (rect.top - containerRect.top) / zoom;
      const width = rect.width / zoom;
      const height = rect.height / zoom;

      // Approximate font size from span style or computed
      const fontSize = parseFloat(getComputedStyle(span).fontSize) || 12;

      setTextSelection({
        text,
        rect: { x: relX, y: relY, width, height },
        fontSize,
      });
      setAreaSelection(null);
      setInlineText(text);
    },
    [editMode, disabled, zoom]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!editMode || disabled) return;

      const overlay = containerRef.current;
      if (!overlay) return;

      const wasPointerEvents = overlay.style.pointerEvents;
      overlay.style.pointerEvents = 'none';

      const element = document.elementFromPoint(e.clientX, e.clientY);

      overlay.style.pointerEvents = wasPointerEvents;

      if (!element) return;

      // Ignore clicks on the edit popups themselves (Apply/Cancel buttons)
      if (element.closest?.('button') || element.closest?.('[data-edit-popup]')) {
        overlay.style.pointerEvents = wasPointerEvents;
        return;
      }

      const span = element.closest?.('.textLayer span') as HTMLElement | null;
      if (!span) return;

      e.stopPropagation();

      const text = span.textContent ?? '';
      const rect = span.getBoundingClientRect();
      const containerRect = overlay.getBoundingClientRect();
      if (!containerRect) return;

      const relX = (rect.left - containerRect.left) / zoom;
      const relY = (rect.top - containerRect.top) / zoom;
      const width = rect.width / zoom;
      const height = rect.height / zoom;
      const fontSize = parseFloat(getComputedStyle(span).fontSize) || 12;

      setTextSelection({
        text,
        rect: { x: relX, y: relY, width, height },
        fontSize,
      });
      setInlineText(text);
    },
    [editMode, disabled, zoom]
  );

  // Handle area selection (drag to select image/area)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!editMode || disabled) return;
      if (e.button !== 0) return; // Left click only

      const overlay = containerRef.current;
      if (!overlay) return;

      // Check if click is on text - if so, don't start area draw
      const wasPointerEvents = overlay.style.pointerEvents;
      overlay.style.pointerEvents = 'none';
      const element = document.elementFromPoint(e.clientX, e.clientY);
      overlay.style.pointerEvents = wasPointerEvents;

      if (element?.closest?.('.textLayer span')) return;

      setIsDrawingArea(true);
      setDrawStart({ x: e.clientX, y: e.clientY });
      setCurrentDrawRect(null);
      setTextSelection(null);
      setAreaSelection(null);
    },
    [editMode, disabled]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawingArea || !drawStart) return;

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const startX = (drawStart.x - rect.left) / zoom;
      const startY = (drawStart.y - rect.top) / zoom;
      const currentX = (e.clientX - rect.left) / zoom;
      const currentY = (e.clientY - rect.top) / zoom;

      const rectVal = {
        x: Math.min(startX, currentX),
        y: Math.min(startY, currentY),
        width: Math.abs(currentX - startX),
        height: Math.abs(currentY - startY),
      };
      setCurrentDrawRect(rectVal);
      currentDrawRectRef.current = rectVal;
    },
    [isDrawingArea, drawStart, zoom]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDrawingArea) return;

    setIsDrawingArea(false);

    if (
      currentDrawRectRef.current &&
      currentDrawRectRef.current.width > 5 &&
      currentDrawRectRef.current.height > 5
    ) {
      setAreaSelection({ rect: currentDrawRectRef.current });
      setShowAreaMenu(true);
    }

    setDrawStart(null);
    setCurrentDrawRect(null);
  }, [isDrawingArea]);

  // Commit text replacement
  const commitTextReplace = useCallback(() => {
    if (!textSelection || !inlineText.trim()) return;

    const op: PdfObjectEditOperation = {
      id: `text-replace-${Date.now()}`,
      type: 'replace-text',
      pageNumber,
      rect: textSelection.rect,
      text: inlineText.trim(),
      fontSize: textSelection.fontSize,
      color: '#000000',
    };

    addOperation(tabId, op);
    setTextSelection(null);
    setInlineText('');
  }, [textSelection, inlineText, pageNumber, tabId, addOperation]);

  // Commit area remove
  const commitAreaRemove = useCallback(() => {
    if (!areaSelection) return;

    const op: PdfObjectEditOperation = {
      id: `remove-area-${Date.now()}`,
      type: 'remove-area',
      pageNumber,
      rect: areaSelection.rect,
      fillColor: '#FFFFFF',
    };

    addOperation(tabId, op);
    setAreaSelection(null);
    setShowAreaMenu(false);
  }, [areaSelection, pageNumber, tabId, addOperation]);

  // Handle image replace via file dialog using window.crosspdf
  const handleReplaceImage = useCallback(async () => {
    if (!areaSelection) return;

    try {
      const result = await window.crosspdf.openFileDialog({
        title: 'Select Image to Replace',
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }],
        properties: ['openFile'],
      });

      if (result.canceled || !result.filePaths[0]) {
        return;
      }

      const imagePath = result.filePaths[0];
      const readResult = await window.crosspdf.readFile(imagePath);

      if (!readResult.success || !readResult.data) {
        console.error('Failed to read image file:', readResult.error);
        return;
      }

      // Determine mime type from extension
      const ext = imagePath.toLowerCase().split('.').pop();
      const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

      const op: PdfObjectEditOperation = {
        id: `replace-image-${Date.now()}`,
        type: 'replace-image',
        pageNumber,
        rect: areaSelection.rect,
        imageBytes: readResult.data,
        mimeType,
      };

      addOperation(tabId, op);
      setAreaSelection(null);
      setShowAreaMenu(false);
    } catch (err) {
      console.error('Failed to replace image:', err);
    }
  }, [areaSelection, pageNumber, tabId, addOperation]);

  // Cancel current selection
  const cancelSelection = useCallback(() => {
    setTextSelection(null);
    setAreaSelection(null);
    setShowAreaMenu(false);
    setInlineText('');
  }, []);

  if (!editMode) return null;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-20 pointer-events-auto"
      style={{ cursor: 'crosshair' }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Text selection inline editor */}
      {textSelection && (
        <div
          data-edit-popup
          className="absolute bg-white border border-gray-300 rounded shadow-lg p-2 min-w-48 z-30"
          style={{
            left: textSelection.rect.x * zoom,
            top: textSelection.rect.y * zoom,
            maxWidth: Math.max(textSelection.rect.width * zoom, 200),
          }}
        >
          <textarea
            className="w-full p-1 border border-gray-300 rounded text-sm font-mono"
            value={inlineText}
            onChange={(e) => setInlineText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                commitTextReplace();
              }
              if (e.key === 'Escape') {
                cancelSelection();
              }
            }}
            autoFocus
            rows={3}
            style={{ fontSize: textSelection.fontSize * zoom }}
          />
          <div className="flex gap-2 mt-2">
            <button
              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
              onClick={commitTextReplace}
            >
              Apply
            </button>
            <button
              className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
              onClick={cancelSelection}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Area selection rectangle while drawing */}
      {currentDrawRect && (
        <div
          className="absolute border-2 border-dashed border-blue-500 bg-blue-500/10 pointer-events-none"
          style={{
            left: currentDrawRect.x * zoom,
            top: currentDrawRect.y * zoom,
            width: currentDrawRect.width * zoom,
            height: currentDrawRect.height * zoom,
          }}
        />
      )}

      {/* Committed area selection with controls */}
      {areaSelection && !showAreaMenu && (
        <>
          <div
            className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none"
            style={{
              left: areaSelection.rect.x * zoom,
              top: areaSelection.rect.y * zoom,
              width: areaSelection.rect.width * zoom,
              height: areaSelection.rect.height * zoom,
            }}
          />
          <div
            data-edit-popup
            className="absolute bg-white border border-gray-300 rounded shadow-lg p-2 flex gap-2 z-30"
            style={{
              left: Math.min(areaSelection.rect.x * zoom, (pageDims?.width ?? 300) - 180),
              top: (areaSelection.rect.y + areaSelection.rect.height) * zoom + 4,
            }}
          >
            <button
              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
              onClick={() => {
                setShowAreaMenu(true);
              }}
            >
              Remove
            </button>
            <button
              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
              onClick={handleReplaceImage}
            >
              Replace Image
            </button>
            <button
              className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
              onClick={cancelSelection}
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {/* Area context menu */}
      {showAreaMenu && areaSelection && (
        <div
          data-edit-popup
          className="absolute bg-white border border-gray-300 rounded shadow-lg p-3 z-30 min-w-40"
          style={{
            left: Math.min(areaSelection.rect.x * zoom, (pageDims?.width ?? 300) - 160),
            top: (areaSelection.rect.y + areaSelection.rect.height) * zoom + 4,
          }}
        >
          <p className="text-xs text-gray-600 mb-2">Edit selected area:</p>
          <div className="flex flex-col gap-1">
            <button
              className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
              onClick={commitAreaRemove}
            >
              Remove Content
            </button>
            <button
              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
              onClick={handleReplaceImage}
            >
              Replace with Image
            </button>
            <button
              className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
              onClick={cancelSelection}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
