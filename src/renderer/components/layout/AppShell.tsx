import type { ReactNode } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useUIStore } from '../../stores/ui.store';
import type { TabState } from '../../stores/document.store';
import { TabBar } from './TabBar';
import { Sidebar } from '../sidebar/Sidebar';

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
    <div className="h-full flex flex-col bg-surface-50 dark:bg-surface-950">
      {/* TitleBar */}
      <header className="h-10 flex items-center px-4 bg-surface-100 dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800 select-none shrink-0">
        <h1 className="text-sm font-semibold text-surface-700 dark:text-surface-300">
          CrossPDF Studio
        </h1>

        {/* Sidebar toggle */}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => useUIStore.getState().toggleSidebar()}
          className={`p-1 rounded text-xs ${
            sidebarOpen
              ? 'text-brand-600 dark:text-brand-400'
              : 'text-surface-400 hover:text-surface-600'
          }`}
          title="Toggle sidebar"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
          </svg>
        </button>
      </header>

      {/* Tab bar */}
      <TabBar tabs={tabs} activeTabId={activeTabId} onOpenFile={onOpenFile} />

      {/* Main: Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          pdfDocument={activePdfDocument}
          numPages={activeNumPages}
          currentPage={activeCurrentPage}
          onNavigateToPage={onNavigateToPage}
          searchAutoFocus={searchAutoFocus}
        />

        <main className="flex-1 overflow-hidden">{children}</main>
      </div>

      {/* Status bar — only on home screen */}
      {!hasOpenDocument && (
        <footer className="h-6 flex items-center px-3 bg-surface-100 dark:bg-surface-900 border-t border-surface-200 dark:border-surface-800 shrink-0">
          <span className="text-xs text-surface-400">Ready</span>
        </footer>
      )}
    </div>
  );
}
