import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'toolbar';
  size?: 'sm' | 'md';
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

const variants: Record<string, string> = {
  primary:
    'px-4 py-2 text-[13px] bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm shadow-brand-900/15',
  secondary:
    'px-4 py-2 text-[13px] border border-surface-200 bg-white text-surface-700 hover:bg-surface-50 hover:border-surface-300 active:bg-surface-100',
  ghost:
    'px-3 py-1.5 text-[13px] text-surface-600 hover:bg-surface-100 hover:text-surface-900 active:bg-surface-200',
  danger:
    'px-4 py-2 text-[13px] bg-coral-500 text-white hover:bg-coral-600 active:bg-coral-700 shadow-sm shadow-coral-900/10',
  toolbar:
    'h-7 px-2 text-xs text-surface-600 hover:bg-surface-100 hover:text-surface-900 active:bg-surface-200',
};

const sizes: Record<string, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: '',
};

export function Button({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${base} ${variants[variant] ?? variants.primary} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
