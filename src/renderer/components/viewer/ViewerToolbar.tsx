import { useCallback } from 'react';
import type { FitMode, ViewMode } from '../../lib/zoom';
import { ZOOM_MIN, ZOOM_MAX, ZOOM_STEP, formatZoomPercent, fitModeLabel } from '../../lib/zoom';

interface ViewerToolbarProps {
  fileName: string;
  numPages: number;
  currentPage: number;
  pageInput: string;
  viewMode: ViewMode;
  fitMode: FitMode;
  zoom: number;
  disabled: boolean;

  onClose: () => void;
  onOpenAnother: () => void;
  onPageInputChange: (value: string) => void;
  onPageInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onPageInputFocus: () => void;
  onPageInputBlur: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onFirstPage: () => void;
  onLastPage: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomChange: (z: number) => void;
  onFitMode: (mode: FitMode) => void;
  onViewMode: (mode: ViewMode) => void;
}

export function ViewerToolbar({
  fileName,
  numPages,
  currentPage,
  pageInput,
  viewMode,
  fitMode,
  zoom,
  disabled,
  onClose,
  onOpenAnother,
  onPageInputChange,
  onPageInputKeyDown,
  onPageInputFocus,
  onPageInputBlur,
  onPrevPage,
  onNextPage,
  onFirstPage,
  onLastPage,
  onZoomIn,
  onZoomOut,
  onZoomChange,
  onFitMode,
  onViewMode,
}: ViewerToolbarProps) {
  const handleZoomSlider = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const pct = parseInt(e.target.value, 10);
      if (!isNaN(pct)) {
        onZoomChange(pct / 100);
      }
    },
    [onZoomChange]
  );

  const zoomPct = Math.round(zoom * 100);
  const canPrev = currentPage <= 1 || disabled;
  const canNext = currentPage >= numPages || disabled;

  return (
    <div className="h-10 flex items-center gap-1.5 px-3 border-b border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-950 shrink-0 select-none">
      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        disabled={disabled && numPages === 0}
        className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-500 hover:text-surface-900 dark:hover:text-surface-100 disabled:opacity-30"
        aria-label="Close document"
        title="Close document"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* File name */}
      <span
        className="text-xs text-surface-600 dark:text-surface-300 truncate max-w-[200px]"
        title={fileName}
      >
        {fileName}
      </span>

      <div className="flex-1" />

      {/* Open another */}
      <button
        type="button"
        onClick={onOpenAnother}
        className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-500 hover:text-surface-900 dark:hover:text-surface-100"
        aria-label="Open another document"
        title="Open another document"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </button>

      <div className="w-px h-5 bg-surface-300 dark:bg-surface-700" />

      {/* View mode toggle */}
      <button
        type="button"
        onClick={() => onViewMode(viewMode === 'single' ? 'continuous' : 'single')}
        disabled={disabled}
        className="px-1.5 py-0.5 text-xs rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300 disabled:opacity-30"
        title={`Switch to ${viewMode === 'single' ? 'continuous' : 'single page'} mode`}
      >
        {viewMode === 'single' ? 'Single' : 'Scroll'}
      </button>

      <div className="w-px h-5 bg-surface-300 dark:bg-surface-700" />

      {/* Navigation */}
      <button
        type="button"
        onClick={onFirstPage}
        disabled={canPrev}
        className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300 disabled:opacity-30 disabled:cursor-default"
        aria-label="First page"
        title="First page"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
        </svg>
      </button>

      <button
        type="button"
        onClick={onPrevPage}
        disabled={canPrev}
        className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300 disabled:opacity-30 disabled:cursor-default"
        aria-label="Previous page"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <input
        type="text"
        inputMode="numeric"
        value={pageInput}
        onChange={(e) => onPageInputChange(e.target.value)}
        onKeyDown={onPageInputKeyDown}
        onFocus={onPageInputFocus}
        onBlur={onPageInputBlur}
        disabled={disabled}
        className="w-10 h-6 text-center text-xs rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 outline-none focus:border-brand-400 disabled:opacity-30"
        aria-label="Page number"
      />

      <span className="text-xs text-surface-500 dark:text-surface-400">/ {numPages}</span>

      <button
        type="button"
        onClick={onNextPage}
        disabled={canNext}
        className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300 disabled:opacity-30 disabled:cursor-default"
        aria-label="Next page"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <button
        type="button"
        onClick={onLastPage}
        disabled={canNext}
        className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300 disabled:opacity-30 disabled:cursor-default"
        aria-label="Last page"
        title="Last page"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
        </svg>
      </button>

      <div className="w-px h-5 bg-surface-300 dark:bg-surface-700" />

      {/* Zoom controls */}
      <button
        type="button"
        onClick={onZoomOut}
        disabled={zoom <= ZOOM_MIN || disabled}
        className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300 disabled:opacity-30 disabled:cursor-default"
        aria-label="Zoom out"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12H3" />
        </svg>
      </button>

      <input
        type="range"
        min={ZOOM_MIN * 100}
        max={ZOOM_MAX * 100}
        step={ZOOM_STEP * 100}
        value={zoomPct}
        onChange={handleZoomSlider}
        disabled={disabled}
        className="w-20 h-1 accent-brand-500 disabled:opacity-30"
        aria-label="Zoom slider"
      />

      <span className="text-xs text-surface-600 dark:text-surface-300 w-10 text-center tabular-nums">
        {formatZoomPercent(zoom)}
      </span>

      <button
        type="button"
        onClick={onZoomIn}
        disabled={zoom >= ZOOM_MAX || disabled}
        className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300 disabled:opacity-30 disabled:cursor-default"
        aria-label="Zoom in"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
        </svg>
      </button>

      <div className="w-px h-5 bg-surface-300 dark:bg-surface-700" />

      {/* Fit mode presets */}
      {(['actual', 'fit-width', 'fit-page'] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onFitMode(mode)}
          disabled={disabled}
          className={`px-1.5 py-0.5 text-xs rounded disabled:opacity-30 ${
            fitMode === mode
              ? 'bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300 font-medium'
              : 'text-surface-500 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
          }`}
          title={fitModeLabel(mode)}
        >
          {fitModeLabel(mode)}
        </button>
      ))}
    </div>
  );
}
