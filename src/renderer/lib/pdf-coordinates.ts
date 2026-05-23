import type { PdfRect } from '../types/annotation.types';

/**
 * Convert PDF page coordinates (scale=1, top-left origin) to display/pixel
 * coordinates for a given zoom level.
 */
export function pdfRectToPixel(rect: PdfRect, zoom: number): PdfRect {
  return {
    x: rect.x * zoom,
    y: rect.y * zoom,
    width: rect.width * zoom,
    height: rect.height * zoom,
  };
}

/**
 * Convert display coordinates back to PDF page coordinates (scale=1).
 */
export function pixelRectToPdf(rect: PdfRect, zoom: number): PdfRect {
  return {
    x: rect.x / zoom,
    y: rect.y / zoom,
    width: rect.width / zoom,
    height: rect.height / zoom,
  };
}

/**
 * Convert a point from screen coordinates (relative to an element's bounding rect)
 * to PDF page coordinates at scale=1 (top-left origin).
 */
export function screenPointToPdf(
  screenX: number,
  screenY: number,
  elementRect: DOMRect,
  zoom: number
): { x: number; y: number } {
  return {
    x: (screenX - elementRect.left) / zoom,
    y: (screenY - elementRect.top) / zoom,
  };
}

/**
 * Convert quad points from PDF page coordinates to display coordinates.
 * quadPoints is a flat array of numbers [x1,y1,x2,y2,x3,y3,x4,y4, ...]
 */
export function quadPointsToPixel(quadPoints: number[], zoom: number): number[] {
  const result = new Array(quadPoints.length);
  for (let i = 0; i < quadPoints.length; i++) {
    result[i] = quadPoints[i] * zoom;
  }
  return result;
}

/**
 * Convert quad points from display coordinates to PDF page coordinates.
 */
export function quadPointsToPdf(quadPoints: number[], zoom: number): number[] {
  const result = new Array(quadPoints.length);
  for (let i = 0; i < quadPoints.length; i++) {
    result[i] = quadPoints[i] / zoom;
  }
  return result;
}

/**
 * Get the bounding rect that encompasses all selection rectangles
 * relative to a container element, in container-local coordinates.
 */
export function getSelectionBounds(
  container: HTMLElement,
  zoom: number
): PdfRect | null {
  const selection = document.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const containerRect = container.getBoundingClientRect();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < selection.rangeCount; i++) {
    const range = selection.getRangeAt(i);
    if (!range) continue;
    const rects = range.getClientRects();
    for (let j = 0; j < rects.length; j++) {
      const r = rects[j];
      if (!r || r.width === 0 || r.height === 0) continue;
      const left = r.left - containerRect.left;
      const top = r.top - containerRect.top;
      const right = r.right - containerRect.left;
      const bottom = r.bottom - containerRect.top;
      minX = Math.min(minX, left);
      minY = Math.min(minY, top);
      maxX = Math.max(maxX, right);
      maxY = Math.max(maxY, bottom);
    }
  }

  if (!isFinite(minX)) return null;

  return {
    x: minX / zoom,
    y: minY / zoom,
    width: (maxX - minX) / zoom,
    height: (maxY - minY) / zoom,
  };
}

/**
 * Get per-segment quad points from the current text selection,
 * relative to a container element, in PDF page coordinates.
 * Each quad is [x1,y1,x2,y2,x3,y3,x4,y4] representing the four corners
 * of a selection segment rectangle.
 */
export function getSelectionQuadPoints(
  container: HTMLElement,
  zoom: number
): number[] | null {
  const selection = document.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const containerRect = container.getBoundingClientRect();
  const quads: number[] = [];

  for (let i = 0; i < selection.rangeCount; i++) {
    const range = selection.getRangeAt(i);
    if (!range) continue;
    const rects = range.getClientRects();
    for (let j = 0; j < rects.length; j++) {
      const r = rects[j];
      if (!r || r.width === 0 || r.height === 0) continue;
      const x1 = (r.left - containerRect.left) / zoom;
      const y1 = (r.top - containerRect.top) / zoom;
      const x2 = (r.right - containerRect.left) / zoom;
      const y2 = (r.top - containerRect.top) / zoom;
      const x3 = (r.right - containerRect.left) / zoom;
      const y3 = (r.bottom - containerRect.top) / zoom;
      const x4 = (r.left - containerRect.left) / zoom;
      const y4 = (r.bottom - containerRect.top) / zoom;
      quads.push(x1, y1, x2, y2, x3, y3, x4, y4);
    }
  }

  return quads.length > 0 ? quads : null;
}
