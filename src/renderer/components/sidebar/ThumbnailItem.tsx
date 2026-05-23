import { useCallback, useEffect, useRef } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { usePdfThumbnail } from '../../hooks/usePdfThumbnail';
import { Spinner } from '../ui/Spinner';

interface ThumbnailItemProps {
  pdfDocument: PDFDocumentProxy;
  pageNumber: number;
  isActive: boolean;
  selected: boolean;
  onClick: (pageNumber: number) => void;
  onContextMenu?: (pageNumber: number, e: React.MouseEvent) => void;
  onSelectToggle?: (pageNumber: number, shiftKey: boolean) => void;
}

export function ThumbnailItem({
  pdfDocument,
  pageNumber,
  isActive,
  selected,
  onClick,
  onContextMenu,
  onSelectToggle,
}: ThumbnailItemProps) {
  const { state, render, cancel } = usePdfThumbnail(pdfDocument, pageNumber);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef(state.status);

  useEffect(() => {
    statusRef.current = state.status;
  }, [state.status]);

  // Lazy render with IntersectionObserver
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && statusRef.current === 'idle') {
          render();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      cancel();
    };
  }, [render, cancel]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onContextMenu?.(pageNumber, e);
    },
    [onContextMenu, pageNumber]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.ctrlKey || e.metaKey) {
        onSelectToggle?.(pageNumber, e.shiftKey);
      } else {
        onClick(pageNumber);
      }
    },
    [onClick, onSelectToggle, pageNumber]
  );

  return (
    <div
      ref={sentinelRef}
      className={`group cursor-pointer rounded border-2 p-1 transition-colors relative ${
        isActive
          ? 'border-brand-500 bg-brand-50 dark:bg-brand-950'
          : selected
            ? 'border-brand-300 bg-brand-50/50 dark:bg-brand-950/50'
            : 'border-transparent hover:border-surface-300 dark:hover:border-surface-600'
      }`}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      aria-label={`Page ${pageNumber}`}
      aria-current={isActive ? 'true' : undefined}
    >
      {/* Selection checkbox */}
      <div
        className="absolute top-1 left-1 z-10"
        onClick={(e) => {
          e.stopPropagation();
          onSelectToggle?.(pageNumber, e.shiftKey);
        }}
      >
        <div
          className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
            selected
              ? 'bg-brand-500 border-brand-500 text-white'
              : 'bg-white dark:bg-surface-800 border-surface-300 dark:border-surface-600 opacity-0 group-hover:opacity-100'
          }`}
        >
          {selected && (
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center gap-1">
        {/* Page number label */}
        <span className="text-[10px] text-surface-500 font-medium tabular-nums">{pageNumber}</span>

        {/* Thumbnail image or placeholder */}
        <div className="w-full bg-white dark:bg-surface-800 rounded-sm overflow-hidden shadow-sm">
          {state.status === 'loading' && (
            <div className="flex items-center justify-center h-20">
              <Spinner className="w-4 h-4" />
            </div>
          )}

          {state.status === 'error' && (
            <div className="flex items-center justify-center h-20 text-[10px] text-amber-500">
              Error
            </div>
          )}

          {state.status === 'done' && state.dataUrl && (
            <img
              src={state.dataUrl}
              alt={`Thumbnail for page ${pageNumber}`}
              className="w-full block"
              draggable={false}
            />
          )}

          {state.status === 'idle' && (
            <div className="h-20 bg-surface-100 dark:bg-surface-800 animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}
