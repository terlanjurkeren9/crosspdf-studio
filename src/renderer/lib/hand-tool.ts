import type { AnnotationTool } from '../types/annotation.types';

export interface HandToolPanStart {
  clientX: number;
  clientY: number;
  scrollLeft: number;
  scrollTop: number;
}

export interface HandToolPanPosition {
  scrollLeft: number;
  scrollTop: number;
}

export function getHandToolCursor(activeTool: AnnotationTool, isPanning: boolean): string {
  if (activeTool !== 'hand') return '';
  return isPanning ? 'grabbing' : 'grab';
}

export function getHandToolUserSelect(activeTool: AnnotationTool): string {
  return activeTool === 'hand' ? 'none' : '';
}

export function getAnnotationHitTargetPointerEvents(activeTool: string): 'auto' | 'none' {
  return activeTool === 'hand' ? 'none' : 'auto';
}

export function getAnnotationHitTargetCursor(activeTool: string): 'pointer' | 'grab' {
  return activeTool === 'hand' ? 'grab' : 'pointer';
}

export function calculateHandToolPanPosition(
  start: HandToolPanStart,
  clientX: number,
  clientY: number
): HandToolPanPosition {
  return {
    scrollLeft: start.scrollLeft - (clientX - start.clientX),
    scrollTop: start.scrollTop - (clientY - start.clientY),
  };
}
