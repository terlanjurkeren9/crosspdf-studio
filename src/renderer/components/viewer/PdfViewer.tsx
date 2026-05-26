import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { usePdfDocument } from '../../hooks/usePdfDocument';
import { useResizeObserver } from '../../hooks/useResizeObserver';
import { useDocumentStore } from '../../stores/document.store';
import { useAnnotationStore, createAnnotation } from '../../stores/annotation.store';
import { useUIStore } from '../../stores/ui.store';
import { useAnnotationInteraction } from '../../hooks/useAnnotationInteraction';
import type { TabState } from '../../stores/document.store';
import { PageList } from './PageList';
import { PageTextLayer } from './PageTextLayer';
import { AnnotationLayer } from './AnnotationLayer';
import { ViewerToolbar } from './ViewerToolbar';
import { ViewerStatusBar } from './ViewerStatusBar';
import { Spinner } from '../ui/Spinner';
import { Button } from '../ui/Button';
import { clampZoom, computeFitZoom, ZOOM_FACTOR } from '../../lib/zoom';
import type { FitMode, ViewMode, PageDims } from '../../lib/zoom';
import { loadAnnotationDraft, saveAnnotationDraft } from '../../services/annotation-persistence';
import { AnnotationEditor } from './AnnotationEditor';
import type {
  Annotation,
  RedactionAnnotation,
  StampAnnotation,
} from '../../types/annotation.types';
import { isRedaction, isStamp } from '../../types/annotation.types';
import { RedactionDrawLayer } from './RedactionDrawLayer';
import { StampInteractionLayer } from './StampInteractionLayer';
import { applyStamps } from '../../services/pdf-ops.service';
import { screenPointToPdf } from '../../lib/pdf-coordinates';
import { normalizeImageToSafeDataUrl } from '../../lib/image-normalize';

const EMPTY_ANNOTATIONS: Annotation[] = [];

type DocState =
  | { status: 'reading-file' }
  | { status: 'loading-doc' }
  | { status: 'ready' }
  | { status: 'error'; message: string };

export interface PdfViewerHandle {
  goToPage: (page: number) => void;
}

interface PdfViewerProps {
  tab: TabState;
  onOpenAnother: () => void;
  onPdfDocumentLoaded?: (doc: PDFDocumentProxy | null) => void;
  viewerRef?: React.RefObject<PdfViewerHandle | null>;
}

export function PdfViewer({ tab, onOpenAnother, onPdfDocumentLoaded, viewerRef }: PdfViewerProps) {
  const updateTabState = useDocumentStore((s) => s.updateTabState);
  const closeTab = useDocumentStore((s) => s.closeTab);

  // ── Annotations ──────────────────────────────────────────────

  const annotationsForTab = useAnnotationStore(
    (s) => s.annotationsByTab[tab.id] ?? EMPTY_ANNOTATIONS
  );
  const activeTool = useAnnotationStore((s) => s.activeTool);
  const setActiveTool = useAnnotationStore((s) => s.setActiveTool);
  const undo = useAnnotationStore((s) => s.undo);
  const redo = useAnnotationStore((s) => s.redo);

  const textLayerContainerRef = useRef<HTMLDivElement>(null);

  const {
    selectedIds,
    selectAnnotation,
    updateAnnotation,
    createTextMarkupFromSelection,
    handlePageClick,
    handleDeleteKey,
    setZoom,
  } = useAnnotationInteraction(tab.id);

  // ── Inline editor state ─────────────────────────────────────

  const [editingAnnotation, setEditingAnnotation] = useState<{
    id: string;
    initialContent: string;
    label: string;
    anchorRect: DOMRect | null;
  } | null>(null);

  const handleAnnotationDoubleClick = useCallback(
    (id: string) => {
      const ann = annotationsForTab.find((a) => a.id === id);
      if (!ann) return;

      if (ann.type === 'sticky-note' || ann.type === 'free-text') {
        const currentContent = 'content' in ann ? (ann as { content: string }).content : '';
        // Capture anchor position from the event's implicit target
        // We'll get the rect from the annotation's hit target via a ref or from DOM
        const hitEl = document.querySelector(`[data-annotation-hit="${id}"]`);
        setEditingAnnotation({
          id,
          initialContent: currentContent,
          label: ann.type === 'sticky-note' ? 'Edit note' : 'Edit text',
          anchorRect: hitEl?.getBoundingClientRect() ?? null,
        });
      }
    },
    [annotationsForTab]
  );

  const handleEditorSave = useCallback(
    (content: string) => {
      if (!editingAnnotation) return;
      updateAnnotation(tab.id, editingAnnotation.id, { content } as Partial<Annotation>);
      setEditingAnnotation(null);
    },
    [editingAnnotation, tab.id, updateAnnotation]
  );

  const handleEditorCancel = useCallback(() => {
    setEditingAnnotation(null);
  }, []);

  // ── File + Document ──────────────────────────────────────────

  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [readError, setReadError] = useState<string | null>(null);

  const {
    pdfDocument,
    numPages,
    loading: docLoading,
    error: docError,
  } = usePdfDocument(pdfData, tab.password);

  // ── View state (initialized from tab store, then local) ──────

  const [viewMode, setViewMode] = useState<ViewMode>(tab.viewMode);
  const [fitMode, setFitModeState] = useState<FitMode>(tab.fitMode);
  const [zoom, setZoomState] = useState(tab.zoom);
  const [currentPage, setCurrentPage] = useState(tab.currentPage);
  const [pageInput, setPageInput] = useState(String(tab.currentPage));
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(tab.rotation);

  // ── Continuous-mode state ────────────────────────────────────

  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());
  const [pageDimsMap, setPageDimsMap] = useState<Map<number, PageDims>>(new Map());
  const [pageDims, setPageDims] = useState<PageDims | null>(null);

  // Reset view state if tab changes (different file)
  const tabIdRef = useRef(tab.id);
  useEffect(() => {
    if (tab.id !== tabIdRef.current) {
      tabIdRef.current = tab.id;
      setViewMode(tab.viewMode);
      setFitModeState(tab.fitMode);
      setZoomState(tab.zoom);
      setCurrentPage(tab.currentPage);
      setPageInput(String(tab.currentPage));
      setRotation(tab.rotation);
      setPdfData(null);
      setReadError(null);
      setRenderedPages(new Set());
      setPageDimsMap(new Map());
      setPageDims(null);
    }
  }, [tab]);

  // ── Single-page render state ─────────────────────────────────

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const isUserScrollRef = useRef(false);
  const isPageInputFocusedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const containerSize = useResizeObserver(containerRef);

  // ── Persist viewer state to tab store ────────────────────────

  useEffect(() => {
    updateTabState(tab.id, {
      viewMode,
      fitMode,
      zoom,
      currentPage,
      rotation,
    });
  }, [tab.id, viewMode, fitMode, zoom, currentPage, rotation, updateTabState]);

  // ── Expose pdfDocument to parent ─────────────────────────────

  useEffect(() => {
    onPdfDocumentLoaded?.(pdfDocument);
    return () => {
      onPdfDocumentLoaded?.(null);
    };
  }, [pdfDocument, onPdfDocumentLoaded]);

  // ── Derived ──────────────────────────────────────────────────

  const docState = useMemo((): DocState => {
    if (readError) return { status: 'error', message: readError };
    if (docError) return { status: 'error', message: docError };
    if (pdfDocument) return { status: 'ready' };
    if (docLoading) return { status: 'loading-doc' };
    return { status: 'reading-file' };
  }, [readError, docError, pdfDocument, docLoading]);

  const effectiveZoom = useMemo(() => {
    if (fitMode === 'custom') return zoom;
    return computeFitZoom(fitMode, pageDims, containerSize.width, containerSize.height) ?? zoom;
  }, [fitMode, zoom, pageDims, containerSize]);

  // Sync effective zoom to annotation interaction hook
  useEffect(() => {
    setZoom(effectiveZoom);
  }, [effectiveZoom, setZoom]);

  // ── Annotation persistence ───────────────────────────────────

  const setAnnotationsForTab = useAnnotationStore((s) => s.setAnnotationsForTab);
  const persistRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const annotationsRef = useRef(annotationsForTab);
  useEffect(() => {
    annotationsRef.current = annotationsForTab;
  });

  // Activate persistence + load annotation draft when document becomes ready
  useEffect(() => {
    if (docState.status !== 'ready') return;
    let cancelled = false;

    persistRef.current = true;

    (async () => {
      const drafts = await loadAnnotationDraft(tab.filePath);
      if (cancelled) return;
      // Only load if drafts exist AND no annotations have been created yet
      if (drafts && drafts.length > 0 && annotationsRef.current.length === 0) {
        setAnnotationsForTab(tab.id, drafts);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Only on mount + doc becoming ready
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docState.status, tab.filePath]);

  // Auto-save on annotation changes (debounced)
  useEffect(() => {
    if (!persistRef.current) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveAnnotationDraft(tab.filePath, annotationsForTab);
    }, 2000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [annotationsForTab, tab.filePath]);

  // Save on unmount
  useEffect(() => {
    return () => {
      if (persistRef.current && annotationsRef.current.length > 0) {
        saveAnnotationDraft(tab.filePath, annotationsRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Read file ────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function readFile() {
      try {
        const result = await window.crosspdf.readFile(tab.filePath);
        if (cancelled) return;

        if (!result.success || !result.data) {
          setReadError(result.error ?? 'Failed to read file');
          return;
        }

        setPdfData(result.data);
      } catch (err) {
        if (!cancelled) {
          setReadError(err instanceof Error ? err.message : 'Failed to read file');
        }
      }
    }

    readFile();

    return () => {
      cancelled = true;
    };
  }, [tab.filePath]);

  // ── Load first-page dimensions for fit-mode calc ─────────────

  useEffect(() => {
    if (!pdfDocument) return;
    let cancelled = false;

    (async () => {
      try {
        const page = await pdfDocument.getPage(1);
        if (cancelled) {
          page.cleanup();
          return;
        }
        const viewport = page.getViewport({ scale: 1 });
        setPageDims({ width: viewport.width, height: viewport.height });
        page.cleanup();
      } catch {
        // Ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfDocument]);

  // ── Single-page render effect ────────────────────────────────

  useEffect(() => {
    if (viewMode !== 'single') return;
    if (docState.status !== 'ready') return;

    const canvas = canvasRef.current;
    const doc = pdfDocument;
    if (!canvas || !doc) return;

    renderTaskRef.current?.cancel();
    renderTaskRef.current = null;

    let cancelled = false;
    let page;
    let renderTask: RenderTask | null = null;

    (async () => {
      try {
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        page = await doc.getPage(currentPage);
        const viewport = page.getViewport({
          scale: effectiveZoom * pixelRatio,
          rotation,
        });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / pixelRatio}px`;
        canvas.style.height = `${viewport.height / pixelRatio}px`;

        renderTask = page.render({ canvas, viewport });
        renderTaskRef.current = renderTask;

        await renderTask.promise;
        if (!cancelled) {
          setRenderError(null);
        }
      } catch (err) {
        if (cancelled) return;
        const isCancel = err instanceof Error && err.name === 'RenderingCancelledException';
        if (!isCancel) {
          setRenderError(err instanceof Error ? err.message : 'Unknown render error');
        }
      } finally {
        if (renderTaskRef.current === renderTask) {
          renderTaskRef.current = null;
        }
        page?.cleanup();
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
      if (renderTaskRef.current === renderTask) {
        renderTaskRef.current = null;
      }
    };
  }, [viewMode, docState.status, currentPage, effectiveZoom, rotation, pdfDocument]);

  // ── Unmount cleanup ──────────────────────────────────────────

  useEffect(() => {
    return () => {
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    };
  }, []);

  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      if (mode !== viewMode) {
        setRenderedPages(new Set());
        setPageDimsMap(new Map());
      }
      setViewMode(mode);
    },
    [viewMode]
  );

  // ── Continuous mode helpers ──────────────────────────────────

  const addRenderedPage = useCallback((pageNumber: number) => {
    setRenderedPages((prev) => {
      if (prev.has(pageNumber)) return prev;
      const next = new Set(prev);
      next.add(pageNumber);
      return next;
    });
  }, []);

  const handleVisiblePageChange = useCallback((pageNumber: number) => {
    if (isUserScrollRef.current || isPageInputFocusedRef.current) return;
    setCurrentPage(pageNumber);
    setPageInput(String(pageNumber));
  }, []);

  const handlePageDims = useCallback(
    (pageNumber: number, dims: PageDims) => {
      setPageDimsMap((prev) => {
        const existing = prev.get(pageNumber);
        if (existing && existing.width === dims.width && existing.height === dims.height) {
          return prev;
        }
        const next = new Map(prev);
        next.set(pageNumber, dims);
        return next;
      });
      if (pageNumber === 1 && !pageDims) {
        setPageDims(dims);
      }
    },
    [pageDims]
  );

  // ── Navigation ───────────────────────────────────────────────

  const goToPage = useCallback(
    (page: number) => {
      const clamped = Math.max(1, Math.min(page, numPages));
      setCurrentPage(clamped);
      setPageInput(String(clamped));
      setRenderError(null);

      if (viewMode === 'continuous' && clamped !== currentPage) {
        isUserScrollRef.current = true;
        addRenderedPage(clamped);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const el = document.querySelector(`[data-page-number="${clamped}"]`);
            if (el) {
              el.scrollIntoView({ block: 'start', behavior: 'smooth' });
            }
            setTimeout(() => {
              isUserScrollRef.current = false;
            }, 800);
          });
        });
      }
    },
    [numPages, viewMode, currentPage, addRenderedPage]
  );

  // Expose goToPage to parent via ref
  useImperativeHandle(
    viewerRef,
    () => ({
      goToPage,
    }),
    [goToPage]
  );

  const handlePrevPage = useCallback(() => goToPage(currentPage - 1), [goToPage, currentPage]);
  const handleNextPage = useCallback(() => goToPage(currentPage + 1), [goToPage, currentPage]);
  const handleFirstPage = useCallback(() => goToPage(1), [goToPage]);
  const handleLastPage = useCallback(() => goToPage(numPages), [goToPage, numPages]);

  // ── Page input handlers ──────────────────────────────────────

  const handlePageInputChange = useCallback((value: string) => {
    setPageInput(value);
  }, []);

  const handlePageInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const value = parseInt(e.currentTarget.value, 10);
        if (!isNaN(value)) {
          goToPage(value);
        } else {
          setPageInput(String(currentPage));
        }
      }
    },
    [goToPage, currentPage]
  );

  const handlePageInputFocus = useCallback(() => {
    isPageInputFocusedRef.current = true;
  }, []);

  const handlePageInputBlur = useCallback(() => {
    isPageInputFocusedRef.current = false;
    setPageInput(String(currentPage));
  }, [currentPage]);

  // ── Zoom ─────────────────────────────────────────────────────

  const setFitMode = useCallback(
    (mode: FitMode) => {
      setFitModeState(mode);
      if (mode !== 'custom') {
        const newZoom = computeFitZoom(mode, pageDims, containerSize.width, containerSize.height);
        if (newZoom !== null) {
          setZoomState(newZoom);
        }
      }
    },
    [pageDims, containerSize]
  );

  const setCustomZoom = useCallback((z: number) => {
    const clamped = clampZoom(z);
    setZoomState(clamped);
    setFitModeState('custom');
  }, []);

  const handleZoomIn = useCallback(() => {
    setCustomZoom(zoom * ZOOM_FACTOR);
  }, [zoom, setCustomZoom]);

  const handleZoomOut = useCallback(() => {
    setCustomZoom(zoom / ZOOM_FACTOR);
  }, [zoom, setCustomZoom]);

  // ── Close handler ────────────────────────────────────────────

  const handleClose = useCallback(() => {
    closeTab(tab.id);
  }, [closeTab, tab.id]);

  // ── Page ops handlers ────────────────────────────────────────

  const handleMerge = useCallback(() => {
    useUIStore.getState().openPageOpsDialog('merge');
  }, []);

  const handleSplit = useCallback(() => {
    useUIStore.getState().openPageOpsDialog('split', {
      sourceFilePath: tab.filePath,
      sourceFileName: tab.fileName,
      totalPages: numPages,
    });
  }, [tab.filePath, tab.fileName, numPages]);

  const handleExtract = useCallback(() => {
    useUIStore.getState().openPageOpsDialog('extract', {
      sourceFilePath: tab.filePath,
      sourceFileName: tab.fileName,
      totalPages: numPages,
    });
  }, [tab.filePath, tab.fileName, numPages]);

  const handleReorder = useCallback(() => {
    useUIStore.getState().openPageOpsDialog('reorder', {
      sourceFilePath: tab.filePath,
      sourceFileName: tab.fileName,
      totalPages: numPages,
    });
  }, [tab.filePath, tab.fileName, numPages]);

  const handleDeletePage = useCallback(() => {
    useUIStore.getState().openPageOpsDialog('delete', {
      pages: [currentPage],
      numPages,
      filePath: tab.filePath,
      fileName: tab.fileName,
    });
  }, [currentPage, numPages, tab.filePath, tab.fileName]);

  const handleRotateCW = useCallback(() => {
    setRotation((prev) => ((prev + 90) % 360) as 0 | 90 | 180 | 270);
  }, []);

  const handleRotateCCW = useCallback(() => {
    setRotation((prev) => ((prev + 270) % 360) as 0 | 90 | 180 | 270);
  }, []);

  // ── Phase 4 dialog handlers ───────────────────────────────────

  const handleOcr = useCallback(() => {
    useUIStore.getState().openDialog('ocr', {
      filePath: tab.filePath,
      fileName: tab.fileName,
      numPages,
    });
  }, [tab.filePath, tab.fileName, numPages]);

  const handleForms = useCallback(() => {
    useUIStore.getState().openDialog('forms', {
      filePath: tab.filePath,
      fileName: tab.fileName,
    });
  }, [tab.filePath, tab.fileName]);

  const handlePassword = useCallback(() => {
    useUIStore.getState().openDialog('password-protection', {
      filePath: tab.filePath,
      fileName: tab.fileName,
    });
  }, [tab.filePath, tab.fileName]);

  const handlePdfToImages = useCallback(() => {
    useUIStore.getState().openDialog('pdf-to-images', {
      filePath: tab.filePath,
      fileName: tab.fileName,
      numPages,
    });
  }, [tab.filePath, tab.fileName, numPages]);

  const handleImagesToPdf = useCallback(() => {
    useUIStore.getState().openDialog('images-to-pdf');
  }, []);

  const handlePreferences = useCallback(() => {
    useUIStore.getState().openDialog('preferences');
  }, []);

  // ── Stamp: placement handler ────────────────────────────────

  const handleStampClick = useCallback(
    async (pageNumber: number, e: React.MouseEvent) => {
      const target = e.currentTarget as HTMLElement;
      const containerRect = target.getBoundingClientRect();
      const pdfPoint = screenPointToPdf(e.clientX, e.clientY, containerRect, effectiveZoom);

      let imagePath: string;
      try {
        const result = await window.crosspdf.openFileDialog({
          title: 'Select Image',
          filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }],
        });
        if (result.canceled || result.filePaths.length === 0) return;
        imagePath = result.filePaths[0];
      } catch {
        return;
      }

      let imageBytes: ArrayBuffer;
      try {
        const readResult = await window.crosspdf.readFile(imagePath);
        if (!readResult.success || !readResult.data) return;
        imageBytes = readResult.data;
      } catch {
        return;
      }

      const ext = imagePath.split('.').pop()?.toLowerCase() ?? '';
      const mimeType =
        ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : null;

      if (!mimeType) {
        alert('Unsupported image format. Only PNG and JPEG images are supported.');
        return;
      }

      let dataUrl: string;
      let naturalW: number;
      let naturalH: number;
      try {
        const normalized = await normalizeImageToSafeDataUrl(imageBytes, mimeType);
        dataUrl = normalized.dataUrl;
        naturalW = normalized.width;
        naturalH = normalized.height;
      } catch {
        alert('Failed to process the selected image. Try a different image file.');
        return;
      }

      const maxDim = 200; // PDF points — initial placement size
      const scale = Math.min(1, maxDim / Math.max(naturalW, naturalH));
      const imgW = naturalW * scale;
      const imgH = naturalH * scale;

      const ann = createAnnotation('stamp', pageNumber, {
        rect: { x: pdfPoint.x, y: pdfPoint.y, width: imgW, height: imgH },
        imageDataUrl: dataUrl,
        imageWidth: naturalW,
        imageHeight: naturalH,
      });
      useAnnotationStore.getState().addAnnotation(tab.id, ann);
    },
    [effectiveZoom, tab.id]
  );

  // ── Stamp: export handler ────────────────────────────────────

  const stamps = useMemo(() => {
    return annotationsForTab.filter((a): a is StampAnnotation => isStamp(a));
  }, [annotationsForTab]);

  const hasStamps = stamps.length > 0;

  const handleExportWithImages = useCallback(async () => {
    if (stamps.length === 0) return;

    const saveResult = await window.crosspdf.saveFileDialog({
      defaultPath: tab.fileName.replace('.pdf', '-with-images.pdf'),
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (saveResult.canceled || !saveResult.filePath) return;

    try {
      const readResult = await window.crosspdf.readFile(tab.filePath);
      if (!readResult.success || !readResult.data) {
        alert(`Failed to read source PDF: ${readResult.error ?? 'unknown error'}`);
        return;
      }
      const freshPdfData = readResult.data;

      const stampInputs = stamps.map((s) => {
        const comma = s.imageDataUrl.indexOf(',');
        const base64 = s.imageDataUrl.slice(comma + 1);
        const mimeMatch = s.imageDataUrl.match(/^data:(image\/[^;]+);/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
        const binary = atob(base64);
        const imageBytes = new ArrayBuffer(binary.length);
        const view = new Uint8Array(imageBytes);
        for (let i = 0; i < binary.length; i++) {
          view[i] = binary.charCodeAt(i);
        }
        return {
          pageNumber: s.pageNumber,
          rect: s.rect,
          imageBytes,
          mimeType,
          opacity: s.opacity,
        };
      });

      const result = await applyStamps(freshPdfData, stampInputs);

      // Create a fresh owned copy — never reference a potentially detached buffer
      const freshCopy = new Uint8Array(result.length);
      freshCopy.set(result);
      const output = freshCopy.buffer;

      const writeResult = await window.crosspdf.writeFile(saveResult.filePath, output);
      if (!writeResult.success) {
        alert(`Failed to export PDF with images: ${writeResult.error ?? 'unknown write error'}`);
      }
    } catch (err) {
      alert(
        'Failed to export PDF with images: ' + (err instanceof Error ? err.message : String(err))
      );
    }
  }, [stamps, tab.fileName, tab.filePath]);

  // ── Redaction: draw handler ──────────────────────────────────

  const handleRedactionDrawn = useCallback(
    (pageNumber: number, rect: { x: number; y: number; width: number; height: number }) => {
      const ann = createAnnotation('redaction', pageNumber, { rect });
      useAnnotationStore.getState().addAnnotation(tab.id, ann);
    },
    [tab.id]
  );

  // ── Redaction: apply flow ────────────────────────────────────

  const redactions = useMemo(() => {
    return annotationsForTab.filter((a): a is RedactionAnnotation => isRedaction(a));
  }, [annotationsForTab]);

  const redactedPageNumbers = useMemo(() => {
    const pages = new Set<number>();
    for (const r of redactions) {
      pages.add(r.pageNumber);
    }
    return Array.from(pages).sort((a, b) => a - b);
  }, [redactions]);

  const hasRedactions = redactions.length > 0;

  const handleRedactionApply = useCallback(() => {
    if (!hasRedactions) return;
    useUIStore.getState().openDialog('redaction', {
      totalRedactions: redactions.length,
      affectedPages: redactedPageNumbers,
      filePath: tab.filePath,
      fileName: tab.fileName,
      tabId: tab.id,
    });
  }, [hasRedactions, redactions.length, redactedPageNumbers, tab.filePath, tab.fileName, tab.id]);

  // ── Keyboard shortcuts ───────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (docState.status !== 'ready') return;

      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const meta = e.ctrlKey || e.metaKey;

      // When the user has an active text selection, skip navigation shortcuts
      // that would destroy the selection (allows Ctrl+C to work naturally).
      const selection = document.getSelection();
      const hasActiveSelection = selection && !selection.isCollapsed && selection.rangeCount > 0;

      if (e.key === 'Home') {
        if (hasActiveSelection) return;
        e.preventDefault();
        handleFirstPage();
      } else if (e.key === 'End') {
        if (hasActiveSelection) return;
        e.preventDefault();
        handleLastPage();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        if (hasActiveSelection) return;
        e.preventDefault();
        handleNextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        if (hasActiveSelection) return;
        e.preventDefault();
        handlePrevPage();
      } else if (e.key === 'PageDown') {
        if (hasActiveSelection) return;
        e.preventDefault();
        handleNextPage();
      } else if (e.key === 'PageUp') {
        if (hasActiveSelection) return;
        e.preventDefault();
        handlePrevPage();
      } else if (meta && e.key === '=') {
        e.preventDefault();
        handleZoomIn();
      } else if (meta && e.key === '-') {
        e.preventDefault();
        handleZoomOut();
      } else if (meta && e.key === '0') {
        e.preventDefault();
        setFitMode('fit-page');
      } else if (meta && e.key === '1') {
        e.preventDefault();
        setFitMode('actual');
      } else if (meta && e.key === '2') {
        e.preventDefault();
        setFitMode('fit-width');
      } else if (meta && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo(tab.id);
      } else if (meta && e.key === 'z') {
        e.preventDefault();
        undo(tab.id);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (getSelection()?.isCollapsed !== false) {
          e.preventDefault();
          handleDeleteKey();
        }
      } else if (e.key === 'Enter') {
        const isTextMarkup =
          activeTool === 'highlight' || activeTool === 'underline' || activeTool === 'strikeout';
        if (isTextMarkup) {
          e.preventDefault();
          if (viewMode === 'single') {
            if (textLayerContainerRef.current) {
              createTextMarkupFromSelection(currentPage, textLayerContainerRef.current);
            }
          } else {
            // Continuous mode: find page container from selection
            const sel = getSelection();
            if (sel && sel.rangeCount > 0) {
              const range = sel.getRangeAt(0);
              const textLayer = (range.startContainer as Node).parentElement?.closest(
                '.textLayer'
              ) as HTMLElement | null;
              const pageEl = textLayer?.closest('[data-page-number]') as HTMLElement | null;
              const container = textLayer?.parentElement as HTMLElement | null;
              const pageNum = pageEl ? parseInt(pageEl.dataset.pageNumber ?? '0', 10) : 0;
              if (container && pageNum > 0) {
                createTextMarkupFromSelection(pageNum, container);
              }
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    docState.status,
    handleFirstPage,
    handleLastPage,
    handleNextPage,
    handlePrevPage,
    handleZoomIn,
    handleZoomOut,
    setFitMode,
    activeTool,
    currentPage,
    viewMode,
    createTextMarkupFromSelection,
    handleDeleteKey,
    undo,
    redo,
    tab.id,
  ]);

  // Create text markup annotation on mouseup after drag-select
  const createTextMarkupRef = useRef(createTextMarkupFromSelection);
  useEffect(() => {
    createTextMarkupRef.current = createTextMarkupFromSelection;
  });

  useEffect(() => {
    const handler = () => {
      const tool = useAnnotationStore.getState().activeTool;
      if (tool !== 'highlight' && tool !== 'underline' && tool !== 'strikeout') return;

      // Let the browser finish updating the selection
      setTimeout(() => {
        const sel = document.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;

        const range = sel.getRangeAt(0);
        const textLayer = (range.startContainer as Node).parentElement?.closest(
          '.textLayer'
        ) as HTMLElement | null;
        if (!textLayer) return;

        const container = textLayer.parentElement as HTMLElement | null;
        if (!container) return;

        const pageEl = textLayer.closest('[data-page-number]') as HTMLElement | null;
        const pageNum = pageEl ? parseInt(pageEl.dataset.pageNumber ?? '0', 10) : 0;
        if (pageNum <= 0) return;

        createTextMarkupRef.current(pageNum, container);
      }, 0);
    };

    window.addEventListener('mouseup', handler);
    return () => window.removeEventListener('mouseup', handler);
  }, []);

  const isDisabled = docState.status !== 'ready';

  return (
    <div className="h-full flex flex-col bg-surface-100 dark:bg-surface-900">
      <ViewerToolbar
        fileName={tab.fileName}
        numPages={numPages}
        currentPage={currentPage}
        pageInput={pageInput}
        viewMode={viewMode}
        fitMode={fitMode}
        zoom={effectiveZoom}
        disabled={isDisabled}
        onClose={handleClose}
        onOpenAnother={onOpenAnother}
        onPageInputChange={handlePageInputChange}
        onPageInputKeyDown={handlePageInputKeyDown}
        onPageInputFocus={handlePageInputFocus}
        onPageInputBlur={handlePageInputBlur}
        onPrevPage={handlePrevPage}
        onNextPage={handleNextPage}
        onFirstPage={handleFirstPage}
        onLastPage={handleLastPage}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomChange={setCustomZoom}
        onFitMode={setFitMode}
        onViewMode={handleViewModeChange}
        activeTool={activeTool}
        onToolChange={setActiveTool}
        onRotateCW={handleRotateCW}
        onRotateCCW={handleRotateCCW}
        onDeletePage={handleDeletePage}
        onMerge={handleMerge}
        onSplit={handleSplit}
        onExtract={handleExtract}
        onReorder={handleReorder}
        onOcr={handleOcr}
        onForms={handleForms}
        onPassword={handlePassword}
        onRedactionApply={handleRedactionApply}
        hasRedactions={hasRedactions}
        onExportWithImages={handleExportWithImages}
        hasStamps={hasStamps}
        onPdfToImages={handlePdfToImages}
        onImagesToPdf={handleImagesToPdf}
        onPreferences={handlePreferences}
      />

      {/* Content area */}
      <div ref={containerRef} className="flex-1 overflow-hidden">
        {docState.status === 'reading-file' && (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <Spinner />
            <span className="text-sm text-surface-500">Reading file…</span>
          </div>
        )}

        {docState.status === 'loading-doc' && (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <Spinner />
            <span className="text-sm text-surface-500">Loading PDF…</span>
          </div>
        )}

        {docState.status === 'error' && (
          <div className="h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="text-red-500 dark:text-red-400">
              <svg
                className="w-12 h-12 mx-auto"
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
            </div>
            <div>
              <p className="text-sm font-medium text-surface-700 dark:text-surface-200">
                Failed to open document
              </p>
              <p className="text-xs text-surface-500 mt-1">{docState.message}</p>
            </div>
            <Button onClick={onOpenAnother} className="text-xs">
              Open a different file
            </Button>
          </div>
        )}

        {docState.status === 'ready' && viewMode === 'single' && (
          <div className="h-full overflow-auto flex justify-center bg-surface-200/50 dark:bg-surface-800/50">
            {renderError && (
              <div className="flex flex-col items-center justify-center gap-4 p-8 text-center self-center">
                <div className="text-amber-500 dark:text-amber-400">
                  <svg
                    className="w-12 h-12 mx-auto"
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
                </div>
                <div>
                  <p className="text-sm font-medium text-surface-700 dark:text-surface-200">
                    Failed to render this page
                  </p>
                  <p className="text-xs text-surface-500 mt-1">{renderError}</p>
                </div>
                <p className="text-xs text-surface-400">Try navigating to a different page.</p>
              </div>
            )}

            {!renderError && (
              <div className="p-4">
                <div
                  className="relative"
                  ref={textLayerContainerRef}
                  data-page-number={currentPage}
                >
                  <canvas
                    ref={canvasRef}
                    className="block shadow bg-white"
                    aria-label={`Page ${currentPage} of ${numPages}`}
                  />
                  {pdfDocument && (
                    <>
                      <PageTextLayer
                        pdfDocument={pdfDocument}
                        pageNumber={currentPage}
                        zoom={effectiveZoom}
                      />
                      <AnnotationLayer
                        annotations={annotationsForTab}
                        pageNumber={currentPage}
                        zoom={effectiveZoom}
                        pageDims={pageDims}
                        selectedIds={selectedIds}
                        activeTool={activeTool}
                        onAnnotationClick={(id) => selectAnnotation(id)}
                        onAnnotationDoubleClick={(id) => handleAnnotationDoubleClick(id)}
                        onPageClick={(e) => {
                          if (activeTool === 'stamp') {
                            handleStampClick(currentPage, e);
                          } else {
                            handlePageClick(currentPage, e);
                          }
                        }}
                      />
                      <RedactionDrawLayer
                        pageNumber={currentPage}
                        zoom={effectiveZoom}
                        active={activeTool === 'redaction'}
                        onRedactionDrawn={handleRedactionDrawn}
                      />
                      <StampInteractionLayer
                        zoom={effectiveZoom}
                        stamps={annotationsForTab
                          .filter((a): a is StampAnnotation => isStamp(a))
                          .filter((s) => s.pageNumber === currentPage)}
                        selectedIds={selectedIds}
                        activeTool={activeTool}
                        onAnnotationClick={(id) => selectAnnotation(id)}
                        onStampMoved={(id, rect) =>
                          updateAnnotation(tab.id, id, { rect } as Partial<Annotation>)
                        }
                        onStampResized={(id, rect) =>
                          updateAnnotation(tab.id, id, { rect } as Partial<Annotation>)
                        }
                      />
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {docState.status === 'ready' && viewMode === 'continuous' && pdfDocument && (
          <PageList
            pdfDocument={pdfDocument}
            numPages={numPages}
            zoom={effectiveZoom}
            rotation={rotation}
            initialPage={currentPage}
            onVisiblePageChange={handleVisiblePageChange}
            renderedPages={renderedPages}
            onPageRender={addRenderedPage}
            pageDimsMap={pageDimsMap}
            onPageDims={handlePageDims}
            annotations={annotationsForTab}
            selectedIds={selectedIds}
            activeTool={activeTool}
            onAnnotationClick={(id) => selectAnnotation(id)}
            onAnnotationDoubleClick={(id) => handleAnnotationDoubleClick(id)}
            onPageClick={(e) => {
              const pageNum = parseInt(
                (e.currentTarget as HTMLElement)
                  .closest('[data-page-number]')
                  ?.getAttribute('data-page-number') ?? '0',
                10
              );
              if (pageNum) {
                if (activeTool === 'stamp') {
                  handleStampClick(pageNum, e);
                } else {
                  handlePageClick(pageNum, e);
                }
              }
            }}
            onRedactionDrawn={handleRedactionDrawn}
            onStampMoved={(id, rect) =>
              updateAnnotation(tab.id, id, { rect } as Partial<Annotation>)
            }
            onStampResized={(id, rect) =>
              updateAnnotation(tab.id, id, { rect } as Partial<Annotation>)
            }
          />
        )}
      </div>

      <ViewerStatusBar
        fileName={tab.fileName}
        currentPage={currentPage}
        numPages={numPages}
        zoom={effectiveZoom}
        fitMode={fitMode}
        viewMode={viewMode}
      />

      {editingAnnotation && (
        <AnnotationEditor
          initialContent={editingAnnotation.initialContent}
          label={editingAnnotation.label}
          anchorRect={editingAnnotation.anchorRect}
          onSave={handleEditorSave}
          onCancel={handleEditorCancel}
        />
      )}
    </div>
  );
}
