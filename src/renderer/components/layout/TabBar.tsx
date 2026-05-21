import { useCallback, useEffect, useRef } from 'react';
import type { TabState } from '../../stores/document.store';
import { useDocumentStore } from '../../stores/document.store';

interface TabBarProps {
  tabs: TabState[];
  activeTabId: string | null;
  onOpenFile: () => void;
}

export function TabBar({ tabs, activeTabId, onOpenFile }: TabBarProps) {
  const setActiveTab = useDocumentStore((s) => s.setActiveTab);
  const closeTab = useDocumentStore((s) => s.closeTab);
  const tabBarRef = useRef<HTMLDivElement>(null);

  // Scroll active tab into view
  useEffect(() => {
    if (!activeTabId) return;
    const el = tabBarRef.current?.querySelector(
      `[data-tab-id="${activeTabId}"]`
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeTabId]);

  // Keyboard shortcuts: Ctrl+Tab / Ctrl+Shift+Tab
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === 'Tab') {
        e.preventDefault();
        const currentIdx = tabs.findIndex((t) => t.id === activeTabId);
        if (e.shiftKey) {
          const prev = (currentIdx - 1 + tabs.length) % tabs.length;
          setActiveTab(tabs[prev]?.id ?? '');
        } else {
          const next = (currentIdx + 1) % tabs.length;
          setActiveTab(tabs[next]?.id ?? '');
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tabs, activeTabId, setActiveTab]);

  const handleCloseTab = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      e.stopPropagation();
      closeTab(tabId);
    },
    [closeTab]
  );

  if (tabs.length === 0) return null;

  return (
    <div
      ref={tabBarRef}
      className="h-9 flex items-center gap-0 px-1 bg-surface-100 dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800 overflow-x-auto shrink-0 select-none"
      role="tablist"
      aria-label="Open documents"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            data-tab-id={tab.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={0}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setActiveTab(tab.id);
              }
            }}
            className={`group flex items-center gap-1 h-7 px-2 text-xs cursor-pointer rounded-t border-x border-t transition-colors shrink-0 max-w-[180px] ${
              isActive
                ? 'bg-white dark:bg-surface-950 border-surface-200 dark:border-surface-700 text-surface-900 dark:text-surface-100'
                : 'border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 hover:bg-surface-200/50 dark:hover:bg-surface-800/50'
            }`}
          >
            <span className="truncate">{tab.fileName}</span>
            <button
              type="button"
              onClick={(e) => handleCloseTab(e, tab.id)}
              className={`shrink-0 p-0.5 rounded-sm transition-opacity hover:bg-surface-200 dark:hover:bg-surface-700 ${
                isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
              aria-label={`Close ${tab.fileName}`}
            >
              <svg
                className="w-3 h-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}

      {/* New tab button */}
      <button
        type="button"
        onClick={onOpenFile}
        className="shrink-0 ml-1 p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
        aria-label="Open new tab"
        title="Open new tab (Ctrl+O)"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
        </svg>
      </button>
    </div>
  );
}
