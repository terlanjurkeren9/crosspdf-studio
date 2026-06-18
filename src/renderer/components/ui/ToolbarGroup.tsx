import type { ReactNode } from 'react';

interface ToolbarGroupProps {
  children: ReactNode;
  label?: string;
  className?: string;
}

export function ToolbarGroup({ children, label, className = '' }: ToolbarGroupProps) {
  return (
    <div
      className={`flex min-h-14 flex-wrap shrink-0 items-center gap-0.5 border-r border-surface-200 pr-2.5 last:border-r-0 last:pr-0 dark:border-surface-700 ${className}`}
      aria-label={label}
    >
      {children}
    </div>
  );
}
