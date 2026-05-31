import { useTranslation } from 'react-i18next';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { PenTool } from 'lucide-react';

interface SignatureDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SignatureDialog({ open, onClose }: SignatureDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('signature.title')}
      footer={
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t('common.close')}
          </Button>
          <Button variant="primary" disabled>
            <PenTool className="h-4 w-4" />
            {t('signature.comingSoon')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            {t('signature.placeholderTitle')}
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            {t('signature.placeholderDescription')}
          </p>
        </div>

        <div>
          <p className="text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">
            {t('signature.futureScope')}
          </p>
        </div>

        <div className="rounded-lg bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 p-3">
          <p className="text-xs text-surface-500 dark:text-surface-400">
            {t('signature.noSignatureMessage')}
          </p>
        </div>
      </div>
    </Dialog>
  );
}
