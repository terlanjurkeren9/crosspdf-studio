import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../ui/Dialog';
import { extractPages } from '../../services/pdf-ops.service';
import { parsePageRanges, extractOutputName } from '../../lib/page-range-parser';

interface ExtractPagesDialogProps {
  open: boolean;
  onClose: () => void;
  sourceFilePath: string;
  sourceFileName: string;
  totalPages: number;
  preSelectedPages?: number[];
}

export function ExtractPagesDialog({
  open,
  onClose,
  sourceFilePath,
  sourceFileName,
  totalPages,
  preSelectedPages,
}: ExtractPagesDialogProps) {
  const { t } = useTranslation();
  const [rangeInput, setRangeInput] = useState(
    preSelectedPages && preSelectedPages.length > 0 ? preSelectedPages.join(', ') : ''
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPages = parsePageRanges(rangeInput, totalPages);

  const handleExtract = useCallback(async () => {
    const pages = parsePageRanges(rangeInput, totalPages);
    if (pages.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      // Read source file
      const readResult = await window.crosspdf.readFile(sourceFilePath);
      if (!readResult.success || !readResult.data) {
        throw new Error('Failed to read source file');
      }

      const result = await extractPages(readResult.data, pages);

      const saveResult = await window.crosspdf.saveFileDialog({
        defaultPath: extractOutputName(sourceFileName),
        filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
      });
      if (saveResult.canceled || !saveResult.filePath) {
        setLoading(false);
        return;
      }

      await window.crosspdf.writeFile(saveResult.filePath, result.buffer as ArrayBuffer);

      const openNow = confirm(
        `Extracted ${pages.length} page(s) to:\n${saveResult.filePath}\n\nOpen the extracted document?`
      );
      if (openNow) {
        window.dispatchEvent(
          new CustomEvent('crosspdf:open-file', {
            detail: { filePath: saveResult.filePath },
          })
        );
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extract failed');
    } finally {
      setLoading(false);
    }
  }, [rangeInput, totalPages, sourceFilePath, sourceFileName, onClose]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Extract Pages"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-3 py-1.5 text-xs rounded border border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-30"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleExtract}
            disabled={selectedPages.length === 0 || loading}
            className="px-3 py-1.5 text-xs rounded text-white bg-brand-500 hover:bg-brand-600 disabled:opacity-30 flex items-center gap-2"
          >
            {loading && (
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            )}
            Extract
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs text-surface-500">
          Source: {sourceFileName} ({totalPages} page{totalPages !== 1 ? 's' : ''})
        </p>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-surface-600 dark:text-surface-400">
            Pages to extract (e.g. 1-3, 5, 7-9):
          </label>
          <input
            type="text"
            value={rangeInput}
            onChange={(e) => setRangeInput(e.target.value)}
            placeholder={`1-3, 5, 7-9`}
            className="h-7 px-2 text-xs rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 outline-none focus:border-brand-400"
            autoFocus
          />
        </div>

        {selectedPages.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selectedPages.slice(0, 30).map((p) => (
              <span
                key={p}
                className="px-1.5 py-0.5 text-[11px] rounded bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300"
              >
                {p}
              </span>
            ))}
            {selectedPages.length > 30 && (
              <span className="px-1.5 py-0.5 text-[11px] text-surface-400">
                +{selectedPages.length - 30} more
              </span>
            )}
          </div>
        )}

        {selectedPages.length > 0 && (
          <p className="text-xs text-surface-500">
            {selectedPages.length} page{selectedPages.length !== 1 ? 's' : ''} selected. Output:{' '}
            {extractOutputName(sourceFileName)}
          </p>
        )}

        {selectedPages.length === 0 && rangeInput.trim() && (
          <p className="text-xs text-amber-500">Enter valid page numbers or ranges.</p>
        )}

        {error && (
          <div className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-2">
            {error}
          </div>
        )}
      </div>
    </Dialog>
  );
}
