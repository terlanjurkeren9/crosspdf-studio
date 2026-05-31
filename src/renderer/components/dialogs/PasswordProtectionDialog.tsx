import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';

interface PasswordProtectionDialogProps {
  open: boolean;
  onClose: () => void;
  filePath: string;
  fileName: string;
  onPasswordChanged?: (password: string | undefined) => void;
}

type Status = 'loading' | 'ready' | 'error' | 'encrypting' | 'decrypting' | 'success';

export function PasswordProtectionDialog({
  open,
  onClose,
  filePath,
  fileName,
  onPasswordChanged,
}: PasswordProtectionDialogProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>('loading');
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Add password form
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Remove password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [showRemoveForm, setShowRemoveForm] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function check() {
      setStatus('loading');
      setErrorMessage('');
      setSuccessMessage('');
      setShowAddForm(false);
      setShowRemoveForm(false);
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

  const handleAddPassword = useCallback(async () => {
    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }
    if (newPassword.length < 1) {
      setErrorMessage('Password cannot be empty.');
      return;
    }

    setStatus('encrypting');
    setErrorMessage('');
    try {
      const result = await window.crosspdf.encryptPdf(
        filePath,
        newPassword,
        ownerPassword || undefined
      );
      if (!result.success || !result.data) {
        setErrorMessage(result.error ?? 'Encryption failed.');
        setStatus('ready');
        return;
      }

      const writeResult = await window.crosspdf.writeFile(filePath, result.data);
      if (!writeResult.success) {
        setErrorMessage(writeResult.error ?? 'Failed to save encrypted PDF.');
        setStatus('ready');
        return;
      }

      setSuccessMessage('Password protection applied successfully.');
      setIsEncrypted(true);
      setShowAddForm(false);
      setNewPassword('');
      setConfirmPassword('');
      setOwnerPassword('');
      setStatus('success');
      onPasswordChanged?.(newPassword);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Encryption failed.');
      setStatus('ready');
    }
  }, [filePath, newPassword, confirmPassword, ownerPassword, onPasswordChanged]);

  const handleRemovePassword = useCallback(async () => {
    if (currentPassword.length < 1) {
      setErrorMessage('Password cannot be empty.');
      return;
    }

    setStatus('decrypting');
    setErrorMessage('');
    try {
      const result = await window.crosspdf.removePassword(filePath, currentPassword);
      if (!result.success || !result.data) {
        setErrorMessage(result.error ?? 'Decryption failed.');
        setStatus('ready');
        return;
      }

      const writeResult = await window.crosspdf.writeFile(filePath, result.data);
      if (!writeResult.success) {
        setErrorMessage(writeResult.error ?? 'Failed to save decrypted PDF.');
        setStatus('ready');
        return;
      }

      setSuccessMessage('Password protection removed successfully.');
      setIsEncrypted(false);
      setShowRemoveForm(false);
      setCurrentPassword('');
      setStatus('success');
      onPasswordChanged?.(undefined);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Decryption failed.');
      setStatus('ready');
    }
  }, [filePath, currentPassword, onPasswordChanged]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const resetForms = useCallback(() => {
    setShowAddForm(false);
    setShowRemoveForm(false);
    setErrorMessage('');
    setSuccessMessage('');
    setNewPassword('');
    setConfirmPassword('');
    setOwnerPassword('');
    setCurrentPassword('');
    if (status === 'success') {
      setStatus('ready');
    }
  }, [status]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Password Protection"
      footer={
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleClose}>
            {t('common.close')}
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

        {status === 'encrypting' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Spinner />
            <span className="text-sm text-surface-500">Applying password protection...</span>
          </div>
        )}

        {status === 'decrypting' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Spinner />
            <span className="text-sm text-surface-500">Removing password protection...</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="p-3 rounded bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm">
            {successMessage}
          </div>
        )}

        {(status === 'ready' || status === 'success') && (
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

            {isEncrypted && !showRemoveForm && (
              <div className="p-3 rounded bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-sm text-surface-600 dark:text-surface-400 space-y-2">
                <p>This document is password-protected.</p>
                <Button
                  variant="secondary"
                  className="text-xs py-1.5 px-3"
                  onClick={() => {
                    resetForms();
                    setShowRemoveForm(true);
                  }}
                >
                  Remove Password
                </Button>
              </div>
            )}

            {isEncrypted && showRemoveForm && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    className="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded bg-white dark:bg-surface-800 text-sm"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" className="text-xs py-1.5 px-3" onClick={resetForms}>
                    {t('common.cancel')}
                  </Button>
                  <Button
                    variant="primary"
                    className="text-xs py-1.5 px-3"
                    onClick={handleRemovePassword}
                  >
                    Remove Password
                  </Button>
                </div>
              </div>
            )}

            {!isEncrypted && !showAddForm && (
              <div className="p-3 rounded bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-sm text-surface-600 dark:text-surface-400 space-y-2">
                <p>This document is not password-protected.</p>
                <Button
                  variant="secondary"
                  className="text-xs py-1.5 px-3"
                  onClick={() => {
                    resetForms();
                    setShowAddForm(true);
                  }}
                >
                  Add Password
                </Button>
              </div>
            )}

            {!isEncrypted && showAddForm && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    className="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded bg-white dark:bg-surface-800 text-sm"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    className="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded bg-white dark:bg-surface-800 text-sm"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                    Owner Password (optional)
                  </label>
                  <input
                    type="password"
                    className="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded bg-white dark:bg-surface-800 text-sm"
                    value={ownerPassword}
                    onChange={(e) => setOwnerPassword(e.target.value)}
                    placeholder="Owner password (defaults to user password)"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" className="text-xs py-1.5 px-3" onClick={resetForms}>
                    {t('common.cancel')}
                  </Button>
                  <Button
                    variant="primary"
                    className="text-xs py-1.5 px-3"
                    onClick={handleAddPassword}
                  >
                    Apply Password
                  </Button>
                </div>
              </div>
            )}

            <div className="p-3 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 text-xs text-blue-700 dark:text-blue-400 space-y-1">
              <p className="font-medium">Security notes:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Encryption uses 256-bit AES via bundled QPDF</li>
                <li>Passwords are never stored or logged</li>
                <li>Separate owner and user passwords are supported</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
