import { useEffect, useRef } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { usePdfThumbnail } from '../../hooks/usePdfThumbnail';
import { Spinner } from '../ui/Spinner';

interface ThumbnailItemProps {
  pdfDocument: PDFDocumentProxy;
  pageNumber: number;
  isActive: boolean;
  onClick: (pageNumber: number) => void;
}

export function ThumbnailItem({ pdfDocument, pageNumber, isActive, onClick }: ThumbnailItemProps) {
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

  return (
    <div
      ref={sentinelRef}
      role="button"
      tabIndex={0}
      className={`cursor-pointer rounded border-2 p-1 transition-colors ${
        isActive
          ? 'border-brand-500 bg-brand-50 dark:bg-brand-950'
          : 'border-transparent hover:border-surface-300 dark:hover:border-surface-600'
      }`}
      onClick={() => onClick(pageNumber)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(pageNumber);
        }
      }}
      aria-label={`Page ${pageNumber}`}
      aria-current={isActive ? 'true' : undefined}
    >
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
