import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';

type DialogName =
  | 'merge'
  | 'split'
  | 'extract'
  | 'delete'
  | 'reorder'
  | 'ocr'
  | 'export'
  | 'password'
  | 'preferences'
  | string;

interface UIState {
  theme: Theme;
  sidebarOpen: boolean;
  sidebarWidth: number;
  sidebarActivePanel: string | null;
  activePageOpsDialog: string | null;
  activeDialog: DialogName | null;
  pageOpsDialogProps: Record<string, unknown>;
  dialogProps: Record<string, unknown>;
  toastMessage: string | null;
  signaturePlacement: { page: number; rect: [number, number, number, number] } | null;
  signaturePlacementMode: boolean;
  signatureFormData: {
    certificatePath: string;
    passphrase: string;
    signerName: string;
    reason: string;
    location: string;
    contact: string;
  };

  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarPanel: (panel: string | null) => void;
  openPageOpsDialog: (name: string, props?: Record<string, unknown>) => void;
  closePageOpsDialog: () => void;
  openDialog: (name: DialogName, props?: Record<string, unknown>) => void;
  closeDialog: () => void;
  showToast: (message: string) => void;
  clearToast: () => void;
  setSignaturePlacement: (
    placement: { page: number; rect: [number, number, number, number] } | null
  ) => void;
  setSignaturePlacementMode: (mode: boolean) => void;
  setSignatureFormData: (data: UIState['signatureFormData']) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useUIStore = create<UIState>((set) => ({
  theme: 'system',
  sidebarOpen: true,
  sidebarWidth: 260,
  sidebarActivePanel: null,
  activePageOpsDialog: null,
  activeDialog: null,
  pageOpsDialogProps: {},
  dialogProps: {},
  toastMessage: null,
  signaturePlacement: null,
  signaturePlacementMode: false,
  signatureFormData: {
    certificatePath: '',
    passphrase: '',
    signerName: '',
    reason: '',
    location: '',
    contact: '',
  },

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

  openPageOpsDialog: (name, props) =>
    set({ activePageOpsDialog: name, pageOpsDialogProps: props ?? {} }),

  closePageOpsDialog: () => set({ activePageOpsDialog: null, pageOpsDialogProps: {} }),

  openDialog: (name, props) => set({ activeDialog: name, dialogProps: props ?? {} }),

  closeDialog: () => set({ activeDialog: null, dialogProps: {} }),

  showToast: (message) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toastMessage: message });
    toastTimer = setTimeout(() => {
      set({ toastMessage: null });
      toastTimer = null;
    }, 4000);
  },

  clearToast: () => {
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = null;
    set({ toastMessage: null });
  },

  setSignaturePlacement: (placement) =>
    set({ signaturePlacement: placement, signaturePlacementMode: false }),
  setSignaturePlacementMode: (mode: boolean) => set({ signaturePlacementMode: mode }),
  setSignatureFormData: (data) => set({ signatureFormData: data }),
}));
