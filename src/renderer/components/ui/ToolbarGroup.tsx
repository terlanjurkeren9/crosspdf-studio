import type { ReactNode } from 'react';

interface ToolbarGroupProps {
  children: ReactNode;
  label?: string;
  className?: string;
}

export function ToolbarGroup({ children, label, className = '' }: ToolbarGroupProps) {
  return (
    <div
      className={`flex h-9 shrink-0 items-center gap-1 border-r border-surface-200 pr-2 last:border-r-0 last:pr-0 dark:border-surface-800 ${className}`}
      aria-label={label}
    >
      {children}
    </div>
  );
}
