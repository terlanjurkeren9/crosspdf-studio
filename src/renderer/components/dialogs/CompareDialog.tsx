import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../ui/Dialog';
import { diffTexts, type CompareResult, type DiffLine } from '../../lib/diff';

interface CompareDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CompareDialog({ open, onClose }: CompareDialogProps) {
  const { t } = useTranslation();
  const [leftFile, setLeftFile] = useState<{ path: string; name: string; text: string } | null>(
    null
  );
  const [rightFile, setRightFile] = useState<{ path: string; name: string; text: string } | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);

  const extractTextFromFile = async (filePath: string): Promise<string> => {
    const readResult = await window.crosspdf.readFile(filePath);
    if (!readResult.success || !readResult.data) {
      throw new Error('Failed to read file');
    }

    // Load PDF and extract text
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.mjs',
      import.meta.url
    ).toString();

    const doc = await pdfjsLib.getDocument({ data: readResult.data }).promise;
    let fullText = '';

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      fullText += textContent.items.map((item) => ('str' in item ? item.str : '')).join(' ');
      if (i < doc.numPages) fullText += '\n';
      page.cleanup();
    }

    doc.destroy();
    return fullText;
  };

  const handleSelectFile = useCallback(async (side: 'left' | 'right') => {
    try {
      const result = await window.crosspdf.openFileDialog({
        filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
      });
      if (result.canceled || result.filePaths.length === 0) return;

      const filePath = result.filePaths[0];
      const name = filePath.split(/[/\\]/).pop() ?? filePath;

      setLoading(true);
      setError(null);

      const text = await extractTextFromFile(filePath);
      const fileData = { path: filePath, name, text };

      if (side === 'left') {
        setLeftFile(fileData);
      } else {
        setRightFile(fileData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCompare = useCallback(async () => {
    if (!leftFile || !rightFile) return;

    setLoading(true);
    setError(null);

    try {
      const diffs = diffTexts(leftFile.text, rightFile.text);
      const stats = {
        added: diffs.filter((d) => d.type === 'added').length,
        removed: diffs.filter((d) => d.type === 'removed').length,
        equal: diffs.filter((d) => d.type === 'equal').length,
        total: diffs.length,
      };

      setResult({
        leftText: leftFile.text,
        rightText: rightFile.text,
        leftFileName: leftFile.name,
        rightFileName: rightFile.name,
        diffs,
        stats,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compare documents');
    } finally {
      setLoading(false);
    }
  }, [leftFile, rightFile]);

  const handleReset = useCallback(() => {
    setLeftFile(null);
    setRightFile(null);
    setResult(null);
    setError(null);
  }, []);

  const renderDiffLine = (line: DiffLine, side: 'left' | 'right') => {
    const isLeft = side === 'left';
    const lineNum = isLeft ? line.leftLineNum : line.rightLineNum;
    const showContent = isLeft ? line.type !== 'added' : line.type !== 'removed';

    let bgColor = 'bg-transparent';
    if (line.type === 'added' && !isLeft) bgColor = 'bg-green-100 dark:bg-green-900/30';
    if (line.type === 'removed' && isLeft) bgColor = 'bg-red-100 dark:bg-red-900/30';

    return (
      <div
        key={`${side}-${lineNum ?? 'null'}-${line.content}`}
        className={`flex text-xs font-mono ${bgColor}`}
      >
        <span className="w-12 shrink-0 px-2 py-0.5 text-right text-surface-400 select-none">
          {lineNum ?? ''}
        </span>
        <span className="flex-1 px-2 py-0.5 whitespace-pre-wrap">
          {showContent ? line.content : ''}
        </span>
      </div>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} title={t('compare.title', 'Compare Documents')}>
      <div className="w-full max-w-4xl">
        {!result ? (
          <>
            {/* File selection */}
            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-surface-500 mb-1">
                  {t('compare.leftFile', 'Original (Left)')}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={leftFile?.name ?? ''}
                    readOnly
                    placeholder={t('compare.selectFile', 'Select PDF...')}
                    className="flex-1 h-8 px-2 text-xs rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800"
                  />
                  <button
                    type="button"
                    onClick={() => handleSelectFile('left')}
                    className="px-3 h-8 text-xs font-medium rounded bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600"
                  >
                    {t('common.open', 'Open')}
                  </button>
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-surface-500 mb-1">
                  {t('compare.rightFile', 'Modified (Right)')}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={rightFile?.name ?? ''}
                    readOnly
                    placeholder={t('compare.selectFile', 'Select PDF...')}
                    className="flex-1 h-8 px-2 text-xs rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800"
                  />
                  <button
                    type="button"
                    onClick={() => handleSelectFile('right')}
                    className="px-3 h-8 text-xs font-medium rounded bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600"
                  >
                    {t('common.open', 'Open')}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 text-xs text-red-600 bg-red-50 dark:bg-red-950/30 rounded">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 h-8 text-xs font-medium rounded border border-surface-300 dark:border-surface-600 hover:bg-surface-100 dark:hover:bg-surface-700"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleCompare}
                disabled={!leftFile || !rightFile || loading}
                className="px-4 h-8 text-xs font-medium rounded bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-30 disabled:pointer-events-none"
              >
                {loading ? t('common.loading', 'Loading...') : t('compare.compare', 'Compare')}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Results */}
            <div className="mb-3 flex items-center gap-4 text-xs text-surface-500">
              <span className="text-green-600">+{result.stats.added} added</span>
              <span className="text-red-600">-{result.stats.removed} removed</span>
              <span>{result.stats.equal} unchanged</span>
            </div>

            <div className="flex gap-2 mb-3">
              <span className="text-[10px] font-medium text-surface-400">
                {result.leftFileName}
              </span>
              <span className="text-[10px] text-surface-300">vs</span>
              <span className="text-[10px] font-medium text-surface-400">
                {result.rightFileName}
              </span>
            </div>

            {/* Side-by-side diff */}
            <div className="flex gap-2 max-h-[400px] overflow-auto border border-surface-200 dark:border-surface-700 rounded">
              <div className="flex-1 overflow-auto">
                {result.diffs.map((line) => renderDiffLine(line, 'left'))}
              </div>
              <div className="w-px bg-surface-200 dark:bg-surface-700" />
              <div className="flex-1 overflow-auto">
                {result.diffs.map((line) => renderDiffLine(line, 'right'))}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 h-8 text-xs font-medium rounded border border-surface-300 dark:border-surface-600 hover:bg-surface-100 dark:hover:bg-surface-700"
              >
                {t('compare.compareAgain', 'Compare Again')}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 h-8 text-xs font-medium rounded bg-brand-500 text-white hover:bg-brand-600"
              >
                {t('common.close', 'Close')}
              </button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
