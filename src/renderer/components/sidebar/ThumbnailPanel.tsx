import { useCallback, useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { FileOutput, Trash2 } from 'lucide-react';
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

  const handleSelectToggle = useCallback((pageNumber: number, shiftKey: boolean) => {
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
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedPages(new Set(Array.from({ length: numPages }, (_, i) => i + 1)));
  }, [numPages]);

  const handleDeselectAll = useCallback(() => {
    setSelectedPages(new Set());
  }, []);

  const handleContextMenu = useCallback((pageNumber: number, e: React.MouseEvent) => {
    setContextMenu({ pageNumber, x: e.clientX, y: e.clientY });
  }, []);

  const openDialog = useCallback((name: string, pages: number[]) => {
    setContextMenu(null);
    useUIStore.getState().openPageOpsDialog(name, { pages });
  }, []);

  const selectedArray = Array.from(selectedPages).sort((a, b) => a - b);

  return (
    <div className="flex h-full flex-col">
      {/* Selection toolbar */}
      {selectedPages.size > 0 && (
        <div className="flex shrink-0 items-center gap-1 border-b border-surface-200 bg-white px-2 py-1.5 dark:border-surface-800 dark:bg-surface-950">
          <span className="mr-1 text-[10px] font-medium text-surface-500">
            {selectedPages.size} selected
          </span>
          <button
            type="button"
            onClick={() => openDialog('extract', selectedArray)}
            className="rounded border border-surface-300 px-1.5 py-0.5 text-[10px] text-surface-600 hover:bg-surface-100 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800"
          >
            Extract
          </button>
          <button
            type="button"
            onClick={() => openDialog('delete', selectedArray)}
            className="rounded border border-red-300 px-1.5 py-0.5 text-[10px] text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
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
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
        {Array.from({ length: numPages }, (_, i) => {
          const pageNumber = i + 1;
          const isActive = pageNumber === currentPage;

          return (
            <div key={`${documentKey}-${pageNumber}`} ref={isActive ? activeRef : undefined}>
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
          className="fixed z-[300] min-w-[170px] rounded-md border border-surface-200 bg-white py-1 shadow-xl shadow-surface-950/15 dark:border-surface-700 dark:bg-surface-900"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
            onClick={() => openDialog('delete', [contextMenu.pageNumber])}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Page {contextMenu.pageNumber}
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-surface-700 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800"
            onClick={() => openDialog('extract', [contextMenu.pageNumber])}
          >
            <FileOutput className="h-3.5 w-3.5" />
            Extract Page {contextMenu.pageNumber}
          </button>
          <div className="my-1 border-t border-surface-200 dark:border-surface-700" />
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
