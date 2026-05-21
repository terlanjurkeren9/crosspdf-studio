import type { SearchResult } from '../../lib/search';

interface SearchResultItemProps {
  result: SearchResult;
  isActive: boolean;
  onClick: () => void;
}

export function SearchResultItem({ result, isActive, onClick }: SearchResultItemProps) {
  const pageLabel = `Page ${result.pageNumber}`;
  const matchLabel = `Result ${result.matchIndex + 1}`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded text-xs transition-colors ${
        isActive
          ? 'bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-200'
          : 'hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-700 dark:text-surface-300'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="font-semibold tabular-nums text-surface-700 dark:text-surface-200">
          {pageLabel}
        </span>
        <span className="text-[10px] text-surface-400 dark:text-surface-500">{matchLabel}</span>
      </div>
      <div className="text-[11px] leading-relaxed text-surface-600 dark:text-surface-300">
        <span className="text-surface-400 dark:text-surface-500">
          {result.contextBefore ? `...${result.contextBefore} ` : ''}
        </span>
        <mark className="rounded-sm bg-yellow-200 px-0.5 text-surface-900 dark:bg-yellow-700 dark:text-surface-100">
          {result.text}
        </mark>
        <span className="text-surface-400 dark:text-surface-500">
          {result.contextAfter ? ` ${result.contextAfter}...` : ''}
        </span>
      </div>
    </button>
  );
}
