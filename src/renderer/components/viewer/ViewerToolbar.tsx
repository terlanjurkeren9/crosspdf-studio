import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Circle,
  Command,
  Edit3,
  FileImage,
  FileOutput,
  FilePlus2,
  FileText,
  FolderOpen,
  GitCompare,
  Hand,
  Highlighter,
  ImagePlus,
  Images,
  Layers,
  LockKeyhole,
  Minus,
  MousePointer2,
  PenTool,
  Pencil,
  Printer,
  RotateCcw,
  RotateCw,
  Save,
  ScanText,
  Scissors,
  Settings,
  ShieldCheck,
  ShieldOff,
  Square,
  StickyNote,
  Strikethrough,
  TextCursorInput,
  Type,
  Underline,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  type ChangeEvent,
  type ComponentType,
  type KeyboardEvent,
  type FocusEvent,
  useCallback,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import type { AnnotationTool } from '../../types/annotation.types';
import type { FitMode, ViewMode } from '../../lib/zoom';
import { IconButton } from '../ui/IconButton';
import { SegmentedControl } from '../ui/SegmentedControl';
import { ToolbarGroup } from '../ui/ToolbarGroup';
import { ToolPaletteDropdown } from '../ui/ToolPaletteDropdown';
import type { ToolPaletteGroup, ToolPaletteItem } from '../ui/ToolPaletteDropdown';
import { RibbonTabs } from '../ui/RibbonTabs';
import type { RibbonTab } from '../ui/RibbonTabs';

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 5;
const ZOOM_STEP = 0.25;

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
  onSave?: () => void;
  onSaveAs?: () => void;
  onPrint?: () => void;
  onPageInputChange: (val: string) => void;
  onPageInputKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onPageInputFocus: (e: FocusEvent<HTMLInputElement>) => void;
  onPageInputBlur: (e: FocusEvent<HTMLInputElement>) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onFirstPage: () => void;
  onLastPage: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomChange: (val: number) => void;
  onFitMode: (val: FitMode) => void;
  onViewMode: (val: ViewMode) => void;
  activeTool: AnnotationTool | null;
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
  onCompare?: () => void;
  onBatch?: () => void;
  onValidate?: () => void;
  onCommandPalette?: () => void;
  editMode: boolean;
  onEditModeToggle: () => void;
  /** Apply pending redactions */
  onRedactionApply?: () => void;
  hasRedactions?: boolean;
  /** Export with images */
  onExportWithImages?: () => void;
  hasStamps?: boolean;
  /** Preferences / settings */
  onPreferences?: () => void;
  /** Rotate view clockwise */
  onRotateViewCW?: () => void;
  /** Rotate view counter-clockwise */
  onRotateViewCCW?: () => void;
  /** Export OCR'd text */
  onExportText?: () => void;
  /** Flatten PDF forms */
  onFlatten?: () => void;
  /** Create form field */
  onCreateField?: () => void;
}

function fitModeLabel(mode: FitMode): string {
  switch (mode) {
    case 'actual':
      return '100%';
    case 'fit-width':
      return 'Fit Width';
    case 'fit-page':
      return 'Fit Page';
    default:
      return '';
  }
}

function formatZoomPercent(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}

interface ToolDef {
  tool: AnnotationTool;
  labelKey: string;
  icon: ComponentType<{ className?: string }>;
}

const TEXT_MARKUP_TOOLS: ToolDef[] = [
  { tool: 'highlight', labelKey: 'viewer.highlight', icon: Highlighter },
  { tool: 'underline', labelKey: 'viewer.underline', icon: Underline },
  { tool: 'strikeout', labelKey: 'viewer.strikeout', icon: Strikethrough },
  { tool: 'sticky-note', labelKey: 'viewer.stickyNote', icon: StickyNote },
  { tool: 'free-text', labelKey: 'viewer.addText', icon: Type },
];

const SHAPE_TOOLS: ToolDef[] = [
  { tool: 'rectangle', labelKey: 'viewer.rectangle', icon: Square },
  { tool: 'ellipse', labelKey: 'viewer.ellipse', icon: Circle },
  { tool: 'line', labelKey: 'viewer.line', icon: Minus },
  { tool: 'arrow', labelKey: 'viewer.arrow', icon: ArrowRight },
];

const DRAWING_TOOLS: ToolDef[] = [{ tool: 'freehand', labelKey: 'viewer.freehand', icon: Pencil }];

const ADVANCED_TOOLS: ToolDef[] = [
  { tool: 'stamp', labelKey: 'viewer.addImage', icon: ImagePlus },
  { tool: 'redaction', labelKey: 'viewer.redaction', icon: ShieldOff },
  { tool: 'form-field', labelKey: 'viewer.createFormField', icon: TextCursorInput },
];

function toolDefsToItems(tools: ToolDef[], t: (key: string) => string): ToolPaletteItem[] {
  return tools.map((td) => ({
    id: td.tool,
    label: t(td.labelKey),
    icon: td.icon,
  }));
}

/** Separator between toolbar sections */
function ToolbarSeparator() {
  return (
    <div className="mx-1 h-6 w-px bg-gradient-to-b from-transparent via-surface-300 to-transparent dark:via-surface-600" />
  );
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
  onSave,
  onSaveAs,
  onPrint,
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
  onCompare,
  onBatch,
  onValidate,
  onCommandPalette,
  editMode,
  onEditModeToggle,
  onRedactionApply,
  hasRedactions,
  onExportWithImages,
  hasStamps,
  onPreferences,
  onRotateViewCW,
  onRotateViewCCW,
  onExportText,
  onFlatten,
  onCreateField,
}: ViewerToolbarProps) {
  const { t } = useTranslation();
  const [ribbonTab, setRibbonTab] = useState('home');

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

  /* Build annotation palette groups */
  const annotationGroups: ToolPaletteGroup[] = [
    { label: t('viewer.groupTextMarkup'), items: toolDefsToItems(TEXT_MARKUP_TOOLS, t) },
    { label: t('viewer.groupShapes'), items: toolDefsToItems(SHAPE_TOOLS, t) },
    { label: t('viewer.groupDrawing'), items: toolDefsToItems(DRAWING_TOOLS, t) },
    { label: t('viewer.groupAdvanced'), items: toolDefsToItems(ADVANCED_TOOLS, t) },
  ];

  /* Build page operations palette */
  const pageOpsItems: ToolPaletteGroup[] = [
    {
      label: t('viewer.groupPageActions'),
      items: [
        ...(onDeletePage
          ? [
              {
                id: 'delete-page',
                label: t('viewer.deleteCurrentPage'),
                icon: X as ComponentType<{ className?: string }>,
              },
            ]
          : []),
        ...(onRotateCCW
          ? [
              {
                id: 'rotate-ccw',
                label: t('viewer.rotateLeft'),
                icon: ChevronsLeft as ComponentType<{ className?: string }>,
              },
            ]
          : []),
        ...(onRotateCW
          ? [
              {
                id: 'rotate-cw',
                label: t('viewer.rotateRight'),
                icon: ChevronsRight as ComponentType<{ className?: string }>,
              },
            ]
          : []),
        ...(onMerge
          ? [
              {
                id: 'merge',
                label: t('viewer.mergePdf'),
                icon: FilePlus2 as ComponentType<{ className?: string }>,
              },
            ]
          : []),
        ...(onSplit
          ? [
              {
                id: 'split',
                label: t('viewer.splitPdf'),
                icon: Scissors as ComponentType<{ className?: string }>,
              },
            ]
          : []),
        ...(onReorder
          ? [
              {
                id: 'reorder',
                label: t('viewer.reorderPages'),
                icon: ArrowRight as ComponentType<{ className?: string }>,
              },
            ]
          : []),
        ...(onExtract
          ? [
              {
                id: 'extract',
                label: t('viewer.extractPages'),
                icon: FileOutput as ComponentType<{ className?: string }>,
              },
            ]
          : []),
      ].filter((x) => x) as ToolPaletteItem[],
    },
  ];

  /* Build convert/secure palette */
  const toolsItems: ToolPaletteGroup[] = [
    {
      label: t('viewer.convertSecure'),
      items: [
        ...(onOcr
          ? [
              {
                id: 'ocr',
                label: t('viewer.ocr'),
                icon: ScanText as ComponentType<{ className?: string }>,
              },
            ]
          : []),
        ...(onExportText
          ? [
              {
                id: 'export-text',
                label: t('viewer.exportText'),
                icon: FileText as ComponentType<{ className?: string }>,
              },
            ]
          : []),
        ...(onForms
          ? [
              {
                id: 'forms',
                label: t('viewer.forms'),
                icon: FileOutput as ComponentType<{ className?: string }>,
              },
            ]
          : []),
        ...(onFlatten
          ? [
              {
                id: 'flatten',
                label: t('viewer.flatten'),
                icon: Layers as ComponentType<{ className?: string }>,
              },
            ]
          : []),
        ...(onCreateField
          ? [
              {
                id: 'create-field',
                label: t('viewer.createField'),
                icon: TextCursorInput as ComponentType<{ className?: string }>,
              },
            ]
          : []),
        ...(onPassword
          ? [
              {
                id: 'password',
                label: t('viewer.passwordProtection'),
                icon: LockKeyhole as ComponentType<{ className?: string }>,
              },
            ]
          : []),
        ...(onPassword
          ? [
              {
                id: 'password',
                label: t('viewer.passwordProtection'),
                icon: LockKeyhole as ComponentType<{ className?: string }>,
              },
            ]
          : []),
        ...(onPdfToImages
          ? [
              {
                id: 'pdf-to-images',
                label: t('viewer.pdfToImages'),
                icon: FileImage as ComponentType<{ className?: string }>,
              },
            ]
          : []),
        ...(onImagesToPdf
          ? [
              {
                id: 'images-to-pdf',
                label: t('viewer.imagesToPdf'),
                icon: Images as ComponentType<{ className?: string }>,
              },
            ]
          : []),
        ...(onSignature
          ? [
              {
                id: 'signature',
                label: t('viewer.digitalSignature'),
                icon: PenTool as ComponentType<{ className?: string }>,
              },
            ]
          : []),
      ].filter((x) => x) as ToolPaletteItem[],
    },
  ];

  const handlePageOpSelect = useCallback(
    (id: string) => {
      switch (id) {
        case 'delete-page':
          onDeletePage?.();
          break;
        case 'rotate-ccw':
          onRotateCCW?.();
          break;
        case 'rotate-cw':
          onRotateCW?.();
          break;
        case 'merge':
          onMerge?.();
          break;
        case 'split':
          onSplit?.();
          break;
        case 'reorder':
          onReorder?.();
          break;
        case 'extract':
          onExtract?.();
          break;
      }
    },
    [onDeletePage, onRotateCCW, onRotateCW, onMerge, onSplit, onReorder, onExtract]
  );

  const handleToolSelect = useCallback(
    (id: string) => {
      switch (id) {
        case 'ocr':
          onOcr?.();
          break;
        case 'export-text':
          onExportText?.();
          break;
        case 'forms':
          onForms?.();
          break;
        case 'flatten':
          onFlatten?.();
          break;
        case 'create-field':
          onCreateField?.();
          break;
        case 'password':
          onPassword?.();
          break;
        case 'pdf-to-images':
          onPdfToImages?.();
          break;
        case 'images-to-pdf':
          onImagesToPdf?.();
          break;
        case 'signature':
          onSignature?.();
          break;
        case 'compare':
          onCompare?.();
          break;
        case 'batch':
          onBatch?.();
          break;
        case 'validate':
          onValidate?.();
          break;
      }
    },
    [
      onOcr,
      onExportText,
      onForms,
      onFlatten,
      onCreateField,
      onPassword,
      onPdfToImages,
      onImagesToPdf,
      onSignature,
      onCompare,
      onBatch,
      onValidate,
    ]
  );

  const ribbonTabs: RibbonTab[] = [
    { id: 'home', label: 'Home', icon: FilePlus2, accent: 'blue' },
    { id: 'annotate', label: 'Annotate', icon: Highlighter, accent: 'indigo' },
    { id: 'pages', label: 'Pages', icon: FilePlus2, accent: 'green' },
    { id: 'tools', label: 'Tools', icon: ScanText, accent: 'amber' },
  ];

  return (
    <div className="flex shrink-0 flex-col">
      {/* === RIBBON TABS === */}
      <RibbonTabs tabs={ribbonTabs} activeTab={ribbonTab} onTabChange={setRibbonTab} />

      {/* === TOOLBAR === */}
      <div className="flex h-12 shrink-0 select-none items-center gap-1 overflow-x-auto border-b border-surface-200 bg-white px-2 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:border-surface-700 dark:bg-surface-900 dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)]">
        {/* ── HOME tab content ── */}
        {ribbonTab === 'home' && (
          <>
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
              {onSave && (
                <IconButton label={t('viewer.save')} onClick={onSave} disabled={disabled}>
                  <Save className="h-4 w-4" />
                </IconButton>
              )}
              {onSaveAs && (
                <IconButton label={t('viewer.saveAs')} onClick={onSaveAs} disabled={disabled}>
                  <FilePlus2 className="h-4 w-4" />
                </IconButton>
              )}
              {onPrint && (
                <IconButton label={t('viewer.print')} onClick={onPrint} disabled={disabled}>
                  <Printer className="h-4 w-4" />
                </IconButton>
              )}
              <span
                className="max-w-[140px] truncate px-1 text-xs font-medium text-surface-600 dark:text-surface-300"
                title={fileName}
              >
                {fileName}
              </span>
            </ToolbarGroup>

            <ToolbarSeparator />

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
              {onRotateViewCCW && (
                <IconButton
                  label={t('viewer.rotateViewCCW')}
                  onClick={onRotateViewCCW}
                  disabled={disabled}
                >
                  <RotateCcw className="h-4 w-4" />
                </IconButton>
              )}
              {onRotateViewCW && (
                <IconButton
                  label={t('viewer.rotateViewCW')}
                  onClick={onRotateViewCW}
                  disabled={disabled}
                >
                  <RotateCw className="h-4 w-4" />
                </IconButton>
              )}
              <IconButton
                label={t('viewer.hand')}
                onClick={() => onToolChange('hand')}
                active={activeTool === 'hand'}
                disabled={disabled}
              >
                <Hand className="h-4 w-4" />
              </IconButton>
              {onCommandPalette && (
                <IconButton label={t('viewer.commandPalette')} onClick={onCommandPalette}>
                  <Command className="h-4 w-4" />
                </IconButton>
              )}
            </ToolbarGroup>

            {/* Preferences */}
            {onPreferences && (
              <>
                <ToolbarSeparator />
                <ToolbarGroup label="" className="border-r-0 pr-0">
                  <IconButton label={t('viewer.preferences')} onClick={onPreferences}>
                    <Settings className="h-4 w-4" />
                  </IconButton>
                </ToolbarGroup>
              </>
            )}
          </>
        )}

        {/* ── ANNOTATE tab content ── */}
        {ribbonTab === 'annotate' && (
          <>
            <ToolbarGroup label={t('viewer.annotate')}>
              <IconButton
                label={t('viewer.select')}
                onClick={() => onToolChange('select')}
                active={activeTool === 'select'}
                disabled={disabled}
              >
                <MousePointer2 className="h-4 w-4" />
              </IconButton>
              <IconButton
                label={t('viewer.hand')}
                onClick={() => onToolChange('hand')}
                active={activeTool === 'hand'}
                disabled={disabled}
              >
                <Hand className="h-4 w-4" />
              </IconButton>
              {[...TEXT_MARKUP_TOOLS, ...SHAPE_TOOLS, ...DRAWING_TOOLS, ...ADVANCED_TOOLS].map(
                (tool) => {
                  const Icon = tool.icon;
                  return (
                    <IconButton
                      key={tool.tool}
                      label={t(tool.labelKey)}
                      onClick={() => onToolChange(tool.tool)}
                      active={activeTool === tool.tool}
                      disabled={disabled}
                    >
                      <Icon className="h-4 w-4" />
                    </IconButton>
                  );
                }
              )}

              <ToolPaletteDropdown
                triggerIcon={Highlighter}
                triggerLabel={t('viewer.annotate')}
                activeTool={activeTool ?? undefined}
                groups={annotationGroups}
                onSelect={(id) => onToolChange(id as AnnotationTool)}
                disabled={disabled}
                active={activeTool !== null && activeTool !== 'select' && activeTool !== 'hand'}
                accent="indigo"
              />
            </ToolbarGroup>

            {/* Apply Redact — conditional */}
            {onRedactionApply && hasRedactions && (
              <>
                <ToolbarSeparator />
                <ToolbarGroup label="" className="border-r-0 pr-0">
                  <IconButton
                    label={t('viewer.applyRedaction')}
                    onClick={onRedactionApply}
                    disabled={disabled}
                    className="bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60"
                  >
                    <ShieldOff className="h-4 w-4" />
                  </IconButton>
                </ToolbarGroup>
              </>
            )}
          </>
        )}

        {/* ── PAGES tab content ── */}
        {ribbonTab === 'pages' && (
          <>
            <ToolbarGroup label={t('viewer.pages')}>
              <IconButton
                label={t('viewer.deleteCurrentPage')}
                onClick={onDeletePage}
                disabled={disabled || !onDeletePage}
              >
                <X className="h-4 w-4" />
              </IconButton>
              {onRotateCCW && (
                <IconButton
                  label={t('viewer.rotateLeft')}
                  onClick={onRotateCCW}
                  disabled={disabled}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </IconButton>
              )}
              {onRotateCW && (
                <IconButton
                  label={t('viewer.rotateRight')}
                  onClick={onRotateCW}
                  disabled={disabled}
                >
                  <ChevronsRight className="h-4 w-4" />
                </IconButton>
              )}
              {onMerge && (
                <IconButton label={t('viewer.mergePdf')} onClick={onMerge} disabled={disabled}>
                  <FilePlus2 className="h-4 w-4" />
                </IconButton>
              )}
              {onSplit && (
                <IconButton label={t('viewer.splitPdf')} onClick={onSplit} disabled={disabled}>
                  <Scissors className="h-4 w-4" />
                </IconButton>
              )}
              {onReorder && (
                <IconButton
                  label={t('viewer.reorderPages')}
                  onClick={onReorder}
                  disabled={disabled}
                >
                  <ArrowRight className="h-4 w-4" />
                </IconButton>
              )}
              {onExtract && (
                <IconButton
                  label={t('viewer.extractPages')}
                  onClick={onExtract}
                  disabled={disabled}
                >
                  <FileOutput className="h-4 w-4" />
                </IconButton>
              )}
              <ToolPaletteDropdown
                triggerIcon={FilePlus2}
                triggerLabel={t('viewer.pages')}
                groups={pageOpsItems}
                onSelect={handlePageOpSelect}
                disabled={disabled}
                accent="green"
              />
            </ToolbarGroup>
          </>
        )}

        {/* ── TOOLS tab content ── */}
        {ribbonTab === 'tools' && (
          <>
            <ToolbarGroup label={t('viewer.tools')}>
              {onOcr && (
                <IconButton label={t('viewer.ocr')} onClick={onOcr} disabled={disabled}>
                  <ScanText className="h-4 w-4" />
                </IconButton>
              )}
              {onExportText && (
                <IconButton
                  label={t('viewer.exportText')}
                  onClick={onExportText}
                  disabled={disabled}
                >
                  <FileText className="h-4 w-4" />
                </IconButton>
              )}
              {onForms && (
                <IconButton label={t('viewer.forms')} onClick={onForms} disabled={disabled}>
                  <FileOutput className="h-4 w-4" />
                </IconButton>
              )}
              {onFlatten && (
                <IconButton label={t('viewer.flatten')} onClick={onFlatten} disabled={disabled}>
                  <Layers className="h-4 w-4" />
                </IconButton>
              )}
              {onCreateField && (
                <IconButton
                  label={t('viewer.createField')}
                  onClick={onCreateField}
                  disabled={disabled}
                >
                  <TextCursorInput className="h-4 w-4" />
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
                <IconButton
                  label={t('viewer.pdfToImages')}
                  onClick={onPdfToImages}
                  disabled={disabled}
                >
                  <FileImage className="h-4 w-4" />
                </IconButton>
              )}
              {onImagesToPdf && (
                <IconButton
                  label={t('viewer.imagesToPdf')}
                  onClick={onImagesToPdf}
                  disabled={disabled}
                >
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
              {onCompare && (
                <IconButton label={t('viewer.compareDocuments')} onClick={onCompare}>
                  <GitCompare className="h-4 w-4" />
                </IconButton>
              )}
              {onBatch && (
                <IconButton label={t('viewer.batchProcessing')} onClick={onBatch}>
                  <Layers className="h-4 w-4" />
                </IconButton>
              )}
              {onValidate && (
                <IconButton label={t('viewer.validatePdf')} onClick={onValidate}>
                  <ShieldCheck className="h-4 w-4" />
                </IconButton>
              )}
              <ToolPaletteDropdown
                triggerIcon={ScanText}
                triggerLabel={t('viewer.tools')}
                groups={toolsItems}
                onSelect={handleToolSelect}
                disabled={disabled}
                active={editMode}
                accent="amber"
              />
              <IconButton
                label={t('viewer.editPdfObjects')}
                onClick={onEditModeToggle}
                active={editMode}
                disabled={disabled}
              >
                <Edit3 className="h-4 w-4" />
              </IconButton>
            </ToolbarGroup>

            {/* Export Images — conditional */}
            {onExportWithImages && hasStamps && (
              <>
                <ToolbarSeparator />
                <ToolbarGroup label="" className="border-r-0 pr-0">
                  <IconButton
                    label={t('viewer.exportWithImages')}
                    onClick={onExportWithImages}
                    disabled={disabled}
                    className="bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/60"
                  >
                    <FileImage className="h-4 w-4" />
                  </IconButton>
                </ToolbarGroup>
              </>
            )}
          </>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* ── Always visible: Navigation + Zoom ── */}
        <ToolbarSeparator />
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

        <ToolbarSeparator />

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
            className="h-1 w-20 accent-brand-500 disabled:opacity-35"
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
    </div>
  );
}
