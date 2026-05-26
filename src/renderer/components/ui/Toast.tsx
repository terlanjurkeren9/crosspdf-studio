import { useUIStore } from '../../stores/ui.store';

export function Toast() {
  const toastMessage = useUIStore((s) => s.toastMessage);

  if (!toastMessage) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-toast-in rounded-md border border-surface-700 bg-surface-900 px-4 py-2 text-sm text-surface-50 shadow-xl shadow-surface-950/25 dark:border-surface-200 dark:bg-surface-50 dark:text-surface-900">
      {toastMessage}
    </div>
  );
}
