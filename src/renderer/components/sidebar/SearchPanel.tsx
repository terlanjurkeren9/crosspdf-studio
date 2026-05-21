import { useCallback, useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { searchPages, createSearchOptions, type SearchResult } from '../../lib/search';
import { SearchResultItem } from './SearchResultItem';

interface SearchPanelProps {
  pdfDocument: PDFDocumentProxy | null;
  numPages: number;
  onNavigateToPage: (pageNumber: number) => void;
  autoFocus?: boolean;
}

type SearchStatus =
  | { status: 'idle' }
  | { status: 'extracting'; current: number; total: number }
  | { status: 'searching' }
  | { status: 'done' }
  | { status: 'error'; message: string };

export function SearchPanel({
  pdfDocument,
  numPages,
  onNavigateToPage,
  autoFocus = false,
}: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [status, setStatus] = useState<SearchStatus>({ status: 'idle' });
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeResultIdx, setActiveResultIdx] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const textCacheRef = useRef<Map<number, string>>(new Map());
  const docIdRef = useRef<PDFDocumentProxy | null>(null);

  // Clear cache when document changes
  useEffect(() => {
    if (docIdRef.current !== pdfDocument) {
      textCacheRef.current.clear();
      docIdRef.current = pdfDocument;
      setResults([]);
      setActiveResultIdx(0);
      setStatus({ status: 'idle' });
    }
  }, [pdfDocument]);

  // Auto-focus input
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const performSearch = useCallback(async () => {
    if (!pdfDocument || !query.trim()) {
      setResults([]);
      setStatus({ status: 'idle' });
      return;
    }

    const trimmedQuery = query.trim();
    const pagesToExtract: number[] = [];

    // Check which pages need extraction
    for (let i = 1; i <= numPages; i++) {
      if (!textCacheRef.current.has(i)) {
        pagesToExtract.push(i);
      }
    }

    // Extract uncached pages
    if (pagesToExtract.length > 0) {
      setStatus({ status: 'extracting', current: 0, total: pagesToExtract.length });

      for (let idx = 0; idx < pagesToExtract.length; idx++) {
        const pageNum = pagesToExtract[idx];
        try {
          const page = await pdfDocument.getPage(pageNum);
          const textContent = await page.getTextContent();
          const text = textContent.items.map((item) => ('str' in item ? item.str : '')).join(' ');
          textCacheRef.current.set(pageNum, text);
          page.cleanup();
        } catch {
          textCacheRef.current.set(pageNum, '');
        }
        setStatus({ status: 'extracting', current: idx + 1, total: pagesToExtract.length });
      }
    }

    // Search
    setStatus({ status: 'searching' });

    const options = createSearchOptions(trimmedQuery, caseSensitive, wholeWord);
    const searchResults = searchPages(textCacheRef.current, options);

    setResults(searchResults);
    setActiveResultIdx(0);
    setStatus({ status: 'done' });
  }, [pdfDocument, query, numPages, caseSensitive, wholeWord]);

  const goToResult = useCallback(
    (idx: number) => {
      const result = results[idx];
      if (result) {
        setActiveResultIdx(idx);
        onNavigateToPage(result.pageNumber);
      }
    },
    [results, onNavigateToPage]
  );

  const goToNextResult = useCallback(() => {
    if (results.length === 0) return;
    const next = (activeResultIdx + 1) % results.length;
    goToResult(next);
  }, [activeResultIdx, results.length, goToResult]);

  const goToPrevResult = useCallback(() => {
    if (results.length === 0) return;
    const prev = (activeResultIdx - 1 + results.length) % results.length;
    goToResult(prev);
  }, [activeResultIdx, results.length, goToResult]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        performSearch();
      }
    },
    [performSearch]
  );

  const isExtracting = status.status === 'extracting';
  const isSearching = status.status === 'searching';
  const busy = isExtracting || isSearching;

  return (
    <div className="h-full flex flex-col">
      {/* Search input area */}
      <div className="p-2 space-y-2 border-b border-surface-200 dark:border-surface-800">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search in document…"
            disabled={!pdfDocument}
            className="w-full h-8 px-2 pr-8 text-xs rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 outline-none focus:border-brand-400 disabled:opacity-30"
            aria-label="Search text"
          />
          {busy && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <div className="w-3 h-3 border-2 border-surface-300 border-t-brand-500 rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Options */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-[11px] text-surface-500 cursor-pointer">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
              className="w-3 h-3 accent-brand-500"
            />
            Aa
          </label>
          <label className="flex items-center gap-1 text-[11px] text-surface-500 cursor-pointer">
            <input
              type="checkbox"
              checked={wholeWord}
              onChange={(e) => setWholeWord(e.target.checked)}
              className="w-3 h-3 accent-brand-500"
            />
            Whole word
          </label>
        </div>

        {/* Search button */}
        <button
          type="button"
          onClick={performSearch}
          disabled={!pdfDocument || !query.trim() || busy}
          className="w-full h-7 text-xs font-medium rounded bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          Search
        </button>
      </div>

      {/* Results area */}
      <div className="flex-1 overflow-y-auto">
        {status.status === 'extracting' && (
          <div className="p-3 text-xs text-surface-500">
            Extracting text: {status.current} / {status.total} pages…
            <div className="mt-1 h-1 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-500 transition-all"
                style={{
                  width: `${(status.current / status.total) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {status.status === 'searching' && (
          <div className="p-3 text-xs text-surface-500">Searching…</div>
        )}

        {status.status === 'done' && results.length === 0 && (
          <div className="p-3 text-xs text-surface-500">
            No results found for &quot;{query}&quot;
          </div>
        )}

        {status.status === 'error' && (
          <div className="p-3 text-xs text-red-500">{status.message}</div>
        )}

        {results.length > 0 && (
          <>
            {/* Navigation bar */}
            <div className="flex items-center gap-1 px-2 py-1 border-b border-surface-200 dark:border-surface-800">
              <span className="text-[10px] text-surface-500">
                {activeResultIdx + 1} / {results.length}
              </span>
              <div className="flex-1" />
              <button
                type="button"
                onClick={goToPrevResult}
                className="p-0.5 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-500"
                aria-label="Previous result"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={goToNextResult}
                className="p-0.5 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-500"
                aria-label="Next result"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Result list */}
            <div className="flex flex-col gap-0.5 p-1">
              {results.map((result, idx) => (
                <SearchResultItem
                  key={`${result.pageNumber}-${result.matchIndex}`}
                  result={result}
                  isActive={idx === activeResultIdx}
                  onClick={() => goToResult(idx)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
