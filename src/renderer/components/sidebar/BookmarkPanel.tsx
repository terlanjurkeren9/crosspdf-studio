import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { Bookmark, ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface OutlineItem {
  title: string;
  dest: unknown;
  url: string | null;
  items: OutlineItem[];
  bold: boolean;
  italic: boolean;
  color: Uint8ClampedArray;
}

interface BookmarkPanelProps {
  pdfDocument: PDFDocumentProxy;
  onNavigateToPage: (pageNumber: number) => void;
}

export function BookmarkPanel({ pdfDocument, onNavigateToPage }: BookmarkPanelProps) {
  const { t } = useTranslation();
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function loadOutline() {
      try {
        const outlineData = await pdfDocument.getOutline();
        if (!cancelled) {
          setOutline(outlineData || []);
          if (outlineData) {
            const allKeys = new Set<string>();
            const collectKeys = (items: OutlineItem[], prefix = '') => {
              items.forEach((item, idx) => {
                const key = `${prefix}-${idx}`;
                allKeys.add(key);
                if (item.items && item.items.length > 0) {
                  collectKeys(item.items, key);
                }
              });
            };
            collectKeys(outlineData);
            setExpanded(allKeys);
          }
        }
      } catch (err) {
        console.error('Failed to load PDF outline:', err);
        if (!cancelled) setOutline([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadOutline();
    return () => {
      cancelled = true;
    };
  }, [pdfDocument]);

  const resolvePageNumber = useCallback(
    async (dest: unknown): Promise<number | null> => {
      if (!dest) return null;
      try {
        let destArray: unknown = dest;
        if (typeof dest === 'string') {
          destArray = await pdfDocument.getDestination(dest);
        }
        if (Array.isArray(destArray) && destArray.length > 0) {
          const ref = destArray[0];
          const pageIndex = await pdfDocument.getPageIndex(ref);
          return pageIndex + 1;
        }
      } catch (e) {
        console.warn('Failed to resolve outline destination', e);
      }
      return null;
    },
    [pdfDocument]
  );

  const handleItemClick = useCallback(
    async (item: OutlineItem) => {
      if (item.url) {
        window.open(item.url, '_blank');
        return;
      }
      const pageNum = await resolvePageNumber(item.dest);
      if (pageNum) {
        onNavigateToPage(pageNum);
      }
    },
    [resolvePageNumber, onNavigateToPage]
  );

  const toggleExpand = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const renderItems = (items: OutlineItem[], prefix = ''): ReactNode => {
    return items.map((item, idx) => {
      const key = `${prefix}-${idx}`;
      const hasChildren = item.items && item.items.length > 0;
      const isExpanded = expanded.has(key);

      return (
        <div key={key}>
          <button
            type="button"
            onClick={() => handleItemClick(item)}
            className={`flex w-full items-center gap-1 px-2 py-1.5 text-left text-xs transition-colors hover:bg-surface-100 dark:hover:bg-surface-800 ${
              item.bold ? 'font-semibold' : 'font-medium'
            } ${item.italic ? 'italic' : ''}`}
            style={{
              paddingLeft: `${12 + (prefix.split('-').length - 1) * 16}px`,
              color: item.color
                ? `rgb(${item.color[0]}, ${item.color[1]}, ${item.color[2]})`
                : undefined,
            }}
          >
            {hasChildren && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(key);
                }}
                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded hover:bg-surface-200 dark:hover:bg-surface-700"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </span>
            )}
            {!hasChildren && <span className="h-4 w-4 shrink-0" />}
            <span className="truncate">{item.title}</span>
          </button>
          {hasChildren && isExpanded && renderItems(item.items, key)}
        </div>
      );
    });
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <span className="text-xs text-surface-400">{t('common.loading')}</span>
      </div>
    );
  }

  if (outline.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
        <Bookmark className="h-8 w-8 text-surface-300 dark:text-surface-600" />
        <p className="text-xs text-surface-400">{t('sidebar.noBookmarks')}</p>
      </div>
    );
  }

  return <div className="flex h-full flex-col overflow-y-auto">{renderItems(outline)}</div>;
}
