import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Spinner } from '../ui/Spinner';
import { useUIStore } from '../../stores/ui.store';
import type { SignDigitalResult } from '@shared/types/signing.types';

interface SignatureDialogProps {
  open: boolean;
  onClose: () => void;
  activeFile: string | null;
  activeFileName: string | null;
}

type SigningStatus = 'idle' | 'signing' | 'success' | 'error';

export function SignatureDialog({
  open,
  onClose,
  activeFile,
  activeFileName,
}: SignatureDialogProps) {
  const { t } = useTranslation();
  const signaturePlacement = useUIStore((s) => s.signaturePlacement);
  const savedFormData = useUIStore((s) => s.signatureFormData);

  const [certificatePath, setCertificatePath] = useState(savedFormData.certificatePath);
  const [passphrase, setPassphrase] = useState(savedFormData.passphrase);
  const [signerName, setSignerName] = useState(savedFormData.signerName);
  const [reason, setReason] = useState(savedFormData.reason);
  const [location, setLocation] = useState(savedFormData.location);
  const [contact, setContact] = useState(savedFormData.contact);

  const [status, setStatus] = useState<SigningStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  /** Persist current form state to store (survives dialog close for placement roundtrip) */
  const saveFormData = useCallback(() => {
    useUIStore.getState().setSignatureFormData({
      certificatePath,
      passphrase,
      signerName,
      reason,
      location,
      contact,
    });
  }, [certificatePath, passphrase, signerName, reason, location, contact]);

  const handleClose = useCallback(() => {
    useUIStore.getState().setSignaturePlacement(null);
    saveFormData();
    onClose();
  }, [onClose, saveFormData]);

  const handlePickCertificate = useCallback(async () => {
    try {
      const result = await window.crosspdf.openFileDialog({
        filters: [
          {
            name: t('signature.certificateFilter'),
            extensions: ['p12', 'pfx'],
          },
        ],
        properties: ['openFile'],
      });
      if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
        setCertificatePath(result.filePaths[0]);
      }
    } catch {
      // Silent fallback
    }
  }, [t]);

  const handlePlaceSignature = useCallback(() => {
    saveFormData();
    useUIStore.getState().setSignaturePlacementMode(true);
    onClose();
  }, [saveFormData, onClose]);

  const handleSign = useCallback(async () => {
    if (!activeFile) {
      setStatus('error');
      setStatusMessage(t('signature.noActiveFile'));
      return;
    }

    if (!certificatePath) {
      setStatus('error');
      setStatusMessage(t('signature.noCertificate'));
      return;
    }

    if (!passphrase) {
      setStatus('error');
      setStatusMessage(t('signature.noPassphrase'));
      return;
    }

    if (!signaturePlacement) {
      setStatus('error');
      setStatusMessage(t('signature.noPlacement'));
      return;
    }

    setStatus('signing');
    setStatusMessage('');

    try {
      const saveResult = await window.crosspdf.saveFileDialog({
        defaultPath: activeFileName
          ? activeFileName.replace(/\.pdf$/i, '') + '_signed.pdf'
          : 'signed.pdf',
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });

      if (saveResult.canceled || !saveResult.filePath) {
        setStatus('idle');
        return;
      }

      const result: SignDigitalResult = await window.crosspdf.signPdf({
        filePath: activeFile,
        certificatePath,
        passphrase,
        outputPath: saveResult.filePath,
        name: signerName || undefined,
        reason: reason || undefined,
        location: location || undefined,
        contactInfo: contact || undefined,
        page: signaturePlacement.page,
        widgetRect: signaturePlacement.rect,
      });

      if (result.success) {
        setStatus('success');
        setStatusMessage(t('signature.success', { path: saveResult.filePath }));
      } else {
        setStatus('error');
        setStatusMessage(result.error || t('signature.error'));
      }
    } catch {
      setStatus('error');
      setStatusMessage(t('signature.error'));
    }
  }, [
    activeFile,
    activeFileName,
    certificatePath,
    passphrase,
    signerName,
    reason,
    location,
    contact,
    signaturePlacement,
    t,
  ]);

  const isSignDisabled =
    status === 'signing' || !activeFile || !certificatePath || !passphrase || !signaturePlacement;

  const footer = (
    <>
      <Button onClick={handleClose} variant="secondary" size="sm">
        {t('signature.close')}
      </Button>
      <Button onClick={handleSign} disabled={isSignDisabled} variant="primary" size="sm">
        {status === 'signing' ? (
          <span className="inline-flex items-center gap-2">
            <Spinner className="h-4 w-4" size="sm" />
            {t('signature.signing')}
          </span>
        ) : (
          t('signature.sign')
        )}
      </Button>
    </>
  );

  return (
    <Dialog open={open} onClose={handleClose} title={t('signature.title')} footer={footer}>
      <div className="space-y-4">
        {!activeFile && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-200">
            {t('signature.noFileOpen')}
          </div>
        )}

        {activeFile && (
          <div className="text-sm text-surface-500 dark:text-surface-400">
            <Label>{t('signature.document')}</Label>
            <p className="mt-1 truncate font-mono text-xs">{activeFileName || activeFile}</p>
          </div>
        )}

        {/* Certificate picker */}
        <div className="space-y-1.5">
          <Label>{t('signature.certificate')}</Label>
          <div className="flex gap-2">
            <Input
              type="text"
              value={certificatePath}
              onChange={(e) => setCertificatePath(e.target.value)}
              placeholder={t('signature.certificatePlaceholder')}
              className="flex-1 cursor-default"
              readOnly
            />
            <Button onClick={handlePickCertificate} variant="secondary" size="sm">
              {t('signature.browse')}
            </Button>
          </div>
        </div>

        {/* Passphrase */}
        <div className="space-y-1.5">
          <Label>{t('signature.passphrase')}</Label>
          <Input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        {/* Optional fields */}
        <div className="space-y-1.5">
          <Label>{t('signature.signerName')}</Label>
          <Input
            type="text"
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            placeholder={t('signature.signerNamePlaceholder')}
          />
        </div>

        <div className="space-y-1.5">
          <Label>{t('signature.reason')}</Label>
          <Input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('signature.reasonPlaceholder')}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>{t('signature.location')}</Label>
            <Input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t('signature.locationPlaceholder')}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('signature.contact')}</Label>
            <Input
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder={t('signature.contactPlaceholder')}
            />
          </div>
        </div>

        {/* Placement section */}
        <div className="space-y-2 rounded-lg border border-surface-200 p-3 dark:border-surface-600">
          <div className="flex items-center justify-between">
            <Label>{t('signature.placement')}</Label>
            <Button
              onClick={handlePlaceSignature}
              variant="secondary"
              size="sm"
              data-testid="signature-place-button"
            >
              {t('signature.placeOnPage')}
            </Button>
          </div>

          {signaturePlacement ? (
            <div
              className="mt-2 rounded bg-blue-50 p-2 text-xs text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
              data-testid="signature-placement-summary"
            >
              {t('signature.placementSummary', {
                page: signaturePlacement.page,
                x: Math.round(signaturePlacement.rect[0]),
                y: Math.round(signaturePlacement.rect[1]),
                w: Math.round(signaturePlacement.rect[2]),
                h: Math.round(signaturePlacement.rect[3]),
              })}
            </div>
          ) : (
            <p className="mt-1 text-xs text-surface-400">{t('signature.placementHint')}</p>
          )}
        </div>

        {/* Status message */}
        {status !== 'idle' && (
          <div
            className={`rounded-lg p-3 text-sm ${
              status === 'signing'
                ? 'bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200'
                : status === 'success'
                  ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-200'
                  : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200'
            }`}
          >
            {status === 'signing' && (
              <span className="inline-flex items-center gap-2">
                <Spinner className="h-4 w-4" size="sm" />
                {t('signature.signing')}
              </span>
            )}
            {status === 'success' && <span>{statusMessage}</span>}
            {status === 'error' && <span>✗ {statusMessage}</span>}
          </div>
        )}
      </div>
    </Dialog>
  );
}
