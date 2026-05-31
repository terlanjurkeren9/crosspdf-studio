import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';

interface PasswordDialogProps {
  open: boolean;
  onClose: () => void;
  filePath: string;
  fileName: string;
  onSuccess: (data: ArrayBuffer, password: string) => void;
}

export function PasswordDialog({
  open,
  onClose,
  filePath,
  fileName,
  onSuccess,
}: PasswordDialogProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // State resets on mount; App.tsx remounts via key when dialog opens.

  const handleSubmit = useCallback(async () => {
    if (!password.trim()) {
      setError('Please enter a password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await window.crosspdf.applyPassword(filePath, password);

      if (!result.success || !result.data) {
        setError(result.error ?? 'Incorrect password.');
        setLoading(false);
        return;
      }

      onSuccess(result.data, password);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open document.');
      setLoading(false);
    }
  }, [password, filePath, onSuccess, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <Dialog
      open={open}
      onClose={loading ? () => {} : onClose}
      title="Password Protected PDF"
      footer={
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" />
                Opening...
              </span>
            ) : (
              t('common.open')
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-surface-600 dark:text-surface-400">
          <strong>{fileName}</strong> is password-protected. Enter the password to open this
          document.
        </p>

        <div>
          <label
            htmlFor="pdf-password"
            className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1"
          >
            Password
          </label>
          <input
            id="pdf-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            autoFocus
            className="w-full h-8 px-2 text-sm rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 disabled:opacity-50"
            placeholder="Enter PDF password"
          />
        </div>

        {error && (
          <div className="p-2 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <p className="text-xs text-surface-400">
          The password is not stored or logged. You will need to enter it again when reopening this
          document.
        </p>
      </div>
    </Dialog>
  );
}
