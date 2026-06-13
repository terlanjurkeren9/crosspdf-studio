import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type { FitMode, ViewMode } from '../lib/zoom';
import type { WindowApi } from '../../preload/index';

declare global {
  interface Window {
    crosspdf: WindowApi;
  }
}

export interface TabState {
  id: string;
  filePath: string;
  fileName: string;
  currentPage: number;
  zoom: number;
  fitMode: FitMode;
  viewMode: ViewMode;
  rotation: 0 | 90 | 180 | 270;
  password?: string;
}

interface DocumentState {
  tabs: TabState[];
  activeTabId: string | null;

  openTab: (filePath: string, fileName: string, password?: string) => string;
  restoreSession: (savedTabs: TabState[], savedActiveTabId: string | null) => void;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeTabsToRight: (tabId: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (tabId: string) => void;
  updateTabState: (tabId: string, patch: Partial<TabState>) => void;
  getActiveTab: () => TabState | null;
  getTab: (tabId: string) => TabState | undefined;
}

function createTab(filePath: string, fileName: string, password?: string): TabState {
  return {
    id: uuid(),
    filePath,
    fileName,
    currentPage: 1,
    zoom: 1.0,
    fitMode: 'fit-width',
    viewMode: 'single',
    rotation: 0,
    password,
  };
}

export const useDocumentStore = create<DocumentState>((set, get) => {
  const saveSession = (tabs: TabState[], activeTabId: string | null) => {
    if (typeof window !== 'undefined' && window.crosspdf) {
      window.crosspdf.saveSession(tabs, activeTabId).catch(console.error);
    }
  };

  return {
    tabs: [],
    activeTabId: null,

    openTab: (filePath, fileName, password) => {
      const existing = get().tabs.find((t) => t.filePath === filePath);
      if (existing) {
        set({ activeTabId: existing.id });
        saveSession(get().tabs, existing.id);
        return existing.id;
      }

      const tab = createTab(filePath, fileName, password);
      set((s) => {
        const nextTabs = [...s.tabs, tab];
        saveSession(nextTabs, tab.id);
        return { tabs: nextTabs, activeTabId: tab.id };
      });
      return tab.id;
    },

    restoreSession: (savedTabs, savedActiveTabId) => {
      if (!Array.isArray(savedTabs) || savedTabs.length === 0) return;

      // Validate and sanitize each tab
      const restored: TabState[] = savedTabs
        .filter((t) => t && typeof t.filePath === 'string' && typeof t.fileName === 'string')
        .map((t) => ({
          id: typeof t.id === 'string' && t.id ? t.id : uuid(),
          filePath: t.filePath,
          fileName: t.fileName,
          currentPage: typeof t.currentPage === 'number' ? t.currentPage : 1,
          zoom: typeof t.zoom === 'number' ? t.zoom : 1.0,
          fitMode:
            t.fitMode === 'fit-width' ||
            t.fitMode === 'fit-page' ||
            t.fitMode === 'actual' ||
            t.fitMode === 'custom'
              ? t.fitMode
              : 'fit-width',
          viewMode: t.viewMode === 'single' || t.viewMode === 'continuous' ? t.viewMode : 'single',
          rotation: t.rotation === 90 || t.rotation === 180 || t.rotation === 270 ? t.rotation : 0,
          password: typeof t.password === 'string' ? t.password : undefined,
        }));

      if (restored.length === 0) return;

      const validActiveId =
        savedActiveTabId && restored.some((t) => t.id === savedActiveTabId)
          ? savedActiveTabId
          : restored[0].id;

      set({ tabs: restored, activeTabId: validActiveId });
      saveSession(restored, validActiveId);
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
            const newIdx = Math.min(idx, next.length - 1);
            nextActiveId = next[newIdx].id;
          } else {
            nextActiveId = null;
          }
        }

        saveSession(next, nextActiveId);
        return { tabs: next, activeTabId: nextActiveId };
      });
    },

    closeOtherTabs: (tabId) => {
      set((s) => {
        const tabToKeep = s.tabs.find((t) => t.id === tabId);
        if (!tabToKeep) return s;
        saveSession([tabToKeep], tabId);
        return { tabs: [tabToKeep], activeTabId: tabId };
      });
    },

    closeTabsToRight: (tabId) => {
      set((s) => {
        const idx = s.tabs.findIndex((t) => t.id === tabId);
        if (idx === -1) return s;

        const next = s.tabs.slice(0, idx + 1);
        let nextActiveId = s.activeTabId;

        if (idx < s.tabs.findIndex((t) => t.id === s.activeTabId)) {
          nextActiveId = tabId;
        }

        saveSession(next, nextActiveId);
        return { tabs: next, activeTabId: nextActiveId };
      });
    },

    closeAllTabs: () => {
      set({ tabs: [], activeTabId: null });
      saveSession([], null);
    },

    setActiveTab: (tabId) => {
      if (get().tabs.some((t) => t.id === tabId)) {
        set({ activeTabId: tabId });
        saveSession(get().tabs, tabId);
      }
    },

    updateTabState: (tabId, patch) => {
      set((s) => {
        const nextTabs = s.tabs.map((t) => (t.id === tabId ? { ...t, ...patch } : t));
        saveSession(nextTabs, s.activeTabId);
        return { tabs: nextTabs };
      });
    },

    getActiveTab: () => {
      const { tabs, activeTabId } = get();
      return tabs.find((t) => t.id === activeTabId) ?? null;
    },

    getTab: (tabId) => {
      return get().tabs.find((t) => t.id === tabId);
    },
  };
});
