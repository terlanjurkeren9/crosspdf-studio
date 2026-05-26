import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Dialog({ open, onClose, title, children, footer }: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-surface-950/45 p-4 backdrop-blur-[1px]"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="flex max-h-[86vh] w-full max-w-lg flex-col overflow-hidden rounded-md border border-surface-200 bg-white shadow-2xl shadow-surface-950/20 dark:border-surface-700 dark:bg-surface-900">
        {/* Header */}
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-surface-200 bg-surface-50 px-4 dark:border-surface-800 dark:bg-surface-950">
          <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-surface-500 hover:bg-surface-200 hover:text-surface-900 dark:text-surface-400 dark:hover:bg-surface-800 dark:hover:text-surface-100"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 text-sm text-surface-700 dark:text-surface-300">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-surface-200 bg-surface-50 px-4 py-3 dark:border-surface-800 dark:bg-surface-950">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
