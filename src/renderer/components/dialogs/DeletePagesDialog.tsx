import { ConfirmDialog } from './ConfirmDialog';

interface DeletePagesDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pages: number[];
  loading?: boolean;
}

export function DeletePagesDialog({
  open,
  onClose,
  onConfirm,
  pages,
  loading = false,
}: DeletePagesDialogProps) {
  const pageLabel =
    pages.length === 1
      ? `page ${pages[0]}`
      : `${pages.length} pages (${pages.slice(0, 5).join(', ')}${pages.length > 5 ? '...' : ''})`;

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Delete Pages"
      message={
        <div className="flex flex-col gap-2">
          <p>
            Are you sure you want to delete <strong>{pageLabel}</strong>?
          </p>
          <p className="text-xs text-surface-500">
            This operation saves the result as a new file. The original document will not be
            modified.
          </p>
        </div>
      }
      confirmLabel="Delete"
      destructive
      loading={loading}
    />
  );
}
