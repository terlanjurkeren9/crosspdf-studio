import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';

export interface ToolPaletteItem {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  disabled?: boolean;
  active?: boolean;
}

export interface ToolPaletteGroup {
  label: string;
  items: ToolPaletteItem[];
}

type SectionAccent = 'indigo' | 'green' | 'amber' | 'blue' | 'neutral';

interface ToolPaletteDropdownProps {
  /** Icon shown on the trigger button */
  triggerIcon: ComponentType<{ className?: string }>;
  /** Label for accessibility */
  triggerLabel: string;
  /** Active tool ID (to show checkmark) */
  activeTool?: string;
  /** Tool groups shown in the palette */
  groups: ToolPaletteGroup[];
  /** Called when a tool is selected */
  onSelect: (id: string) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Align the dropdown */
  align?: 'left' | 'right';
  /** Active state for the trigger */
  active?: boolean;
  /** Extra class names */
  className?: string;
  /** Section accent color (for color coding per section) */
  accent?: SectionAccent;
}

const ACCENT_HEADER_BG: Record<string, string> = {
  indigo:
    'bg-gradient-to-r from-indigo-50 to-indigo-100/60 dark:from-indigo-950/40 dark:to-indigo-900/20',
  green:
    'bg-gradient-to-r from-emerald-50 to-emerald-100/60 dark:from-emerald-950/40 dark:to-emerald-900/20',
  amber:
    'bg-gradient-to-r from-amber-50 to-amber-100/60 dark:from-amber-950/40 dark:to-amber-900/20',
  blue: 'bg-gradient-to-r from-blue-50 to-blue-100/60 dark:from-blue-950/40 dark:to-blue-900/20',
  neutral: 'bg-surface-50 dark:bg-surface-800/60',
};

const ACCENT_DOT: Record<string, string> = {
  indigo: 'bg-indigo-500 dark:bg-indigo-400',
  green: 'bg-emerald-500 dark:bg-emerald-400',
  amber: 'bg-amber-500 dark:bg-amber-400',
  blue: 'bg-blue-500 dark:bg-blue-400',
  neutral: 'bg-surface-400 dark:bg-surface-500',
};

const ACCENT_TEXT: Record<string, string> = {
  indigo: 'text-indigo-700 dark:text-indigo-300',
  green: 'text-emerald-700 dark:text-emerald-300',
  amber: 'text-amber-700 dark:text-amber-300',
  blue: 'text-blue-700 dark:text-blue-300',
  neutral: 'text-surface-600 dark:text-surface-400',
};

const ACCENT_ACTIVE_BG: Record<string, string> = {
  indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400',
  green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400',
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400',
  neutral: 'bg-surface-100 text-surface-700 dark:bg-surface-700 dark:text-surface-300',
};

export function ToolPaletteDropdown({
  triggerIcon: TriggerIcon,
  triggerLabel,
  activeTool,
  groups,
  onSelect,
  disabled = false,
  align = 'left',
  active = false,
  className = '',
  accent = 'indigo',
}: ToolPaletteDropdownProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (dropdownRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      close();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onPointerEnter={() => {
          const openPalette = document.querySelector('[data-tool-palette-open]');
          if (openPalette && openPalette !== dropdownRef.current) {
            setOpen(true);
          }
        }}
        className={`
          inline-flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-150
          disabled:opacity-30
          ${
            active || open
              ? `${ACCENT_ACTIVE_BG[accent]} shadow-sm`
              : 'text-surface-400 hover:scale-[1.08] hover:bg-surface-100 hover:text-surface-700 dark:text-surface-500 dark:hover:bg-surface-700 dark:hover:text-surface-200'
          }
          ${className}
        `}
        title={triggerLabel}
      >
        <TriggerIcon className="h-4 w-4" />
      </button>

      {open && (
        <div
          ref={dropdownRef}
          data-tool-palette-open
          role="menu"
          aria-label={triggerLabel}
          className={`
            animate-slide-down absolute z-[250] mt-1.5 min-w-[220px] overflow-hidden
            rounded-xl border border-surface-200/80 bg-white
            shadow-[0_8px_30px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)]
            dark:border-surface-600/50 dark:bg-surface-800
            dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)]
            ${align === 'right' ? 'right-0' : 'left-0'}
          `}
        >
          {groups.map((group, gi) => (
            <div key={group.label}>
              {gi > 0 && (
                <div className="mx-2 my-0.5 border-t border-surface-100 dark:border-surface-700" />
              )}
              {/* Group header with accent color */}
              <div className={`flex items-center gap-2 px-4 py-1.5 ${ACCENT_HEADER_BG[accent]}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${ACCENT_DOT[accent]}`} />
                <span
                  className={`text-[11px] font-semibold uppercase tracking-wider ${ACCENT_TEXT[accent]}`}
                >
                  {group.label}
                </span>
              </div>
              {/* Group items — 4-column grid */}
              <div className={`grid grid-cols-4 gap-0.5 px-2.5 py-2 ${gi === 0 ? 'pt-2.5' : ''}`}>
                {group.items.map((item) => {
                  const isActive = activeTool === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      disabled={item.disabled}
                      onClick={() => {
                        onSelect(item.id);
                        close();
                      }}
                      className={`
                        group/tool relative flex flex-col items-center gap-0.5 rounded-lg px-1.5 py-2 text-[10px] transition-all duration-150
                        disabled:opacity-30
                        ${
                          isActive
                            ? `${ACCENT_ACTIVE_BG[accent]} shadow-sm`
                            : 'text-surface-600 hover:scale-[1.05] hover:bg-surface-50 hover:text-surface-900 dark:text-surface-300 dark:hover:bg-surface-700 dark:hover:text-surface-100'
                        }
                      `}
                      title={item.label}
                    >
                      {/* Active dot indicator */}
                      {isActive && (
                        <span
                          className={`absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full ${ACCENT_DOT[accent]}`}
                        />
                      )}
                      <Icon className="h-4 w-4" />
                      <span className="text-[9px] leading-tight">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Footer with subtle gradient */}
          <div className="h-1 bg-gradient-to-b from-transparent to-surface-50/50 dark:to-surface-800/50" />
        </div>
      )}
    </div>
  );
}
