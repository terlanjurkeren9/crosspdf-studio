import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function Button({ children, className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg
        bg-brand-500 text-white
        hover:bg-brand-600
        active:bg-brand-700
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500
        disabled:opacity-50 disabled:pointer-events-none
        transition-colors ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
