import type { ComponentType, ReactNode } from 'react';

export interface RibbonTab {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  accent?: 'blue' | 'indigo' | 'green' | 'amber' | 'neutral';
}

interface RibbonTabsProps {
  tabs: RibbonTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  children?: ReactNode;
}

const ACCENT_COLORS: Record<string, { active: string; hover: string; underline: string }> = {
  blue: {
    active: 'text-brand-700 dark:text-brand-300',
    hover: 'hover:text-brand-600 dark:hover:text-brand-400',
    underline: 'bg-brand-500',
  },
  indigo: {
    active: 'text-indigo-700 dark:text-indigo-300',
    hover: 'hover:text-indigo-600 dark:hover:text-indigo-400',
    underline: 'bg-indigo-500',
  },
  green: {
    active: 'text-emerald-700 dark:text-emerald-300',
    hover: 'hover:text-emerald-600 dark:hover:text-emerald-400',
    underline: 'bg-emerald-500',
  },
  amber: {
    active: 'text-amber-700 dark:text-amber-300',
    hover: 'hover:text-amber-600 dark:hover:text-amber-400',
    underline: 'bg-amber-500',
  },
  neutral: {
    active: 'text-surface-700 dark:text-surface-300',
    hover: 'hover:text-surface-600 dark:hover:text-surface-400',
    underline: 'bg-surface-400',
  },
};

export function RibbonTabs({ tabs, activeTab, onTabChange, children }: RibbonTabsProps) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-0.5 border-b border-surface-200 bg-gradient-to-b from-surface-50 to-white px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-surface-700 dark:from-surface-800 dark:to-surface-900 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const colors = ACCENT_COLORS[tab.accent ?? 'neutral'];
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`
              group relative flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all duration-150
              ${
                isActive
                  ? `${colors.active} bg-white shadow-sm dark:bg-surface-800`
                  : `text-surface-500 ${colors.hover} dark:text-surface-400`
              }
            `}
          >
            {/* Active tab underline indicator */}
            {isActive && (
              <span
                className={`absolute bottom-0 left-1/2 h-0.5 w-4/5 -translate-x-1/2 rounded-full ${colors.underline}`}
              />
            )}
            {/* Hover background */}
            {!isActive && (
              <span className="absolute inset-0 rounded-md bg-surface-100/0 transition-colors duration-150 group-hover:bg-surface-100 dark:group-hover:bg-surface-700/50" />
            )}
            {Icon && <Icon className="relative z-10 h-3.5 w-3.5" />}
            <span className="relative z-10">{tab.label}</span>
          </button>
        );
      })}

      {/* Right-side content (e.g. close button or settings) */}
      {children && <div className="ml-auto flex items-center gap-1">{children}</div>}
    </div>
  );
}
