import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Plus, X } from 'lucide-react';
import type { TabState } from '../../stores/document.store';
import { useDocumentStore } from '../../stores/document.store';

interface ContextMenuState {
  tabId: string;
  x: number;
  y: number;
}

interface TabBarProps {
  tabs: TabState[];
  activeTabId: string | null;
  onOpenFile: () => void;
}

export function TabBar({ tabs, activeTabId, onOpenFile }: TabBarProps) {
  const setActiveTab = useDocumentStore((s) => s.setActiveTab);
  const closeTab = useDocumentStore((s) => s.closeTab);
  const closeOtherTabs = useDocumentStore((s) => s.closeOtherTabs);
  const closeTabsToRight = useDocumentStore((s) => s.closeTabsToRight);
  const closeAllTabs = useDocumentStore((s) => s.closeAllTabs);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  useEffect(() => {
    if (!activeTabId) return;
    const el = tabBarRef.current?.querySelector(
      `[data-tab-id="${activeTabId}"]`
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeTabId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === 'Tab') {
        e.preventDefault();
        const currentIdx = tabs.findIndex((t) => t.id === activeTabId);
        if (tabs.length === 0) return;
        const nextIdx = e.shiftKey
          ? (currentIdx - 1 + tabs.length) % tabs.length
          : (currentIdx + 1) % tabs.length;
        setActiveTab(tabs[nextIdx]?.id ?? '');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tabs, activeTabId, setActiveTab]);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [contextMenu]);

  const handleCloseTab = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      e.stopPropagation();
      closeTab(tabId);
    },
    [closeTab]
  );

  const handleContextMenu = useCallback((e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenu({ tabId, x: e.clientX, y: e.clientY });
  }, []);

  if (tabs.length === 0) return null;

  return (
    <div
      ref={tabBarRef}
      className="relative flex h-9 shrink-0 select-none items-end gap-0 overflow-x-auto border-b border-surface-200 bg-surface-50 px-2 dark:border-surface-700 dark:bg-surface-900"
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
            onContextMenu={(e) => handleContextMenu(e, tab.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setActiveTab(tab.id);
              }
            }}
            className={`group mb-[-1px] flex h-8 max-w-[220px] shrink-0 cursor-pointer items-center gap-1.5 rounded-t-lg border px-2.5 text-xs font-medium transition-colors ${
              isActive
                ? 'border-surface-200 border-b-white bg-white text-surface-800 dark:border-surface-700 dark:border-b-surface-900 dark:bg-surface-800 dark:text-surface-100'
                : 'border-transparent text-surface-500 hover:bg-surface-200/60 hover:text-surface-700 dark:text-surface-400 dark:hover:bg-surface-700/60 dark:hover:text-surface-200'
            }`}
          >
            <FileText
              className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-brand-600 dark:text-brand-400' : ''}`}
            />
            <span className="truncate">{tab.fileName}</span>
            <button
              type="button"
              onClick={(e) => handleCloseTab(e, tab.id)}
              className={`ml-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded transition-opacity hover:bg-surface-200 dark:hover:bg-surface-600 ${
                isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
              aria-label={`Close ${tab.fileName}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}

      <button
        type="button"
        onClick={onOpenFile}
        className="mb-1 ml-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-surface-400 hover:bg-surface-200 hover:text-surface-600 dark:hover:bg-surface-700 dark:hover:text-surface-300"
        aria-label="Open new tab"
        title="Open new tab (Ctrl+O)"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-[300] min-w-[180px] rounded-md border border-surface-200 bg-white py-1 shadow-xl shadow-surface-950/15 dark:border-surface-700 dark:bg-surface-900"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-surface-700 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800"
            onClick={() => {
              closeTab(contextMenu.tabId);
              setContextMenu(null);
            }}
          >
            Close
          </button>
          {tabs.length > 1 && (
            <>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-surface-700 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800"
                onClick={() => {
                  closeOtherTabs(contextMenu.tabId);
                  setContextMenu(null);
                }}
              >
                Close Others
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-surface-700 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800"
                onClick={() => {
                  closeTabsToRight(contextMenu.tabId);
                  setContextMenu(null);
                }}
              >
                Close Tabs to the Right
              </button>
              <div className="my-1 border-t border-surface-200 dark:border-surface-700" />
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                onClick={() => {
                  closeAllTabs();
                  setContextMenu(null);
                }}
              >
                Close All
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
