import { useCallback, useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { ThumbnailItem } from './ThumbnailItem';
import { useUIStore } from '../../stores/ui.store';

interface ThumbnailPanelProps {
  pdfDocument: PDFDocumentProxy;
  numPages: number;
  currentPage: number;
  onPageClick: (pageNumber: number) => void;
}

type ContextMenuState = {
  pageNumber: number;
  x: number;
  y: number;
} | null;

export function ThumbnailPanel({
  pdfDocument,
  numPages,
  currentPage,
  onPageClick,
}: ThumbnailPanelProps) {
  const activeRef = useRef<HTMLDivElement>(null);
  const documentKey = pdfDocument.fingerprints?.join(':') ?? 'document';
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);

  // Scroll active thumbnail into view when currentPage changes
  useEffect(() => {
    const el = activeRef.current;
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [currentPage]);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [contextMenu]);

  const handleSelectToggle = useCallback(
    (pageNumber: number, shiftKey: boolean) => {
      setSelectedPages((prev) => {
        const next = new Set(prev);

        if (shiftKey && prev.size > 0) {
          // Range select
          const min = Math.min(...Array.from(prev));
          const max = Math.max(...Array.from(prev));
          const start = Math.min(min, pageNumber);
          const end = Math.max(max, pageNumber);
          for (let p = start; p <= end; p++) {
            next.add(p);
          }
        } else if (next.has(pageNumber)) {
          next.delete(pageNumber);
        } else {
          next.add(pageNumber);
        }

        return next;
      });
    },
    []
  );

  const handleSelectAll = useCallback(() => {
    setSelectedPages(new Set(Array.from({ length: numPages }, (_, i) => i + 1)));
  }, [numPages]);

  const handleDeselectAll = useCallback(() => {
    setSelectedPages(new Set());
  }, []);

  const handleContextMenu = useCallback(
    (pageNumber: number, e: React.MouseEvent) => {
      setContextMenu({ pageNumber, x: e.clientX, y: e.clientY });
    },
    []
  );

  const openDialog = useCallback(
    (name: string, pages: number[]) => {
      setContextMenu(null);
      useUIStore.getState().openPageOpsDialog(name, { pages });
    },
    []
  );

  const selectedArray = Array.from(selectedPages).sort((a, b) => a - b);

  return (
    <div className="h-full flex flex-col">
      {/* Selection toolbar */}
      {selectedPages.size > 0 && (
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 shrink-0">
          <span className="text-[10px] text-surface-500 mr-1">
            {selectedPages.size} selected
          </span>
          <button
            type="button"
            onClick={() => openDialog('extract', selectedArray)}
            className="px-1.5 py-0.5 text-[10px] rounded border border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800"
          >
            Extract
          </button>
          <button
            type="button"
            onClick={() => openDialog('delete', selectedArray)}
            className="px-1.5 py-0.5 text-[10px] rounded border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            Delete
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleSelectAll}
            className="px-1 py-0.5 text-[10px] text-surface-400 hover:text-surface-600"
          >
            All
          </button>
          <button
            type="button"
            onClick={handleDeselectAll}
            className="px-1 py-0.5 text-[10px] text-surface-400 hover:text-surface-600"
          >
            Clear
          </button>
        </div>
      )}

      {/* Thumbnail list */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
        {Array.from({ length: numPages }, (_, i) => {
          const pageNumber = i + 1;
          const isActive = pageNumber === currentPage;

          return (
            <div
              key={`${documentKey}-${pageNumber}`}
              ref={isActive ? activeRef : undefined}
            >
              <ThumbnailItem
                pdfDocument={pdfDocument}
                pageNumber={pageNumber}
                isActive={isActive}
                selected={selectedPages.has(pageNumber)}
                onClick={onPageClick}
                onContextMenu={handleContextMenu}
                onSelectToggle={handleSelectToggle}
              />
            </div>
          );
        })}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-[300] bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded shadow-lg py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            type="button"
            className="w-full text-left px-3 py-1.5 text-xs text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 flex items-center gap-2"
            onClick={() => openDialog('delete', [contextMenu.pageNumber])}
          >
            <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Page {contextMenu.pageNumber}
          </button>
          <button
            type="button"
            className="w-full text-left px-3 py-1.5 text-xs text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 flex items-center gap-2"
            onClick={() => openDialog('extract', [contextMenu.pageNumber])}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Extract Page {contextMenu.pageNumber}
          </button>
          <div className="border-t border-surface-200 dark:border-surface-700 my-1" />
          <button
            type="button"
            className="w-full text-left px-3 py-1.5 text-xs text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800"
            onClick={() => {
              setContextMenu(null);
              setSelectedPages(new Set([contextMenu.pageNumber]));
            }}
          >
            Select Page
          </button>
          <button
            type="button"
            className="w-full text-left px-3 py-1.5 text-xs text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800"
            onClick={handleSelectAll}
          >
            Select All
          </button>
        </div>
      )}
    </div>
  );
}
