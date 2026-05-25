import { Dialog } from '../ui/Dialog';

interface RedactionDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  affectedPages: number[];
  totalRedactions: number;
  loading?: boolean;
}

export function RedactionDialog({
  open,
  onClose,
  onConfirm,
  affectedPages,
  totalRedactions,
  loading = false,
}: RedactionDialogProps) {
  const pageList =
    affectedPages.length <= 10
      ? affectedPages.join(', ')
      : affectedPages.slice(0, 10).join(', ') + ` and ${affectedPages.length - 10} more`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Apply Redactions"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-3 py-1.5 text-xs rounded border border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-30"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-3 py-1.5 text-xs rounded text-white bg-red-500 hover:bg-red-600 disabled:opacity-30 flex items-center gap-2"
          >
            {loading && (
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            )}
            Apply Redactions
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
          <p className="text-sm font-semibold text-red-700 dark:text-red-300">
            Redaction is permanent and irreversible.
          </p>
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
            This operation will permanently remove the marked content. Redacted pages will be
            converted to images, making text unsearchable and unselectable on those pages. Save the
            result as a new file.
          </p>
        </div>

        <div className="text-sm space-y-1">
          <p>
            <span className="font-medium">{totalRedactions}</span> redaction mark
            {totalRedactions !== 1 ? 's' : ''} across{' '}
            <span className="font-medium">{affectedPages.length}</span> page
            {affectedPages.length !== 1 ? 's' : ''}
            {affectedPages.length > 0 && <>: {pageList}</>}.
          </p>

          <p className="text-xs text-surface-500 mt-2">
            Pages without redaction marks will be preserved unchanged. Affected pages will become
            image-only (no selectable text, no searchable text).
          </p>
        </div>
      </div>
    </Dialog>
  );
}
