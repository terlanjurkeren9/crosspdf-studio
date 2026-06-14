import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { AlertCircle } from 'lucide-react';
import { Spinner } from '../ui/Spinner';
import { Button } from '../ui/Button';
import { clampZoom, computeFitZoom, ZOOM_FACTOR } from '../../lib/zoom';
import type { FitMode, ViewMode, PageDims } from '../../lib/zoom';
import { loadAnnotationDraft, saveAnnotationDraft } from '../../services/annotation-persistence';
import { AnnotationEditor } from './AnnotationEditor';
import type {
  Annotation,
  AnnotationTool,
  RedactionAnnotation,
  StampAnnotation,
} from '../../types/annotation.types';
import { isRedaction, isStamp } from '../../types/annotation.types';
import { RedactionDrawLayer } from './RedactionDrawLayer';
import { FormFieldDrawLayer } from './FormFieldDrawLayer';
import { SignaturePlacementLayer } from './SignaturePlacementLayer';
import { AnnotationInteractionLayer } from './AnnotationInteractionLayer';
import { FreehandDrawLayer } from './FreehandDrawLayer';
import { ShapeDrawLayer } from './ShapeDrawLayer';
import { applyStamps, addFormFields } from '../../services/pdf-ops.service';
import type { FormFieldSpec } from '../../services/pdf-ops.service';
import { FormFieldSettingsDialog } from '../dialogs/FormFieldSettingsDialog';
import { screenPointToPdf } from '../../lib/pdf-coordinates';
import { normalizeImageToSafeDataUrl } from '../../lib/image-normalize';
import {
  calculateHandToolPanPosition,
  getHandToolCursor,
  getHandToolUserSelect,
} from '../../lib/hand-tool';
import {
  getFileShortcutAction,
  isEditableShortcutTarget,
  saveAsDefaultPath,
} from '../../lib/file-shortcuts';
import { embedAnnotationsInPdf, extractAnnotationsFromPdf } from '../../lib/pdf-annotation-embed';

const EMPTY_ANNOTATIONS: Annotation[] = [];

type DocState =
  | { status: 'reading-file' }
  | { status: 'loading-doc' }
  | { status: 'ready' }
  | { status: 'error'; message: string };

function emitE2EFileAction(action: 'save' | 'save-as' | 'print', filePath?: string): void {
  if (!window.crosspdf.isE2E) return;
  window.dispatchEvent(
    new CustomEvent('crosspdf:e2e-file-action', {
      detail: { action, filePath },
    })
  );
}

function getE2ESaveFilePath(): string | undefined {
  if (!window.crosspdf.isE2E) return undefined;
  return (window as unknown as { __crosspdfE2ESaveFilePath?: string }).__crosspdfE2ESaveFilePath;
}

export interface PdfViewerHandle {
  goToPage: (page: number) => void;
  previousPage: () => void;
  nextPage: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setFitMode: (mode: FitMode) => void;
  setTool: (tool: AnnotationTool) => void;
  save: () => Promise<void>;
  saveAs: () => Promise<void>;
  print: () => void;
}

interface PdfViewerProps {
  tab: TabState;
  onOpenAnother: () => void;
  onPdfDocumentLoaded?: (doc: PDFDocumentProxy | null) => void;
  viewerRef?: React.RefObject<PdfViewerHandle | null>;
}

export function PdfViewer({ tab, onOpenAnother, onPdfDocumentLoaded, viewerRef }: PdfViewerProps) {
  const { t } = useTranslation();
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
  const signaturePlacementMode = useUIStore((s) => s.signaturePlacementMode);

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

  const [editingFormField, setEditingFormField] = useState<{
    id: string;
    fieldName: string;
    fieldType: 'text' | 'checkbox' | 'dropdown' | 'radiogroup';
    required: boolean;
    defaultValue?: string;
    options?: string[];
    maxLength?: number;
  } | null>(null);

  const handleAnnotationDoubleClick = useCallback(
    (id: string) => {
      const ann = annotationsForTab.find((a) => a.id === id);
      if (!ann) return;

      if (ann.type === 'sticky-note' || ann.type === 'free-text') {
        const currentContent = 'content' in ann ? (ann as { content: string }).content : '';
        const hitEl = document.querySelector(`[data-annotation-hit="${id}"]`);
        setEditingAnnotation({
          id,
          initialContent: currentContent,
          label: ann.type === 'sticky-note' ? 'Edit note' : 'Edit text',
          anchorRect: hitEl?.getBoundingClientRect() ?? null,
        });
      } else if (ann.type === 'form-field') {
        setEditingFormField({
          id: ann.id,
          fieldName: ann.fieldName,
          fieldType: ann.fieldType,
          required: ann.required,
          defaultValue: ann.defaultValue,
          options: ann.options,
          maxLength: ann.maxLength,
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
  const [isPanning, setIsPanning] = useState(false);

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

  useEffect(() => {
    const root = containerRef.current;
    const workspace = root?.querySelector<HTMLElement>('.pdf-workspace');
    if (!workspace || activeTool !== 'hand' || docState.status !== 'ready') {
      setIsPanning(false);
      return;
    }

    let dragging = false;
    let panStart = {
      clientX: 0,
      clientY: 0,
      scrollLeft: 0,
      scrollTop: 0,
    };

    const stopPan = () => {
      if (!dragging) return;
      dragging = false;
      setIsPanning(false);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('button,input,textarea,select,[role="button"]')) return;

      e.preventDefault();
      dragging = true;
      panStart = {
        clientX: e.clientX,
        clientY: e.clientY,
        scrollLeft: workspace.scrollLeft,
        scrollTop: workspace.scrollTop,
      };
      setIsPanning(true);

      try {
        workspace.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      e.preventDefault();
      const next = calculateHandToolPanPosition(panStart, e.clientX, e.clientY);
      workspace.scrollLeft = next.scrollLeft;
      workspace.scrollTop = next.scrollTop;
    };

    workspace.addEventListener('pointerdown', onPointerDown);
    workspace.addEventListener('pointermove', onPointerMove);
    workspace.addEventListener('pointerup', stopPan);
    workspace.addEventListener('pointercancel', stopPan);
    workspace.addEventListener('lostpointercapture', stopPan);

    return () => {
      workspace.removeEventListener('pointerdown', onPointerDown);
      workspace.removeEventListener('pointermove', onPointerMove);
      workspace.removeEventListener('pointerup', stopPan);
      workspace.removeEventListener('pointercancel', stopPan);
      workspace.removeEventListener('lostpointercapture', stopPan);
      stopPan();
    };
  }, [activeTool, docState.status, viewMode]);

  useEffect(() => {
    const root = containerRef.current;
    const workspace = root?.querySelector<HTMLElement>('.pdf-workspace');
    if (!workspace) return;

    const previousCursor = workspace.style.cursor;
    const previousUserSelect = workspace.style.userSelect;

    workspace.style.cursor =
      docState.status === 'ready' ? getHandToolCursor(activeTool, isPanning) : '';
    workspace.style.userSelect =
      docState.status === 'ready' ? getHandToolUserSelect(activeTool) : '';

    return () => {
      workspace.style.cursor = previousCursor;
      workspace.style.userSelect = previousUserSelect;
    };
  }, [activeTool, docState.status, isPanning, viewMode]);

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

  useEffect(() => {
    if (!window.crosspdf.isE2E) return;
    const handler = (event: Event) => {
      const annotations = (event as CustomEvent<Annotation[]>).detail;
      if (Array.isArray(annotations)) {
        setAnnotationsForTab(tab.id, annotations);
      }
    };
    window.addEventListener('crosspdf:e2e-set-annotations', handler);
    return () => window.removeEventListener('crosspdf:e2e-set-annotations', handler);
  }, [setAnnotationsForTab, tab.id]);

  // Activate persistence + load annotation draft when document becomes ready
  useEffect(() => {
    if (docState.status !== 'ready') return;
    let cancelled = false;

    persistRef.current = true;

    (async () => {
      try {
        const readResult = await window.crosspdf.readFile(tab.filePath);
        if (cancelled) return;
        if (readResult.success && readResult.data) {
          const embedded = await extractAnnotationsFromPdf(readResult.data);
          if (cancelled) return;
          if (embedded.length > 0 && annotationsRef.current.length === 0) {
            setAnnotationsForTab(tab.id, embedded);
            return;
          }
        }
      } catch (err) {
        console.error('Failed to load embedded PDF annotations:', err);
      }

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
        // Seed with current page so continuous mode shows it immediately
        const seed =
          currentPage > 0 && currentPage <= numPages ? new Set([currentPage]) : new Set<number>();
        setRenderedPages(seed);
        setPageDimsMap(new Map());
      }
      setViewMode(mode);
    },
    [viewMode, currentPage, numPages]
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

  // ── File actions ─────────────────────────────────────────────

  const readCurrentPdfBytes = useCallback(async (): Promise<ArrayBuffer | null> => {
    if (tab.filePath) {
      const readResult = await window.crosspdf.readFile(tab.filePath);
      if (!readResult.success || !readResult.data) {
        useUIStore.getState().showToast(readResult.error ?? t('viewer.saveFailed'));
        return null;
      }
      return readResult.data;
    }

    return pdfData;
  }, [pdfData, tab.filePath, t]);

  const buildAnnotatedPdfBytes = useCallback(async (): Promise<ArrayBuffer | null> => {
    const data = await readCurrentPdfBytes();
    if (!data) return null;

    try {
      return await embedAnnotationsInPdf(data, annotationsRef.current);
    } catch (err) {
      console.error('Failed to embed annotations in PDF:', err);
      useUIStore.getState().showToast(t('viewer.saveFailed'));
      return null;
    }
  }, [readCurrentPdfBytes, t]);

  const handleSaveAs = useCallback(async () => {
    const data = await buildAnnotatedPdfBytes();
    if (!data) return;

    const e2eSavePath = getE2ESaveFilePath();
    const saveResult = e2eSavePath
      ? { canceled: false, filePath: e2eSavePath }
      : await window.crosspdf.saveFileDialog({
          defaultPath: saveAsDefaultPath(tab.fileName),
          filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
        });
    if (saveResult.canceled || !saveResult.filePath) return;

    const writeResult = await window.crosspdf.writeFile(saveResult.filePath, data);
    if (!writeResult.success) {
      useUIStore.getState().showToast(writeResult.error ?? t('viewer.saveFailed'));
      return;
    }

    useUIStore.getState().showToast(t('viewer.saved'));
    emitE2EFileAction('save-as', saveResult.filePath);
    const fileName = saveResult.filePath.split(/[/\\]/).pop() ?? saveResult.filePath;
    window.dispatchEvent(
      new CustomEvent('crosspdf:open-file', { detail: { filePath: saveResult.filePath } })
    );
    window.crosspdf.upsertRecentDocument(saveResult.filePath, fileName).catch(() => {
      // Ignore — recent documents update is best-effort.
    });
  }, [buildAnnotatedPdfBytes, tab.fileName, t]);

  const handleSave = useCallback(async () => {
    if (!tab.filePath) {
      await handleSaveAs();
      return;
    }

    const data = await buildAnnotatedPdfBytes();
    if (!data) return;

    const writeResult = await window.crosspdf.writeFile(tab.filePath, data);
    if (!writeResult.success) {
      useUIStore.getState().showToast(writeResult.error ?? t('viewer.saveFailed'));
      return;
    }

    useUIStore.getState().showToast(t('viewer.saved'));
    emitE2EFileAction('save', tab.filePath);
    window.crosspdf.upsertRecentDocument(tab.filePath, tab.fileName).catch(() => {
      // Ignore — recent documents update is best-effort.
    });
  }, [buildAnnotatedPdfBytes, handleSaveAs, tab.fileName, tab.filePath, t]);

  const handlePrint = useCallback(() => {
    emitE2EFileAction('print', tab.filePath);
    if (window.crosspdf.isE2E) return;
    window.print();
  }, [tab.filePath]);

  useImperativeHandle(
    viewerRef,
    () => ({
      goToPage,
      previousPage: handlePrevPage,
      nextPage: handleNextPage,
      zoomIn: handleZoomIn,
      zoomOut: handleZoomOut,
      setFitMode,
      setTool: setActiveTool,
      save: handleSave,
      saveAs: handleSaveAs,
      print: handlePrint,
    }),
    [
      goToPage,
      handlePrevPage,
      handleNextPage,
      handleZoomIn,
      handleZoomOut,
      setFitMode,
      setActiveTool,
      handleSave,
      handleSaveAs,
      handlePrint,
    ]
  );

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

  const handleSignature = useCallback(() => {
    useUIStore.getState().openDialog('signature');
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
      const store = useAnnotationStore.getState();
      store.addAnnotation(tab.id, ann);
      store.setActiveTool('select');
      store.selectAnnotation(ann.id);
      useUIStore.getState().showToast('Image placed. Drag to move, use corner handles to resize.');
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

  // ── Form Field: draw handler ─────────────────────────────────

  const handleFormFieldDrawn = useCallback(
    (pageNumber: number, rect: { x: number; y: number; width: number; height: number }) => {
      const ann = createAnnotation('form-field', pageNumber, { rect });
      const store = useAnnotationStore.getState();
      store.addAnnotation(tab.id, ann);
      store.setActiveTool('select');
    },
    [tab.id]
  );

  // ── Signature placement: draw handler ───────────────────────

  const handleSignaturePlaced = useCallback(
    (pageNumber: number, rect: { x: number; y: number; width: number; height: number }) => {
      useUIStore.getState().setSignaturePlacement({
        page: pageNumber,
        rect: [rect.x, rect.y, rect.width, rect.height],
      });
      useUIStore.getState().openDialog('signature');
    },
    []
  );

  // ── Freehand: draw handler ───────────────────────────────────

  const handleFreehandDrawn = useCallback(
    (pageNumber: number, points: number[], color: string, strokeWidth: number) => {
      const ann = createAnnotation('freehand', pageNumber, { points, color, strokeWidth });
      useAnnotationStore.getState().addAnnotation(tab.id, ann);
    },
    [tab.id]
  );

  // ── Shape: draw handler ─────────────────────────────────────

  const handleShapeDrawn = useCallback(
    (
      pageNumber: number,
      type: 'rectangle' | 'ellipse' | 'line' | 'arrow',
      points: number[],
      color: string,
      strokeWidth: number
    ) => {
      const [x1, y1, x2, y2] = points;
      const rect =
        type === 'rectangle' || type === 'ellipse'
          ? {
              x: Math.min(x1, x2),
              y: Math.min(y1, y2),
              width: Math.abs(x2 - x1),
              height: Math.abs(y2 - y1),
            }
          : undefined;
      const ann = createAnnotation(type, pageNumber, {
        ...(rect ? { rect } : { points }),
        color,
        strokeWidth,
      });
      useAnnotationStore.getState().addAnnotation(tab.id, ann);
    },
    [tab.id]
  );

  // ── Form Field: settings dialog state ────────────────────────  // ── Form Field: settings handlers ────────────────────────────

  const handleFormFieldSettingsSave = useCallback(
    (settings: {
      fieldName: string;
      fieldType: 'text' | 'checkbox' | 'dropdown' | 'radiogroup';
      required: boolean;
      defaultValue?: string;
      options?: string[];
      maxLength?: number;
    }) => {
      if (!editingFormField) return;
      useAnnotationStore
        .getState()
        .updateAnnotation(tab.id, editingFormField.id, settings as Partial<Annotation>);
      setEditingFormField(null);
    },
    [editingFormField, tab.id, setEditingFormField]
  );

  const handleFormFieldSettingsClose = useCallback(() => {
    setEditingFormField(null);
  }, [setEditingFormField]);

  // ── Form Field: apply flow ───────────────────────────────────

  const formFields = useMemo(() => {
    return annotationsForTab.filter((a) => a.type === 'form-field');
  }, [annotationsForTab]);

  const hasFormFields = formFields.length > 0;

  const handleApplyFormFields = useCallback(async () => {
    if (formFields.length === 0) return;

    const saveResult = await window.crosspdf.saveFileDialog({
      defaultPath: tab.fileName.replace('.pdf', '-with-forms.pdf'),
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });

    if (saveResult.canceled || !saveResult.filePath) return;

    try {
      const readResult = await window.crosspdf.readFile(tab.filePath);
      if (!readResult.success || !readResult.data) {
        useUIStore.getState().showToast(t('formField.readFailed'));
        return;
      }

      const specs: FormFieldSpec[] = formFields.map((f) => ({
        name: f.fieldName || `field_${f.id.slice(0, 8)}`,
        type: f.fieldType as FormFieldSpec['type'],
        page: f.pageNumber,
        x: f.rect.x,
        y: f.rect.y,
        width: f.rect.width,
        height: f.rect.height,
        required: f.required,
        defaultValue: f.defaultValue,
        options: f.options,
        maxLength: f.maxLength,
      }));

      const resultBytes = await addFormFields(readResult.data, specs);

      const output = new Uint8Array(resultBytes.length);
      output.set(resultBytes);

      await window.crosspdf.writeFile(saveResult.filePath, output.buffer);

      useUIStore.getState().showToast(t('formField.appliedSuccessfully'));

      // Clear only form-field annotations
      const formFieldIds = formFields.map((f) => f.id);
      useAnnotationStore.getState().deleteAnnotations(tab.id, formFieldIds);
    } catch (err) {
      useUIStore.getState().showToast(
        t('formField.applyFailed', {
          error: err instanceof Error ? err.message : String(err),
        })
      );
    }
  }, [formFields, tab.filePath, tab.fileName, tab.id, t]);

  // ── Keyboard shortcuts ───────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (docState.status !== 'ready') return;

      if (isEditableShortcutTarget(e.target)) return;

      const meta = e.ctrlKey || e.metaKey;
      const fileAction = getFileShortcutAction(e);
      if (fileAction === 'save') {
        e.preventDefault();
        void handleSave();
        return;
      }
      if (fileAction === 'save-as') {
        e.preventDefault();
        void handleSaveAs();
        return;
      }
      if (fileAction === 'print') {
        e.preventDefault();
        handlePrint();
        return;
      }

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
    handleSave,
    handleSaveAs,
    handlePrint,
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
    <div className="flex h-full flex-col bg-surface-100 dark:bg-surface-900">
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
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onPrint={handlePrint}
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
        onPdfToImages={handlePdfToImages}
        onImagesToPdf={handleImagesToPdf}
        onSignature={handleSignature}
      />

      {/* Content area */}
      <div ref={containerRef} className="flex-1 overflow-hidden relative">
        {/* Floating action buttons — outside toolbar, overlaid on viewer */}
        {docState.status === 'ready' && (
          <div className="absolute bottom-4 right-4 z-50 flex flex-col gap-2">
            {hasRedactions && (
              <button
                type="button"
                onClick={handleRedactionApply}
                className="rounded-xl bg-coral-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-coral-900/25 hover:bg-coral-600 active:bg-coral-700 transition-colors"
                title="Apply Redactions"
              >
                Apply Redactions ({redactions.length})
              </button>
            )}
            {hasStamps && (
              <button
                type="button"
                onClick={handleExportWithImages}
                className="rounded-xl bg-teal-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-teal-900/25 hover:bg-teal-600 active:bg-teal-700 transition-colors"
                title="Export PDF with Images"
              >
                Export Images ({stamps.length})
              </button>
            )}
            {hasFormFields && (
              <button
                type="button"
                onClick={handleApplyFormFields}
                className="rounded-xl bg-blue-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-900/25 hover:bg-blue-600 active:bg-blue-700 transition-colors"
                title={t('formField.apply')}
              >
                {t('formField.apply')} ({formFields.length})
              </button>
            )}
          </div>
        )}
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
              <AlertCircle className="mx-auto h-12 w-12" />
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
          <div className="pdf-workspace flex h-full justify-center overflow-auto">
            {renderError && (
              <div className="flex flex-col items-center justify-center gap-4 p-8 text-center self-center">
                <div className="text-amber-500 dark:text-amber-400">
                  <AlertCircle className="mx-auto h-12 w-12" />
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
              <div className="p-5">
                <div
                  className="relative"
                  ref={textLayerContainerRef}
                  data-page-number={currentPage}
                >
                  <canvas
                    ref={canvasRef}
                    className="block bg-white shadow-xl shadow-surface-950/20"
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
                      <FormFieldDrawLayer
                        pageNumber={currentPage}
                        zoom={effectiveZoom}
                        active={activeTool === 'form-field'}
                        onFormFieldDrawn={handleFormFieldDrawn}
                      />
                      <SignaturePlacementLayer
                        pageNumber={currentPage}
                        zoom={effectiveZoom}
                        active={signaturePlacementMode}
                        onPlacementComplete={handleSignaturePlaced}
                      />
                      <FreehandDrawLayer
                        pageNumber={currentPage}
                        zoom={effectiveZoom}
                        active={activeTool === 'freehand'}
                        onFreehandDrawn={handleFreehandDrawn}
                      />
                      <ShapeDrawLayer
                        pageNumber={currentPage}
                        zoom={effectiveZoom}
                        active={
                          activeTool === 'rectangle' ||
                          activeTool === 'ellipse' ||
                          activeTool === 'line' ||
                          activeTool === 'arrow'
                        }
                        activeTool={activeTool}
                        onShapeDrawn={handleShapeDrawn}
                      />
                      <AnnotationInteractionLayer
                        zoom={effectiveZoom}
                        annotations={annotationsForTab.filter((a) => a.pageNumber === currentPage)}
                        selectedIds={selectedIds}
                        activeTool={activeTool}
                        onAnnotationClick={(id) => selectAnnotation(id)}
                        onAnnotationDoubleClick={(id) => handleAnnotationDoubleClick(id)}
                        onAnnotationMoved={(id, rect) =>
                          updateAnnotation(tab.id, id, { rect } as Partial<Annotation>)
                        }
                        onAnnotationResized={(id, rect) =>
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
            onFormFieldDrawn={handleFormFieldDrawn}
            onFreehandDrawn={handleFreehandDrawn}
            onShapeDrawn={handleShapeDrawn}
            onAnnotationMoved={(id, rect) =>
              updateAnnotation(tab.id, id, { rect } as Partial<Annotation>)
            }
            onAnnotationResized={(id, rect) =>
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

      {editingFormField && (
        <FormFieldSettingsDialog
          open={true}
          onClose={handleFormFieldSettingsClose}
          onSave={handleFormFieldSettingsSave}
          initialFieldName={editingFormField.fieldName}
          initialFieldType={editingFormField.fieldType}
          initialRequired={editingFormField.required}
          initialDefaultValue={editingFormField.defaultValue}
          initialOptions={editingFormField.options}
          initialMaxLength={editingFormField.maxLength}
        />
      )}
    </div>
  );
}
