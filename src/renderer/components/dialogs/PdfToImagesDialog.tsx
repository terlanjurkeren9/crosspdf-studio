import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { convertPdfToImages } from '../../services/image.service';

interface PdfToImagesDialogProps {
  open: boolean;
  onClose: () => void;
  filePath: string;
  fileName: string;
  numPages: number;
  password?: string;
}

type Status = 'idle' | 'converting' | 'done' | 'error';

export function PdfToImagesDialog({
  open,
  onClose,
  filePath,
  numPages,
  password,
}: PdfToImagesDialogProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>('idle');
  const [pageRange, setPageRange] = useState(`1-${numPages}`);
  const [dpi, setDpi] = useState(144);
  const [errorMessage, setErrorMessage] = useState('');
  const [outputDir, setOutputDir] = useState('');

  const reset = useCallback(() => {
    setStatus('idle');
    setPageRange(`1-${numPages}`);
    setDpi(144);
    setErrorMessage('');
    setOutputDir('');
  }, [numPages]);

  const parseRange = useCallback(
    (raw: string): number[] => {
      const pages: number[] = [];
      const parts = raw.split(',').map((p) => p.trim());
      for (const part of parts) {
        if (part.includes('-')) {
          const [startStr, endStr] = part.split('-').map((s) => s.trim());
          const start = parseInt(startStr, 10);
          const end = parseInt(endStr, 10);
          if (isNaN(start) || isNaN(end) || start < 1 || end > numPages || start > end) {
            throw new Error(
              `Invalid page range "${part}". Pages must be between 1 and ${numPages}.`
            );
          }
          for (let i = start; i <= end; i++) pages.push(i);
        } else {
          const n = parseInt(part, 10);
          if (isNaN(n) || n < 1 || n > numPages) {
            throw new Error(
              `Invalid page number "${part}". Pages must be between 1 and ${numPages}.`
            );
          }
          pages.push(n);
        }
      }
      return [...new Set(pages)].sort((a, b) => a - b);
    },
    [numPages]
  );

  const handleConvert = useCallback(async () => {
    setErrorMessage('');

    let pageNumbers: number[];
    try {
      pageNumbers = parseRange(pageRange);
      if (pageNumbers.length === 0) {
        setErrorMessage('Please specify at least one page to export.');
        return;
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Invalid page range.');
      return;
    }

    // Pick output directory
    let dirPath: string;
    try {
      const result = await window.crosspdf.openFileDialog({
        title: 'Select Output Directory',
        properties: ['openDirectory'],
      });
      if (result.canceled || result.filePaths.length === 0) return;
      dirPath = result.filePaths[0];
    } catch {
      setErrorMessage('Failed to open directory picker.');
      return;
    }
    setOutputDir(dirPath);

    setStatus('converting');

    try {
      const readResult = await window.crosspdf.readFile(filePath);
      if (!readResult.success || !readResult.data) {
        setErrorMessage('Failed to read source PDF file.');
        setStatus('error');
        return;
      }

      const scale = dpi / 72;
      const { images } = await convertPdfToImages(readResult.data, pageNumbers, scale, password);

      let writeErrors = 0;
      for (const img of images) {
        const ext = img.mimeType === 'image/jpeg' ? 'jpg' : 'png';
        const outPath = `${dirPath}/page_${img.pageNumber}.${ext}`;
        const writeResult = await window.crosspdf.writeFile(outPath, img.bytes);
        if (!writeResult.success) writeErrors++;
      }

      if (writeErrors > 0) {
        setErrorMessage(
          `${writeErrors} of ${images.length} page(s) failed to write. Check disk space and permissions.`
        );
        setStatus('error');
      } else {
        setStatus('done');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error during conversion.');
      setStatus('error');
    }
  }, [pageRange, dpi, filePath, password, parseRange]);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const footer = (
    <>
      <Button variant="secondary" onClick={handleClose}>
        {status === 'done' ? t('common.close') : t('common.cancel')}
      </Button>
      {status !== 'done' && (
        <Button variant="primary" onClick={handleConvert} disabled={status === 'converting'}>
          {status === 'converting' ? 'Exporting...' : 'Choose Directory & Export'}
        </Button>
      )}
    </>
  );

  return (
    <Dialog open={open} onClose={handleClose} title="Export PDF to Images" footer={footer}>
      <div className="flex flex-col gap-4">
        {/* Page range */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-surface-600 dark:text-surface-400">
            Pages
          </label>
          <input
            type="text"
            value={pageRange}
            onChange={(e) => setPageRange(e.target.value)}
            disabled={status === 'converting'}
            className="w-full h-8 px-2 text-sm rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 outline-none focus:border-brand-400 disabled:opacity-50"
            placeholder={`e.g. 1-${numPages}`}
          />
          <span className="text-xs text-surface-400">
            Comma-separated pages or ranges (e.g. 1,3,5-8). Max: {numPages}.
          </span>
        </div>

        {/* DPI */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-surface-600 dark:text-surface-400">
            Resolution (DPI)
          </label>
          <select
            value={dpi}
            onChange={(e) => setDpi(parseInt(e.target.value, 10))}
            disabled={status === 'converting'}
            className="w-full h-8 px-2 text-sm rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 outline-none focus:border-brand-400 disabled:opacity-50"
          >
            <option value={72}>72 DPI (screen)</option>
            <option value={144}>144 DPI (2x)</option>
            <option value={200}>200 DPI</option>
            <option value={300}>300 DPI (print)</option>
          </select>
        </div>

        {/* Status */}
        {status === 'converting' && (
          <div className="flex items-center gap-2 text-sm text-surface-500">
            <Spinner />
            Exporting pages as PNG images...
          </div>
        )}

        {status === 'done' && (
          <div className="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 rounded p-2">
            Exported to: {outputDir}
          </div>
        )}

        {status === 'error' && (
          <div className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded p-2">
            {errorMessage}
          </div>
        )}
      </div>
    </Dialog>
  );
}
