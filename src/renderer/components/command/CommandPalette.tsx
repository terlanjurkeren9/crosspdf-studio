import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { filterCommands, type CommandItem } from '../../lib/command-palette';

interface CommandPaletteProps {
  open: boolean;
  commands: CommandItem[];
  onClose: () => void;
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (!needle) return <>{text}</>;

  const index = text.toLowerCase().indexOf(needle.toLowerCase());
  if (index === -1) return <>{text}</>;

  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded bg-accent-100 px-0.5 text-accent-800 dark:bg-accent-900 dark:text-accent-100">
        {text.slice(index, index + needle.length)}
      </mark>
      {text.slice(index + needle.length)}
    </>
  );
}

export function CommandPalette({ open, commands, onClose }: CommandPaletteProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredCommands = useMemo(() => filterCommands(commands, query), [commands, query]);
  const activeIndex = Math.min(selectedIndex, Math.max(0, filteredCommands.length - 1));

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  if (!open) return null;

  const runSelected = () => {
    const command = filteredCommands[activeIndex];
    if (!command || command.disabled) return;
    void command.run();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/35 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="mx-auto mt-[10vh] w-full max-w-xl overflow-hidden rounded-lg border border-surface-200 bg-white shadow-2xl dark:border-surface-700 dark:bg-surface-900"
        role="dialog"
        aria-modal="true"
        aria-label={t('commandPalette.title')}
      >
        <div className="flex h-12 items-center gap-2 border-b border-surface-200 px-3 dark:border-surface-700">
          <Search className="h-4 w-4 shrink-0 text-surface-500 dark:text-surface-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((i) =>
                  filteredCommands.length === 0 ? 0 : (i + 1) % filteredCommands.length
                );
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((i) =>
                  filteredCommands.length === 0
                    ? 0
                    : (i - 1 + filteredCommands.length) % filteredCommands.length
                );
              } else if (e.key === 'Enter') {
                e.preventDefault();
                runSelected();
              }
            }}
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-surface-900 outline-none placeholder:text-surface-400 dark:text-surface-50 dark:placeholder:text-surface-500"
            placeholder={t('commandPalette.placeholder')}
            aria-label={t('commandPalette.search')}
          />
          <kbd className="rounded border border-surface-200 px-1.5 py-0.5 text-[10px] font-medium text-surface-500 dark:border-surface-700 dark:text-surface-400">
            Esc
          </kbd>
        </div>

        <div className="max-h-[420px] overflow-y-auto py-1" role="listbox">
          {filteredCommands.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-surface-500 dark:text-surface-400">
              {t('commandPalette.noResults')}
            </div>
          ) : (
            filteredCommands.map((command, index) => {
              const selected = index === activeIndex;
              return (
                <button
                  key={command.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={command.disabled}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => {
                    if (command.disabled) return;
                    void command.run();
                    onClose();
                  }}
                  className={[
                    'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm',
                    selected
                      ? 'bg-accent-50 text-accent-900 dark:bg-accent-950 dark:text-accent-50'
                      : 'text-surface-800 dark:text-surface-100',
                    command.disabled
                      ? 'cursor-not-allowed opacity-45'
                      : 'cursor-default hover:bg-surface-100 dark:hover:bg-surface-800',
                  ].join(' ')}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      <HighlightMatch text={command.label} query={query} />
                    </span>
                    <span className="block text-xs capitalize text-surface-500 dark:text-surface-400">
                      {t(`commandPalette.groups.${command.group}`)}
                    </span>
                  </span>
                  {command.shortcut && (
                    <kbd className="shrink-0 rounded border border-surface-200 px-1.5 py-0.5 text-[10px] font-medium text-surface-500 dark:border-surface-700 dark:text-surface-400">
                      {command.shortcut}
                    </kbd>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
