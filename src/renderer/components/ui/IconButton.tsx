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
    ? 'bg-brand-100 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-950/70 dark:text-brand-300 dark:ring-brand-900'
    : danger
      ? 'text-surface-500 hover:bg-red-50 hover:text-red-700 dark:text-surface-400 dark:hover:bg-red-950/40 dark:hover:text-red-300'
      : 'text-surface-600 hover:bg-surface-200 hover:text-surface-950 dark:text-surface-300 dark:hover:bg-surface-800 dark:hover:text-surface-50';

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors disabled:cursor-default disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${activeClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
