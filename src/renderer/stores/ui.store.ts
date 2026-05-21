import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';

interface UIState {
  theme: Theme;
  sidebarOpen: boolean;
  sidebarWidth: number;
  sidebarActivePanel: string | null;

  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarPanel: (panel: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  theme: 'system',
  sidebarOpen: true,
  sidebarWidth: 260,
  sidebarActivePanel: null,

  setTheme: (theme) => set({ theme }),

  // 3-state cycle: expanded panel → rail → hidden → rail
  toggleSidebar: () =>
    set((s) => {
      if (s.sidebarActivePanel !== null) {
        // Panel expanded → collapse to rail
        return { sidebarActivePanel: null, sidebarOpen: true };
      }
      if (s.sidebarOpen) {
        // Rail → hide
        return { sidebarOpen: false };
      }
      // Hidden → show rail
      return { sidebarOpen: true, sidebarActivePanel: null };
    }),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  setSidebarPanel: (panel) =>
    set((s) => ({
      sidebarActivePanel: s.sidebarActivePanel === panel ? null : panel,
      sidebarOpen: true,
    })),
}));
