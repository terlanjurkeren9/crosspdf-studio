import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../ui/Dialog';
import { useBatchStore, type BatchJob } from '../../stores/batch.store';
import { mergePDFs } from '../../services/pdf-ops.service';
import { checkWriteResult } from '../../lib/batch-merge';
import { Trash2, CheckCircle, XCircle, Loader2, Play, Plus, FolderOpen } from 'lucide-react';

interface BatchDialogProps {
  open: boolean;
  onClose: () => void;
}

type BatchOperationType = 'merge' | 'split' | 'convert' | 'ocr';

const PLANNED_OPS: Set<string> = new Set(['split', 'convert', 'ocr']);

const OPERATION_LABELS: Record<string, string> = {
  merge: 'Merge PDFs',
  split: 'Split PDF (planned)',
  convert: 'Convert to Images (planned)',
  ocr: 'OCR Document (planned)',
  redact: 'Redact Document (planned)',
  password: 'Password Protect (planned)',
};

export function BatchDialog({ open, onClose }: BatchDialogProps) {
  const { t } = useTranslation();
  const { jobs, removeJob, clearCompleted, setRunning } = useBatchStore();
  const [selectedType, setSelectedType] = useState<BatchOperationType>('merge');
  const [processing, setProcessing] = useState(false);

  const handleAddJob = useCallback(async () => {
    try {
      const result = await window.crosspdf.openFileDialog({
        multiSelections: selectedType === 'merge',
        filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
      });
      if (result.canceled || result.filePaths.length === 0) return;

      const fileNames = result.filePaths.map((p) => p.split(/[/\\]/).pop() ?? p);

      useBatchStore.getState().addJob({
        type: selectedType,
        inputFiles: result.filePaths,
        params: { fileNames },
      });
    } catch (err) {
      console.error('Failed to add batch job:', err);
    }
  }, [selectedType]);

  const handleProcessQueue = useCallback(async () => {
    const pendingJobs = jobs.filter((j) => j.status === 'pending');
    if (pendingJobs.length === 0) return;

    setProcessing(true);
    setRunning(true);

    for (const job of pendingJobs) {
      if (PLANNED_OPS.has(job.type)) {
        useBatchStore.getState().updateJob(job.id, {
          status: 'failed',
          error: `"${job.type}" batch operation is not yet implemented. Only merge is currently supported.`,
          completedAt: Date.now(),
        });
        continue;
      }

      useBatchStore.getState().updateJob(job.id, { status: 'running' });

      try {
        if (job.type === 'merge') {
          await executeMerge(job);
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
            'Batch merge is fully functional. Split, convert, and OCR operations are planned and will fail if queued.'
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
