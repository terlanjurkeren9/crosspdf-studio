import { useEffect, useRef } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { ChevronRight, MessageSquareText, Search, Rows3 } from 'lucide-react';
import { useUIStore } from '../../stores/ui.store';
import { ThumbnailPanel } from './ThumbnailPanel';
import { SearchPanel } from './SearchPanel';
import { CommentPanel } from './CommentPanel';

type PanelType = 'thumbnails' | 'search' | 'comments';

interface SidebarProps {
  pdfDocument: PDFDocumentProxy | null;
  numPages: number;
  currentPage: number;
  onNavigateToPage: (pageNumber: number) => void;
  searchAutoFocus?: boolean;
  activeTabId?: string | null;
}

const PANELS: Record<PanelType, { label: string; icon: typeof Rows3 }> = {
  thumbnails: { label: 'Thumbnails', icon: Rows3 },
  search: { label: 'Search', icon: Search },
  comments: { label: 'Comments', icon: MessageSquareText },
};

function RailButton({
  panel,
  activePanel,
  onClick,
}: {
  panel: PanelType;
  activePanel: PanelType | null;
  onClick: () => void;
}) {
  const isActive = activePanel === panel;
  const Icon = PANELS[panel].icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
        isActive
          ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-100 dark:bg-brand-950/60 dark:text-brand-300 dark:ring-brand-900'
          : 'text-surface-500 hover:bg-surface-100 hover:text-surface-900 dark:text-surface-400 dark:hover:bg-surface-800 dark:hover:text-surface-100'
      }`}
      title={PANELS[panel].label}
      aria-label={PANELS[panel].label}
      aria-pressed={isActive}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export function Sidebar({
  pdfDocument,
  numPages,
  currentPage,
  onNavigateToPage,
  searchAutoFocus = false,
  activeTabId,
}: SidebarProps) {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const activePanel = useUIStore((s) => s.sidebarActivePanel);
  const setSidebarPanel = useUIStore((s) => s.setSidebarPanel);

  const lastPanelRef = useRef<PanelType | null>(null);
  const panel = (activePanel as PanelType | null) || null;

  useEffect(() => {
    if (panel) lastPanelRef.current = panel;
  }, [panel]);

  if (!sidebarOpen) {
    return (
      <aside className="h-full shrink-0" style={{ width: 0 }}>
        <button
          type="button"
          onClick={() => setSidebarPanel(lastPanelRef.current || 'thumbnails')}
          className="absolute left-0 top-[90px] z-[90] flex h-8 w-7 items-center justify-center rounded-r-md border border-l-0 border-surface-200 bg-white text-surface-500 shadow-sm hover:text-surface-900 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-400 dark:hover:text-surface-100"
          title="Show sidebar"
          aria-label="Show sidebar"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex h-full shrink-0 border-r border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-950">
      <div className="flex w-12 flex-col items-center gap-1 border-r border-surface-200 px-1.5 py-2 dark:border-surface-800">
        {(Object.keys(PANELS) as PanelType[]).map((p) => (
          <RailButton key={p} panel={p} activePanel={panel} onClick={() => setSidebarPanel(p)} />
        ))}
        <div className="flex-1" />
      </div>

      {panel && (
        <div
          className="flex h-full flex-col bg-surface-50 transition-[width] dark:bg-surface-950"
          style={{ width: Math.max(220, sidebarWidth - 48) }}
        >
          <div className="flex h-10 shrink-0 items-center border-b border-surface-200 px-3 dark:border-surface-800">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-surface-500">
              {PANELS[panel].label}
            </h2>
          </div>

          <div className="min-w-0 flex-1 overflow-hidden">
            {panel === 'thumbnails' && pdfDocument && (
              <ThumbnailPanel
                key={activeTabId ?? 'no-tab'}
                pdfDocument={pdfDocument}
                numPages={numPages}
                currentPage={currentPage}
                onPageClick={onNavigateToPage}
              />
            )}
            {panel === 'thumbnails' && !pdfDocument && (
              <div className="p-3 text-xs text-surface-500">Open a document to view pages.</div>
            )}

            {panel === 'search' && (
              <SearchPanel
                pdfDocument={pdfDocument}
                numPages={numPages}
                onNavigateToPage={onNavigateToPage}
                autoFocus={searchAutoFocus}
              />
            )}

            {panel === 'comments' && (
              <CommentPanel tabId={activeTabId ?? null} onNavigateToPage={onNavigateToPage} />
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
