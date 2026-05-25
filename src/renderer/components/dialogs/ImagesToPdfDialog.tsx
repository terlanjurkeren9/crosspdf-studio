import { useCallback, useState } from 'react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { createPdfFromImages } from '../../services/image.service';

interface ImageFile {
  path: string;
  name: string;
}

interface ImagesToPdfDialogProps {
  open: boolean;
  onClose: () => void;
}

type Status = 'idle' | 'creating' | 'done' | 'error';

export function ImagesToPdfDialog({ open, onClose }: ImagesToPdfDialogProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [images, setImages] = useState<ImageFile[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [outputPath, setOutputPath] = useState('');

  const reset = useCallback(() => {
    setStatus('idle');
    setImages([]);
    setErrorMessage('');
    setOutputPath('');
  }, []);

  const handleSelectImages = useCallback(async () => {
    try {
      const result = await window.crosspdf.openFileDialog({
        title: 'Select Images',
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }],
        multiSelections: true,
      });
      if (result.canceled || result.filePaths.length === 0) return;

      const files = result.filePaths.map((p) => ({
        path: p,
        name: p.split(/[/\\]/).pop() ?? p,
      }));

      // Auto-sort by filename
      files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

      setImages(files);
      setStatus('idle');
    } catch {
      setErrorMessage('Failed to open file picker.');
      setStatus('error');
    }
  }, []);

  const moveImage = useCallback((index: number, direction: -1 | 1) => {
    setImages((prev) => {
      const next = [...prev];
      const targetIdx = index + direction;
      if (targetIdx < 0 || targetIdx >= next.length) return prev;
      [next[index], next[targetIdx]] = [next[targetIdx], next[index]];
      return next;
    });
  }, []);

  const removeImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleCreate = useCallback(async () => {
    if (images.length === 0) {
      setErrorMessage('Please select at least one image.');
      return;
    }

    setErrorMessage('');

    // Read all images
    setStatus('creating');
    try {
      const imageBuffers: { bytes: ArrayBuffer; mimeType: string }[] = [];
      for (const img of images) {
        const readResult = await window.crosspdf.readFile(img.path);
        if (!readResult.success || !readResult.data) {
          setErrorMessage(`Failed to read image: ${img.name}`);
          setStatus('error');
          return;
        }
        const ext = img.name.split('.').pop()?.toLowerCase() ?? '';
        const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
        imageBuffers.push({ bytes: readResult.data, mimeType });
      }

      // Create PDF via worker
      const pdfBytes = await createPdfFromImages(imageBuffers);

      // Save dialog
      const saveResult = await window.crosspdf.saveFileDialog({
        defaultPath: 'images.pdf',
        filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
      });
      if (saveResult.canceled || !saveResult.filePath) {
        setStatus('idle');
        return;
      }

      const writeResult = await window.crosspdf.writeFile(saveResult.filePath, pdfBytes);
      if (!writeResult.success) {
        setErrorMessage('Failed to write output PDF file.');
        setStatus('error');
        return;
      }

      setOutputPath(saveResult.filePath);
      setStatus('done');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error during conversion.');
      setStatus('error');
    }
  }, [images]);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const footer = (
    <>
      <Button variant="secondary" onClick={handleClose}>
        {status === 'done' ? 'Close' : 'Cancel'}
      </Button>
      {status !== 'done' && (
        <Button
          variant="primary"
          onClick={handleCreate}
          disabled={status === 'creating' || images.length === 0}
        >
          {status === 'creating' ? 'Creating PDF...' : 'Create PDF'}
        </Button>
      )}
    </>
  );

  return (
    <Dialog open={open} onClose={handleClose} title="Create PDF from Images" footer={footer}>
      <div className="flex flex-col gap-4">
        {/* Select images button */}
        <Button variant="secondary" onClick={handleSelectImages} disabled={status === 'creating'}>
          {images.length === 0
            ? 'Select Image Files'
            : `Add More Images (${images.length} selected)`}
        </Button>

        {/* Image list */}
        {images.length > 0 && (
          <div className="border border-surface-200 dark:border-surface-700 rounded overflow-hidden">
            <div className="max-h-48 overflow-y-auto">
              {images.map((img, idx) => (
                <div
                  key={`${img.path}-${idx}`}
                  className="flex items-center gap-2 px-3 py-2 border-b border-surface-100 dark:border-surface-800 last:border-b-0 text-sm"
                >
                  <span className="text-xs text-surface-400 w-6 tabular-nums text-right shrink-0">
                    {idx + 1}
                  </span>
                  <span className="flex-1 truncate text-surface-700 dark:text-surface-300">
                    {img.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => moveImage(idx, -1)}
                    disabled={idx === 0 || status === 'creating'}
                    className="p-0.5 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-400 disabled:opacity-30"
                    title="Move up"
                    aria-label="Move up"
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
                    onClick={() => moveImage(idx, 1)}
                    disabled={idx === images.length - 1 || status === 'creating'}
                    className="p-0.5 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-400 disabled:opacity-30"
                    title="Move down"
                    aria-label="Move down"
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
                    onClick={() => removeImage(idx)}
                    disabled={status === 'creating'}
                    className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-surface-400 hover:text-red-600 disabled:opacity-30"
                    title="Remove"
                    aria-label="Remove"
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
          </div>
        )}

        {/* Status */}
        {status === 'creating' && (
          <div className="flex items-center gap-2 text-sm text-surface-500">
            <Spinner />
            Creating PDF from {images.length} image(s)...
          </div>
        )}

        {status === 'done' && (
          <div className="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 rounded p-2">
            PDF created: {outputPath}
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
