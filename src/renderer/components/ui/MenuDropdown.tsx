import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export interface MenuItem {
  label?: string;
  shortcut?: string;
  action?: () => void;
  separator?: boolean;
  danger?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
}

interface MenuDropdownProps {
  label: string;
  items: MenuItem[];
  align?: 'left' | 'right';
}

export function MenuDropdown({ label, items, align = 'left' }: MenuDropdownProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (menuRef.current?.contains(target)) return;
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
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onPointerEnter={() => {
          // Open sibling menu on hover if another menu is already open
          const openMenu = document.querySelector('[data-menu-open]');
          if (openMenu && openMenu !== menuRef.current) {
            setOpen(true);
          }
        }}
        className={`rounded-lg px-2.5 py-1 text-[13px] font-medium transition-colors ${
          open
            ? 'bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400'
            : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900 dark:text-surface-400 dark:hover:bg-surface-800 dark:hover:text-surface-200'
        }`}
      >
        {label}
      </button>

      {open && (
        <div
          ref={menuRef}
          data-menu-open
          role="menu"
          aria-label={label}
          className={`animate-slide-down absolute z-[250] mt-1 min-w-[200px] overflow-hidden rounded-xl border border-surface-200 bg-white py-1 shadow-lg shadow-surface-900/10 dark:border-surface-700 dark:bg-surface-800 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {items.map((item, idx) => {
            if (item.separator) {
              return (
                <div
                  key={`sep-${idx}`}
                  role="separator"
                  className="my-1 border-t border-surface-100 dark:border-surface-700"
                />
              );
            }

            return (
              <button
                key={`${item.label}-${idx}`}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  item.action?.();
                  close();
                }}
                className={`flex w-full items-center gap-3 px-3.5 py-1.5 text-left text-[13px] transition-colors disabled:opacity-30 ${
                  item.danger
                    ? 'text-coral-600 hover:bg-coral-50 dark:text-coral-400 dark:hover:bg-coral-950/20'
                    : 'text-surface-700 hover:bg-surface-50 hover:text-surface-900 dark:text-surface-300 dark:hover:bg-surface-700 dark:hover:text-surface-100'
                }`}
              >
                {item.icon && (
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center text-surface-400">
                    {item.icon}
                  </span>
                )}
                <span className="flex-1">{item.label}</span>
                {item.shortcut && (
                  <span className="ml-4 text-xs text-surface-400">{item.shortcut}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
