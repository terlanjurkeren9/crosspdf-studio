import { create } from 'zustand';
import type { PdfObjectEditOperation } from '../lib/pdf-object-edit';
import { applyPdfObjectEdits, ownedArrayBuffer } from '../lib/pdf-object-edit';

interface PdfObjectEditState {
  // Operations per tab id
  pendingOperations: Map<string, PdfObjectEditOperation[]>;
  isApplying: boolean;
  lastError: string | null;

  // Add a pending operation for a tab
  addOperation: (tabId: string, operation: PdfObjectEditOperation) => void;

  // Remove a pending operation by id
  removeOperation: (tabId: string, operationId: string) => void;

  // Clear all pending operations for a tab
  clearOperations: (tabId: string) => void;

  // Apply all pending operations to PDF bytes
  applyEdits: (tabId: string, source: ArrayBuffer | Uint8Array) => Promise<ArrayBuffer | null>;

  // Get pending operations for a tab
  getOperations: (tabId: string) => PdfObjectEditOperation[];
}

export const usePdfObjectEditStore = create<PdfObjectEditState>((set, get) => ({
  pendingOperations: new Map(),
  isApplying: false,
  lastError: null,

  addOperation: (tabId, operation) => {
    set((state) => {
      const newMap = new Map(state.pendingOperations);
      const existing = newMap.get(tabId) ?? [];
      newMap.set(tabId, [...existing, operation]);
      return { pendingOperations: newMap };
    });
  },

  removeOperation: (tabId, operationId) => {
    set((state) => {
      const newMap = new Map(state.pendingOperations);
      const existing = newMap.get(tabId) ?? [];
      newMap.set(
        tabId,
        existing.filter((op) => op.id !== operationId)
      );
      return { pendingOperations: newMap };
    });
  },

  clearOperations: (tabId) => {
    set((state) => {
      const newMap = new Map(state.pendingOperations);
      newMap.delete(tabId);
      return { pendingOperations: newMap };
    });
  },

  applyEdits: async (tabId, source) => {
    const operations = get().pendingOperations.get(tabId) ?? [];
    if (operations.length === 0) {
      return source instanceof ArrayBuffer ? source : ownedArrayBuffer(source);
    }

    set({ isApplying: true, lastError: null });
    try {
      const result = await applyPdfObjectEdits(source, operations);
      // Clear operations after successful apply
      set((state) => {
        const newMap = new Map(state.pendingOperations);
        newMap.delete(tabId);
        return { pendingOperations: newMap, isApplying: false };
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to apply edits';
      set({ isApplying: false, lastError: message });
      return null;
    }
  },

  getOperations: (tabId) => {
    return get().pendingOperations.get(tabId) ?? [];
  },
}));
