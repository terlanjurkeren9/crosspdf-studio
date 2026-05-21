import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type { FitMode, ViewMode } from '../lib/zoom';

export interface TabState {
  id: string;
  filePath: string;
  fileName: string;
  currentPage: number;
  zoom: number;
  fitMode: FitMode;
  viewMode: ViewMode;
}

interface DocumentState {
  tabs: TabState[];
  activeTabId: string | null;

  openTab: (filePath: string, fileName: string) => string;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTabState: (tabId: string, patch: Partial<TabState>) => void;
  getActiveTab: () => TabState | null;
  getTab: (tabId: string) => TabState | undefined;
}

function createTab(filePath: string, fileName: string): TabState {
  return {
    id: uuid(),
    filePath,
    fileName,
    currentPage: 1,
    zoom: 1.0,
    fitMode: 'fit-width',
    viewMode: 'single',
  };
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  openTab: (filePath, fileName) => {
    // Reuse existing tab for the same file
    const existing = get().tabs.find((t) => t.filePath === filePath);
    if (existing) {
      set({ activeTabId: existing.id });
      return existing.id;
    }

    const tab = createTab(filePath, fileName);
    set((s) => ({
      tabs: [...s.tabs, tab],
      activeTabId: tab.id,
    }));
    return tab.id;
  },

  closeTab: (tabId) => {
    set((s) => {
      const idx = s.tabs.findIndex((t) => t.id === tabId);
      if (idx === -1) return s;

      const next = [...s.tabs];
      next.splice(idx, 1);

      let nextActiveId = s.activeTabId;
      if (s.activeTabId === tabId) {
        if (next.length > 0) {
          // Prefer tab to the right, then left
          const newIdx = Math.min(idx, next.length - 1);
          nextActiveId = next[newIdx].id;
        } else {
          nextActiveId = null;
        }
      }

      return { tabs: next, activeTabId: nextActiveId };
    });
  },

  setActiveTab: (tabId) => {
    if (get().tabs.some((t) => t.id === tabId)) {
      set({ activeTabId: tabId });
    }
  },

  updateTabState: (tabId, patch) => {
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, ...patch } : t)),
    }));
  },

  getActiveTab: () => {
    const { tabs, activeTabId } = get();
    return tabs.find((t) => t.id === activeTabId) ?? null;
  },

  getTab: (tabId) => {
    return get().tabs.find((t) => t.id === tabId);
  },
}));
