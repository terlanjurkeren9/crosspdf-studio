import type { ReactNode } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { FileText, PanelLeft, Settings } from 'lucide-react';
import { useUIStore } from '../../stores/ui.store';
import type { TabState } from '../../stores/document.store';
import { TabBar } from './TabBar';
import { Sidebar } from '../sidebar/Sidebar';
import { Toast } from '../ui/Toast';

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

  return (
    <div className="flex h-full flex-col bg-surface-50 text-surface-900 dark:bg-surface-950 dark:text-surface-100">
      <header className="flex h-10 shrink-0 select-none items-center border-b border-surface-200 bg-white px-3 dark:border-surface-800 dark:bg-surface-950">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-600 text-white shadow-sm shadow-brand-900/20">
            <FileText className="h-3.5 w-3.5" />
          </div>
          <h1 className="text-sm font-semibold text-surface-900 dark:text-surface-100">
            CrossPDF Studio
          </h1>
        </div>

        <nav className="ml-6 flex items-center gap-1 text-[12px] font-medium text-surface-600 dark:text-surface-400">
          {['File', 'Edit', 'View', 'Tools', 'Help'].map((item) => (
            <button
              key={item}
              type="button"
              className="rounded px-2 py-1 hover:bg-surface-100 hover:text-surface-950 dark:hover:bg-surface-800 dark:hover:text-surface-100"
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="flex-1" />
        <button
          type="button"
          onClick={() => useUIStore.getState().toggleSidebar()}
          className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${
            sidebarOpen
              ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300'
              : 'text-surface-500 hover:bg-surface-100 hover:text-surface-900 dark:hover:bg-surface-800 dark:hover:text-surface-100'
          }`}
          title="Toggle sidebar"
          aria-label="Toggle sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => useUIStore.getState().openDialog('preferences')}
          className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-surface-500 hover:bg-surface-100 hover:text-surface-900 dark:text-surface-400 dark:hover:bg-surface-800 dark:hover:text-surface-100"
          title="Preferences"
          aria-label="Preferences"
        >
          <Settings className="h-4 w-4" />
        </button>
      </header>

      <TabBar tabs={tabs} activeTabId={activeTabId} onOpenFile={onOpenFile} />

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

      {!hasOpenDocument && (
        <footer className="flex h-6 shrink-0 items-center border-t border-surface-200 bg-white px-3 dark:border-surface-800 dark:bg-surface-950">
          <span className="text-xs text-surface-500">Ready</span>
        </footer>
      )}

      <Toast />
    </div>
  );
}
