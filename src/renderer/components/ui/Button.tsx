import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'toolbar';
}

export function Button({ children, className = '', variant = 'primary', ...props }: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-md transition-colors disabled:opacity-45 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

  const variants: Record<string, string> = {
    primary:
      'px-3.5 py-2 text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm shadow-brand-900/10',
    secondary:
      'px-3.5 py-2 text-sm font-medium border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800',
    ghost:
      'px-3 py-1.5 text-sm font-medium text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800',
    danger:
      'px-3.5 py-2 text-sm font-semibold bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm shadow-red-900/10',
    toolbar:
      'h-7 px-2 text-xs font-medium text-surface-600 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-800',
  };

  return (
    <button className={`${base} ${variants[variant] ?? variants.primary} ${className}`} {...props}>
      {children}
    </button>
  );
}
