import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../ui/Dialog';
import { CheckCircle, XCircle, FileText } from 'lucide-react';

interface ValidateDialogProps {
  open: boolean;
  onClose: () => void;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  isPdfA: boolean;
  pdfaLevel?: string;
}

export function ValidateDialog({ open, onClose }: ValidateDialogProps) {
  const { t } = useTranslation();
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelectFile = useCallback(async () => {
    try {
      const result = await window.crosspdf.openFileDialog({
        filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
      });
      if (result.canceled || result.filePaths.length === 0) return;

      const path = result.filePaths[0];
      const name = path.split(/[/\\]/).pop() ?? path;
      setFilePath(path);
      setFileName(name);
      setResult(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select file');
    }
  }, []);

  const handleValidate = useCallback(async () => {
    if (!filePath) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const validation = await window.crosspdf.validatePdf(filePath);
      setResult(validation);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setLoading(false);
    }
  }, [filePath]);

  return (
    <Dialog open={open} onClose={onClose} title={t('validate.title', 'Validate PDF')}>
      <div className="w-full max-w-lg">
        {/* File selection */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-surface-500 mb-1">
            {t('validate.selectFile', 'Select PDF to validate')}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={fileName ?? ''}
              readOnly
              placeholder={t('validate.selectFile', 'Select PDF...')}
              className="flex-1 h-8 px-2 text-xs rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800"
            />
            <button
              type="button"
              onClick={handleSelectFile}
              className="flex items-center gap-1 px-3 h-8 text-xs font-medium rounded bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600"
            >
              <FileText className="h-3.5 w-3.5" />
              {t('common.open', 'Open')}
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 text-xs text-red-600 bg-red-50 dark:bg-red-950/30 rounded">
            {error}
          </div>
        )}

        {/* Validation results */}
        {result && (
          <div className="mb-4 space-y-3">
            {/* Overall status */}
            <div
              className={`flex items-center gap-2 p-3 rounded ${
                result.valid
                  ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300'
                  : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
              }`}
            >
              {result.valid ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
              <span className="text-sm font-medium">
                {result.valid
                  ? t('validate.valid', 'PDF is valid')
                  : t('validate.invalid', 'PDF has issues')}
              </span>
            </div>

            {/* PDF/A status */}
            <div className="flex items-center gap-2 text-xs text-surface-600 dark:text-surface-400">
              <span>{t('validate.pdfA', 'PDF/A compliance')}:</span>
              {result.isPdfA ? (
                <span className="text-green-600">
                  {t('validate.pdfACompliant', 'Compliant')}{' '}
                  {result.pdfaLevel && `(Level ${result.pdfaLevel})`}
                </span>
              ) : (
                <span className="text-surface-400">{t('validate.notPdfA', 'Not PDF/A')}</span>
              )}
            </div>

            {/* Errors */}
            {result.errors.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-red-600 mb-1">
                  {t('validate.errors', 'Errors')}
                </h4>
                <div className="max-h-[100px] overflow-auto text-[10px] font-mono bg-red-50 dark:bg-red-950/30 p-2 rounded">
                  {result.errors.map((err, i) => (
                    <div key={i} className="text-red-700 dark:text-red-300">
                      {err}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-amber-600 mb-1">
                  {t('validate.warnings', 'Warnings')}
                </h4>
                <div className="max-h-[100px] overflow-auto text-[10px] font-mono bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
                  {result.warnings.map((warn, i) => (
                    <div key={i} className="text-amber-700 dark:text-amber-300">
                      {warn}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleValidate}
            disabled={!filePath || loading}
            className="flex items-center gap-1 px-4 h-8 text-xs font-medium rounded bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-30"
          >
            {loading ? t('common.loading', 'Loading...') : t('validate.validate', 'Validate')}
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
