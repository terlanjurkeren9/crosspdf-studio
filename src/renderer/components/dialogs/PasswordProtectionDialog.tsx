import { useCallback, useEffect, useState } from 'react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';

interface PasswordProtectionDialogProps {
  open: boolean;
  onClose: () => void;
  filePath: string;
  fileName: string;
}

type Status = 'loading' | 'ready' | 'error';

export function PasswordProtectionDialog({
  open,
  onClose,
  filePath,
  fileName,
}: PasswordProtectionDialogProps) {
  const [status, setStatus] = useState<Status>('loading');
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function check() {
      setStatus('loading');
      setErrorMessage('');
      try {
        const result = await window.crosspdf.checkEncrypted(filePath);
        if (cancelled) return;
        if (result.success) {
          setIsEncrypted(result.isEncrypted ?? false);
          setStatus('ready');
        } else {
          setErrorMessage(result.error ?? 'Failed to check encryption status.');
          setStatus('error');
        }
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(err instanceof Error ? err.message : 'Failed to check encryption status.');
        setStatus('error');
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [open, filePath]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Password Protection"
      footer={
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Spinner />
            <span className="text-sm text-surface-500">Checking document...</span>
          </div>
        )}

        {status === 'error' && (
          <div className="p-3 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
            {errorMessage}
          </div>
        )}

        {status === 'ready' && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-surface-500">Status:</span>
              <span
                className={`text-xs px-2 py-0.5 rounded font-medium ${
                  isEncrypted
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                    : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                }`}
              >
                {isEncrypted ? 'Encrypted' : 'Not encrypted'}
              </span>
            </div>

            <p className="text-sm text-surface-600 dark:text-surface-400">
              <strong>{fileName}</strong>
            </p>

            {isEncrypted ? (
              <div className="p-3 rounded bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-sm text-surface-600 dark:text-surface-400 space-y-2">
                <p>
                  This document is currently password-protected. It was opened with a password in
                  this session.
                </p>
                <p>
                  Removing or changing the password requires bundled QPDF, which is planned for a
                  follow-up release. The password you entered was used only in memory and is not
                  stored.
                </p>
              </div>
            ) : (
              <div className="p-3 rounded bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-sm text-surface-600 dark:text-surface-400 space-y-2">
                <p>
                  This document is not password-protected. You can add a password to prevent
                  unauthorized access.
                </p>
                <div className="p-2 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs">
                  Password protection (encryption) requires bundled QPDF. This feature will be
                  enabled in a follow-up release. The app does not perform fake encryption.
                </div>
              </div>
            )}

            <div className="p-3 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 text-xs text-blue-700 dark:text-blue-400 space-y-1">
              <p className="font-medium">Available now:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Open password-protected PDFs (password entered at open time)</li>
                <li>Passwords are never stored or logged</li>
              </ul>
              <p className="font-medium mt-2">Coming in a follow-up release:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Add password protection to any PDF (256-bit AES)</li>
                <li>Remove or change password on existing PDFs</li>
                <li>Set separate owner and user passwords</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
