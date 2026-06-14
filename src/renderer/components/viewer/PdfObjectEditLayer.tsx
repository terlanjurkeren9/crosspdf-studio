import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePdfObjectEditStore } from '../../stores/pdf-object-edit.store';
import type { PdfObjectEditOperation, TextFormatting } from '../../lib/pdf-object-edit';

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

const DEFAULT_FORMATTING: TextFormatting = {
  bold: false,
  italic: false,
  underline: false,
  color: '#000000',
  fontFamily: 'helvetica',
};

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
  const [formatting, setFormatting] = useState<TextFormatting>({ ...DEFAULT_FORMATTING });

  // Drag offsets for committed ops (op.id → { x, y })
  const dragOffsets = useRef<Map<string, { x: number; y: number }>>(new Map());
  const [draggingOpId, setDraggingOpId] = useState<string | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; origX: number; origY: number } | null>(null);

  // Ref map for direct DOM manipulation during drag — avoids React re-render on every mousemove
  const committedOpEls = useRef<Map<string, HTMLElement>>(new Map());

  // Editing-state for committed ops (re-select by clicking committed element)
  const [editingCommittedOp, setEditingCommittedOp] = useState<PdfObjectEditOperation | null>(null);
  const [editingCommittedText, setEditingCommittedText] = useState('');

  const addOperation = usePdfObjectEditStore((s) => s.addOperation);
  const removeOperation = usePdfObjectEditStore((s) => s.removeOperation);

  // Subscribe to pending operations for this tab — used to pick page-scoped ops
  const allOps = usePdfObjectEditStore((s) => s.pendingOperations.get(tabId));
  const committedOps = useMemo(
    () => (allOps ?? []).filter((op) => op.pageNumber === pageNumber),
    [allOps, pageNumber]
  );

  // Map op ID → blob URL for replace-image operations (derived, render-safe)
  const imageBlobUrls = useMemo(() => {
    const map = new Map<string, string>();
    for (const op of committedOps) {
      if (op.type === 'replace-image' && op.imageBytes) {
        const blob = new Blob([new Uint8Array(op.imageBytes)], { type: op.mimeType });
        map.set(op.id, URL.createObjectURL(blob));
      }
    }
    return map;
  }, [committedOps]);

  // Revoke stale blob URLs
  const prevBlobKeys = useRef<Set<string>>(new Set());
  useEffect(() => {
    const keys = new Set(imageBlobUrls.keys());
    prevBlobKeys.current = keys;
    return () => {
      for (const url of imageBlobUrls.values()) URL.revokeObjectURL(url);
    };
  }, [imageBlobUrls]);

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

  // Handle click in edit mode
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!editMode || disabled) return;
      const overlay = containerRef.current;
      if (!overlay) return;
      const wasPointerEvents = overlay.style.pointerEvents;
      overlay.style.pointerEvents = 'none';
      const element = document.elementFromPoint(e.clientX, e.clientY);
      overlay.style.pointerEvents = wasPointerEvents;
      if (!element) return;
      const span = element.closest?.('.textLayer span') as HTMLElement | null;
      if (!span) {
        setTextSelection(null);
        setEditingCommittedOp(null);
        return;
      }
      e.stopPropagation();
      const text = span.textContent ?? '';
      const rect = span.getBoundingClientRect();
      const containerRect = overlay.getBoundingClientRect();
      if (!containerRect) return;
      const relX = (rect.left - containerRect.left) / zoom;
      const relY = (rect.top - containerRect.top) / zoom;
      const width = rect.width / zoom;
      const height = rect.height / zoom;
      const fontSize = (parseFloat(getComputedStyle(span).fontSize) || 12) / zoom;
      setTextSelection({ text, rect: { x: relX, y: relY, width, height }, fontSize });
      setAreaSelection(null);
      setEditingCommittedOp(null);
      setInlineText(text);
      setFormatting({ ...DEFAULT_FORMATTING });
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
      const fontSize = (parseFloat(getComputedStyle(span).fontSize) || 12) / zoom;
      setTextSelection({ text, rect: { x: relX, y: relY, width, height }, fontSize });
      setAreaSelection(null);
      setEditingCommittedOp(null);
      setInlineText(text);
    },
    [editMode, disabled, zoom]
  );

  // Area drawing
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!editMode || disabled) return;
      if (e.button !== 0) return;
      const overlay = containerRef.current;
      if (!overlay) return;
      const wasPointerEvents = overlay.style.pointerEvents;
      overlay.style.pointerEvents = 'none';
      const element = document.elementFromPoint(e.clientX, e.clientY);
      overlay.style.pointerEvents = wasPointerEvents;
      if (element?.closest?.('.textLayer span') || element?.closest?.('[data-committed-op]'))
        return;
      setIsDrawingArea(true);
      setDrawStart({ x: e.clientX, y: e.clientY });
      setCurrentDrawRect(null);
      setTextSelection(null);
      setAreaSelection(null);
      setEditingCommittedOp(null);
    },
    [editMode, disabled]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDrawingArea && drawStart) {
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
        return;
      }
      if (draggingOpId && dragStartRef.current) {
        const container = containerRef.current;
        if (!container) return;
        const dx = (e.clientX - dragStartRef.current.x) / zoom;
        const dy = (e.clientY - dragStartRef.current.y) / zoom;
        const newX = dragStartRef.current.origX + dx;
        const newY = dragStartRef.current.origY + dy;
        dragOffsets.current.set(draggingOpId, { x: newX, y: newY });
        // Direct DOM manipulation — no React re-render during drag
        const el = committedOpEls.current.get(draggingOpId);
        if (el) {
          el.style.left = `${newX * zoom}px`;
          el.style.top = `${newY * zoom}px`;
        }
      }
    },
    [isDrawingArea, drawStart, zoom, draggingOpId]
  );

  const handleMouseUp = useCallback(() => {
    if (isDrawingArea) {
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
      return;
    }
    if (draggingOpId) {
      // Persist final position back to the store op
      const offset = dragOffsets.current.get(draggingOpId);
      if (offset) {
        const committed = committedOps.find((o) => o.id === draggingOpId);
        if (committed) {
          const updated = { ...committed, rect: { ...committed.rect, x: offset.x, y: offset.y } };
          removeOperation(tabId, draggingOpId);
          addOperation(tabId, updated);
        }
      }
      dragOffsets.current.delete(draggingOpId);
      setDraggingOpId(null);
      dragStartRef.current = null;
    }
  }, [isDrawingArea, draggingOpId, committedOps, addOperation, removeOperation, tabId]);

  // Toggle formatting
  const toggleBold = useCallback(() => setFormatting((f) => ({ ...f, bold: !f.bold })), []);
  const toggleItalic = useCallback(() => setFormatting((f) => ({ ...f, italic: !f.italic })), []);
  const toggleUnderline = useCallback(
    () => setFormatting((f) => ({ ...f, underline: !f.underline })),
    []
  );
  const setColor = useCallback((c: string) => setFormatting((f) => ({ ...f, color: c })), []);
  const setFontFamily = useCallback(
    (ff: 'helvetica' | 'times' | 'courier') => setFormatting((f) => ({ ...f, fontFamily: ff })),
    []
  );

  // Commit text replace with formatting
  const commitTextReplace = useCallback(
    (opts?: { editExistingOpId?: string }) => {
      if (opts?.editExistingOpId) {
        if (!editingCommittedText.trim()) {
          removeOperation(tabId, opts.editExistingOpId);
          setEditingCommittedOp(null);
          return;
        }
        const existingOp = committedOps.find((o) => o.id === opts.editExistingOpId);
        // Also remove paired cover if applicable
        const pairedCover = committedOps.find(
          (o) => o.type === 'remove-area' && o.coverFor === opts.editExistingOpId
        );
        const textOpId = `text-replace-${Date.now()}`;
        const coverOpId = `cover-${Date.now()}`;
        const textOp: PdfObjectEditOperation = {
          id: textOpId,
          type: 'replace-text' as const,
          pageNumber,
          rect:
            existingOp?.type === 'replace-text'
              ? existingOp.rect
              : { x: 0, y: 0, width: 100, height: 20 },
          text: editingCommittedText.trim(),
          fontSize: existingOp?.type === 'replace-text' ? existingOp.fontSize : 12,
          bold:
            existingOp?.type === 'replace-text'
              ? (existingOp.bold ?? formatting.bold)
              : formatting.bold,
          italic:
            existingOp?.type === 'replace-text'
              ? (existingOp.italic ?? formatting.italic)
              : formatting.italic,
          underline:
            existingOp?.type === 'replace-text'
              ? (existingOp.underline ?? formatting.underline)
              : formatting.underline,
          color:
            existingOp?.type === 'replace-text'
              ? (existingOp.color ?? formatting.color)
              : formatting.color,
          fontFamily:
            existingOp?.type === 'replace-text'
              ? (existingOp.fontFamily ?? formatting.fontFamily ?? 'helvetica')
              : (formatting.fontFamily ?? 'helvetica'),
        };
        const newCoverOp: PdfObjectEditOperation = {
          id: coverOpId,
          type: 'remove-area' as const,
          pageNumber,
          rect: textOp.rect,
          fillColor: '#ffffff',
          coverFor: textOpId,
        };
        removeOperation(tabId, opts.editExistingOpId);
        if (pairedCover) removeOperation(tabId, pairedCover.id);
        addOperation(tabId, newCoverOp);
        addOperation(tabId, textOp);
        setEditingCommittedOp(null);
        setEditingCommittedText('');
        return;
      }
      if (!textSelection || !inlineText.trim()) return;
      const textOpId = `text-replace-${Date.now()}`;
      const coverOpId = `cover-${Date.now()}`;
      const textOp: PdfObjectEditOperation = {
        id: textOpId,
        type: 'replace-text' as const,
        pageNumber,
        rect: textSelection.rect,
        text: inlineText.trim(),
        fontSize: textSelection.fontSize,
        bold: formatting.bold,
        italic: formatting.italic,
        underline: formatting.underline,
        color: formatting.color,
        fontFamily: formatting.fontFamily,
      };
      const coverOp: PdfObjectEditOperation = {
        id: coverOpId,
        type: 'remove-area' as const,
        pageNumber,
        rect: textSelection.rect,
        fillColor: '#ffffff',
        coverFor: textOpId,
      };
      addOperation(tabId, coverOp);
      addOperation(tabId, textOp);
      setTextSelection(null);
      setInlineText('');
    },
    [
      textSelection,
      inlineText,
      formatting,
      pageNumber,
      tabId,
      addOperation,
      removeOperation,
      editingCommittedText,
      committedOps,
    ]
  );

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

  // Handle image replace
  const handleReplaceImage = useCallback(async () => {
    if (!areaSelection) return;
    try {
      const result = await window.crosspdf.openFileDialog({
        title: 'Select Image to Replace',
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }],
        properties: ['openFile'],
      });
      if (result.canceled || !result.filePaths[0]) return;
      const imagePath = result.filePaths[0];
      const readResult = await window.crosspdf.readFile(imagePath);
      if (!readResult.success || !readResult.data) {
        console.error('Failed to read image file:', readResult.error);
        return;
      }
      const ext = imagePath.toLowerCase().split('.').pop();
      const mimeType = ext === 'png' ? ('image/png' as const) : ('image/jpeg' as const);
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

  // Cancel
  const cancelSelection = useCallback(() => {
    setTextSelection(null);
    setAreaSelection(null);
    setShowAreaMenu(false);
    setInlineText('');
    setEditingCommittedOp(null);
  }, []);

  // Re-edit committed text
  const startEditCommittedOp = useCallback((op: PdfObjectEditOperation) => {
    if (op.type !== 'replace-text') return;
    setEditingCommittedOp(op);
    setEditingCommittedText(op.text);
    setTextSelection(null);
    setAreaSelection(null);
    setFormatting({
      bold: op.bold ?? false,
      italic: op.italic ?? false,
      underline: op.underline ?? false,
      color: op.color ?? '#000000',
      fontFamily: op.fontFamily ?? 'helvetica',
    });
  }, []);

  // Drag handlers for committed ops
  const handleCommittedOpMouseDown = useCallback(
    (e: React.MouseEvent, op: PdfObjectEditOperation) => {
      if (!editMode) return;
      e.stopPropagation();
      e.preventDefault();
      if (e.button !== 0) return;
      if (e.shiftKey) {
        // Shift+click = remove
        removeOperation(tabId, op.id);
        // If replace-text, also remove paired cover
        if (op.type === 'replace-text') {
          const pairedCover = committedOps.find(
            (o) => o.type === 'remove-area' && o.coverFor === op.id
          );
          if (pairedCover) removeOperation(tabId, pairedCover.id);
        }
        return;
      }
      if (e.detail === 2) {
        // Double-click: re-edit
        startEditCommittedOp(op);
        return;
      }
      // Single click: start drag — only for replace-text (static covers are non-interactive)
      if (op.type !== 'replace-text') return;
      const rect = op.rect;
      setDraggingOpId(op.id);
      dragStartRef.current = { x: e.clientX, y: e.clientY, origX: rect.x, origY: rect.y };
    },
    [editMode, tabId, removeOperation, committedOps, startEditCommittedOp]
  );

  if (!editMode) return null;

  const fmtBtnBase = 'px-1.5 py-0.5 text-xs rounded border hover:bg-gray-100';

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-20 pointer-events-auto"
      style={{ cursor: draggingOpId ? 'grabbing' : 'crosshair' }}
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
          className="absolute bg-white border border-gray-300 rounded shadow-lg p-2 z-30"
          style={{
            left: textSelection.rect.x * zoom,
            top: textSelection.rect.y * zoom,
            minWidth: Math.max(textSelection.rect.width * zoom, 260),
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Formatting toolbar */}
          <div className="flex items-center gap-1 mb-2 pb-1 border-b border-gray-200">
            <select
              value={formatting.fontFamily ?? 'helvetica'}
              onChange={(e) => {
                setFontFamily(e.target.value as 'helvetica' | 'times' | 'courier');
              }}
              className="text-xs border rounded px-1 py-0.5"
            >
              <option value="helvetica">Helvetica</option>
              <option value="times">Times</option>
              <option value="courier">Courier</option>
            </select>
            <input
              type="number"
              value={Math.round(textSelection.fontSize)}
              onChange={(e) => {
                const v = Math.max(
                  4,
                  Math.min(144, Number(e.target.value) || textSelection.fontSize)
                );
                setTextSelection({ ...textSelection, fontSize: v });
              }}
              className="w-10 text-xs border rounded px-1 py-0.5 text-center"
              title="Font size"
            />
            <button
              className={`${fmtBtnBase} ${formatting.bold ? 'bg-blue-100 border-blue-300' : ''}`}
              onClick={toggleBold}
              title="Bold"
            >
              <b>B</b>
            </button>
            <button
              className={`${fmtBtnBase} ${formatting.italic ? 'bg-blue-100 border-blue-300' : ''}`}
              onClick={toggleItalic}
              title="Italic"
            >
              <i>I</i>
            </button>
            <button
              className={`${fmtBtnBase} ${formatting.underline ? 'bg-blue-100 border-blue-300' : ''}`}
              onClick={toggleUnderline}
              title="Underline"
            >
              <u>U</u>
            </button>
            <input
              type="color"
              value={formatting.color ?? '#000000'}
              onChange={(e) => setColor(e.target.value)}
              className="w-6 h-5 border rounded cursor-pointer"
              title="Text color"
            />
          </div>
          <textarea
            className="w-full p-1 border border-gray-300 rounded text-sm"
            value={inlineText}
            onChange={(e) => setInlineText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.shiftKey) {
                e.preventDefault();
                commitTextReplace();
              }
              if (e.key === 'Escape') cancelSelection();
            }}
            autoFocus
            rows={3}
            style={{
              fontSize: textSelection.fontSize * zoom,
              fontWeight: formatting.bold ? 'bold' : 'normal',
              fontStyle: formatting.italic ? 'italic' : 'normal',
              textDecoration: formatting.underline ? 'underline' : 'none',
              fontFamily:
                formatting.fontFamily === 'courier'
                  ? 'monospace'
                  : formatting.fontFamily === 'times'
                    ? 'serif'
                    : 'sans-serif',
            }}
          />
          <div className="flex gap-2 mt-2">
            <button
              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
              onClick={() => commitTextReplace()}
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

      {/* Committed edit operations overlay */}
      {committedOps.map((op) => {
        if (op.type === 'replace-text') {
          const isEditing = editingCommittedOp?.id === op.id;
          if (isEditing) {
            return (
              <div
                key={op.id}
                data-edit-popup
                className="absolute bg-white border-2 border-blue-400 rounded shadow-lg p-2 z-30 min-w-60"
                style={{
                  left: op.rect.x * zoom,
                  top: op.rect.y * zoom,
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-1 mb-2 pb-1 border-b border-gray-200">
                  <select
                    value={formatting.fontFamily ?? 'helvetica'}
                    onChange={(e) => {
                      setFontFamily(e.target.value as 'helvetica' | 'times' | 'courier');
                    }}
                    className="text-xs border rounded px-1 py-0.5"
                  >
                    <option value="helvetica">Helvetica</option>
                    <option value="times">Times</option>
                    <option value="courier">Courier</option>
                  </select>
                  <input
                    type="number"
                    value={Math.round(op.fontSize)}
                    onChange={() => {
                      /* fontSize handled via commit */
                    }}
                    className="w-10 text-xs border rounded px-1 py-0.5 text-center"
                  />
                  <button
                    className={`${fmtBtnBase} ${formatting.bold ? 'bg-blue-100 border-blue-300' : ''}`}
                    onClick={toggleBold}
                  >
                    <b>B</b>
                  </button>
                  <button
                    className={`${fmtBtnBase} ${formatting.italic ? 'bg-blue-100 border-blue-300' : ''}`}
                    onClick={toggleItalic}
                  >
                    <i>I</i>
                  </button>
                  <button
                    className={`${fmtBtnBase} ${formatting.underline ? 'bg-blue-100 border-blue-300' : ''}`}
                    onClick={toggleUnderline}
                  >
                    <u>U</u>
                  </button>
                  <input
                    type="color"
                    value={formatting.color ?? '#000000'}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-6 h-5 border rounded"
                  />
                </div>
                <textarea
                  className="w-full p-1 border border-gray-300 rounded text-sm"
                  value={editingCommittedText}
                  onChange={(e) => setEditingCommittedText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      commitTextReplace({ editExistingOpId: op.id });
                    }
                    if (e.key === 'Escape') {
                      setEditingCommittedOp(null);
                    }
                  }}
                  autoFocus
                  rows={2}
                  style={{
                    fontSize: op.fontSize * zoom,
                    fontWeight: formatting.bold ? 'bold' : 'normal',
                    fontStyle: formatting.italic ? 'italic' : 'normal',
                    textDecoration: formatting.underline ? 'underline' : 'none',
                    fontFamily:
                      formatting.fontFamily === 'courier'
                        ? 'monospace'
                        : formatting.fontFamily === 'times'
                          ? 'serif'
                          : 'sans-serif',
                  }}
                />
                <div className="flex gap-2 mt-2">
                  <button
                    className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                    onClick={() => commitTextReplace({ editExistingOpId: op.id })}
                  >
                    Apply
                  </button>
                  <button
                    className="px-2 py-1 text-xs bg-red-400 text-white rounded hover:bg-red-500"
                    onClick={() => {
                      removeOperation(tabId, op.id);
                      setEditingCommittedOp(null);
                    }}
                  >
                    Delete
                  </button>
                  <button
                    className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
                    onClick={() => setEditingCommittedOp(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            );
          }
          const isDragging = draggingOpId === op.id;
          return (
            <div
              key={op.id}
              data-committed-op
              ref={(el) => {
                if (el) committedOpEls.current.set(op.id, el);
                else committedOpEls.current.delete(op.id);
              }}
              className={`absolute bg-white border border-gray-300/50 rounded-sm cursor-move hover:border-blue-400 hover:bg-blue-50/30 ${isDragging ? 'border-blue-500 bg-blue-50 shadow-lg z-25' : 'pointer-events-auto'}`}
              style={{
                left: op.rect.x * zoom,
                top: op.rect.y * zoom,
                minWidth: op.rect.width * zoom,
                minHeight: op.rect.height * zoom,
                zIndex: isDragging ? 25 : 21,
              }}
              onMouseDown={(e) => handleCommittedOpMouseDown(e, op)}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => {
                e.stopPropagation();
                startEditCommittedOp(op);
              }}
            >
              <span
                className="select-none whitespace-pre-wrap break-words"
                style={{
                  fontSize: op.fontSize * zoom,
                  fontWeight: op.bold ? 'bold' : 'normal',
                  fontStyle: op.italic ? 'italic' : 'normal',
                  textDecoration: op.underline ? 'underline' : 'none',
                  color: op.color ?? '#000',
                  fontFamily:
                    op.fontFamily === 'courier'
                      ? 'monospace'
                      : op.fontFamily === 'times'
                        ? 'serif'
                        : 'sans-serif',
                  lineHeight: `${op.fontSize * zoom * 1.3}px`,
                }}
              >
                {op.text}
              </span>
            </div>
          );
        }
        if (op.type === 'remove-area') {
          const isStatic = !!op.coverFor;
          return (
            <div
              key={op.id}
              data-committed-op={isStatic ? undefined : true}
              className={`absolute border border-gray-300/30 rounded-sm ${isStatic ? 'pointer-events-none' : 'cursor-move hover:border-red-400 pointer-events-auto'}`}
              style={{
                left: op.rect.x * zoom,
                top: op.rect.y * zoom,
                width: op.rect.width * zoom,
                height: op.rect.height * zoom,
                backgroundColor: op.fillColor ?? '#fff',
                zIndex: isStatic ? 12 : 21,
              }}
              onMouseDown={isStatic ? undefined : (e) => handleCommittedOpMouseDown(e, op)}
            />
          );
        }
        if (op.type === 'replace-image') {
          return (
            <div
              key={op.id}
              data-committed-op
              className="absolute border border-green-300/50 rounded-sm cursor-move hover:border-green-400"
              style={{
                left: op.rect.x * zoom,
                top: op.rect.y * zoom,
                width: op.rect.width * zoom,
                height: op.rect.height * zoom,
                backgroundImage: `url(${imageBlobUrls.get(op.id)})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                zIndex: 21,
              }}
              onMouseDown={(e) => handleCommittedOpMouseDown(e, op)}
            />
          );
        }
        return null;
      })}

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

      {/* Area quick-actions */}
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
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
              onClick={() => setShowAreaMenu(true)}
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
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
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
