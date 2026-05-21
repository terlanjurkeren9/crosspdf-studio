import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '../src/renderer/stores/ui.store';

describe('UI Store', () => {
  beforeEach(() => {
    useUIStore.setState({
      theme: 'system',
      sidebarOpen: true,
      sidebarWidth: 260,
      sidebarActivePanel: null,
    });
  });

  describe('theme', () => {
    it('defaults to system', () => {
      expect(useUIStore.getState().theme).toBe('system');
    });

    it('setTheme changes theme', () => {
      useUIStore.getState().setTheme('dark');
      expect(useUIStore.getState().theme).toBe('dark');
    });

    it('setTheme to light', () => {
      useUIStore.getState().setTheme('light');
      expect(useUIStore.getState().theme).toBe('light');
    });
  });

  describe('sidebar', () => {
    it('defaults to open', () => {
      expect(useUIStore.getState().sidebarOpen).toBe(true);
    });

    it('toggleSidebar: rail → hidden', () => {
      // Start: rail (sidebarOpen=true, panel=null)
      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().sidebarOpen).toBe(false);
      expect(useUIStore.getState().sidebarActivePanel).toBeNull();
    });

    it('toggleSidebar: expanded → rail', () => {
      // Start: expanded panel
      useUIStore.setState({ sidebarActivePanel: 'thumbnails', sidebarOpen: true });
      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().sidebarOpen).toBe(true);
      expect(useUIStore.getState().sidebarActivePanel).toBeNull();
    });

    it('toggleSidebar: hidden → rail', () => {
      // Start: hidden
      useUIStore.setState({ sidebarOpen: false, sidebarActivePanel: null });
      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().sidebarOpen).toBe(true);
      expect(useUIStore.getState().sidebarActivePanel).toBeNull();
    });

    it('setSidebarOpen sets explicit value', () => {
      useUIStore.getState().setSidebarOpen(false);
      expect(useUIStore.getState().sidebarOpen).toBe(false);
    });

    it('default sidebar width is 260', () => {
      expect(useUIStore.getState().sidebarWidth).toBe(260);
    });

    describe('setSidebarPanel', () => {
      it('sets panel and opens sidebar', () => {
        useUIStore.getState().setSidebarOpen(false);
        useUIStore.getState().setSidebarPanel('thumbnails');
        expect(useUIStore.getState().sidebarActivePanel).toBe('thumbnails');
        expect(useUIStore.getState().sidebarOpen).toBe(true);
      });

      it('toggles panel to null on same panel click', () => {
        useUIStore.getState().setSidebarPanel('thumbnails');
        expect(useUIStore.getState().sidebarActivePanel).toBe('thumbnails');

        useUIStore.getState().setSidebarPanel('thumbnails');
        expect(useUIStore.getState().sidebarActivePanel).toBe(null);
      });

      it('switches between panels', () => {
        useUIStore.getState().setSidebarPanel('thumbnails');
        useUIStore.getState().setSidebarPanel('search');
        expect(useUIStore.getState().sidebarActivePanel).toBe('search');
        expect(useUIStore.getState().sidebarOpen).toBe(true);
      });
    });
  });
});
