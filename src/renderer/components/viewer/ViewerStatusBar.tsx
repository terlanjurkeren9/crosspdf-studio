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
    <footer className="flex h-7 shrink-0 select-none items-center gap-3 border-t border-surface-200 bg-white px-3 dark:border-surface-700 dark:bg-surface-900">
      <span className="text-xs font-medium text-surface-600 dark:text-surface-300">
        Page {currentPage} / {numPages}
      </span>

      <span className="h-3 w-px bg-surface-200 dark:bg-surface-700" />

      <span className="text-xs text-surface-400 tabular-nums">{formatZoomPercent(zoom)}</span>

      <span className="h-3 w-px bg-surface-200 dark:bg-surface-700" />

      <span className="text-xs text-surface-400">{fitModeLabel(fitMode)}</span>

      <span className="h-3 w-px bg-surface-200 dark:bg-surface-700" />

      <span className="text-xs text-surface-400 capitalize">{viewMode}</span>

      <div className="flex-1" />

      <span className="max-w-[300px] truncate text-xs text-surface-400" title={fileName}>
        {fileName}
      </span>
    </footer>
  );
}
