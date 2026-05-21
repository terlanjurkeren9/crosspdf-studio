import { useEffect, useRef } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useUIStore } from '../../stores/ui.store';
import { ThumbnailPanel } from './ThumbnailPanel';
import { SearchPanel } from './SearchPanel';

type PanelType = 'thumbnails' | 'search';

interface SidebarProps {
  pdfDocument: PDFDocumentProxy | null;
  numPages: number;
  currentPage: number;
  onNavigateToPage: (pageNumber: number) => void;
  searchAutoFocus?: boolean;
}

const PANEL_LABELS: Record<PanelType, string> = {
  thumbnails: 'Thumbnails',
  search: 'Search',
};

function TabButton({
  panel,
  activePanel,
  onClick,
}: {
  panel: PanelType;
  activePanel: PanelType | null;
  onClick: () => void;
}) {
  const isActive = activePanel === panel;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 h-7 text-xs font-medium rounded transition-colors ${
        isActive
          ? 'bg-white dark:bg-surface-900 text-brand-600 dark:text-brand-400 shadow-sm'
          : 'text-surface-500 hover:bg-surface-200 hover:text-surface-700 dark:hover:bg-surface-800 dark:hover:text-surface-300'
      }`}
      aria-pressed={isActive}
    >
      {PANEL_LABELS[panel]}
    </button>
  );
}

export function Sidebar({
  pdfDocument,
  numPages,
  currentPage,
  onNavigateToPage,
  searchAutoFocus = false,
}: SidebarProps) {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const activePanel = useUIStore((s) => s.sidebarActivePanel);
  const setSidebarPanel = useUIStore((s) => s.setSidebarPanel);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  // Remember last active panel so >>> can restore it
  const lastPanelRef = useRef<PanelType | null>(null);
  const panel = (activePanel as PanelType | null) || null;

  useEffect(() => {
    if (panel) {
      lastPanelRef.current = panel;
    }
  }, [panel]);

  if (!sidebarOpen) return null;

  // ── Collapsed strip ──────────────────────────────────────────
  if (panel === null) {
    return (
      <aside
        className="h-full flex flex-col items-center bg-surface-50 dark:bg-surface-950 border-r border-surface-200 dark:border-surface-800 shrink-0"
        style={{ width: 44 }}
      >
        <button
          type="button"
          onClick={() => {
            setSidebarPanel(lastPanelRef.current || 'thumbnails');
          }}
          className="mt-2 p-1.5 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-500"
          title="Expand sidebar"
          aria-label="Expand sidebar"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      </aside>
    );
  }

  // ── Expanded panel ───────────────────────────────────────────
  return (
    <aside
      className="h-full flex flex-col bg-surface-50 dark:bg-surface-950 border-r border-surface-200 dark:border-surface-800 shrink-0 transition-[width]"
      style={{ width: sidebarWidth }}
    >
      {/* Tab bar + collapse button */}
      <div className="flex items-center h-9 shrink-0 border-b border-surface-200 dark:border-surface-800 bg-surface-100 dark:bg-surface-900 px-1 gap-0.5">
        {(Object.keys(PANEL_LABELS) as PanelType[]).map((p) => (
          <TabButton key={p} panel={p} activePanel={panel} onClick={() => setSidebarPanel(p)} />
        ))}
        <div className="flex-1" />
        <button
          type="button"
          onClick={toggleSidebar}
          className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-500"
          title="Collapse sidebar"
          aria-label="Collapse sidebar"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Panel content */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {panel === 'thumbnails' && pdfDocument && (
          <ThumbnailPanel
            pdfDocument={pdfDocument}
            numPages={numPages}
            currentPage={currentPage}
            onPageClick={onNavigateToPage}
          />
        )}
        {panel === 'thumbnails' && !pdfDocument && (
          <div className="p-3 text-xs text-surface-400">Open a document to view thumbnails</div>
        )}

        {panel === 'search' && (
          <SearchPanel
            pdfDocument={pdfDocument}
            numPages={numPages}
            onNavigateToPage={onNavigateToPage}
            autoFocus={searchAutoFocus}
          />
        )}
      </div>
    </aside>
  );
}
