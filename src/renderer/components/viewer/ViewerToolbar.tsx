import { useCallback } from 'react';
import type { ChangeEvent, ComponentType, KeyboardEvent } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Combine,
  FileImage,
  FileOutput,
  FolderOpen,
  Highlighter,
  ImagePlus,
  Images,
  LockKeyhole,
  MousePointer2,
  RotateCcw,
  RotateCw,
  Rows3,
  ScanText,
  Scissors,
  ShieldOff,
  Split,
  StickyNote,
  Strikethrough,
  Trash2,
  Type,
  Underline,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { FitMode, ViewMode } from '../../lib/zoom';
import { ZOOM_MIN, ZOOM_MAX, ZOOM_STEP, formatZoomPercent, fitModeLabel } from '../../lib/zoom';
import type { AnnotationTool } from '../../types/annotation.types';
import { IconButton } from '../ui/IconButton';
import { SegmentedControl } from '../ui/SegmentedControl';
import { ToolbarGroup } from '../ui/ToolbarGroup';

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
  onPageInputKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
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

  activeTool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;

  onRotateCW?: () => void;
  onRotateCCW?: () => void;
  onDeletePage?: () => void;
  onMerge?: () => void;
  onSplit?: () => void;
  onExtract?: () => void;
  onReorder?: () => void;

  onOcr?: () => void;
  onForms?: () => void;
  onPassword?: () => void;
  onRedactionApply?: () => void;
  hasRedactions?: boolean;
  onExportWithImages?: () => void;
  hasStamps?: boolean;
  onPdfToImages?: () => void;
  onImagesToPdf?: () => void;
}

const ANNOTATION_TOOLS: {
  tool: AnnotationTool;
  label: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { tool: 'select', label: 'Select', icon: MousePointer2 },
  { tool: 'highlight', label: 'Highlight', icon: Highlighter },
  { tool: 'underline', label: 'Underline', icon: Underline },
  { tool: 'strikeout', label: 'Strikeout', icon: Strikethrough },
  { tool: 'sticky-note', label: 'Sticky Note', icon: StickyNote },
  { tool: 'free-text', label: 'Add Text', icon: Type },
  { tool: 'stamp', label: 'Add Image', icon: ImagePlus },
  { tool: 'redaction', label: 'Mark Redaction', icon: ShieldOff },
];

const FIT_OPTIONS: { value: FitMode; label: string; title: string }[] = [
  { value: 'actual', label: '100%', title: fitModeLabel('actual') },
  { value: 'fit-width', label: 'Width', title: fitModeLabel('fit-width') },
  { value: 'fit-page', label: 'Page', title: fitModeLabel('fit-page') },
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
}: ViewerToolbarProps) {
  const handleZoomSlider = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const pct = parseInt(e.target.value, 10);
      if (!isNaN(pct)) onZoomChange(pct / 100);
    },
    [onZoomChange]
  );

  const zoomPct = Math.round(zoom * 100);
  const canPrev = currentPage <= 1 || disabled;
  const canNext = currentPage >= numPages || disabled;

  return (
    <div className="flex h-12 shrink-0 select-none items-center gap-2 overflow-x-auto border-b border-surface-200 bg-white px-2 dark:border-surface-800 dark:bg-surface-950">
      <ToolbarGroup label="File">
        <IconButton label="Close document" onClick={onClose} disabled={disabled && numPages === 0}>
          <X className="h-4 w-4" />
        </IconButton>
        <IconButton label="Open another document" onClick={onOpenAnother}>
          <FolderOpen className="h-4 w-4" />
        </IconButton>
        <span
          className="max-w-[180px] truncate px-1 text-xs font-medium text-surface-600 dark:text-surface-300"
          title={fileName}
        >
          {fileName}
        </span>
      </ToolbarGroup>

      <ToolbarGroup label="View">
        <SegmentedControl
          value={viewMode}
          disabled={disabled}
          onChange={onViewMode}
          options={[
            { value: 'single', label: 'Single' },
            { value: 'continuous', label: 'Scroll' },
          ]}
        />
        <SegmentedControl
          value={fitMode}
          disabled={disabled}
          onChange={onFitMode}
          options={FIT_OPTIONS}
        />
      </ToolbarGroup>

      <ToolbarGroup label="Annotate">
        {ANNOTATION_TOOLS.map(({ tool, label, icon: Icon }) => (
          <IconButton
            key={tool}
            label={label}
            active={activeTool === tool}
            onClick={() => onToolChange(tool)}
            disabled={disabled}
            aria-pressed={activeTool === tool}
          >
            <Icon className="h-4 w-4" />
          </IconButton>
        ))}
      </ToolbarGroup>

      <ToolbarGroup label="Pages">
        {onDeletePage && (
          <IconButton label="Delete current page" onClick={onDeletePage} disabled={disabled} danger>
            <Trash2 className="h-4 w-4" />
          </IconButton>
        )}
        {onRotateCCW && (
          <IconButton label="Rotate counter-clockwise" onClick={onRotateCCW} disabled={disabled}>
            <RotateCcw className="h-4 w-4" />
          </IconButton>
        )}
        {onRotateCW && (
          <IconButton label="Rotate clockwise" onClick={onRotateCW} disabled={disabled}>
            <RotateCw className="h-4 w-4" />
          </IconButton>
        )}
        {onMerge && (
          <IconButton label="Merge PDF" onClick={onMerge}>
            <Combine className="h-4 w-4" />
          </IconButton>
        )}
        {onSplit && (
          <IconButton label="Split PDF" onClick={onSplit}>
            <Split className="h-4 w-4" />
          </IconButton>
        )}
        {onReorder && (
          <IconButton label="Reorder pages" onClick={onReorder}>
            <Rows3 className="h-4 w-4" />
          </IconButton>
        )}
        {onExtract && (
          <IconButton label="Extract pages" onClick={onExtract}>
            <Scissors className="h-4 w-4" />
          </IconButton>
        )}
      </ToolbarGroup>

      <ToolbarGroup label="Convert and secure">
        {onOcr && (
          <IconButton label="OCR" onClick={onOcr} disabled={disabled}>
            <ScanText className="h-4 w-4" />
          </IconButton>
        )}
        {onForms && (
          <IconButton label="Forms" onClick={onForms} disabled={disabled}>
            <FileOutput className="h-4 w-4" />
          </IconButton>
        )}
        {onPassword && (
          <IconButton label="Password Protection" onClick={onPassword} disabled={disabled}>
            <LockKeyhole className="h-4 w-4" />
          </IconButton>
        )}
        {onPdfToImages && (
          <IconButton label="PDF to Images" onClick={onPdfToImages} disabled={disabled}>
            <FileImage className="h-4 w-4" />
          </IconButton>
        )}
        {onImagesToPdf && (
          <IconButton label="Images to PDF" onClick={onImagesToPdf}>
            <Images className="h-4 w-4" />
          </IconButton>
        )}
        {onRedactionApply && hasRedactions && (
          <button
            type="button"
            onClick={onRedactionApply}
            disabled={disabled}
            className="h-7 rounded-md bg-red-600 px-2.5 text-xs font-semibold text-white shadow-sm shadow-red-900/10 hover:bg-red-700 disabled:opacity-35"
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
            className="h-7 rounded-md bg-emerald-600 px-2.5 text-xs font-semibold text-white shadow-sm shadow-emerald-900/10 hover:bg-emerald-700 disabled:opacity-35"
            title="Export PDF with Images"
          >
            Export Images
          </button>
        )}
      </ToolbarGroup>

      <div className="flex-1" />

      <ToolbarGroup label="Navigation" className="border-r-0 pr-0">
        <IconButton label="First page" onClick={onFirstPage} disabled={canPrev}>
          <ChevronsLeft className="h-4 w-4" />
        </IconButton>
        <IconButton label="Previous page" onClick={onPrevPage} disabled={canPrev}>
          <ChevronLeft className="h-4 w-4" />
        </IconButton>
        <div className="flex items-center gap-1">
          <input
            type="text"
            inputMode="numeric"
            value={pageInput}
            onChange={(e) => onPageInputChange(e.target.value)}
            onKeyDown={onPageInputKeyDown}
            onFocus={onPageInputFocus}
            onBlur={onPageInputBlur}
            disabled={disabled}
            className="h-7 w-12 rounded-md border border-surface-300 bg-white px-1 text-center text-xs tabular-nums text-surface-900 outline-none focus:border-brand-500 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-100"
            aria-label="Page number"
          />
          <span className="w-10 text-xs tabular-nums text-surface-500">/ {numPages}</span>
        </div>
        <IconButton label="Next page" onClick={onNextPage} disabled={canNext}>
          <ChevronRight className="h-4 w-4" />
        </IconButton>
        <IconButton label="Last page" onClick={onLastPage} disabled={canNext}>
          <ChevronsRight className="h-4 w-4" />
        </IconButton>
      </ToolbarGroup>

      <ToolbarGroup label="Zoom" className="border-r-0 pr-0">
        <IconButton label="Zoom out" onClick={onZoomOut} disabled={zoom <= ZOOM_MIN || disabled}>
          <ZoomOut className="h-4 w-4" />
        </IconButton>
        <input
          type="range"
          min={ZOOM_MIN * 100}
          max={ZOOM_MAX * 100}
          step={ZOOM_STEP * 100}
          value={zoomPct}
          onChange={handleZoomSlider}
          disabled={disabled}
          className="h-1 w-20 disabled:opacity-35"
          aria-label="Zoom slider"
        />
        <span className="w-11 text-center text-xs tabular-nums text-surface-600 dark:text-surface-300">
          {formatZoomPercent(zoom)}
        </span>
        <IconButton label="Zoom in" onClick={onZoomIn} disabled={zoom >= ZOOM_MAX || disabled}>
          <ZoomIn className="h-4 w-4" />
        </IconButton>
      </ToolbarGroup>
    </div>
  );
}
