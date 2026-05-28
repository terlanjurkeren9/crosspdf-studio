import { useCallback, useRef } from 'react';
import { useAnnotationStore, createAnnotation } from '../stores/annotation.store';
import {
  getSelectionQuadPoints,
  getSelectionBounds,
  screenPointToPdf,
} from '../lib/pdf-coordinates';
import type { TextMarkupType } from '../types/annotation.types';

export function useAnnotationInteraction(tabId: string) {
  const activeTool = useAnnotationStore((s) => s.activeTool);
  const addAnnotation = useAnnotationStore((s) => s.addAnnotation);
  const updateAnnotation = useAnnotationStore((s) => s.updateAnnotation);
  const deleteAnnotation = useAnnotationStore((s) => s.deleteAnnotation);
  const selectedIds = useAnnotationStore((s) => s.selectedIds);
  const selectAnnotation = useAnnotationStore((s) => s.selectAnnotation);
  const deselectAll = useAnnotationStore((s) => s.deselectAll);
  const deleteSelected = useAnnotationStore((s) => s.deleteSelected);

  const zoomRef = useRef(1.0);

  const setZoom = useCallback((z: number) => {
    zoomRef.current = z;
  }, []);

  const createTextMarkupFromSelection = useCallback(
    (pageNumber: number, container: HTMLElement) => {
      const type = activeTool as TextMarkupType;
      if (type !== 'highlight' && type !== 'underline' && type !== 'strikeout') return;

      const zoom = zoomRef.current;
      const quads = getSelectionQuadPoints(container, zoom);
      const bounds = getSelectionBounds(container, zoom);
      if (!quads || !bounds) return;

      const annotation = createAnnotation(type, pageNumber, {
        rect: bounds,
        quadPoints: quads,
      });
      addAnnotation(tabId, annotation);
    },
    [activeTool, tabId, addAnnotation]
  );

  const handlePageClick = useCallback(
    (pageNumber: number, e: React.MouseEvent) => {
      const zoom = zoomRef.current;
      const target = e.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      const pdfPoint = screenPointToPdf(e.clientX, e.clientY, rect, zoom);

      if (activeTool === 'sticky-note') {
        const size = 22;
        const annotation = createAnnotation('sticky-note', pageNumber, {
          rect: { x: pdfPoint.x, y: pdfPoint.y, width: size, height: size },
          content: '',
        });
        addAnnotation(tabId, annotation);
        const store = useAnnotationStore.getState();
        store.setActiveTool('select');
        store.selectAnnotation(annotation.id);
      } else if (activeTool === 'free-text') {
        const annotation = createAnnotation('free-text', pageNumber, {
          rect: { x: pdfPoint.x, y: pdfPoint.y, width: 150, height: 30 },
          content: 'Text',
          fontSize: 14,
        });
        addAnnotation(tabId, annotation);
        const store = useAnnotationStore.getState();
        store.setActiveTool('select');
        store.selectAnnotation(annotation.id);
      }
    },
    [activeTool, tabId, addAnnotation]
  );

  const handleDeleteKey = useCallback(() => {
    if (selectedIds.size > 0) {
      deleteSelected(tabId);
    }
  }, [selectedIds, deleteSelected, tabId]);

  return {
    activeTool,
    selectedIds,
    selectAnnotation,
    deselectAll,
    updateAnnotation,
    deleteAnnotation,
    createTextMarkupFromSelection,
    handlePageClick,
    handleDeleteKey,
    setZoom,
  };
}
