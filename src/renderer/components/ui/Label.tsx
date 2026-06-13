import type { LabelHTMLAttributes } from 'react';

interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  className?: string;
}

export function Label({ className = '', children, ...props }: LabelProps) {
  return (
    <label
      className={`block text-xs font-medium text-surface-600 dark:text-surface-400 mb-0.5 ${className}`}
      {...props}
    >
      {children}
    </label>
  );
}
