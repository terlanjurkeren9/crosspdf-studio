import { describe, it, expect, beforeEach } from 'vitest';
import { useDocumentStore } from '../src/renderer/stores/document.store';

describe('Document Store', () => {
  beforeEach(() => {
    useDocumentStore.setState({
      tabs: [],
      activeTabId: null,
    });
  });

  describe('openTab', () => {
    it('creates a new tab and sets it as active', () => {
      const id = useDocumentStore.getState().openTab('/path/file.pdf', 'file.pdf');
      const state = useDocumentStore.getState();

      expect(state.tabs).toHaveLength(1);
      expect(state.tabs[0]!.id).toBe(id);
      expect(state.tabs[0]!.filePath).toBe('/path/file.pdf');
      expect(state.tabs[0]!.fileName).toBe('file.pdf');
      expect(state.tabs[0]!.currentPage).toBe(1);
      expect(state.tabs[0]!.fitMode).toBe('fit-width');
      expect(state.tabs[0]!.viewMode).toBe('single');
      expect(state.activeTabId).toBe(id);
    });

    it('reuses existing tab for same file path', () => {
      const id1 = useDocumentStore.getState().openTab('/path/file.pdf', 'file.pdf');
      const id2 = useDocumentStore.getState().openTab('/path/file.pdf', 'file.pdf');

      expect(id2).toBe(id1);
      expect(useDocumentStore.getState().tabs).toHaveLength(1);
    });

    it('creates separate tabs for different files', () => {
      useDocumentStore.getState().openTab('/path/a.pdf', 'a.pdf');
      useDocumentStore.getState().openTab('/path/b.pdf', 'b.pdf');

      expect(useDocumentStore.getState().tabs).toHaveLength(2);
    });

    it('sets the new tab as active when opening different file', () => {
      const id1 = useDocumentStore.getState().openTab('/path/a.pdf', 'a.pdf');
      const id2 = useDocumentStore.getState().openTab('/path/b.pdf', 'b.pdf');

      expect(useDocumentStore.getState().activeTabId).toBe(id2);
      expect(useDocumentStore.getState().activeTabId).not.toBe(id1);
    });
  });

  describe('closeTab', () => {
    it('removes the tab', () => {
      const id1 = useDocumentStore.getState().openTab('/path/a.pdf', 'a.pdf');
      const id2 = useDocumentStore.getState().openTab('/path/b.pdf', 'b.pdf');

      useDocumentStore.getState().closeTab(id1);
      expect(useDocumentStore.getState().tabs).toHaveLength(1);
      expect(useDocumentStore.getState().tabs[0]!.id).toBe(id2);
    });

    it('activates next tab when closing active tab', () => {
      const id1 = useDocumentStore.getState().openTab('/path/a.pdf', 'a.pdf');
      const id2 = useDocumentStore.getState().openTab('/path/b.pdf', 'b.pdf');

      // id2 is currently active
      useDocumentStore.getState().closeTab(id2);
      expect(useDocumentStore.getState().activeTabId).toBe(id1);
    });

    it('sets activeTabId to null when closing last tab', () => {
      const id = useDocumentStore.getState().openTab('/path/a.pdf', 'a.pdf');
      useDocumentStore.getState().closeTab(id);

      expect(useDocumentStore.getState().tabs).toHaveLength(0);
      expect(useDocumentStore.getState().activeTabId).toBeNull();
    });

    it('does nothing for unknown tab id', () => {
      useDocumentStore.getState().openTab('/path/a.pdf', 'a.pdf');
      useDocumentStore.getState().closeTab('nonexistent');

      expect(useDocumentStore.getState().tabs).toHaveLength(1);
    });
  });

  describe('setActiveTab', () => {
    it('switches active tab', () => {
      const id1 = useDocumentStore.getState().openTab('/path/a.pdf', 'a.pdf');
      useDocumentStore.getState().openTab('/path/b.pdf', 'b.pdf');

      // b.pdf is currently active, switch to a.pdf
      useDocumentStore.getState().setActiveTab(id1);
      expect(useDocumentStore.getState().activeTabId).toBe(id1);
    });

    it('does nothing for unknown tab id', () => {
      const id = useDocumentStore.getState().openTab('/path/a.pdf', 'a.pdf');
      useDocumentStore.getState().setActiveTab('nonexistent');

      expect(useDocumentStore.getState().activeTabId).toBe(id);
    });
  });

  describe('updateTabState', () => {
    it('updates tab state partially', () => {
      const id = useDocumentStore.getState().openTab('/path/a.pdf', 'a.pdf');

      useDocumentStore.getState().updateTabState(id, {
        currentPage: 5,
        zoom: 1.5,
      });

      const tab = useDocumentStore.getState().getTab(id);
      expect(tab?.currentPage).toBe(5);
      expect(tab?.zoom).toBe(1.5);
      // Unchanged fields
      expect(tab?.fitMode).toBe('fit-width');
      expect(tab?.viewMode).toBe('single');
    });

    it('does nothing for unknown tab id', () => {
      useDocumentStore.getState().openTab('/path/a.pdf', 'a.pdf');
      useDocumentStore.getState().updateTabState('nonexistent', { currentPage: 10 });

      expect(useDocumentStore.getState().tabs[0]!.currentPage).toBe(1);
    });

    it('stores password via updateTabState after apply-password', () => {
      const id = useDocumentStore.getState().openTab('/path/a.pdf', 'a.pdf');
      expect(useDocumentStore.getState().getTab(id)?.password).toBeUndefined();

      useDocumentStore.getState().updateTabState(id, { password: 'secret' });
      expect(useDocumentStore.getState().getTab(id)?.password).toBe('secret');
    });

    it('clears password via updateTabState after remove-password', () => {
      const id = useDocumentStore.getState().openTab('/path/a.pdf', 'a.pdf', 'initial');
      expect(useDocumentStore.getState().getTab(id)?.password).toBe('initial');

      useDocumentStore.getState().updateTabState(id, { password: undefined });
      expect(useDocumentStore.getState().getTab(id)?.password).toBeUndefined();
    });
  });

  describe('getActiveTab', () => {
    it('returns active tab', () => {
      const id = useDocumentStore.getState().openTab('/path/a.pdf', 'a.pdf');
      const active = useDocumentStore.getState().getActiveTab();

      expect(active).not.toBeNull();
      expect(active!.id).toBe(id);
    });

    it('returns null when no tabs', () => {
      expect(useDocumentStore.getState().getActiveTab()).toBeNull();
    });
  });

  describe('getTab', () => {
    it('returns tab by id', () => {
      const id = useDocumentStore.getState().openTab('/path/a.pdf', 'a.pdf');
      const tab = useDocumentStore.getState().getTab(id);

      expect(tab).toBeDefined();
      expect(tab!.filePath).toBe('/path/a.pdf');
    });

    it('returns undefined for unknown id', () => {
      expect(useDocumentStore.getState().getTab('nonexistent')).toBeUndefined();
    });
  });
});
