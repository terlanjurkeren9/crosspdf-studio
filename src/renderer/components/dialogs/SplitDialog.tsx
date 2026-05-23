import { useCallback, useMemo, useState } from 'react';
import { Dialog } from '../ui/Dialog';
import { splitPDF } from '../../services/pdf-ops.service';
import {
  buildSplitByCountPlan,
  buildSplitByRangesPlan,
  splitOutputName,
} from '../../lib/page-range-parser';

interface SplitDialogProps {
  open: boolean;
  onClose: () => void;
  sourceFilePath: string;
  sourceFileName: string;
  totalPages: number;
}

type SplitMode = 'count' | 'ranges';

export function SplitDialog({
  open,
  onClose,
  sourceFilePath,
  sourceFileName,
  totalPages,
}: SplitDialogProps) {
  const [mode, setMode] = useState<SplitMode>('count');
  const [pagesPerFile, setPagesPerFile] = useState(1);
  const [rangesInput, setRangesInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const outputPlan = useMemo((): number[][] => {
    if (mode === 'count') {
      if (!pagesPerFile || pagesPerFile < 1) return [];
      return buildSplitByCountPlan(totalPages, pagesPerFile);
    }
    if (!rangesInput.trim()) return [];
    return buildSplitByRangesPlan(totalPages, rangesInput);
  }, [mode, pagesPerFile, rangesInput, totalPages]);

  const totalOutputFiles = outputPlan.length;

  const handleSplit = useCallback(async () => {
    if (outputPlan.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      // Read source file
      const readResult = await window.crosspdf.readFile(sourceFilePath);
      if (!readResult.success || !readResult.data) {
        throw new Error('Failed to read source file');
      }

      const results = await splitPDF(readResult.data, {
        ...(mode === 'count'
          ? { pagesPerFile }
          : { ranges: outputPlan }),
      });

      // Show save dialog for first part to establish output directory
      const firstName = splitOutputName(sourceFileName, 0);
      const firstSave = await window.crosspdf.saveFileDialog({
        defaultPath: firstName,
        filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
      });
      if (firstSave.canceled || !firstSave.filePath) {
        setLoading(false);
        return;
      }

      // Derive output directory and base name pattern from user's first choice
      const firstPath = firstSave.filePath;
      const dir = firstPath.slice(0, firstPath.lastIndexOf('/') + 1) || firstPath.slice(0, firstPath.lastIndexOf('\\') + 1);
      const firstPathBase = firstPath.slice(
        (dir || firstPath.slice(0, Math.max(firstPath.lastIndexOf('/'), firstPath.lastIndexOf('\\')) + 1)).length
      );

      // Write first part
      await window.crosspdf.writeFile(firstPath, results[0].buffer as ArrayBuffer);

      // Write remaining parts to same directory with numbered naming
      let successCount = 1;
      for (let i = 1; i < results.length; i++) {
        // Derive part filename from the user's chosen first filename
        const partMatch = firstPathBase.match(/(.*?)-part-\d+(\.pdf)$/i);
        let partPath: string;
        if (partMatch) {
          partPath = dir + partMatch[1] + `-part-${i + 1}` + partMatch[2];
        } else {
          partPath = dir + splitOutputName(firstPathBase.replace(/\.pdf$/i, ''), i);
        }
        await window.crosspdf.writeFile(partPath, results[i].buffer as ArrayBuffer);
        successCount++;
      }

      const dirInfo = dir ? ` in:\n${dir}` : '';
      alert(
        `Split complete. ${successCount} file(s) saved${dirInfo}.\n\n` +
        `Naming pattern: ${sourceFileName}-part-N.pdf`
      );

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Split failed');
    } finally {
      setLoading(false);
    }
  }, [outputPlan, mode, pagesPerFile, sourceFilePath, sourceFileName, onClose]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Split PDF"
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
          <button
            type="button"
            onClick={handleSplit}
            disabled={totalOutputFiles === 0 || loading}
            className="px-3 py-1.5 text-xs rounded text-white bg-brand-500 hover:bg-brand-600 disabled:opacity-30 flex items-center gap-2"
          >
            {loading && (
              <svg
                className="w-3 h-3 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
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
            Split
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs text-surface-500">
          Source: {sourceFileName} ({totalPages} page{totalPages !== 1 ? 's' : ''})
        </p>

        {/* Mode toggle */}
        <div className="flex gap-1 bg-surface-100 dark:bg-surface-800 rounded p-0.5">
          <button
            type="button"
            onClick={() => setMode('count')}
            className={`flex-1 px-2 py-1 text-xs rounded ${
              mode === 'count'
                ? 'bg-white dark:bg-surface-700 text-surface-800 dark:text-surface-200 shadow-sm'
                : 'text-surface-500 hover:text-surface-700'
            }`}
          >
            By page count
          </button>
          <button
            type="button"
            onClick={() => setMode('ranges')}
            className={`flex-1 px-2 py-1 text-xs rounded ${
              mode === 'ranges'
                ? 'bg-white dark:bg-surface-700 text-surface-800 dark:text-surface-200 shadow-sm'
                : 'text-surface-500 hover:text-surface-700'
            }`}
          >
            By page ranges
          </button>
        </div>

        {mode === 'count' && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-surface-600 dark:text-surface-400 shrink-0">
              Pages per file:
            </label>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={pagesPerFile}
              onChange={(e) =>
                setPagesPerFile(Math.max(1, parseInt(e.target.value, 10) || 1))
              }
              className="w-20 h-7 text-xs text-center rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 outline-none focus:border-brand-400"
            />
          </div>
        )}

        {mode === 'ranges' && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-surface-600 dark:text-surface-400">
              Page ranges (e.g. 1-5, 6-10, 11-15):
            </label>
            <input
              type="text"
              value={rangesInput}
              onChange={(e) => setRangesInput(e.target.value)}
              placeholder={`1-5, 6-10, 11-${totalPages}`}
              className="h-7 px-2 text-xs rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 outline-none focus:border-brand-400"
            />
          </div>
        )}

        {/* Output preview */}
        {totalOutputFiles > 0 && (
          <div className="border border-surface-200 dark:border-surface-700 rounded max-h-48 overflow-y-auto">
            {outputPlan.map((chunk, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-1.5 text-xs border-b border-surface-100 dark:border-surface-800 last:border-b-0"
              >
                <span className="text-surface-400 w-5 shrink-0 tabular-nums">
                  {i + 1}
                </span>
                <span className="text-surface-500 truncate font-mono text-[11px]">
                  {splitOutputName(sourceFileName, i)}
                </span>
                <span className="text-surface-400 shrink-0 ml-auto">
                  {chunk.length} p.
                </span>
              </div>
            ))}
          </div>
        )}

        {totalOutputFiles > 0 && (
          <p className="text-xs text-surface-500">
            {totalOutputFiles} output file{totalOutputFiles !== 1 ? 's' : ''}
          </p>
        )}

        {totalOutputFiles === 0 && mode === 'ranges' && rangesInput.trim() && (
          <p className="text-xs text-amber-500">
            Enter valid page ranges separated by commas.
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
