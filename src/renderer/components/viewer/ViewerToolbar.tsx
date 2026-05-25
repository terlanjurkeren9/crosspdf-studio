import { useCallback } from 'react';
import type { FitMode, ViewMode } from '../../lib/zoom';
import { ZOOM_MIN, ZOOM_MAX, ZOOM_STEP, formatZoomPercent, fitModeLabel } from '../../lib/zoom';
import type { AnnotationTool } from '../../types/annotation.types';

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

  // Annotation
  activeTool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;

  // Page ops
  onRotateCW?: () => void;
  onRotateCCW?: () => void;
  onDeletePage?: () => void;
  onMerge?: () => void;
  onSplit?: () => void;
  onExtract?: () => void;
  onReorder?: () => void;

  // Phase 4 tools
  onOcr?: () => void;
  onForms?: () => void;
  onPassword?: () => void;
  onRedactionApply?: () => void;
  hasRedactions?: boolean;
  onExportWithImages?: () => void;
  hasStamps?: boolean;
  onPdfToImages?: () => void;
  onImagesToPdf?: () => void;
  onPreferences?: () => void;
}

const ANNOTATION_TOOLS: { tool: AnnotationTool; label: string; icon: React.ReactNode }[] = [
  {
    tool: 'select',
    label: 'Select',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
      />
    ),
  },
  {
    tool: 'highlight',
    label: 'Highlight',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      />
    ),
  },
  {
    tool: 'underline',
    label: 'Underline',
    icon: (
      <g>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 3v7a6 6 0 006 6 6 6 0 006-6V3" />
        <line
          x1="4"
          y1="21"
          x2="20"
          y2="21"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
        />
      </g>
    ),
  },
  {
    tool: 'strikeout',
    label: 'Strikeout',
    icon: (
      <g>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 3v7a6 6 0 006 6 6 6 0 006-6V3" />
        <line
          x1="4"
          y1="14"
          x2="20"
          y2="14"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
        />
      </g>
    ),
  },
  {
    tool: 'sticky-note',
    label: 'Sticky Note',
    icon: (
      <g>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"
        />
        <rect x="8" y="2" width="8" height="4" rx="1" stroke="currentColor" strokeWidth={2} />
      </g>
    ),
  },
  {
    tool: 'free-text',
    label: 'Add Text',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />,
  },
  {
    tool: 'stamp',
    label: 'Add Image',
    icon: (
      <g>
        <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth={2} />
        <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 15l-5-5L5 21" />
      </g>
    ),
  },
  {
    tool: 'redaction',
    label: 'Redaction',
    icon: (
      <g>
        <rect
          x="5"
          y="5"
          width="14"
          height="14"
          rx="1"
          stroke="currentColor"
          strokeWidth={2}
          fill="none"
        />
        <path d="M7 7h4l3 3v7l-7-7V7z" fill="currentColor" opacity={0.6} />
        <line x1="5" y1="19" x2="19" y2="5" stroke="currentColor" strokeWidth={2} />
      </g>
    ),
  },
];

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
  activeTool,
  onToolChange,
  onRotateCW,
  onRotateCCW,
  onDeletePage,
  onMerge,
  onSplit,
  onExtract,
  onReorder,
  onOcr,
  onForms,
  onPassword,
  onRedactionApply,
  hasRedactions = false,
  onExportWithImages,
  hasStamps = false,
  onPdfToImages,
  onImagesToPdf,
  onPreferences,
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

      {/* Annotation tools */}
      {ANNOTATION_TOOLS.map(({ tool, label, icon }) => (
        <button
          key={tool}
          type="button"
          onClick={() => onToolChange(tool)}
          disabled={disabled}
          className={`p-1 rounded disabled:opacity-30 ${
            activeTool === tool
              ? 'bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300'
              : 'text-surface-500 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
          }`}
          title={label}
          aria-label={label}
          aria-pressed={activeTool === tool}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            {icon}
          </svg>
        </button>
      ))}

      <div className="w-px h-5 bg-surface-300 dark:bg-surface-700" />

      {/* Navigation */}
      <div className="flex items-center gap-1 shrink-0 whitespace-nowrap">
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

        <div className="flex items-center gap-1 shrink-0 whitespace-nowrap">
          <input
            type="text"
            inputMode="numeric"
            value={pageInput}
            onChange={(e) => onPageInputChange(e.target.value)}
            onKeyDown={onPageInputKeyDown}
            onFocus={onPageInputFocus}
            onBlur={onPageInputBlur}
            disabled={disabled}
            className="w-12 min-w-[3rem] h-6 px-1 text-center text-xs tabular-nums rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 outline-none focus:border-brand-400 disabled:opacity-30"
            aria-label="Page number"
          />

          <span className="text-xs text-surface-500 dark:text-surface-400 tabular-nums whitespace-nowrap">
            / {numPages}
          </span>
        </div>

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
      </div>

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

      {/* Page ops separator + buttons */}
      {(onDeletePage || onRotateCW || onRotateCCW) && (
        <>
          <div className="w-px h-5 bg-surface-300 dark:bg-surface-700" />
          {onDeletePage && (
            <button
              type="button"
              onClick={onDeletePage}
              disabled={disabled}
              className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-surface-500 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-30"
              title="Delete current page"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          )}
          {onRotateCCW && (
            <button
              type="button"
              onClick={onRotateCCW}
              disabled={disabled}
              className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-500 hover:text-surface-900 dark:hover:text-surface-100 disabled:opacity-30"
              title="Rotate counter-clockwise"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M1 4v6h6" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.51 15a9 9 0 102.13-9.36L1 10"
                />
              </svg>
            </button>
          )}
          {onRotateCW && (
            <button
              type="button"
              onClick={onRotateCW}
              disabled={disabled}
              className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-500 hover:text-surface-900 dark:hover:text-surface-100 disabled:opacity-30"
              title="Rotate clockwise"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M23 4v6h-6" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20.49 15a9 9 0 11-2.13-9.36L23 10"
                />
              </svg>
            </button>
          )}
        </>
      )}

      {/* File ops separator + buttons */}
      {(onMerge || onSplit || onExtract || onReorder) && (
        <>
          <div className="w-px h-5 bg-surface-300 dark:bg-surface-700" />
          {onMerge && (
            <button
              type="button"
              onClick={onMerge}
              className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-500 hover:text-surface-900 dark:hover:text-surface-100"
              title="Merge PDF"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
                />
              </svg>
            </button>
          )}
          {onSplit && (
            <button
              type="button"
              onClick={onSplit}
              className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-500 hover:text-surface-900 dark:hover:text-surface-100"
              title="Split PDF"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
            </button>
          )}
          {onReorder && (
            <button
              type="button"
              onClick={onReorder}
              className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-500 hover:text-surface-900 dark:hover:text-surface-100"
              title="Reorder Pages"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 6v12" />
              </svg>
            </button>
          )}
          {onExtract && (
            <button
              type="button"
              onClick={onExtract}
              className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-500 hover:text-surface-900 dark:hover:text-surface-100"
              title="Extract Pages"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </button>
          )}
        </>
      )}

      {/* Phase 4: OCR, Forms, Security, Redaction, Export Images, PDF/Images, Preferences */}
      {(onOcr ||
        onForms ||
        onPassword ||
        onRedactionApply ||
        onExportWithImages ||
        onPdfToImages ||
        onImagesToPdf ||
        onPreferences) && (
        <div className="flex items-center gap-1">
          <div className="w-px h-5 bg-surface-300 dark:bg-surface-700" />
          {onOcr && (
            <button
              type="button"
              onClick={onOcr}
              disabled={disabled}
              className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-500 hover:text-surface-900 dark:hover:text-surface-100 disabled:opacity-30"
              title="OCR"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </button>
          )}
          {onForms && (
            <button
              type="button"
              onClick={onForms}
              disabled={disabled}
              className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-500 hover:text-surface-900 dark:hover:text-surface-100 disabled:opacity-30"
              title="Forms"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </button>
          )}
          {onPassword && (
            <button
              type="button"
              onClick={onPassword}
              disabled={disabled}
              className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-500 hover:text-surface-900 dark:hover:text-surface-100 disabled:opacity-30"
              title="Password Protection"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </button>
          )}
          {onRedactionApply && hasRedactions && (
            <button
              type="button"
              onClick={onRedactionApply}
              disabled={disabled}
              className="px-2 py-0.5 text-xs rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60 disabled:opacity-30 font-medium"
              title="Apply Redactions"
            >
              Apply Redact
            </button>
          )}
          {onExportWithImages && hasStamps && (
            <button
              type="button"
              onClick={onExportWithImages}
              disabled={disabled}
              className="px-2 py-0.5 text-xs rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/60 disabled:opacity-30 font-medium"
              title="Export PDF with Images"
            >
              Export Images
            </button>
          )}
          {onPdfToImages && (
            <button
              type="button"
              onClick={onPdfToImages}
              disabled={disabled}
              className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-500 hover:text-surface-900 dark:hover:text-surface-100 disabled:opacity-30"
              title="PDF to Images"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </button>
          )}
          {onImagesToPdf && (
            <button
              type="button"
              onClick={onImagesToPdf}
              className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-500 hover:text-surface-900 dark:hover:text-surface-100"
              title="Images to PDF"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </button>
          )}
          {onPreferences && (
            <button
              type="button"
              onClick={onPreferences}
              className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-500 hover:text-surface-900 dark:hover:text-surface-100"
              title="Preferences"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
