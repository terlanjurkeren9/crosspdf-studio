import { useCallback, useMemo, useState } from 'react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { runOcr, OCR_LANGUAGES } from '../../services/ocr.service';
import type { OcrPageResult } from '../../workers/ocr.worker';
import { formatOcrExport, saveOcrText } from '../../services/export.service';

interface OcrDialogProps {
  open: boolean;
  onClose: () => void;
  filePath: string;
  fileName: string;
  numPages: number;
}

type OcrStatus = 'idle' | 'running' | 'complete' | 'error';

export function OcrDialog({
  open,
  onClose,
  filePath,
  fileName,
  numPages,
}: OcrDialogProps) {
  const [status, setStatus] = useState<OcrStatus>('idle');
  const [language, setLanguage] = useState('eng');
  const [dpi, setDpi] = useState(300);
  const [pageRange, setPageRange] = useState(`1-${numPages}`);
  const [results, setResults] = useState<OcrPageResult[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [includePageNumbers, setIncludePageNumbers] = useState(true);
  const [dpiInput, setDpiInput] = useState('300');

  const pageNumbers = useMemo(() => {
    try {
      return parseRange(pageRange, numPages);
    } catch {
      return [];
    }
  }, [pageRange, numPages]);

  // State is initialized at mount; App.tsx remounts the dialog via key
  // when it opens, so no explicit reset effect is needed.

  const handleStart = useCallback(async () => {
    if (pageNumbers.length === 0) {
      setErrorMessage('Please enter valid page numbers (e.g. 1-5, 10, 15-20)');
      return;
    }

    setStatus('running');
    setErrorMessage('');

    try {
      const readResult = await window.crosspdf.readFile(filePath);
      if (!readResult.success || !readResult.data) {
        throw new Error('Failed to read PDF file');
      }

      const ocrResults = await runOcr(
        readResult.data,
        pageNumbers,
        language,
        dpi,
        (pageNum, pageIdx, total) => {
          setCurrentPage(pageNum);
          setTotalPages(total);
        }
      );

      setResults(ocrResults);
      setStatus('complete');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'OCR failed');
    }
  }, [filePath, pageNumbers, language, dpi]);

  const handleExport = useCallback(async () => {
    if (results.length === 0) return;

    try {
      const text = formatOcrExport(results, { includePageNumbers });
      const baseName = fileName.replace(/\.pdf$/i, '');
      await saveOcrText(text, `${baseName}-ocr.txt`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Export failed');
    }
  }, [results, fileName, includePageNumbers]);

  const handleDpiBlur = useCallback(() => {
    const val = parseInt(dpiInput, 10);
    if (isNaN(val) || val < 72) {
      setDpiInput('300');
      setDpi(300);
    } else if (val > 600) {
      setDpiInput('600');
      setDpi(600);
    } else {
      setDpi(val);
      setDpiInput(String(val));
    }
  }, [dpiInput]);

  const progress =
    totalPages > 0
      ? pageNumbers.indexOf(currentPage) / totalPages
      : 0;

  const isRunning = status === 'running';

  return (
    <Dialog
      open={open}
      onClose={isRunning ? () => {} : onClose}
      title="OCR — Recognize Text"
      footer={
        <div className="flex items-center gap-2">
          {status === 'complete' && (
            <Button variant="secondary" onClick={handleExport}>
              Export TXT
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isRunning}
          >
            {status === 'complete' ? 'Close' : 'Cancel'}
          </Button>
          {status !== 'complete' && (
            <Button
              variant="primary"
              onClick={handleStart}
              disabled={isRunning || pageNumbers.length === 0}
            >
              {isRunning ? (
                <span className="flex items-center gap-2">
                  <Spinner size="sm" />
                  OCR Running...
                </span>
              ) : (
                'Start OCR'
              )}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {/* Language */}
        <div>
          <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
            Language
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={isRunning}
            className="w-full h-8 px-2 text-sm rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
          >
            {OCR_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        {/* Page range */}
        <div>
          <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
            Page range (e.g. 1-5, 10, 15-20)
          </label>
          <input
            type="text"
            value={pageRange}
            onChange={(e) => setPageRange(e.target.value)}
            disabled={isRunning}
            className="w-full h-8 px-2 text-sm rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 disabled:opacity-50"
            placeholder={`1-${numPages}`}
          />
          <p className="text-xs text-surface-400 mt-1">
            {pageNumbers.length} page{pageNumbers.length !== 1 ? 's' : ''} selected
          </p>
        </div>

        {/* DPI */}
        <div>
          <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
            Resolution (DPI)
          </label>
          <input
            type="number"
            min={72}
            max={600}
            value={dpiInput}
            onChange={(e) => setDpiInput(e.target.value)}
            onBlur={handleDpiBlur}
            disabled={isRunning}
            className="w-24 h-8 px-2 text-sm rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 disabled:opacity-50"
          />
          <span className="text-xs text-surface-400 ml-2">
            Higher DPI = better quality but slower
          </span>
        </div>

        {/* Export options */}
        {status === 'complete' && (
          <div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includePageNumbers}
                onChange={(e) => setIncludePageNumbers(e.target.checked)}
                className="rounded"
              />
              Include page numbers in export
            </label>
          </div>
        )}

        {/* Progress */}
        {isRunning && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-surface-500">
              <span>
                Processing page {currentPage} ({pageNumbers.indexOf(currentPage) + 1}/
                {totalPages})
              </span>
            </div>
            <div className="h-2 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-500 transition-all duration-300"
                style={{ width: `${Math.max(progress * 100, 2)}%` }}
              />
            </div>
          </div>
        )}

        {/* Results preview */}
        {status === 'complete' && results.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
              Results ({results.length} page{results.length !== 1 ? 's' : ''})
            </label>
            <div className="max-h-40 overflow-y-auto rounded border border-surface-200 dark:border-surface-700">
              {results.map((r) => (
                <details key={r.pageNumber} className="border-b border-surface-200 dark:border-surface-700 last:border-none">
                  <summary className="px-3 py-1.5 text-xs cursor-pointer hover:bg-surface-100 dark:hover:bg-surface-800 select-none">
                    Page {r.pageNumber} — {r.text.length} chars —{' '}
                    {(r.confidence * 100).toFixed(0)}% confidence
                  </summary>
                  <pre className="px-3 py-2 text-xs whitespace-pre-wrap text-surface-600 dark:text-surface-400 bg-surface-50 dark:bg-surface-900">
                    {r.text || '(no text recognized)'}
                  </pre>
                </details>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="p-2 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
            {errorMessage}
          </div>
        )}
      </div>
    </Dialog>
  );
}

function parseRange(input: string, maxPage: number): number[] {
  const pages = new Set<number>();
  const parts = input.split(',').map((s) => s.trim()).filter(Boolean);

  for (const part of parts) {
    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const start = Math.max(1, parseInt(rangeMatch[1], 10));
      const end = Math.min(parseInt(rangeMatch[2], 10), maxPage);
      for (let i = start; i <= end; i++) pages.add(i);
    } else {
      const num = parseInt(part, 10);
      if (num >= 1 && num <= maxPage) pages.add(num);
    }
  }

  return Array.from(pages).sort((a, b) => a - b);
}
