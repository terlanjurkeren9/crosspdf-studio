import { describe, it, expect, beforeEach } from 'vitest';
import { useAnnotationStore, createAnnotation } from '../src/renderer/stores/annotation.store';
import type { Annotation } from '../src/renderer/types/annotation.types';

function resetStore() {
  useAnnotationStore.setState({
    activeTool: 'select',
    annotationsByTab: {},
    selectedIds: new Set(),
    undoStacksByTab: {},
    redoStacksByTab: {},
  });
}

describe('Annotation Store', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('activeTool', () => {
    it('defaults to select', () => {
      expect(useAnnotationStore.getState().activeTool).toBe('select');
    });

    it('setActiveTool changes tool', () => {
      useAnnotationStore.getState().setActiveTool('highlight');
      expect(useAnnotationStore.getState().activeTool).toBe('highlight');
    });

    it('setActiveTool to non-select deselects all', () => {
      useAnnotationStore.getState().setActiveTool('select');
      const ann = createAnnotation('highlight', 1, {
        rect: { x: 0, y: 0, width: 10, height: 10 },
        quadPoints: [0, 0, 10, 0, 10, 10, 0, 10],
      });
      useAnnotationStore.getState().addAnnotation('tab1', ann);
      useAnnotationStore.getState().selectAnnotation(ann.id);
      expect(useAnnotationStore.getState().selectedIds.size).toBe(1);

      useAnnotationStore.getState().setActiveTool('underline');
      expect(useAnnotationStore.getState().selectedIds.size).toBe(0);
    });
  });

  describe('CRUD', () => {
    it('addAnnotation adds to correct tab', () => {
      const ann = createAnnotation('highlight', 1, {
        rect: { x: 10, y: 20, width: 30, height: 40 },
        quadPoints: [10, 20, 40, 20, 40, 60, 10, 60],
      });
      useAnnotationStore.getState().addAnnotation('tab1', ann);

      const forTab1 = useAnnotationStore.getState().getAnnotationsForTab('tab1');
      expect(forTab1).toHaveLength(1);
      expect(forTab1[0].type).toBe('highlight');
      expect(forTab1[0].pageNumber).toBe(1);

      const forTab2 = useAnnotationStore.getState().getAnnotationsForTab('tab2');
      expect(forTab2).toHaveLength(0);
    });

    it('annotations are isolated per tab', () => {
      const ann1 = createAnnotation('highlight', 1, {
        rect: { x: 0, y: 0, width: 10, height: 10 },
        quadPoints: [],
      });
      const ann2 = createAnnotation('sticky-note', 2, {
        rect: { x: 5, y: 5, width: 20, height: 20 },
        content: 'hello',
      });

      useAnnotationStore.getState().addAnnotation('tab1', ann1);
      useAnnotationStore.getState().addAnnotation('tab2', ann2);

      expect(useAnnotationStore.getState().getAnnotationsForTab('tab1')).toHaveLength(1);
      expect(useAnnotationStore.getState().getAnnotationsForTab('tab2')).toHaveLength(1);
      expect(useAnnotationStore.getState().getAnnotationsForTab('tab3')).toHaveLength(0);
    });

    it('getAnnotationsForPage filters by page number', () => {
      const ann1 = createAnnotation('highlight', 1, {
        rect: { x: 0, y: 0, width: 10, height: 10 },
        quadPoints: [],
      });
      const ann2 = createAnnotation('sticky-note', 2, {
        rect: { x: 0, y: 0, width: 10, height: 10 },
        content: '',
      });

      useAnnotationStore.getState().addAnnotation('tab1', ann1);
      useAnnotationStore.getState().addAnnotation('tab1', ann2);

      expect(useAnnotationStore.getState().getAnnotationsForPage('tab1', 1)).toHaveLength(1);
      expect(useAnnotationStore.getState().getAnnotationsForPage('tab1', 2)).toHaveLength(1);
      expect(useAnnotationStore.getState().getAnnotationsForPage('tab1', 3)).toHaveLength(0);
    });

    it('updateAnnotation modifies an existing annotation', () => {
      const ann = createAnnotation('highlight', 1, {
        rect: { x: 0, y: 0, width: 10, height: 10 },
        quadPoints: [],
      });
      useAnnotationStore.getState().addAnnotation('tab1', ann);
      useAnnotationStore
        .getState()
        .updateAnnotation('tab1', ann.id, { color: '#000000' } as Partial<Annotation>);

      const updated = useAnnotationStore.getState().getAnnotationsForTab('tab1')[0];
      expect(updated.color).toBe('#000000');
      expect(updated.modifiedAt).toBeGreaterThanOrEqual(ann.modifiedAt);
    });

    it('deleteAnnotation removes an annotation', () => {
      const ann = createAnnotation('highlight', 1, {
        rect: { x: 0, y: 0, width: 10, height: 10 },
        quadPoints: [],
      });
      useAnnotationStore.getState().addAnnotation('tab1', ann);
      useAnnotationStore.getState().deleteAnnotation('tab1', ann.id);

      expect(useAnnotationStore.getState().getAnnotationsForTab('tab1')).toHaveLength(0);
    });

    it('deleteAnnotations removes multiple', () => {
      const ann1 = createAnnotation('highlight', 1, {
        rect: { x: 0, y: 0, width: 10, height: 10 },
        quadPoints: [],
      });
      const ann2 = createAnnotation('underline', 1, {
        rect: { x: 0, y: 0, width: 10, height: 10 },
        quadPoints: [],
      });
      useAnnotationStore.getState().addAnnotation('tab1', ann1);
      useAnnotationStore.getState().addAnnotation('tab1', ann2);
      useAnnotationStore.getState().deleteAnnotations('tab1', [ann1.id, ann2.id]);

      expect(useAnnotationStore.getState().getAnnotationsForTab('tab1')).toHaveLength(0);
    });
  });

  describe('selection', () => {
    it('selectAnnotation toggles selection', () => {
      const ann = createAnnotation('highlight', 1, {
        rect: { x: 0, y: 0, width: 10, height: 10 },
        quadPoints: [],
      });
      useAnnotationStore.getState().addAnnotation('tab1', ann);
      useAnnotationStore.getState().selectAnnotation(ann.id);

      expect(useAnnotationStore.getState().selectedIds.has(ann.id)).toBe(true);

      useAnnotationStore.getState().selectAnnotation(ann.id);
      expect(useAnnotationStore.getState().selectedIds.has(ann.id)).toBe(false);
    });

    it('deselectAll clears selection', () => {
      const ann1 = createAnnotation('highlight', 1, {
        rect: { x: 0, y: 0, width: 10, height: 10 },
        quadPoints: [],
      });
      const ann2 = createAnnotation('sticky-note', 2, {
        rect: { x: 0, y: 0, width: 10, height: 10 },
        content: '',
      });
      useAnnotationStore.getState().addAnnotation('tab1', ann1);
      useAnnotationStore.getState().addAnnotation('tab1', ann2);
      useAnnotationStore.getState().selectAnnotation(ann1.id);
      useAnnotationStore.getState().selectAnnotation(ann2.id);

      useAnnotationStore.getState().deselectAll();
      expect(useAnnotationStore.getState().selectedIds.size).toBe(0);
    });

    it('deleteSelected removes selected annotations', () => {
      const ann1 = createAnnotation('highlight', 1, {
        rect: { x: 0, y: 0, width: 10, height: 10 },
        quadPoints: [],
      });
      const ann2 = createAnnotation('sticky-note', 2, {
        rect: { x: 0, y: 0, width: 10, height: 10 },
        content: '',
      });
      useAnnotationStore.getState().addAnnotation('tab1', ann1);
      useAnnotationStore.getState().addAnnotation('tab1', ann2);
      useAnnotationStore.getState().selectAnnotation(ann1.id);

      useAnnotationStore.getState().deleteSelected('tab1');
      expect(useAnnotationStore.getState().getAnnotationsForTab('tab1')).toHaveLength(1);
      expect(useAnnotationStore.getState().getAnnotationsForTab('tab1')[0].id).toBe(ann2.id);
    });
  });

  describe('undo/redo', () => {
    it('undo restores previous state', () => {
      const ann = createAnnotation('highlight', 1, {
        rect: { x: 0, y: 0, width: 10, height: 10 },
        quadPoints: [],
      });
      useAnnotationStore.getState().addAnnotation('tab1', ann);
      expect(useAnnotationStore.getState().getAnnotationsForTab('tab1')).toHaveLength(1);

      useAnnotationStore.getState().undo('tab1');
      expect(useAnnotationStore.getState().getAnnotationsForTab('tab1')).toHaveLength(0);
    });

    it('redo restores after undo', () => {
      const ann = createAnnotation('highlight', 1, {
        rect: { x: 0, y: 0, width: 10, height: 10 },
        quadPoints: [],
      });
      useAnnotationStore.getState().addAnnotation('tab1', ann);
      useAnnotationStore.getState().undo('tab1');
      expect(useAnnotationStore.getState().getAnnotationsForTab('tab1')).toHaveLength(0);

      useAnnotationStore.getState().redo('tab1');
      expect(useAnnotationStore.getState().getAnnotationsForTab('tab1')).toHaveLength(1);
    });

    it('canUndo returns correct value', () => {
      expect(useAnnotationStore.getState().canUndo('tab1')).toBe(false);

      const ann = createAnnotation('highlight', 1, {
        rect: { x: 0, y: 0, width: 10, height: 10 },
        quadPoints: [],
      });
      useAnnotationStore.getState().addAnnotation('tab1', ann);
      expect(useAnnotationStore.getState().canUndo('tab1')).toBe(true);

      useAnnotationStore.getState().undo('tab1');
      expect(useAnnotationStore.getState().canUndo('tab1')).toBe(false);
    });

    it('canRedo returns correct value', () => {
      expect(useAnnotationStore.getState().canRedo('tab1')).toBe(false);

      const ann = createAnnotation('highlight', 1, {
        rect: { x: 0, y: 0, width: 10, height: 10 },
        quadPoints: [],
      });
      useAnnotationStore.getState().addAnnotation('tab1', ann);
      expect(useAnnotationStore.getState().canRedo('tab1')).toBe(false);

      useAnnotationStore.getState().undo('tab1');
      expect(useAnnotationStore.getState().canRedo('tab1')).toBe(true);
    });

    it('redo clears after new action', () => {
      const ann1 = createAnnotation('highlight', 1, {
        rect: { x: 0, y: 0, width: 10, height: 10 },
        quadPoints: [],
      });
      useAnnotationStore.getState().addAnnotation('tab1', ann1);
      useAnnotationStore.getState().undo('tab1');
      expect(useAnnotationStore.getState().canRedo('tab1')).toBe(true);

      const ann2 = createAnnotation('underline', 2, {
        rect: { x: 0, y: 0, width: 10, height: 10 },
        quadPoints: [],
      });
      useAnnotationStore.getState().addAnnotation('tab1', ann2);
      expect(useAnnotationStore.getState().canRedo('tab1')).toBe(false);
    });

    it('undo/redo is per-tab isolated', () => {
      const ann1 = createAnnotation('highlight', 1, {
        rect: { x: 0, y: 0, width: 10, height: 10 },
        quadPoints: [],
      });
      const ann2 = createAnnotation('sticky-note', 2, {
        rect: { x: 0, y: 0, width: 10, height: 10 },
        content: '',
      });
      useAnnotationStore.getState().addAnnotation('tab1', ann1);
      useAnnotationStore.getState().addAnnotation('tab2', ann2);

      expect(useAnnotationStore.getState().canUndo('tab1')).toBe(true);
      expect(useAnnotationStore.getState().canUndo('tab2')).toBe(true);

      useAnnotationStore.getState().undo('tab1');
      expect(useAnnotationStore.getState().getAnnotationsForTab('tab1')).toHaveLength(0);
      expect(useAnnotationStore.getState().getAnnotationsForTab('tab2')).toHaveLength(1);
    });
  });

  describe('createAnnotation', () => {
    it('creates highlight with defaults', () => {
      const ann = createAnnotation('highlight', 1);
      expect(ann.type).toBe('highlight');
      expect(ann.pageNumber).toBe(1);
      expect(ann.color).toBe('#FFEB3B');
      expect(ann.opacity).toBe(0.3);
      expect(ann.id).toBeTruthy();
      expect('quadPoints' in ann).toBe(true);
    });

    it('creates sticky-note with defaults', () => {
      const ann = createAnnotation('sticky-note', 3);
      expect(ann.type).toBe('sticky-note');
      expect(ann.content).toBe('');
      expect(ann.color).toBe('#FFEB3B');
      expect(ann.opacity).toBe(1);
    });

    it('creates free-text with defaults', () => {
      const ann = createAnnotation('free-text', 1);
      expect(ann.type).toBe('free-text');
      expect(ann.content).toBe('');
      expect('fontSize' in ann).toBe(true);
    });

    it('accepts overrides', () => {
      const ann = createAnnotation('highlight', 1, {
        color: '#FF0000',
        quadPoints: [1, 2, 3, 4, 5, 6, 7, 8],
      });
      expect(ann.color).toBe('#FF0000');
      const annWithQuads = ann as { quadPoints: number[] };
      expect(annWithQuads.quadPoints).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it('underline defaults to red', () => {
      const ann = createAnnotation('underline', 1);
      expect(ann.color).toBe('#F44336');
      expect(ann.opacity).toBe(1);
    });

    it('strikeout defaults to red', () => {
      const ann = createAnnotation('strikeout', 1);
      expect(ann.color).toBe('#F44336');
      expect(ann.opacity).toBe(1);
    });

    it('generates unique IDs', () => {
      const a1 = createAnnotation('highlight', 1);
      const a2 = createAnnotation('highlight', 1);
      expect(a1.id).not.toBe(a2.id);
    });

    it('sets createdAt and modifiedAt', () => {
      const before = Date.now();
      const ann = createAnnotation('highlight', 1);
      const after = Date.now();
      expect(ann.createdAt).toBeGreaterThanOrEqual(before);
      expect(ann.createdAt).toBeLessThanOrEqual(after);
      expect(ann.modifiedAt).toBe(ann.createdAt);
    });
  });

  describe('tab lifecycle', () => {
    it('setAnnotationsForTab replaces all annotations', () => {
      const ann1 = createAnnotation('highlight', 1, {
        rect: { x: 0, y: 0, width: 10, height: 10 },
        quadPoints: [],
      });
      useAnnotationStore.getState().addAnnotation('tab1', ann1);

      const ann2 = createAnnotation('sticky-note', 2, {
        rect: { x: 0, y: 0, width: 10, height: 10 },
        content: 'new',
      });
      useAnnotationStore.getState().setAnnotationsForTab('tab1', [ann2]);

      expect(useAnnotationStore.getState().getAnnotationsForTab('tab1')).toHaveLength(1);
      expect(useAnnotationStore.getState().getAnnotationsForTab('tab1')[0].id).toBe(ann2.id);
      expect(useAnnotationStore.getState().canUndo('tab1')).toBe(false);
    });

    it('clearTab removes all data for a tab', () => {
      const ann = createAnnotation('highlight', 1, {
        rect: { x: 0, y: 0, width: 10, height: 10 },
        quadPoints: [],
      });
      useAnnotationStore.getState().addAnnotation('tab1', ann);
      useAnnotationStore.getState().clearTab('tab1');

      expect(useAnnotationStore.getState().getAnnotationsForTab('tab1')).toHaveLength(0);
      expect(useAnnotationStore.getState().canUndo('tab1')).toBe(false);
    });
  });
});
