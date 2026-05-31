import { useCallback } from 'react';
import type { ChangeEvent, ComponentType, KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
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
  PenTool,
  RotateCcw,
  RotateCw,
  Rows3,
  ScanText,
  Scissors,
  ShieldOff,
  Split,
  StickyNote,
  Strikethrough,
  TextCursorInput,
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
  onPdfToImages?: () => void;
  onImagesToPdf?: () => void;
  onSignature?: () => void;
}

const ANNOTATION_TOOLS: {
  tool: AnnotationTool;
  labelKey: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { tool: 'select', labelKey: 'viewer.select', icon: MousePointer2 },
  { tool: 'highlight', labelKey: 'viewer.highlight', icon: Highlighter },
  { tool: 'underline', labelKey: 'viewer.underline', icon: Underline },
  { tool: 'strikeout', labelKey: 'viewer.strikeout', icon: Strikethrough },
  { tool: 'sticky-note', labelKey: 'viewer.stickyNote', icon: StickyNote },
  { tool: 'free-text', labelKey: 'viewer.addText', icon: Type },
  { tool: 'stamp', labelKey: 'viewer.addImage', icon: ImagePlus },
  { tool: 'redaction', labelKey: 'viewer.redaction', icon: ShieldOff },
  { tool: 'form-field', labelKey: 'viewer.createFormField', icon: TextCursorInput },
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
  onPdfToImages,
  onImagesToPdf,
  onSignature,
}: ViewerToolbarProps) {
  const { t } = useTranslation();
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
  const fitOptions: { value: FitMode; label: string; title: string }[] = [
    { value: 'actual', label: '100%', title: fitModeLabel('actual') },
    { value: 'fit-width', label: t('viewer.widthFit'), title: fitModeLabel('fit-width') },
    { value: 'fit-page', label: t('viewer.pageFit'), title: fitModeLabel('fit-page') },
  ];

  return (
    <div className="flex h-11 shrink-0 select-none items-center gap-2 overflow-x-auto border-b border-surface-200 bg-white px-2.5 dark:border-surface-700 dark:bg-surface-900">
      {/* File */}
      <ToolbarGroup label={t('viewer.file')}>
        <IconButton
          label={t('viewer.closeDocument')}
          onClick={onClose}
          disabled={disabled && numPages === 0}
        >
          <X className="h-4 w-4" />
        </IconButton>
        <IconButton label={t('viewer.openAnotherDocument')} onClick={onOpenAnother}>
          <FolderOpen className="h-4 w-4" />
        </IconButton>
        <span
          className="max-w-[160px] truncate px-1 text-xs font-medium text-surface-600 dark:text-surface-300"
          title={fileName}
        >
          {fileName}
        </span>
      </ToolbarGroup>

      {/* View */}
      <ToolbarGroup label={t('viewer.view')}>
        <SegmentedControl
          value={viewMode}
          disabled={disabled}
          onChange={onViewMode}
          options={[
            { value: 'single', label: t('viewer.single') },
            { value: 'continuous', label: t('viewer.continuous') },
          ]}
        />
        <SegmentedControl
          value={fitMode}
          disabled={disabled}
          onChange={onFitMode}
          options={fitOptions}
        />
      </ToolbarGroup>

      {/* Annotate */}
      <ToolbarGroup label={t('viewer.annotate')}>
        {ANNOTATION_TOOLS.map(({ tool, labelKey, icon: Icon }) => (
          <IconButton
            key={tool}
            label={t(labelKey)}
            active={activeTool === tool}
            onClick={() => onToolChange(tool)}
            disabled={disabled}
            aria-pressed={activeTool === tool}
          >
            <Icon className="h-4 w-4" />
          </IconButton>
        ))}
      </ToolbarGroup>

      {/* Pages */}
      <ToolbarGroup label={t('viewer.pages')}>
        {onDeletePage && (
          <IconButton
            label={t('viewer.deleteCurrentPage')}
            onClick={onDeletePage}
            disabled={disabled}
            danger
          >
            <Trash2 className="h-4 w-4" />
          </IconButton>
        )}
        {onRotateCCW && (
          <IconButton label={t('viewer.rotateLeft')} onClick={onRotateCCW} disabled={disabled}>
            <RotateCcw className="h-4 w-4" />
          </IconButton>
        )}
        {onRotateCW && (
          <IconButton label={t('viewer.rotateRight')} onClick={onRotateCW} disabled={disabled}>
            <RotateCw className="h-4 w-4" />
          </IconButton>
        )}
        {onMerge && (
          <IconButton label={t('viewer.mergePdf')} onClick={onMerge}>
            <Combine className="h-4 w-4" />
          </IconButton>
        )}
        {onSplit && (
          <IconButton label={t('viewer.splitPdf')} onClick={onSplit}>
            <Split className="h-4 w-4" />
          </IconButton>
        )}
        {onReorder && (
          <IconButton label={t('viewer.reorderPages')} onClick={onReorder}>
            <Rows3 className="h-4 w-4" />
          </IconButton>
        )}
        {onExtract && (
          <IconButton label={t('viewer.extractPages')} onClick={onExtract}>
            <Scissors className="h-4 w-4" />
          </IconButton>
        )}
      </ToolbarGroup>

      {/* Convert & Secure */}
      <ToolbarGroup label={t('viewer.convertSecure')}>
        {onOcr && (
          <IconButton label={t('viewer.ocr')} onClick={onOcr} disabled={disabled}>
            <ScanText className="h-4 w-4" />
          </IconButton>
        )}
        {onForms && (
          <IconButton label={t('viewer.forms')} onClick={onForms} disabled={disabled}>
            <FileOutput className="h-4 w-4" />
          </IconButton>
        )}
        {onPassword && (
          <IconButton
            label={t('viewer.passwordProtection')}
            onClick={onPassword}
            disabled={disabled}
          >
            <LockKeyhole className="h-4 w-4" />
          </IconButton>
        )}
        {onPdfToImages && (
          <IconButton label={t('viewer.pdfToImages')} onClick={onPdfToImages} disabled={disabled}>
            <FileImage className="h-4 w-4" />
          </IconButton>
        )}
        {onImagesToPdf && (
          <IconButton label={t('viewer.imagesToPdf')} onClick={onImagesToPdf}>
            <Images className="h-4 w-4" />
          </IconButton>
        )}
        {onSignature && (
          <IconButton
            label={t('viewer.digitalSignature')}
            onClick={onSignature}
            disabled={disabled}
          >
            <PenTool className="h-4 w-4" />
          </IconButton>
        )}
      </ToolbarGroup>

      <div className="flex-1" />

      {/* Navigation */}
      <ToolbarGroup label={t('viewer.navigation')} className="border-r-0 pr-0">
        <IconButton label={t('viewer.firstPage')} onClick={onFirstPage} disabled={canPrev}>
          <ChevronsLeft className="h-4 w-4" />
        </IconButton>
        <IconButton label={t('viewer.previousPage')} onClick={onPrevPage} disabled={canPrev}>
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
            className="h-7 w-12 rounded-lg border border-surface-200 bg-white px-1 text-center text-xs tabular-nums text-surface-700 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-200"
            aria-label={t('viewer.pageNumber')}
          />
          <span className="w-10 text-xs tabular-nums text-surface-400">/ {numPages}</span>
        </div>
        <IconButton label={t('viewer.nextPage')} onClick={onNextPage} disabled={canNext}>
          <ChevronRight className="h-4 w-4" />
        </IconButton>
        <IconButton label={t('viewer.lastPage')} onClick={onLastPage} disabled={canNext}>
          <ChevronsRight className="h-4 w-4" />
        </IconButton>
      </ToolbarGroup>

      {/* Zoom */}
      <ToolbarGroup label={t('viewer.zoom')} className="border-r-0 pr-0">
        <IconButton
          label={t('viewer.zoomOut')}
          onClick={onZoomOut}
          disabled={zoom <= ZOOM_MIN || disabled}
        >
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
          aria-label={t('viewer.zoomSlider')}
        />
        <span className="w-11 text-center text-xs tabular-nums text-surface-500 dark:text-surface-400">
          {formatZoomPercent(zoom)}
        </span>
        <IconButton
          label={t('viewer.zoomIn')}
          onClick={onZoomIn}
          disabled={zoom >= ZOOM_MAX || disabled}
        >
          <ZoomIn className="h-4 w-4" />
        </IconButton>
      </ToolbarGroup>
    </div>
  );
}
