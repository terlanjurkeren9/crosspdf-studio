import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  active?: boolean;
  danger?: boolean;
  label: string;
  variant?: 'toolbar' | 'ribbon';
}

export function IconButton({
  children,
  active = false,
  danger = false,
  label,
  className = '',
  variant = 'toolbar',
  ...props
}: IconButtonProps) {
  const activeClass = active
    ? 'bg-brand-50 text-brand-600 ring-1 ring-brand-200 hover:bg-brand-100 dark:bg-brand-950/60 dark:text-brand-400 dark:ring-brand-800'
    : danger
      ? 'text-surface-500 hover:bg-coral-50 hover:text-coral-600 dark:text-surface-400 dark:hover:bg-coral-950/30 dark:hover:text-coral-400'
      : 'text-surface-500 hover:bg-surface-100 hover:text-surface-700 dark:text-surface-400 dark:hover:bg-surface-800 dark:hover:text-surface-200';

  const baseClass =
    variant === 'ribbon'
      ? 'flex flex-col h-14 min-w-[3.5rem] px-1 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-default disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500'
      : 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-default disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`${baseClass} ${activeClass} ${className}`}
      {...props}
    >
      {variant === 'ribbon' ? (
        <>
          <div className="flex items-center justify-center h-5 w-5 mb-0.5">{children}</div>
          <span className="text-[10px] leading-tight text-center truncate max-w-[5.5rem] w-full px-0.5">
            {label}
          </span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
