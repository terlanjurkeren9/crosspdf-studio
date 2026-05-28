import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  active?: boolean;
  danger?: boolean;
  label: string;
}

export function IconButton({
  children,
  active = false,
  danger = false,
  label,
  className = '',
  ...props
}: IconButtonProps) {
  const activeClass = active
    ? 'bg-brand-50 text-brand-600 ring-1 ring-brand-200 hover:bg-brand-100 dark:bg-brand-950/60 dark:text-brand-400 dark:ring-brand-800'
    : danger
      ? 'text-surface-500 hover:bg-coral-50 hover:text-coral-600 dark:text-surface-400 dark:hover:bg-coral-950/30 dark:hover:text-coral-400'
      : 'text-surface-500 hover:bg-surface-100 hover:text-surface-700 dark:text-surface-400 dark:hover:bg-surface-800 dark:hover:text-surface-200';

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-default disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${activeClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
