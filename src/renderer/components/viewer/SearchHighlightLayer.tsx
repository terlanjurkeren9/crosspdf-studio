import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { findMatchesInText } from '../../lib/search';
import { useSearchStore } from '../../stores/search.store';

interface HighlightBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SearchHighlightLayerProps {
  pdfDocument: PDFDocumentProxy | null;
  pageNumber: number;
  zoom: number;
  rotation: 0 | 90 | 180 | 270;
}

export function SearchHighlightLayer({
  pdfDocument,
  pageNumber,
  zoom,
  rotation,
}: SearchHighlightLayerProps) {
  const query = useSearchStore((s) => s.query);
  const results = useSearchStore((s) => s.results);
  const [boxes, setBoxes] = useState<HighlightBox[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pdfDocument || !query.trim() || results.length === 0) {
      return;
    }

    // Filter results for this page
    const pageResults = results.filter((r) => r.pageNumber === pageNumber);
    if (pageResults.length === 0) {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const page = await pdfDocument.getPage(pageNumber);
        if (cancelled) {
          page.cleanup();
          return;
        }

        const viewport = page.getViewport({ scale: zoom, rotation });
        const textContent = await page.getTextContent();
        if (cancelled) {
          page.cleanup();
          return;
        }

        // Reconstruct page text exactly as search.ts does
        const pageText = textContent.items.map((item) => ('str' in item ? item.str : '')).join(' ');

        // Find matches on this page
        const matches = findMatchesInText(pageText, pageNumber, {
          query,
          caseSensitive: false, // Simplified for highlight layer
          wholeWord: false,
        });

        if (matches.length === 0 || cancelled) {
          page.cleanup();
          return;
        }

        const newBoxes: HighlightBox[] = [];
        let charPos = 0;

        for (const item of textContent.items as {
          str: string;
          transform: number[];
          width: number;
          height: number;
        }[]) {
          if (cancelled) break;
          const str = 'str' in item ? item.str : '';
          if (!str) continue;

          const itemStart = charPos;
          const itemEnd = charPos + str.length;

          // Check if any match starts within this text item
          for (const match of matches) {
            if (match.charIndex >= itemStart && match.charIndex < itemEnd) {
              // Calculate bounding box for this match
              const transform = item.transform;
              const x = transform[4];
              const y = transform[5];

              const width = item.width || str.length * (zoom * 0.5);
              const height = item.height || zoom * 10;

              // Convert PDF coordinates to viewport coordinates
              // convertToViewportRectangle returns [x1, y1, x2, y2]
              const rect = viewport.convertToViewportRectangle([x, y, x + width, y + height]);
              const vx1 = rect[0];
              const vy1 = rect[1];
              const vx2 = rect[2];
              const vy2 = rect[3];

              const boxX = Math.min(vx1, vx2);
              const boxY = Math.min(vy1, vy2);
              const boxWidth = Math.abs(vx2 - vx1);
              const boxHeight = Math.abs(vy2 - vy1);

              if (
                isFinite(boxX) &&
                isFinite(boxY) &&
                isFinite(boxWidth) &&
                isFinite(boxHeight) &&
                boxWidth > 0 &&
                boxHeight > 0
              ) {
                newBoxes.push({
                  x: boxX,
                  y: boxY,
                  width: boxWidth,
                  height: boxHeight,
                });
              }
            }
          }

          charPos += str.length + 1; // +1 for the space added during join
        }

        if (!cancelled) {
          setBoxes(newBoxes);
        }
        page.cleanup();
      } catch (err) {
        console.error('Failed to render search highlights:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfDocument, pageNumber, zoom, rotation, query, results]);

  if (boxes.length === 0) return null;

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
      {boxes.map((box, idx) => (
        <div
          key={idx}
          className="absolute bg-yellow-300/40 border border-yellow-400/60 rounded-sm"
          style={{
            left: box.x,
            top: box.y,
            width: box.width,
            height: box.height,
          }}
        />
      ))}
    </div>
  );
}
