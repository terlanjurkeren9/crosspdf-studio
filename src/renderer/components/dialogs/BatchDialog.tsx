import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../ui/Dialog';
import { useBatchStore, type BatchJob } from '../../stores/batch.store';
import { mergePDFs } from '../../services/pdf-ops.service';
import { convertPdfToImages } from '../../services/image.service';
import { runOcr, OCR_LANGUAGES } from '../../services/ocr.service';
import { formatOcrExport } from '../../services/export.service';
import { checkWriteResult } from '../../lib/batch-merge';
import { Trash2, CheckCircle, XCircle, Loader2, Play, Plus, FolderOpen } from 'lucide-react';

interface BatchDialogProps {
  open: boolean;
  onClose: () => void;
}

interface BatchJobParams extends Record<string, unknown> {
  fileNames: string[];
  imageFormat?: 'png' | 'jpeg';
  ocrPageRange?: string;
  ocrLanguage?: string;
  ocrDpi?: number;
}

type BatchOperationType = 'merge' | 'split' | 'convert' | 'ocr';

const PLANNED_OPS: Set<string> = new Set(['split']);

const OPERATION_LABELS: Record<string, string> = {
  merge: 'Merge PDFs',
  split: 'Split PDF (planned)',
  convert: 'Convert to Images',
  ocr: 'OCR Document',
  redact: 'Redact Document (planned)',
  password: 'Password Protect (planned)',
};

export function BatchDialog({ open, onClose }: BatchDialogProps) {
  const { t } = useTranslation();
  const { jobs, removeJob, clearCompleted, setRunning } = useBatchStore();
  const [selectedType, setSelectedType] = useState<BatchOperationType>('merge');
  const [selectedFormat, setSelectedFormat] = useState<'png' | 'jpeg'>('png');
  const [selectedOcrLanguage, setSelectedOcrLanguage] = useState<string>('eng');
  const [selectedOcrPageRange, setSelectedOcrPageRange] = useState<string>('1-');
  const [processing, setProcessing] = useState(false);

  const handleAddJob = useCallback(async () => {
    try {
      const isConvert = selectedType === 'convert';
      const isOcr = selectedType === 'ocr';
      const result = await window.crosspdf.openFileDialog({
        multiSelections: selectedType === 'merge',
        filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
      });
      if (result.canceled || result.filePaths.length === 0) return;

      if ((isConvert || isOcr) && result.filePaths.length > 1) {
        alert(`Please select only one PDF for ${isConvert ? 'conversion' : 'OCR'}.`);
        return;
      }

      const fileNames = result.filePaths.map((p) => p.split(/[/\\]/).pop() ?? p);
      const params: BatchJobParams = { fileNames };
      if (isConvert) {
        params.imageFormat = selectedFormat;
      } else if (selectedType === 'ocr') {
        params.ocrPageRange = selectedOcrPageRange;
        params.ocrLanguage = selectedOcrLanguage;
        params.ocrDpi = 300;
      }

      useBatchStore.getState().addJob({
        type: selectedType,
        inputFiles: result.filePaths,
        params,
      });
    } catch (err) {
      console.error('Failed to add batch job:', err);
    }
  }, [selectedType, selectedFormat, selectedOcrLanguage, selectedOcrPageRange]);

  const handleProcessQueue = useCallback(async () => {
    const pendingJobs = jobs.filter((j) => j.status === 'pending');
    if (pendingJobs.length === 0) return;

    setProcessing(true);
    setRunning(true);

    for (const job of pendingJobs) {
      if (PLANNED_OPS.has(job.type)) {
        useBatchStore.getState().updateJob(job.id, {
          status: 'failed',
          error: `"${job.type}" batch operation is not yet implemented. Only merge, convert, and OCR are currently supported.`,
          completedAt: Date.now(),
        });
        continue;
      }

      useBatchStore.getState().updateJob(job.id, { status: 'running' });

      try {
        if (job.type === 'merge') {
          await executeMerge(job);
        } else if (job.type === 'convert') {
          await executeConvert(job);
        } else if (job.type === 'ocr') {
          await executeOcr(job);
        } else {
          throw new Error(`Unknown batch operation: ${job.type}`);
        }
      } catch (err) {
        useBatchStore.getState().updateJob(job.id, {
          status: 'failed',
          error: err instanceof Error ? err.message : 'Unknown error',
          completedAt: Date.now(),
        });
      }
    }

    setProcessing(false);
    setRunning(false);
  }, [jobs, setRunning]);

  const pendingCount = jobs.filter((j) => j.status === 'pending').length;
  const runningCount = jobs.filter((j) => j.status === 'running').length;
  const completedCount = jobs.filter((j) => j.status === 'completed').length;
  const failedCount = jobs.filter((j) => j.status === 'failed').length;

  return (
    <Dialog open={open} onClose={onClose} title={t('batch.title', 'Batch Processing')}>
      <div className="w-full max-w-2xl">
        {/* Status notice */}
        <div className="mb-3 p-2 text-[10px] text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-950/30 rounded border border-blue-200 dark:border-blue-800">
          {t(
            'batch.realNotice',
            'Batch merge, convert, and OCR are fully functional. Split operations are planned and will fail if queued.'
          )}
        </div>

        {/* Add job section */}
        <div className="flex items-center gap-2 mb-4">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as BatchOperationType)}
            className="h-8 px-2 text-xs rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800"
          >
            <option value="merge">{OPERATION_LABELS.merge}</option>
            <option value="split">{OPERATION_LABELS.split}</option>
            <option value="convert">{OPERATION_LABELS.convert}</option>
            <option value="ocr">{OPERATION_LABELS.ocr}</option>
          </select>
          {selectedType === 'convert' && (
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value as 'png' | 'jpeg')}
              className="h-8 px-2 text-xs rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800"
            >
              <option value="png">PNG</option>
              <option value="jpeg">JPEG</option>
            </select>
          )}
          {selectedType === 'ocr' && (
            <>
              <select
                value={selectedOcrLanguage}
                onChange={(e) => setSelectedOcrLanguage(e.target.value)}
                className="h-8 px-2 text-xs rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800"
              >
                {OCR_LANGUAGES.map((language) => (
                  <option key={language.code} value={language.code}>
                    {language.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={selectedOcrPageRange}
                onChange={(e) => setSelectedOcrPageRange(e.target.value)}
                placeholder="1-3, 5"
                className="h-8 w-20 px-2 text-xs rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800"
              />
            </>
          )}
          <button
            type="button"
            onClick={handleAddJob}
            className="flex items-center gap-1 px-3 h-8 text-xs font-medium rounded bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('batch.addJob', 'Add Job')}
          </button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mb-3 text-xs text-surface-500">
          <span>{pendingCount} pending</span>
          <span>{runningCount} running</span>
          <span className="text-green-600">{completedCount} completed</span>
          {failedCount > 0 && <span className="text-red-600">{failedCount} failed</span>}
        </div>

        {/* Job list */}
        <div className="max-h-[300px] overflow-auto border border-surface-200 dark:border-surface-700 rounded mb-4">
          {jobs.length === 0 ? (
            <div className="p-4 text-center text-xs text-surface-400">
              {t('batch.noJobs', 'No jobs in queue. Click "Add Job" to begin.')}
            </div>
          ) : (
            jobs.map((job) => <JobItem key={job.id} job={job} onRemove={() => removeJob(job.id)} />)
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={clearCompleted}
            disabled={completedCount === 0 && failedCount === 0}
            className="px-3 h-8 text-xs font-medium rounded border border-surface-300 dark:border-surface-600 hover:bg-surface-100 dark:hover:bg-surface-700 disabled:opacity-30"
          >
            {t('batch.clearCompleted', 'Clear Completed')}
          </button>
          <button
            type="button"
            onClick={handleProcessQueue}
            disabled={pendingCount === 0 || processing}
            className="flex items-center gap-1 px-4 h-8 text-xs font-medium rounded bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-30"
          >
            {processing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {t('batch.process', 'Process Queue')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 h-8 text-xs font-medium rounded border border-surface-300 dark:border-surface-600 hover:bg-surface-100 dark:hover:bg-surface-700"
          >
            {t('common.close', 'Close')}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

async function executeMerge(job: BatchJob): Promise<void> {
  if (job.inputFiles.length < 2) {
    throw new Error('Merge requires at least 2 PDF files.');
  }

  // Read all input files
  const sources: ArrayBuffer[] = [];
  for (const filePath of job.inputFiles) {
    const result = await window.crosspdf.readFile(filePath);
    if (!result.success || !result.data) {
      const name = filePath.split(/[/\\]/).pop() ?? filePath;
      throw new Error(`Failed to read file: ${name}`);
    }
    sources.push(result.data);
  }

  // Merge in worker
  const merged = await mergePDFs(sources);

  // Prompt for output location
  const defaultName = `merged-${new Date().toISOString().slice(0, 10)}.pdf`;
  const saveResult = await window.crosspdf.saveFileDialog({
    defaultPath: defaultName,
    filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
  });
  if (saveResult.canceled || !saveResult.filePath) {
    throw new Error('Save cancelled — no output file selected.');
  }

  // Write output
  const writeResult = await window.crosspdf.writeFile(
    saveResult.filePath,
    merged.buffer as ArrayBuffer
  );
  checkWriteResult(writeResult);

  // Mark completed with output path
  useBatchStore.getState().updateJob(job.id, {
    status: 'completed',
    outputPath: saveResult.filePath,
    completedAt: Date.now(),
  });
}

async function executeConvert(job: BatchJob): Promise<void> {
  if (job.inputFiles.length !== 1) {
    throw new Error('Conversion requires exactly 1 PDF file.');
  }

  const filePath = job.inputFiles[0];
  const readResult = await window.crosspdf.readFile(filePath);
  if (!readResult.success || !readResult.data) {
    const name = filePath.split(/[/\\]/).pop() ?? filePath;
    throw new Error(`Failed to read file: ${name}`);
  }
  const pdfBytes = readResult.data;

  const { PDFDocument } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.load(pdfBytes.slice(0), { ignoreEncryption: true });
  const pageCount = pdfDoc.getPageCount();
  const pageNumbers = Array.from({ length: pageCount }, (_, i) => i + 1);

  const saveResult = await window.crosspdf.openFileDialog({
    title: 'Select Output Directory',
    properties: ['openDirectory'],
  });
  if (saveResult.canceled || saveResult.filePaths.length === 0) {
    throw new Error('Save cancelled — no output directory selected.');
  }
  const outputDir = saveResult.filePaths[0];

  const params = job.params as BatchJobParams;
  const format = params.imageFormat === 'jpeg' ? 'jpeg' : 'png';
  const { images } = await convertPdfToImages(pdfBytes, pageNumbers, 2, undefined, format);

  const baseName =
    filePath
      .split(/[/\\]/)
      .pop()
      ?.replace(/\.pdf$/i, '') ?? 'output';
  const ext = format === 'jpeg' ? 'jpg' : 'png';

  for (const img of images) {
    const fileName = `${baseName}-page-${String(img.pageNumber).padStart(3, '0')}.${ext}`;
    const outPath = `${outputDir}/${fileName}`;
    const writeResult = await window.crosspdf.writeFile(outPath, img.bytes);
    checkWriteResult(writeResult);
  }

  useBatchStore.getState().updateJob(job.id, {
    status: 'completed',
    outputPath: outputDir,
    completedAt: Date.now(),
  });
}

async function executeOcr(job: BatchJob): Promise<void> {
  if (job.inputFiles.length !== 1) {
    throw new Error('OCR requires exactly 1 PDF file.');
  }

  const filePath = job.inputFiles[0];
  const readResult = await window.crosspdf.readFile(filePath);
  if (!readResult.success || !readResult.data) {
    const name = filePath.split(/[/\\]/).pop() ?? filePath;
    throw new Error(`Failed to read file: ${name}`);
  }
  const pdfBytes = readResult.data;

  const { PDFDocument } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.load(pdfBytes.slice(0), { ignoreEncryption: true });
  const pageCount = pdfDoc.getPageCount();

  const params = job.params as BatchJobParams;
  const pageNumbers = parseBatchPageRange(params.ocrPageRange ?? '', pageCount);
  const language = params.ocrLanguage ?? 'eng';
  const dpi = params.ocrDpi ?? 300;

  const saveResult = await window.crosspdf.openFileDialog({
    title: 'Select Output Directory',
    properties: ['openDirectory'],
  });
  if (saveResult.canceled || saveResult.filePaths.length === 0) {
    throw new Error('Save cancelled — no output directory selected.');
  }
  const outputDir = saveResult.filePaths[0];

  const results = await runOcr(pdfBytes, pageNumbers, language, dpi, () => {});
  const text = formatOcrExport(results, {
    includePageNumbers: true,
    includeConfidence: true,
  });

  const baseName =
    filePath
      .split(/[/\\]/)
      .pop()
      ?.replace(/\.pdf$/i, '') ?? 'output';
  const outPath = `${outputDir}/${baseName}-ocr.txt`;
  const encoded = new TextEncoder().encode(text);
  const data = encoded.buffer.slice(
    encoded.byteOffset,
    encoded.byteOffset + encoded.byteLength
  ) as ArrayBuffer;
  const writeResult = await window.crosspdf.writeFile(outPath, data);
  checkWriteResult(writeResult);

  useBatchStore.getState().updateJob(job.id, {
    status: 'completed',
    outputPath: outPath,
    completedAt: Date.now(),
  });
}

function parseBatchPageRange(input: string, maxPage: number): number[] {
  if (maxPage < 1) {
    throw new Error('PDF has no pages to process.');
  }

  const raw = input.trim().toLowerCase();
  if (raw === '' || raw === 'all') {
    return Array.from({ length: maxPage }, (_, index) => index + 1);
  }

  const pages = new Set<number>();
  for (const part of raw.split(',')) {
    const token = part.trim();
    if (!token) continue;

    const range = token.match(/^(\d+)\s*-\s*(\d*)$/);
    if (range) {
      const start = Number.parseInt(range[1], 10);
      const end = range[2] ? Number.parseInt(range[2], 10) : maxPage;
      if (start < 1 || start > maxPage || end < 1 || end > maxPage || start > end) {
        throw new Error(`Invalid page range "${token}". Pages must be between 1 and ${maxPage}.`);
      }
      for (let page = start; page <= end; page++) pages.add(page);
      continue;
    }

    const page = Number.parseInt(token, 10);
    if (!Number.isInteger(page) || page < 1 || page > maxPage || String(page) !== token) {
      throw new Error(`Invalid page "${token}". Pages must be between 1 and ${maxPage}.`);
    }
    pages.add(page);
  }

  if (pages.size === 0) {
    throw new Error('Select at least one page for OCR.');
  }

  return Array.from(pages).sort((a, b) => a - b);
}

function JobItem({ job, onRemove }: { job: BatchJob; onRemove: () => void }) {
  const fileCount = job.inputFiles.length;
  const fileName = job.inputFiles[0]?.split(/[/\\]/).pop() ?? 'Unknown';
  const displayName = fileCount > 1 ? `${fileName} + ${fileCount - 1} more` : fileName;

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-200 dark:border-surface-700 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{OPERATION_LABELS[job.type] ?? job.type}</div>
        <div className="text-[10px] text-surface-400 truncate">{displayName}</div>
        {job.outputPath && (
          <div className="flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400 truncate">
            <FolderOpen className="h-3 w-3 shrink-0" />
            {job.outputPath.split(/[/\\]/).pop()}
          </div>
        )}
        {job.error && (
          <div className="text-[10px] text-red-500 dark:text-red-400 truncate">{job.error}</div>
        )}
      </div>
      <StatusIcon status={job.status} />
      <button
        type="button"
        onClick={onRemove}
        className="p-1 text-surface-400 hover:text-red-500 rounded hover:bg-surface-100 dark:hover:bg-surface-800"
        aria-label="Remove job"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function StatusIcon({ status }: { status: BatchJob['status'] }) {
  switch (status) {
    case 'pending':
      return (
        <div className="w-4 h-4 rounded-full border-2 border-surface-300 dark:border-surface-600" />
      );
    case 'running':
      return <Loader2 className="h-4 w-4 text-brand-500 animate-spin" />;
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
  }
}
