import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type { Annotation, AnnotationTool, AnnotationType } from '../types/annotation.types';

interface AnnotationState {
  activeTool: AnnotationTool;

  /** annotations keyed by tabId, each value is all annotations for that document */
  annotationsByTab: Record<string, Annotation[]>;

  /** selected annotation IDs (global across tabs) */
  selectedIds: Set<string>;

  /** undo stacks keyed by tabId */
  undoStacksByTab: Record<string, Annotation[][]>;

  /** redo stacks keyed by tabId */
  redoStacksByTab: Record<string, Annotation[][]>;

  // Actions — tool
  setActiveTool: (tool: AnnotationTool) => void;

  // Actions — annotations
  addAnnotation: (tabId: string, annotation: Annotation) => void;
  updateAnnotation: (tabId: string, id: string, patch: Partial<Annotation>) => void;
  deleteAnnotation: (tabId: string, id: string) => void;
  deleteAnnotations: (tabId: string, ids: string[]) => void;

  // Actions — selection
  selectAnnotation: (id: string, multi?: boolean) => void;
  deselectAll: () => void;
  deleteSelected: (tabId: string) => void;

  // Actions — undo/redo
  undo: (tabId: string) => void;
  redo: (tabId: string) => void;
  canUndo: (tabId: string) => boolean;
  canRedo: (tabId: string) => boolean;

  // Actions — persistence
  setAnnotationsForTab: (tabId: string, annotations: Annotation[]) => void;
  clearTab: (tabId: string) => void;
  clearAll: () => void;

  // Selectors
  getAnnotationsForTab: (tabId: string) => Annotation[];
  getAnnotationsForPage: (tabId: string, pageNumber: number) => Annotation[];
}

export function createAnnotation(
  type: AnnotationType,
  pageNumber: number,
  overrides?: Record<string, unknown>
): Annotation {
  const now = Date.now();
  const base = {
    id: uuid(),
    type,
    pageNumber,
    rect: { x: 0, y: 0, width: 0, height: 0 },
    color: '#FFEB3B',
    opacity: 0.3,
    author: 'User',
    createdAt: now,
    modifiedAt: now,
  };

  switch (type) {
    case 'highlight': {
      const ann: Annotation = {
        ...base,
        type: 'highlight',
        quadPoints: [],
        ...overrides,
      } as unknown as Annotation;
      return ann;
    }
    case 'underline': {
      const ann: Annotation = {
        ...base,
        type: 'underline',
        color: '#F44336',
        opacity: 1,
        quadPoints: [],
        ...overrides,
      } as unknown as Annotation;
      return ann;
    }
    case 'strikeout': {
      const ann: Annotation = {
        ...base,
        type: 'strikeout',
        color: '#F44336',
        opacity: 1,
        quadPoints: [],
        ...overrides,
      } as unknown as Annotation;
      return ann;
    }
    case 'sticky-note': {
      const ann: Annotation = {
        ...base,
        type: 'sticky-note',
        color: '#FFEB3B',
        opacity: 1,
        content: '',
        ...overrides,
      } as unknown as Annotation;
      return ann;
    }
    case 'free-text': {
      const ann: Annotation = {
        ...base,
        type: 'free-text',
        color: '#000000',
        opacity: 1,
        content: '',
        fontSize: 12,
        ...overrides,
      } as unknown as Annotation;
      return ann;
    }
    case 'freehand': {
      const ann: Annotation = {
        ...base,
        type: 'freehand',
        color: '#F44336',
        opacity: 1,
        points: [],
        strokeWidth: 2,
        ...overrides,
      } as unknown as Annotation;
      return ann;
    }
    case 'rectangle':
    case 'ellipse': {
      const ann: Annotation = {
        ...base,
        type,
        color: '#F44336',
        opacity: 1,
        strokeWidth: 2,
        ...overrides,
      } as unknown as Annotation;
      return ann;
    }
    case 'line':
    case 'arrow': {
      const ann: Annotation = {
        ...base,
        type,
        color: '#F44336',
        opacity: 1,
        points: [],
        strokeWidth: 2,
        ...overrides,
      } as unknown as Annotation;
      return ann;
    }
    case 'redaction': {
      const ann: Annotation = {
        ...base,
        type: 'redaction',
        color: '#000000',
        opacity: 0.5,
        ...overrides,
      } as unknown as Annotation;
      return ann;
    }
    case 'stamp': {
      const ann: Annotation = {
        ...base,
        type: 'stamp',
        color: '#000000',
        opacity: 1,
        imageDataUrl: '',
        imageWidth: 0,
        imageHeight: 0,
        ...overrides,
      } as unknown as Annotation;
      return ann;
    }
    case 'form-field': {
      const ann: Annotation = {
        ...base,
        type: 'form-field',
        color: '#3b82f6',
        opacity: 1,
        fieldName: '',
        fieldType: 'text',
        required: false,
        ...overrides,
      } as unknown as Annotation;
      return ann;
    }
  }
}

function pushUndo(state: AnnotationState, tabId: string): AnnotationState {
  const current = state.annotationsByTab[tabId] ?? [];
  const prevUndo = state.undoStacksByTab[tabId] ?? [];
  return {
    activeTool: state.activeTool,
    annotationsByTab: state.annotationsByTab,
    selectedIds: state.selectedIds,
    undoStacksByTab: {
      ...state.undoStacksByTab,
      [tabId]: [...prevUndo, current],
    },
    redoStacksByTab: {
      ...state.redoStacksByTab,
      [tabId]: [],
    },
  } as AnnotationState;
}

export const useAnnotationStore = create<AnnotationState>((set, get) => ({
  activeTool: 'select',
  annotationsByTab: {},
  selectedIds: new Set(),
  undoStacksByTab: {},
  redoStacksByTab: {},

  setActiveTool: (tool) => {
    set({ activeTool: tool });
    if (tool !== 'select') {
      get().deselectAll();
    }
  },

  addAnnotation: (tabId, annotation) => {
    set((s) => {
      const state = pushUndo(s, tabId);
      const current = state.annotationsByTab[tabId] ?? [];
      return {
        ...state,
        annotationsByTab: {
          ...state.annotationsByTab,
          [tabId]: [...current, annotation],
        } as Record<string, Annotation[]>,
      };
    });
  },

  updateAnnotation: (tabId, id, patch) => {
    set((s) => {
      const state = pushUndo(s, tabId);
      const current = state.annotationsByTab[tabId] ?? [];
      return {
        ...state,
        annotationsByTab: {
          ...state.annotationsByTab,
          [tabId]: current.map((a) =>
            a.id === id ? ({ ...a, ...patch, modifiedAt: Date.now() } as Annotation) : a
          ),
        } as Record<string, Annotation[]>,
      };
    });
  },

  deleteAnnotation: (tabId, id) => {
    set((s) => {
      const state = pushUndo(s, tabId);
      const current = state.annotationsByTab[tabId] ?? [];
      const sel = new Set(state.selectedIds);
      sel.delete(id);
      return {
        ...state,
        annotationsByTab: {
          ...state.annotationsByTab,
          [tabId]: current.filter((a) => a.id !== id),
        } as Record<string, Annotation[]>,
        selectedIds: sel,
      };
    });
  },

  deleteAnnotations: (tabId, ids) => {
    const idSet = new Set(ids);
    set((s) => {
      const state = pushUndo(s, tabId);
      const current = state.annotationsByTab[tabId] ?? [];
      const sel = new Set(state.selectedIds);
      for (const id of ids) sel.delete(id);
      return {
        ...state,
        annotationsByTab: {
          ...state.annotationsByTab,
          [tabId]: current.filter((a) => !idSet.has(a.id)),
        } as Record<string, Annotation[]>,
        selectedIds: sel,
      };
    });
  },

  selectAnnotation: (id, multi = false) => {
    set((s) => {
      if (multi) {
        const next = new Set(s.selectedIds);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return { selectedIds: next };
      }
      // Toggle: if id is the only selected one, deselect; otherwise select only this one
      if (s.selectedIds.size === 1 && s.selectedIds.has(id)) {
        return { selectedIds: new Set() };
      }
      return { selectedIds: new Set([id]) };
    });
  },

  deselectAll: () => {
    set((s) => {
      if (s.selectedIds.size === 0) return s;
      return { selectedIds: new Set() };
    });
  },

  deleteSelected: (tabId) => {
    const { selectedIds } = get();
    if (selectedIds.size === 0) return;
    get().deleteAnnotations(tabId, Array.from(selectedIds));
  },

  undo: (tabId) => {
    set((s) => {
      const undoStack = s.undoStacksByTab[tabId] ?? [];
      if (undoStack.length === 0) return s;

      const prevUndo = [...undoStack];
      const prevState = prevUndo.pop()!;
      const current = s.annotationsByTab[tabId] ?? [];
      const redoStack = s.redoStacksByTab[tabId] ?? [];

      return {
        activeTool: s.activeTool,
        annotationsByTab: {
          ...s.annotationsByTab,
          [tabId]: prevState,
        } as Record<string, Annotation[]>,
        undoStacksByTab: {
          ...s.undoStacksByTab,
          [tabId]: prevUndo,
        },
        redoStacksByTab: {
          ...s.redoStacksByTab,
          [tabId]: [...redoStack, current],
        },
        selectedIds: new Set<string>(),
      } as AnnotationState;
    });
  },

  redo: (tabId) => {
    set((s) => {
      const redoStack = s.redoStacksByTab[tabId] ?? [];
      if (redoStack.length === 0) return s;

      const prevRedo = [...redoStack];
      const nextState = prevRedo.pop()!;
      const current = s.annotationsByTab[tabId] ?? [];
      const undoStack = s.undoStacksByTab[tabId] ?? [];

      return {
        activeTool: s.activeTool,
        annotationsByTab: {
          ...s.annotationsByTab,
          [tabId]: nextState,
        } as Record<string, Annotation[]>,
        redoStacksByTab: {
          ...s.redoStacksByTab,
          [tabId]: prevRedo,
        },
        undoStacksByTab: {
          ...s.undoStacksByTab,
          [tabId]: [...undoStack, current],
        },
        selectedIds: new Set<string>(),
      } as AnnotationState;
    });
  },

  canUndo: (tabId) => {
    return (get().undoStacksByTab[tabId] ?? []).length > 0;
  },

  canRedo: (tabId) => {
    return (get().redoStacksByTab[tabId] ?? []).length > 0;
  },

  setAnnotationsForTab: (tabId, annotations) => {
    set(
      (s) =>
        ({
          activeTool: s.activeTool,
          annotationsByTab: { ...s.annotationsByTab, [tabId]: annotations } as Record<
            string,
            Annotation[]
          >,
          undoStacksByTab: { ...s.undoStacksByTab, [tabId]: [] },
          redoStacksByTab: { ...s.redoStacksByTab, [tabId]: [] },
          selectedIds: s.selectedIds,
        }) as AnnotationState
    );
  },

  clearTab: (tabId) => {
    set((s) => {
      const byTab = { ...s.annotationsByTab } as Record<string, Annotation[]>;
      const undo = { ...s.undoStacksByTab };
      const redo = { ...s.redoStacksByTab };
      delete byTab[tabId];
      delete undo[tabId];
      delete redo[tabId];
      return {
        activeTool: s.activeTool,
        annotationsByTab: byTab,
        undoStacksByTab: undo,
        redoStacksByTab: redo,
        selectedIds: s.selectedIds,
      } as AnnotationState;
    });
  },

  clearAll: () => {
    set({
      annotationsByTab: {},
      undoStacksByTab: {},
      redoStacksByTab: {},
      selectedIds: new Set(),
      activeTool: 'select',
    });
  },

  getAnnotationsForTab: (tabId) => {
    return get().annotationsByTab[tabId] ?? [];
  },

  getAnnotationsForPage: (tabId, pageNumber) => {
    const all = get().annotationsByTab[tabId] ?? [];
    return all.filter((a) => a.pageNumber === pageNumber);
  },
}));
