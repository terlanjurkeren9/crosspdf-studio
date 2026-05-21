import { fitModeLabel, formatZoomPercent } from '../../lib/zoom';
import type { FitMode, ViewMode } from '../../lib/zoom';

interface ViewerStatusBarProps {
  fileName: string;
  currentPage: number;
  numPages: number;
  zoom: number;
  fitMode: FitMode;
  viewMode: ViewMode;
}

export function ViewerStatusBar({
  fileName,
  currentPage,
  numPages,
  zoom,
  fitMode,
  viewMode,
}: ViewerStatusBarProps) {
  return (
    <footer className="h-6 flex items-center gap-3 px-3 bg-surface-100 dark:bg-surface-900 border-t border-surface-200 dark:border-surface-800 shrink-0 select-none">
      <span className="text-xs text-surface-500">
        Page {currentPage} / {numPages}
      </span>

      <span className="text-xs text-surface-300 dark:text-surface-600">|</span>

      <span className="text-xs text-surface-500">{formatZoomPercent(zoom)}</span>

      <span className="text-xs text-surface-300 dark:text-surface-600">|</span>

      <span className="text-xs text-surface-500">{fitModeLabel(fitMode)}</span>

      <span className="text-xs text-surface-300 dark:text-surface-600">|</span>

      <span className="text-xs text-surface-500 capitalize">{viewMode}</span>

      <div className="flex-1" />

      <span className="text-xs text-surface-400 truncate max-w-[300px]" title={fileName}>
        {fileName}
      </span>
    </footer>
  );
}
