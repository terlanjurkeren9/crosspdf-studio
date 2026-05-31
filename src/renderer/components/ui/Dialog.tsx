import { useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({ open, onClose, title, children, footer }: DialogProps) {
  const { t } = useTranslation();
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Capture trigger element on open and return focus on close/unmount
  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement;
    return () => {
      // Defer to after React's commit phase (component unmount)
      if (trigger && typeof trigger.focus === 'function') {
        setTimeout(() => trigger.focus(), 0);
      }
    };
  }, [open]);

  // Escape + focus trap
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key !== 'Tab' || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;
    // Focus first focusable element in the panel
    const raf = requestAnimationFrame(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    });
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-surface-900/40 p-4 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[86vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-xl shadow-surface-900/10 dark:border-surface-700 dark:bg-surface-800"
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-surface-100 bg-surface-50/50 px-5 dark:border-surface-700 dark:bg-surface-800/50">
          <h2 className="text-sm font-semibold text-surface-800 dark:text-surface-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-surface-400 hover:bg-surface-200 hover:text-surface-600 dark:hover:bg-surface-700 dark:hover:text-surface-300"
            aria-label={t('common.closeDialog')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 text-sm text-surface-600 dark:text-surface-300">
          {children}
        </div>

        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-surface-100 bg-surface-50/50 px-5 py-3.5 dark:border-surface-700 dark:bg-surface-800/50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
