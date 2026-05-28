import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog } from '../ui/Dialog';
import { reorderPages } from '../../services/pdf-ops.service';

interface ReorderDialogProps {
  open: boolean;
  onClose: () => void;
  sourceFilePath: string;
  sourceFileName: string;
  totalPages: number;
}

export function ReorderDialog({
  open,
  onClose,
  sourceFilePath,
  sourceFileName,
  totalPages,
}: ReorderDialogProps) {
  const buildOrder = useCallback(
    () => Array.from({ length: totalPages }, (_, i) => i + 1),
    [totalPages]
  );

  const [pageOrder, setPageOrder] = useState<number[]>(buildOrder);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wasOpenRef = useRef(false);

  // Reset order when dialog opens
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      wasOpenRef.current = true;
      setPageOrder(buildOrder());
      setSelectedIndex(null);
      setError(null);
    }
    if (!open) {
      wasOpenRef.current = false;
    }
  }, [open, buildOrder]);

  const hasChanges = useMemo(() => pageOrder.some((p, i) => p !== i + 1), [pageOrder]);

  const handleMove = useCallback(
    (direction: 'up' | 'down' | 'first' | 'last') => {
      if (selectedIndex === null) return;
      setPageOrder((prev) => {
        const next = [...prev];
        const [item] = next.splice(selectedIndex, 1);

        let targetIndex: number;
        switch (direction) {
          case 'up':
            targetIndex = Math.max(0, selectedIndex - 1);
            break;
          case 'down':
            targetIndex = Math.min(next.length, selectedIndex + 1);
            break;
          case 'first':
            targetIndex = 0;
            break;
          case 'last':
            targetIndex = next.length;
            break;
        }

        next.splice(targetIndex, 0, item);
        setSelectedIndex(targetIndex);
        return next;
      });
    },
    [selectedIndex]
  );

  const handleReset = useCallback(() => {
    setPageOrder(Array.from({ length: totalPages }, (_, i) => i + 1));
    setSelectedIndex(null);
  }, [totalPages]);

  const handleApply = useCallback(async () => {
    if (!hasChanges) return;

    setLoading(true);
    setError(null);

    try {
      const readResult = await window.crosspdf.readFile(sourceFilePath);
      if (!readResult.success || !readResult.data) {
        throw new Error('Failed to read source file');
      }

      const result = await reorderPages(readResult.data, pageOrder);

      const saveResult = await window.crosspdf.saveFileDialog({
        defaultPath: sourceFileName.replace('.pdf', '') + '-reordered.pdf',
        filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
      });
      if (saveResult.canceled || !saveResult.filePath) {
        setLoading(false);
        return;
      }

      await window.crosspdf.writeFile(saveResult.filePath, result.buffer as ArrayBuffer);

      const openNow = confirm(`Reorder complete. Open the reordered document?`);
      if (openNow) {
        window.dispatchEvent(
          new CustomEvent('crosspdf:open-file', {
            detail: { filePath: saveResult.filePath },
          })
        );
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reorder failed');
    } finally {
      setLoading(false);
    }
  }, [hasChanges, pageOrder, sourceFilePath, sourceFileName, onClose]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Reorder Pages"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-3 py-1.5 text-xs rounded border border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-30"
          >
            Cancel
          </button>
          {hasChanges && (
            <button
              type="button"
              onClick={handleReset}
              disabled={loading}
              className="px-3 py-1.5 text-xs rounded text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 disabled:opacity-30"
            >
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={handleApply}
            disabled={!hasChanges || loading}
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
            Apply Reorder
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs text-surface-500">
          Source: {sourceFileName} ({totalPages} page{totalPages !== 1 ? 's' : ''})
        </p>

        {/* Move controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleMove('first')}
            disabled={selectedIndex === null || loading}
            className="p-1 rounded border border-surface-300 dark:border-surface-600 text-surface-500 disabled:opacity-20 hover:bg-surface-100 dark:hover:bg-surface-800"
            title="Move to first"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => handleMove('up')}
            disabled={selectedIndex === null || selectedIndex === 0 || loading}
            className="p-1 rounded border border-surface-300 dark:border-surface-600 text-surface-500 disabled:opacity-20 hover:bg-surface-100 dark:hover:bg-surface-800"
            title="Move up"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => handleMove('down')}
            disabled={selectedIndex === null || selectedIndex >= pageOrder.length - 1 || loading}
            className="p-1 rounded border border-surface-300 dark:border-surface-600 text-surface-500 disabled:opacity-20 hover:bg-surface-100 dark:hover:bg-surface-800"
            title="Move down"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => handleMove('last')}
            disabled={selectedIndex === null || loading}
            className="p-1 rounded border border-surface-300 dark:border-surface-600 text-surface-500 disabled:opacity-20 hover:bg-surface-100 dark:hover:bg-surface-800"
            title="Move to last"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
          <div className="w-px h-5 bg-surface-300 dark:bg-surface-700 mx-1" />
          <span className="text-[10px] text-surface-400">
            Select a page, then use arrows to reorder
          </span>
        </div>

        {/* Page list */}
        <div className="border border-surface-200 dark:border-surface-700 rounded max-h-80 overflow-y-auto">
          {pageOrder.map((pageNum, index) => (
            <button
              key={`${pageNum}-${index}`}
              type="button"
              onClick={() => setSelectedIndex(index === selectedIndex ? null : index)}
              className={`w-full flex items-center gap-3 px-3 py-1.5 text-xs text-left border-b border-surface-100 dark:border-surface-800 last:border-b-0 transition-colors ${
                selectedIndex === index
                  ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                  : pageNum !== index + 1
                    ? 'text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-900/10'
                    : 'text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800'
              }`}
            >
              <span className="text-surface-400 w-5 text-center tabular-nums shrink-0">
                {index + 1}
              </span>
              <span className="flex-1">Page {pageNum}</span>
              {pageNum !== index + 1 && (
                <span className="text-[10px] text-amber-500">moved from {pageNum}</span>
              )}
            </button>
          ))}
        </div>

        {hasChanges && (
          <p className="text-xs text-amber-500">
            Order has been changed. Click Apply Reorder to save as a new file.
          </p>
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
