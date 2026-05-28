import { useEffect, useRef } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { ChevronRight, MessageSquareText, Search, LayoutGrid } from 'lucide-react';
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

const PANELS: Record<PanelType, { label: string; icon: typeof LayoutGrid }> = {
  thumbnails: { label: 'Pages', icon: LayoutGrid },
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
      className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-150 ${
        isActive
          ? 'bg-brand-50 text-brand-600 ring-1 ring-brand-200 shadow-sm dark:bg-brand-950/60 dark:text-brand-400 dark:ring-brand-800'
          : 'text-surface-400 hover:bg-surface-100 hover:text-surface-600 dark:text-surface-500 dark:hover:bg-surface-800 dark:hover:text-surface-300'
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
          className="absolute left-0 top-[104px] z-[90] flex h-8 w-6 items-center justify-center rounded-r-lg border border-l-0 border-surface-200 bg-white text-surface-400 shadow-sm hover:text-surface-600 dark:border-surface-700 dark:bg-surface-800 dark:hover:text-surface-300"
          title="Show sidebar"
          aria-label="Show sidebar"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex h-full shrink-0 border-r border-surface-200 bg-white dark:border-surface-700 dark:bg-surface-900">
      {/* Rail */}
      <div className="flex w-11 flex-col items-center gap-1.5 border-r border-surface-200 px-1.5 py-3 dark:border-surface-700">
        {(Object.keys(PANELS) as PanelType[]).map((p) => (
          <RailButton key={p} panel={p} activePanel={panel} onClick={() => setSidebarPanel(p)} />
        ))}
        <div className="flex-1" />
      </div>

      {/* Panel content */}
      {panel && (
        <div
          className="flex h-full flex-col bg-surface-50/80 transition-[width] dark:bg-surface-900/80"
          style={{ width: Math.max(220, sidebarWidth - 44) }}
        >
          <div className="flex h-10 shrink-0 items-center border-b border-surface-200 px-3.5 dark:border-surface-700">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-surface-400">
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
              <div className="p-4 text-xs text-surface-400">
                Open a document to view thumbnails.
              </div>
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
