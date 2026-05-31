import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../ui/Dialog';
import { mergePDFs } from '../../services/pdf-ops.service';

interface FileEntry {
  path: string;
  name: string;
  pageCount: number | null;
}

interface MergeDialogProps {
  open: boolean;
  onClose: () => void;
}

export function MergeDialog({ open, onClose }: MergeDialogProps) {
  const { t } = useTranslation();
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddFiles = useCallback(async () => {
    try {
      const result = await window.crosspdf.openFileDialog({
        multiSelections: true,
        filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
      });
      if (result.canceled || result.filePaths.length === 0) return;

      const newEntries: FileEntry[] = [];
      for (const filePath of result.filePaths) {
        const readResult = await window.crosspdf.readFile(filePath);
        if (!readResult.success || !readResult.data) continue;

        // Try to load the PDF to get page count
        let pageCount: number | null = null;
        try {
          const { PDFDocument } = await import('pdf-lib');
          const doc = await PDFDocument.load(readResult.data, {
            ignoreEncryption: true,
          });
          pageCount = doc.getPageCount();
        } catch {
          // Ignore — page count will show as unknown
        }

        const name = filePath.split(/[/\\]/).pop() ?? filePath;
        newEntries.push({ path: filePath, name, pageCount });
      }

      setFiles((prev) => [...prev, ...newEntries]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add files');
    }
  }, []);

  const handleRemove = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return;
    setFiles((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }, []);

  const handleMoveDown = useCallback((index: number) => {
    setFiles((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }, []);

  const handleMerge = useCallback(async () => {
    if (files.length < 2) return;

    setLoading(true);
    setError(null);

    try {
      // Read all files
      const sources: ArrayBuffer[] = [];
      for (const file of files) {
        const result = await window.crosspdf.readFile(file.path);
        if (!result.success || !result.data) {
          throw new Error(`Failed to read: ${file.name}`);
        }
        sources.push(result.data);
      }

      // Merge in worker
      const merged = await mergePDFs(sources);

      // Save As
      const saveResult = await window.crosspdf.saveFileDialog({
        defaultPath: 'merged.pdf',
        filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
      });
      if (saveResult.canceled || !saveResult.filePath) {
        setLoading(false);
        return;
      }

      await window.crosspdf.writeFile(saveResult.filePath, merged.buffer as ArrayBuffer);

      // Offer to open
      const openNow = confirm('Merge complete. Open the merged document?');
      if (openNow) {
        // Dispatch custom event to open from recent
        window.dispatchEvent(
          new CustomEvent('crosspdf:open-file', { detail: { filePath: saveResult.filePath } })
        );
      }

      onClose();
      setFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Merge failed');
    } finally {
      setLoading(false);
    }
  }, [files, onClose]);

  const totalPages = files.reduce((sum, f) => sum + (f.pageCount ?? 0), 0);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Merge PDF Documents"
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
            onClick={handleMerge}
            disabled={files.length < 2 || loading}
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
            Merge
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-surface-500">
            {files.length} file{files.length !== 1 ? 's' : ''} selected
          </span>
          <button
            type="button"
            onClick={handleAddFiles}
            disabled={loading}
            className="px-2 py-1 text-xs rounded border border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-30"
          >
            + Add Files
          </button>
        </div>

        {files.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-surface-400">
            <svg
              className="w-10 h-10"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <span className="text-xs">Add PDF files to merge</span>
          </div>
        )}

        {files.length > 0 && (
          <div className="border border-surface-200 dark:border-surface-700 rounded divide-y divide-surface-200 dark:divide-surface-700 max-h-64 overflow-y-auto">
            {files.map((file, i) => (
              <div key={file.path} className="flex items-center gap-2 px-3 py-2 text-xs">
                <span className="text-surface-400 w-5 text-center tabular-nums shrink-0">
                  {i + 1}
                </span>
                <span className="flex-1 truncate text-surface-700 dark:text-surface-300">
                  {file.name}
                </span>
                <span className="text-surface-400 shrink-0">
                  {file.pageCount !== null ? `${file.pageCount} p.` : '?'}
                </span>
                <button
                  type="button"
                  onClick={() => handleMoveUp(i)}
                  disabled={i === 0 || loading}
                  className="p-0.5 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-400 disabled:opacity-20"
                  aria-label={`Move ${file.name} up`}
                >
                  <svg
                    className="w-3 h-3"
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
                  onClick={() => handleMoveDown(i)}
                  disabled={i >= files.length - 1 || loading}
                  className="p-0.5 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-400 disabled:opacity-20"
                  aria-label={`Move ${file.name} down`}
                >
                  <svg
                    className="w-3 h-3"
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
                  onClick={() => handleRemove(i)}
                  disabled={loading}
                  className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-surface-400 hover:text-red-500 disabled:opacity-20"
                  aria-label={`Remove ${file.name}`}
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {files.length > 0 && (
          <p className="text-xs text-surface-500">
            Total: {files.length} file{files.length !== 1 ? 's' : ''}
            {totalPages > 0 && `, ${totalPages} page${totalPages !== 1 ? 's' : ''}`}
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
