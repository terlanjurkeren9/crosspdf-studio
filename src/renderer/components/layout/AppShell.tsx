import type { ReactNode } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  FileText,
  PanelLeft,
  Settings,
  FileUp,
  ImagePlus,
  FileImage,
  X,
  Undo2,
  Redo2,
  Trash2,
  MousePointer2,
  PanelRight,
  Search,
  MessageSquareText,
  Combine,
  Scissors,
  Copy,
  ArrowLeftRight,
  ScanText,
  FormInput,
  Lock,
  Info,
  Keyboard,
} from 'lucide-react';
import { useUIStore } from '../../stores/ui.store';
import { useDocumentStore } from '../../stores/document.store';
import type { TabState } from '../../stores/document.store';
import { useAnnotationStore } from '../../stores/annotation.store';
import { TabBar } from './TabBar';
import { Sidebar } from '../sidebar/Sidebar';
import { Toast } from '../ui/Toast';
import { MenuDropdown } from '../ui/MenuDropdown';
import type { MenuItem } from '../ui/MenuDropdown';

interface AppShellProps {
  children: ReactNode;
  tabs: TabState[];
  activeTabId: string | null;
  activePdfDocument: PDFDocumentProxy | null;
  activeNumPages: number;
  activeCurrentPage: number;
  searchAutoFocus: boolean;
  hasOpenDocument: boolean;
  onOpenFile: () => void;
  onNavigateToPage: (pageNumber: number) => void;
}

export function AppShell({
  children,
  tabs,
  activeTabId,
  activePdfDocument,
  activeNumPages,
  activeCurrentPage,
  searchAutoFocus,
  hasOpenDocument,
  onOpenFile,
  onNavigateToPage,
}: AppShellProps) {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;
  const hasActiveDocument = Boolean(activeTab);
  const closeTab = useDocumentStore((s) => s.closeTab);
  const setActiveTool = useAnnotationStore((s) => s.setActiveTool);
  const canUndo = useAnnotationStore((s) => (activeTabId ? s.canUndo(activeTabId) : false));
  const canRedo = useAnnotationStore((s) => (activeTabId ? s.canRedo(activeTabId) : false));
  const hasSelection = useAnnotationStore((s) => s.selectedIds.size > 0);

  const uiState = useUIStore;

  const fileMenu: MenuItem[] = [
    { label: 'Open PDF…', shortcut: 'Ctrl+O', icon: <FileUp size={14} />, action: onOpenFile },
    {
      label: 'Images to PDF…',
      icon: <ImagePlus size={14} />,
      action: () => uiState.getState().openDialog('images-to-pdf'),
    },
    {
      label: 'PDF to Images…',
      icon: <FileImage size={14} />,
      disabled: !hasActiveDocument,
      action: () => uiState.getState().openDialog('pdf-to-images'),
    },
    { separator: true },
    {
      label: 'Close Document',
      shortcut: 'Ctrl+W',
      icon: <X size={14} />,
      disabled: !activeTabId,
      action: () => activeTabId && closeTab(activeTabId),
    },
    {
      label: 'Close All',
      disabled: tabs.length === 0,
      action: () => tabs.forEach((tab) => closeTab(tab.id)),
    },
  ];

  const editMenu: MenuItem[] = [
    {
      label: 'Undo',
      shortcut: 'Ctrl+Z',
      icon: <Undo2 size={14} />,
      disabled: !activeTabId || !canUndo,
      action: () => activeTabId && useAnnotationStore.getState().undo(activeTabId),
    },
    {
      label: 'Redo',
      shortcut: 'Ctrl+Shift+Z',
      icon: <Redo2 size={14} />,
      disabled: !activeTabId || !canRedo,
      action: () => activeTabId && useAnnotationStore.getState().redo(activeTabId),
    },
    { separator: true },
    {
      label: 'Delete Selection',
      shortcut: 'Del',
      icon: <Trash2 size={14} />,
      disabled: !activeTabId || !hasSelection,
      danger: true,
      action: () => activeTabId && useAnnotationStore.getState().deleteSelected(activeTabId),
    },
    { separator: true },
    {
      label: 'Select Tool',
      icon: <MousePointer2 size={14} />,
      disabled: !hasActiveDocument,
      action: () => setActiveTool('select'),
    },
  ];

  const viewMenu: MenuItem[] = [
    {
      label: sidebarOpen ? 'Hide Sidebar' : 'Show Sidebar',
      icon: <PanelRight size={14} />,
      action: () => uiState.getState().toggleSidebar(),
    },
    { separator: true },
    {
      label: 'Thumbnails',
      icon: <PanelLeft size={14} />,
      disabled: !hasActiveDocument,
      action: () => uiState.getState().setSidebarPanel('thumbnails'),
    },
    {
      label: 'Search',
      shortcut: 'Ctrl+F',
      icon: <Search size={14} />,
      disabled: !hasActiveDocument,
      action: () => uiState.getState().setSidebarPanel('search'),
    },
    {
      label: 'Comments',
      icon: <MessageSquareText size={14} />,
      disabled: !hasActiveDocument,
      action: () => uiState.getState().setSidebarPanel('comments'),
    },
  ];

  const toolsMenu: MenuItem[] = [
    {
      label: 'Merge PDFs…',
      icon: <Combine size={14} />,
      action: () => uiState.getState().openPageOpsDialog('merge'),
    },
    {
      label: 'Split PDF…',
      icon: <Scissors size={14} />,
      disabled: !hasActiveDocument,
      action: () => uiState.getState().openPageOpsDialog('split'),
    },
    {
      label: 'Extract Pages…',
      icon: <Copy size={14} />,
      disabled: !hasActiveDocument,
      action: () => uiState.getState().openPageOpsDialog('extract'),
    },
    {
      label: 'Reorder Pages…',
      icon: <ArrowLeftRight size={14} />,
      disabled: !hasActiveDocument,
      action: () => uiState.getState().openPageOpsDialog('reorder'),
    },
    { separator: true },
    {
      label: 'OCR…',
      icon: <ScanText size={14} />,
      disabled: !hasActiveDocument,
      action: () => uiState.getState().openDialog('ocr'),
    },
    {
      label: 'Forms…',
      icon: <FormInput size={14} />,
      disabled: !hasActiveDocument,
      action: () => uiState.getState().openDialog('forms'),
    },
    {
      label: 'Password Protection…',
      icon: <Lock size={14} />,
      disabled: !hasActiveDocument,
      action: () => uiState.getState().openDialog('password-protection'),
    },
  ];

  const helpMenu: MenuItem[] = [
    {
      label: 'About CrossPDF Studio',
      icon: <Info size={14} />,
      action: () => uiState.getState().showToast('CrossPDF Studio v0.1.0'),
    },
    {
      label: 'Keyboard Shortcuts',
      icon: <Keyboard size={14} />,
      action: () =>
        uiState.getState().showToast('Ctrl+O Open · Ctrl+W Close · Ctrl+F Search · Ctrl+Z Undo'),
    },
  ];

  return (
    <div className="flex h-full flex-col bg-surface-50 text-surface-800 dark:bg-surface-950 dark:text-surface-200">
      {/* ── Top App Bar ─────────────────────────────────────── */}
      <header className="flex h-11 shrink-0 select-none items-center gap-3 border-b border-surface-200 bg-white px-3 dark:border-surface-800 dark:bg-surface-900">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm shadow-brand-900/20">
            <FileText className="h-4 w-4" />
          </div>
          <h1 className="text-[13px] font-semibold tracking-tight text-surface-800 dark:text-surface-100">
            CrossPDF Studio
          </h1>
        </div>

        {/* Menu bar */}
        <nav className="flex items-center gap-0.5">
          <MenuDropdown label="File" items={fileMenu} />
          <MenuDropdown label="Edit" items={editMenu} />
          <MenuDropdown label="View" items={viewMenu} />
          <MenuDropdown label="Tools" items={toolsMenu} />
          <MenuDropdown label="Help" items={helpMenu} align="right" />
        </nav>

        <div className="flex-1" />

        {/* Right actions */}
        <button
          type="button"
          onClick={() => useUIStore.getState().toggleSidebar()}
          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
            sidebarOpen
              ? 'bg-brand-50 text-brand-600 hover:bg-brand-100 dark:bg-brand-950/60 dark:text-brand-400'
              : 'text-surface-400 hover:bg-surface-100 hover:text-surface-600 dark:hover:bg-surface-800 dark:hover:text-surface-300'
          }`}
          title="Toggle sidebar"
          aria-label="Toggle sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => useUIStore.getState().openDialog('preferences')}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-surface-400 hover:bg-surface-100 hover:text-surface-600 dark:hover:bg-surface-800 dark:hover:text-surface-300"
          title="Preferences"
          aria-label="Preferences"
        >
          <Settings className="h-4 w-4" />
        </button>
      </header>

      {/* ── Tab Bar ────────────────────────────────────────── */}
      <TabBar tabs={tabs} activeTabId={activeTabId} onOpenFile={onOpenFile} />

      {/* ── Main Content Area ──────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          pdfDocument={activePdfDocument}
          numPages={activeNumPages}
          currentPage={activeCurrentPage}
          onNavigateToPage={onNavigateToPage}
          searchAutoFocus={searchAutoFocus}
          activeTabId={activeTabId}
        />

        <main className="flex-1 overflow-hidden bg-surface-100 dark:bg-surface-900">
          {children}
        </main>
      </div>

      {/* ── Status bar (home only) ─────────────────────────── */}
      {!hasOpenDocument && (
        <footer className="flex h-7 shrink-0 items-center border-t border-surface-200 bg-white px-3 dark:border-surface-800 dark:bg-surface-900">
          <span className="text-xs text-surface-400">Ready</span>
        </footer>
      )}

      <Toast />
    </div>
  );
}
