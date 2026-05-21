import { useEffect, useRef } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { TextLayer, normalizeUnicode } from 'pdfjs-dist';
import { removeNullCharacters } from '../../lib/text-utils';

// ── Module-level text layer registry (PDF.js official pattern) ─

const textLayers = new Map<HTMLElement, HTMLElement>();
let selectionChangeAbortController: AbortController | null = null;

function enableGlobalSelectionListener(abortSignal?: AbortSignal) {
  if (selectionChangeAbortController) return;

  selectionChangeAbortController = new AbortController();
  const signal = abortSignal
    ? AbortSignal.any([selectionChangeAbortController.signal, abortSignal])
    : selectionChangeAbortController.signal;

  const reset = (endDiv: HTMLElement, textLayer: HTMLElement) => {
    textLayer.append(endDiv);
    endDiv.style.width = '';
    endDiv.style.height = '';
    textLayer.classList.remove('selecting');
  };

  let isPointerDown = false;

  document.addEventListener(
    'pointerdown',
    () => {
      isPointerDown = true;
    },
    { signal, passive: true }
  );

  document.addEventListener(
    'pointerup',
    () => {
      isPointerDown = false;
      textLayers.forEach(reset);
    },
    { signal }
  );

  window.addEventListener(
    'blur',
    () => {
      isPointerDown = false;
      textLayers.forEach(reset);
    },
    { signal }
  );

  document.addEventListener(
    'keyup',
    () => {
      if (!isPointerDown) {
        textLayers.forEach(reset);
      }
    },
    { signal }
  );

  let prevRange: Range | null = null;

  document.addEventListener(
    'selectionchange',
    () => {
      const selection = document.getSelection();
      if (!selection || selection.rangeCount === 0) {
        textLayers.forEach(reset);
        prevRange = null;
        return;
      }

      // Find which text layers have active selection ranges
      const activeTextLayers = new Set<HTMLElement>();
      for (let i = 0; i < selection.rangeCount; i++) {
        const range = selection.getRangeAt(i);
        for (const textLayerDiv of textLayers.keys()) {
          if (!activeTextLayers.has(textLayerDiv) && range.intersectsNode(textLayerDiv)) {
            activeTextLayers.add(textLayerDiv);
          }
        }
      }

      // Update selecting state per layer
      for (const [textLayerDiv, endDiv] of textLayers) {
        if (activeTextLayers.has(textLayerDiv)) {
          textLayerDiv.classList.add('selecting');
        } else {
          reset(endDiv, textLayerDiv);
        }
      }

      // Position endOfContent to contain the selection boundary
      // (PDF.js official pattern – works during drag AND after pointer up)
      const range = selection.getRangeAt(0);
      const modifyStart =
        prevRange &&
        (range.compareBoundaryPoints(Range.END_TO_END, prevRange) === 0 ||
          range.compareBoundaryPoints(Range.START_TO_END, prevRange) === 0);
      let anchor: Node = modifyStart ? range.startContainer : range.endContainer;

      if (anchor.nodeType === Node.TEXT_NODE) {
        anchor = anchor.parentNode!;
      }
      if ((anchor as Element).classList?.contains('highlight')) {
        anchor = anchor.parentNode!;
      }

      // When the range ends at offset 0 on a non-text node, walk to the
      // previous sibling to find the right boundary element.
      if (!modifyStart && range.endOffset === 0) {
        let cursor: Node = anchor;
        do {
          while (!cursor.previousSibling) {
            if (!cursor.parentNode) break;
            cursor = cursor.parentNode;
          }
          if (!cursor.previousSibling) break;
          cursor = cursor.previousSibling;
        } while (!cursor.childNodes.length);
        if (cursor.childNodes.length) {
          anchor = cursor;
        }
      }

      const anchorEl = anchor as Element;
      const parentTextLayer = anchorEl.parentElement?.closest('.textLayer') as HTMLElement | null;

      if (!parentTextLayer) {
        textLayers.forEach(reset);
        prevRange = range.cloneRange();
        return;
      }

      const endDiv = textLayers.get(parentTextLayer);
      if (!endDiv) {
        prevRange = range.cloneRange();
        return;
      }

      endDiv.style.width = parentTextLayer.style.width;
      endDiv.style.height = parentTextLayer.style.height;
      endDiv.style.userSelect = 'text';

      const anchorParent = anchorEl.parentElement;
      if (anchorParent) {
        anchorParent.insertBefore(endDiv, modifyStart ? anchor : anchor.nextSibling);
      }

      prevRange = range.cloneRange();
    },
    { signal }
  );
}

function removeGlobalSelectionListener(textLayerDiv: HTMLElement) {
  textLayers.delete(textLayerDiv);
  if (textLayers.size === 0) {
    selectionChangeAbortController?.abort();
    selectionChangeAbortController = null;
  }
}

// ── Component ─────────────────────────────────────────────────

interface PageTextLayerProps {
  pdfDocument: PDFDocumentProxy | null;
  pageNumber: number;
  zoom: number;
}

export function PageTextLayer({ pdfDocument, pageNumber, zoom }: PageTextLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textLayerRef = useRef<TextLayer | null>(null);
  const endOfContentRef = useRef<HTMLDivElement | null>(null);
  const versionRef = useRef(0);

  // ── Render text layer ───────────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    const doc = pdfDocument;
    if (!container || !doc) return;

    textLayerRef.current?.cancel();
    textLayerRef.current = null;
    endOfContentRef.current?.remove();
    endOfContentRef.current = null;
    const version = ++versionRef.current;

    let cancelled = false;

    (async () => {
      let page = null;
      try {
        page = await doc.getPage(pageNumber);
        if (cancelled || version !== versionRef.current) return;

        const viewport = page.getViewport({ scale: zoom });

        if (cancelled || version !== versionRef.current) return;

        container.replaceChildren();

        // Sync text layer scale with canvas zoom so that
        // setLayerDimensions(width/height via calc(var(--total-scale-factor) * pageWidth))
        // and span font-size (calc(var(--text-scale-factor) * var(--font-height)))
        // produce the same CSS dimensions as the canvas.
        container.style.setProperty('--total-scale-factor', String(zoom));

        const textLayer = new TextLayer({
          textContentSource: page.streamTextContent({
            includeMarkedContent: true,
            disableNormalization: true,
          }),
          container,
          viewport,
        });

        textLayerRef.current = textLayer;
        await textLayer.render();

        if (version !== versionRef.current) {
          textLayer.cancel();
          textLayerRef.current = null;
          return;
        }

        // Append endOfContent boundary div (PDF.js TextLayerBuilder pattern)
        const endOfContent = document.createElement('div');
        endOfContent.className = 'endOfContent';
        container.append(endOfContent);
        endOfContentRef.current = endOfContent;

        // Register with global selection listener (PDF.js pattern)
        textLayers.set(container, endOfContent);
        enableGlobalSelectionListener();
      } catch {
        if (version === versionRef.current) {
          container.replaceChildren();
        }
      } finally {
        page?.cleanup();
      }
    })();

    return () => {
      cancelled = true;
      textLayerRef.current?.cancel();
      textLayerRef.current = null;
      endOfContentRef.current?.remove();
      endOfContentRef.current = null;
      if (container) {
        removeGlobalSelectionListener(container);
        container.replaceChildren();
      }
    };
  }, [pdfDocument, pageNumber, zoom]);

  // ── bindMouse: mousedown + copy on the text layer div ─────────

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onMouseDown = () => {
      container.classList.add('selecting');
    };

    const onCopy = (event: ClipboardEvent) => {
      const selection = document.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;

      // Only intercept if the selection intersects this text layer.
      // Otherwise let the event fall through to the default handler
      // (e.g. when the active selection is in a sidebar input).
      const range = selection.getRangeAt(0);
      if (!range.intersectsNode(container)) return;

      event.clipboardData?.setData(
        'text/plain',
        removeNullCharacters(normalizeUnicode(selection.toString()))
      );
      event.preventDefault();
      event.stopPropagation();
    };

    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('copy', onCopy);

    return () => {
      container.removeEventListener('mousedown', onMouseDown);
      container.removeEventListener('copy', onCopy);
    };
  }, [pdfDocument, pageNumber]);

  // ── Unmount: final cleanup ──────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    const textLayer = textLayerRef;
    const endOfContent = endOfContentRef;

    return () => {
      if (container) {
        removeGlobalSelectionListener(container);
        container.classList.remove('selecting');
      }
      textLayer.current?.cancel();
      textLayer.current = null;
      endOfContent.current?.remove();
      endOfContent.current = null;
    };
  }, []);

  return <div ref={containerRef} className="textLayer" />;
}
