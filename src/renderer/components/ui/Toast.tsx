import { useUIStore } from '../../stores/ui.store';

export function Toast() {
  const toastMessage = useUIStore((s) => s.toastMessage);

  if (!toastMessage) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-surface-800 dark:bg-surface-200 text-surface-100 dark:text-surface-800 text-sm shadow-lg pointer-events-none animate-toast-in">
      {toastMessage}
    </div>
  );
}
