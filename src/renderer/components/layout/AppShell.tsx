import { useCallback } from 'react';
import type { ReactNode } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useTranslation } from 'react-i18next';
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
  TextCursorInput,
  Lock,
  Info,
  Keyboard,
  PenTool,
  DownloadCloud,
  GitCompare,
  Layers,
  ShieldCheck,
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
  onOpenFilePath?: (filePath: string) => void;
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
  onOpenFilePath,
  onNavigateToPage,
}: AppShellProps) {
  const { t } = useTranslation();
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer.files?.[0];
      const electronFile = file as File & { path?: string };
      if (electronFile && typeof electronFile.path === 'string') {
        const filePath = electronFile.path;
        if (filePath.toLowerCase().endsWith('.pdf')) {
          onOpenFilePath?.(filePath);
        }
      }
    },
    [onOpenFilePath]
  );

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;
  const hasActiveDocument = Boolean(activeTab);
  const closeTab = useDocumentStore((s) => s.closeTab);
  const setActiveTool = useAnnotationStore((s) => s.setActiveTool);
  const canUndo = useAnnotationStore((s) => (activeTabId ? s.canUndo(activeTabId) : false));
  const canRedo = useAnnotationStore((s) => (activeTabId ? s.canRedo(activeTabId) : false));
  const hasSelection = useAnnotationStore((s) => s.selectedIds.size > 0);

  const uiState = useUIStore;

  const fileMenu: MenuItem[] = [
    {
      label: t('menu.openPdf'),
      shortcut: 'Ctrl+O',
      icon: <FileUp size={14} />,
      action: onOpenFile,
    },
    {
      label: t('menu.imagesToPdf'),
      icon: <ImagePlus size={14} />,
      action: () => uiState.getState().openDialog('images-to-pdf'),
    },
    {
      label: t('menu.pdfToImages'),
      icon: <FileImage size={14} />,
      disabled: !hasActiveDocument,
      action: () => uiState.getState().openDialog('pdf-to-images'),
    },
    { separator: true },
    {
      label: t('menu.closeDocument'),
      shortcut: 'Ctrl+W',
      icon: <X size={14} />,
      disabled: !activeTabId,
      action: () => activeTabId && closeTab(activeTabId),
    },
    {
      label: t('menu.closeAll'),
      disabled: tabs.length === 0,
      action: () => tabs.forEach((tab) => closeTab(tab.id)),
    },
  ];

  const editMenu: MenuItem[] = [
    {
      label: t('menu.undo'),
      shortcut: 'Ctrl+Z',
      icon: <Undo2 size={14} />,
      disabled: !activeTabId || !canUndo,
      action: () => activeTabId && useAnnotationStore.getState().undo(activeTabId),
    },
    {
      label: t('menu.redo'),
      shortcut: 'Ctrl+Shift+Z',
      icon: <Redo2 size={14} />,
      disabled: !activeTabId || !canRedo,
      action: () => activeTabId && useAnnotationStore.getState().redo(activeTabId),
    },
    { separator: true },
    {
      label: t('menu.deleteSelection'),
      shortcut: 'Del',
      icon: <Trash2 size={14} />,
      disabled: !activeTabId || !hasSelection,
      danger: true,
      action: () => activeTabId && useAnnotationStore.getState().deleteSelected(activeTabId),
    },
    { separator: true },
    {
      label: t('menu.selectTool'),
      icon: <MousePointer2 size={14} />,
      disabled: !hasActiveDocument,
      action: () => setActiveTool('select'),
    },
  ];

  const viewMenu: MenuItem[] = [
    {
      label: sidebarOpen ? t('menu.hideSidebar') : t('menu.showSidebar'),
      icon: <PanelRight size={14} />,
      action: () => uiState.getState().toggleSidebar(),
    },
    { separator: true },
    {
      label: t('menu.thumbnails'),
      icon: <PanelLeft size={14} />,
      disabled: !hasActiveDocument,
      action: () => uiState.getState().setSidebarPanel('thumbnails'),
    },
    {
      label: t('menu.search'),
      shortcut: 'Ctrl+F',
      icon: <Search size={14} />,
      disabled: !hasActiveDocument,
      action: () => uiState.getState().setSidebarPanel('search'),
    },
    {
      label: t('menu.comments'),
      icon: <MessageSquareText size={14} />,
      disabled: !hasActiveDocument,
      action: () => uiState.getState().setSidebarPanel('comments'),
    },
  ];

  const toolsMenu: MenuItem[] = [
    {
      label: t('menu.mergePdfs'),
      icon: <Combine size={14} />,
      action: () => uiState.getState().openPageOpsDialog('merge'),
    },
    {
      label: t('menu.splitPdf'),
      icon: <Scissors size={14} />,
      disabled: !hasActiveDocument,
      action: () => uiState.getState().openPageOpsDialog('split'),
    },
    {
      label: t('menu.extractPages'),
      icon: <Copy size={14} />,
      disabled: !hasActiveDocument,
      action: () => uiState.getState().openPageOpsDialog('extract'),
    },
    {
      label: t('menu.reorderPages'),
      icon: <ArrowLeftRight size={14} />,
      disabled: !hasActiveDocument,
      action: () => uiState.getState().openPageOpsDialog('reorder'),
    },
    { separator: true },
    {
      label: t('menu.ocr'),
      icon: <ScanText size={14} />,
      disabled: !hasActiveDocument,
      action: () => uiState.getState().openDialog('ocr'),
    },
    {
      label: t('menu.forms'),
      icon: <FormInput size={14} />,
      disabled: !hasActiveDocument,
      action: () => uiState.getState().openDialog('forms'),
    },
    {
      label: t('menu.createFormField'),
      icon: <TextCursorInput size={14} />,
      disabled: !hasActiveDocument,
      action: () => useAnnotationStore.getState().setActiveTool('form-field'),
    },
    {
      label: t('menu.passwordProtection'),
      icon: <Lock size={14} />,
      disabled: !hasActiveDocument,
      action: () => uiState.getState().openDialog('password-protection'),
    },
    {
      label: t('menu.digitalSignature'),
      icon: <PenTool size={14} />,
      disabled: !hasActiveDocument,
      action: () => uiState.getState().openDialog('signature'),
    },
    { separator: true },
    {
      label: t('menu.compare', 'Compare Documents'),
      icon: <GitCompare size={14} />,
      action: () => uiState.getState().openDialog('compare'),
    },
    {
      label: t('menu.batch', 'Batch Processing'),
      icon: <Layers size={14} />,
      action: () => uiState.getState().openDialog('batch'),
    },
    {
      label: t('menu.validate', 'Validate PDF'),
      icon: <ShieldCheck size={14} />,
      action: () => uiState.getState().openDialog('validate'),
    },
  ];

  const helpMenu: MenuItem[] = [
    {
      label: t('menu.about'),
      icon: <Info size={14} />,
      action: () => uiState.getState().showToast('CrossPDF Studio v0.1.0'),
    },
    {
      label: t('menu.keyboardShortcuts'),
      icon: <Keyboard size={14} />,
      action: () =>
        uiState.getState().showToast('Ctrl+O Open · Ctrl+W Close · Ctrl+F Search · Ctrl+Z Undo'),
    },
    { separator: true },
    {
      label: t('update.checkForUpdates'),
      icon: <DownloadCloud size={14} />,
      action: async () => {
        try {
          const result = await window.crosspdf.checkForUpdates();
          const s = result.state;
          if (s.status === 'not-available') {
            uiState.getState().showToast(t('update.upToDate'));
          } else if (s.status === 'available') {
            uiState.getState().showToast(t('update.available', { version: s.version }));
          } else if (s.status === 'error') {
            uiState.getState().showToast(t('update.error'));
          }
        } catch {
          uiState.getState().showToast(t('update.error'));
        }
      },
    },
  ];

  return (
    <div
      className="flex h-full flex-col bg-surface-50 text-surface-800 dark:bg-surface-950 dark:text-surface-200"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
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
          <MenuDropdown label={t('menu.file')} items={fileMenu} />
          <MenuDropdown label={t('menu.edit')} items={editMenu} />
          <MenuDropdown label={t('menu.view')} items={viewMenu} />
          <MenuDropdown label={t('menu.tools')} items={toolsMenu} />
          <MenuDropdown label={t('menu.help')} items={helpMenu} align="right" />
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
          title={t('menu.toggleSidebar')}
          aria-label={t('menu.toggleSidebar')}
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => useUIStore.getState().openDialog('preferences')}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-surface-400 hover:bg-surface-100 hover:text-surface-600 dark:hover:bg-surface-800 dark:hover:text-surface-300"
          title={t('preferences.title')}
          aria-label={t('preferences.title')}
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
          <span className="text-xs text-surface-400">{t('common.ready')}</span>
        </footer>
      )}

      <Toast />
    </div>
  );
}
