export type FitMode = 'actual' | 'fit-width' | 'fit-page' | 'custom';
export type ViewMode = 'single' | 'continuous';

export interface PageDims {
  width: number;
  height: number;
}

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 4.0;
export const ZOOM_STEP = 0.05;
export const ZOOM_FACTOR = 1.2;
const PADDING = 40;

export function clampZoom(z: number): number {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
}

export function computeFitZoom(
  fitMode: FitMode,
  pageDims: PageDims | null,
  containerWidth: number,
  containerHeight: number
): number | null {
  if (!pageDims || containerWidth <= 0 || containerHeight <= 0) {
    return fitMode === 'actual' ? 1.0 : null;
  }

  const availW = Math.max(1, containerWidth - PADDING);
  const availH = Math.max(1, containerHeight - PADDING);

  switch (fitMode) {
    case 'actual':
      return 1.0;
    case 'fit-width':
      return clampZoom(availW / pageDims.width);
    case 'fit-page':
      return clampZoom(Math.min(availW / pageDims.width, availH / pageDims.height));
    case 'custom':
      return null;
  }
}

export function formatZoomPercent(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}

export function fitModeLabel(fitMode: FitMode): string {
  switch (fitMode) {
    case 'actual':
      return 'Actual Size';
    case 'fit-width':
      return 'Fit Width';
    case 'fit-page':
      return 'Fit Page';
    case 'custom':
      return 'Custom';
  }
}
