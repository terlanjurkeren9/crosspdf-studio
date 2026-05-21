import { useEffect, useRef } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { ThumbnailItem } from './ThumbnailItem';

interface ThumbnailPanelProps {
  pdfDocument: PDFDocumentProxy;
  numPages: number;
  currentPage: number;
  onPageClick: (pageNumber: number) => void;
}

export function ThumbnailPanel({
  pdfDocument,
  numPages,
  currentPage,
  onPageClick,
}: ThumbnailPanelProps) {
  const activeRef = useRef<HTMLDivElement>(null);
  const documentKey = pdfDocument.fingerprints?.join(':') ?? 'document';

  // Scroll active thumbnail into view when currentPage changes
  useEffect(() => {
    const el = activeRef.current;
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [currentPage]);

  return (
    <div className="h-full overflow-y-auto p-2 flex flex-col gap-2">
      {Array.from({ length: numPages }, (_, i) => {
        const pageNumber = i + 1;
        const isActive = pageNumber === currentPage;

        return (
          <div key={`${documentKey}-${pageNumber}`} ref={isActive ? activeRef : undefined}>
            <ThumbnailItem
              pdfDocument={pdfDocument}
              pageNumber={pageNumber}
              isActive={isActive}
              onClick={onPageClick}
            />
          </div>
        );
      })}
    </div>
  );
}
