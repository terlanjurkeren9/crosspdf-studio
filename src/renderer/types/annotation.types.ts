export type AnnotationType =
  | 'highlight'
  | 'underline'
  | 'strikeout'
  | 'sticky-note'
  | 'free-text'
  | 'freehand'
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'arrow';

export type AnnotationTool = 'select' | AnnotationType;

export interface PdfRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AnnotationBase {
  id: string;
  type: AnnotationType;
  pageNumber: number;
  /** PDF page coordinates at scale=1, top-left origin */
  rect: PdfRect;
  color: string;
  opacity: number;
  author: string;
  createdAt: number;
  modifiedAt: number;
}

export interface HighlightAnnotation extends AnnotationBase {
  type: 'highlight';
  /** quadPoints in PDF page coordinates (top-left origin). Each quad = 8 numbers. */
  quadPoints: number[];
}

export interface UnderlineAnnotation extends AnnotationBase {
  type: 'underline';
  quadPoints: number[];
}

export interface StrikeoutAnnotation extends AnnotationBase {
  type: 'strikeout';
  quadPoints: number[];
}

export interface StickyNoteAnnotation extends AnnotationBase {
  type: 'sticky-note';
  content: string;
}

export interface FreeTextAnnotation extends AnnotationBase {
  type: 'free-text';
  content: string;
  fontSize: number;
}

export interface FreehandAnnotation extends AnnotationBase {
  type: 'freehand';
  points: number[];
  strokeWidth: number;
}

export interface RectangleAnnotation extends AnnotationBase {
  type: 'rectangle';
  strokeWidth: number;
}

export interface EllipseAnnotation extends AnnotationBase {
  type: 'ellipse';
  strokeWidth: number;
}

export interface LineAnnotation extends AnnotationBase {
  type: 'line';
  points: number[];
  strokeWidth: number;
}

export interface ArrowAnnotation extends AnnotationBase {
  type: 'arrow';
  points: number[];
  strokeWidth: number;
}

export type Annotation =
  | HighlightAnnotation
  | UnderlineAnnotation
  | StrikeoutAnnotation
  | StickyNoteAnnotation
  | FreeTextAnnotation
  | FreehandAnnotation
  | RectangleAnnotation
  | EllipseAnnotation
  | LineAnnotation
  | ArrowAnnotation;

export type TextMarkupType = 'highlight' | 'underline' | 'strikeout';

export function isTextMarkup(a: Annotation): a is HighlightAnnotation | UnderlineAnnotation | StrikeoutAnnotation {
  return a.type === 'highlight' || a.type === 'underline' || a.type === 'strikeout';
}

export function isStickyNote(a: Annotation): a is StickyNoteAnnotation {
  return a.type === 'sticky-note';
}

export function isFreeText(a: Annotation): a is FreeTextAnnotation {
  return a.type === 'free-text';
}

export const DEFAULT_ANNOTATION_COLOR = '#FFEB3B';
export const HIGHLIGHT_DEFAULT_OPACITY = 0.3;
export const ANNOTATION_COLORS = [
  '#FFEB3B',
  '#FF9800',
  '#F44336',
  '#E91E63',
  '#9C27B0',
  '#2196F3',
  '#4CAF50',
  '#00BCD4',
];

export function toolCursor(tool: AnnotationTool): string {
  switch (tool) {
    case 'select':
      return 'default';
    case 'highlight':
    case 'underline':
    case 'strikeout':
      return 'text';
    case 'sticky-note':
      return 'cell';
    case 'free-text':
      return 'text';
    case 'freehand':
    case 'rectangle':
    case 'ellipse':
    case 'line':
    case 'arrow':
      return 'crosshair';
  }
}
