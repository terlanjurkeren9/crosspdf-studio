import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFString,
} from 'pdf-lib';
import type {
  Annotation,
  FreeTextAnnotation,
  HighlightAnnotation,
  PdfRect,
  StickyNoteAnnotation,
  StrikeoutAnnotation,
  UnderlineAnnotation,
} from '../types/annotation.types';

type PersistableAnnotation =
  | HighlightAnnotation
  | UnderlineAnnotation
  | StrikeoutAnnotation
  | StickyNoteAnnotation
  | FreeTextAnnotation;

const CROSSPDF_NM_PREFIX = 'CrossPDF:';
const CROSSPDF_DATA = PDFName.of('CrossPDFData');
const PRINT_FLAG = 4;

const subtypeByType: Record<PersistableAnnotation['type'], string> = {
  highlight: 'Highlight',
  underline: 'Underline',
  strikeout: 'StrikeOut',
  'sticky-note': 'Text',
  'free-text': 'FreeText',
};

const typeBySubtype: Record<string, PersistableAnnotation['type'] | undefined> = {
  Highlight: 'highlight',
  Underline: 'underline',
  StrikeOut: 'strikeout',
  Text: 'sticky-note',
  FreeText: 'free-text',
};

export function isPdfEmbeddableAnnotation(
  annotation: Annotation
): annotation is PersistableAnnotation {
  return (
    annotation.type === 'highlight' ||
    annotation.type === 'underline' ||
    annotation.type === 'strikeout' ||
    annotation.type === 'sticky-note' ||
    annotation.type === 'free-text'
  );
}

export async function embedAnnotationsInPdf(
  source: ArrayBuffer | Uint8Array,
  annotations: Annotation[]
): Promise<ArrayBuffer> {
  const pdfDoc = await PDFDocument.load(source, { ignoreEncryption: true });
  const embeddable = annotations.filter(isPdfEmbeddableAnnotation);

  removeCrossPdfAnnotations(pdfDoc);

  for (const annotation of embeddable) {
    const pageIndex = annotation.pageNumber - 1;
    if (pageIndex < 0 || pageIndex >= pdfDoc.getPageCount()) continue;
    addAnnotation(pdfDoc, pageIndex, annotation);
  }

  const bytes = await pdfDoc.save();
  return ownedArrayBuffer(bytes);
}

export async function extractAnnotationsFromPdf(
  source: ArrayBuffer | Uint8Array
): Promise<Annotation[]> {
  const pdfDoc = await PDFDocument.load(source, { ignoreEncryption: true });
  const annotations: Annotation[] = [];

  for (let pageIndex = 0; pageIndex < pdfDoc.getPageCount(); pageIndex++) {
    const page = pdfDoc.getPage(pageIndex);
    const annots = page.node.Annots();
    if (!annots) continue;

    for (let i = 0; i < annots.size(); i++) {
      const dict = lookupAnnotationDict(pdfDoc, annots, i);
      if (!dict) continue;

      const embedded = readCrossPdfData(dict);
      if (embedded) {
        annotations.push(embedded);
        continue;
      }

      const parsed = parseNativeAnnotation(dict, pageIndex + 1, page.getHeight());
      if (parsed) annotations.push(parsed);
    }
  }

  return annotations;
}

function addAnnotation(
  pdfDoc: PDFDocument,
  pageIndex: number,
  annotation: PersistableAnnotation
): void {
  const context = pdfDoc.context;
  const page = pdfDoc.getPage(pageIndex);
  const height = page.getHeight();
  const rect = toPdfRect(annotation.rect, height);
  const dict = context.obj({
    Type: 'Annot',
    Subtype: subtypeByType[annotation.type],
    Rect: rect,
    F: PRINT_FLAG,
    C: colorArray(annotation.color),
    CA: annotation.opacity,
  }) as PDFDict;
  dict.set(PDFName.of('NM'), PDFString.of(`${CROSSPDF_NM_PREFIX}${annotation.id}`));
  dict.set(PDFName.of('T'), PDFString.of(annotation.author));
  dict.set(PDFName.of('M'), PDFString.of(pdfDate(annotation.modifiedAt)));
  dict.set(
    PDFName.of('Contents'),
    PDFString.of(
      annotation.type === 'sticky-note' || annotation.type === 'free-text' ? annotation.content : ''
    )
  );
  dict.set(CROSSPDF_DATA, PDFString.of(JSON.stringify(annotation)));

  if (
    annotation.type === 'highlight' ||
    annotation.type === 'underline' ||
    annotation.type === 'strikeout'
  ) {
    dict.set(PDFName.of('QuadPoints'), context.obj(toPdfQuadPoints(annotation.quadPoints, height)));
  }

  if (annotation.type === 'sticky-note') {
    dict.set(PDFName.of('Name'), PDFName.of('Comment'));
    dict.set(PDFName.of('Open'), context.obj(false));
  }

  if (annotation.type === 'free-text') {
    const [r, g, b] = hexToRgb(annotation.color);
    dict.set(PDFName.of('DA'), PDFString.of(`/Helv ${annotation.fontSize} Tf ${r} ${g} ${b} rg`));
    dict.set(PDFName.of('Q'), PDFNumber.of(0));
  }

  const ref = context.register(dict);
  page.node.addAnnot(ref);
}

function removeCrossPdfAnnotations(pdfDoc: PDFDocument): void {
  const context = pdfDoc.context;
  for (const page of pdfDoc.getPages()) {
    const annots = page.node.Annots();
    if (!annots) continue;

    for (let i = annots.size() - 1; i >= 0; i--) {
      const object = annots.get(i);
      const dict = context.lookupMaybe(object, PDFDict);
      if (dict && isCrossPdfAnnotation(dict)) {
        annots.remove(i);
      }
    }
  }
}

function isCrossPdfAnnotation(dict: PDFDict): boolean {
  if (dict.has(CROSSPDF_DATA)) return true;
  const nm = readText(dict, PDFName.of('NM'));
  return nm?.startsWith(CROSSPDF_NM_PREFIX) ?? false;
}

function readCrossPdfData(dict: PDFDict): Annotation | null {
  const text = readText(dict, CROSSPDF_DATA);
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as Annotation;
    if (isPdfEmbeddableAnnotation(parsed)) return parsed;
    return null;
  } catch {
    return null;
  }
}

function parseNativeAnnotation(
  dict: PDFDict,
  pageNumber: number,
  pageHeight: number
): Annotation | null {
  const subtype = dict.lookupMaybe(PDFName.of('Subtype'), PDFName)?.asString().replace('/', '');
  const type = subtype ? typeBySubtype[subtype] : undefined;
  if (!type) return null;

  const rect = fromPdfRect(dict.lookupMaybe(PDFName.of('Rect'), PDFArray), pageHeight);
  if (!rect) return null;

  const now = Date.now();
  const base = {
    id: readText(dict, PDFName.of('NM')) ?? `${CROSSPDF_NM_PREFIX}native-${pageNumber}-${now}`,
    type,
    pageNumber,
    rect,
    color: readColor(dict.lookupMaybe(PDFName.of('C'), PDFArray)) ?? '#FFEB3B',
    opacity: readNumber(dict.lookupMaybe(PDFName.of('CA'), PDFNumber)) ?? 1,
    author: readText(dict, PDFName.of('T')) ?? 'User',
    createdAt: now,
    modifiedAt: now,
  };

  if (type === 'highlight' || type === 'underline' || type === 'strikeout') {
    const quadPoints = fromPdfQuadPoints(
      dict.lookupMaybe(PDFName.of('QuadPoints'), PDFArray),
      pageHeight
    ) ?? [
      rect.x,
      rect.y,
      rect.x + rect.width,
      rect.y,
      rect.x + rect.width,
      rect.y + rect.height,
      rect.x,
      rect.y + rect.height,
    ];
    return { ...base, type, quadPoints } as Annotation;
  }

  if (type === 'sticky-note') {
    return { ...base, type, content: readText(dict, PDFName.of('Contents')) ?? '' };
  }

  return {
    ...base,
    type: 'free-text',
    content: readText(dict, PDFName.of('Contents')) ?? '',
    fontSize: 12,
  };
}

function lookupAnnotationDict(
  pdfDoc: PDFDocument,
  annots: PDFArray,
  index: number
): PDFDict | null {
  return pdfDoc.context.lookupMaybe(annots.get(index), PDFDict) ?? null;
}

function toPdfRect(rect: PdfRect, pageHeight: number): number[] {
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = pageHeight - rect.y;
  const bottom = pageHeight - rect.y - rect.height;
  return [left, bottom, right, top];
}

function fromPdfRect(rect: PDFArray | undefined, pageHeight: number): PdfRect | null {
  if (!rect || rect.size() !== 4) return null;
  const left = readArrayNumber(rect, 0);
  const bottom = readArrayNumber(rect, 1);
  const right = readArrayNumber(rect, 2);
  const top = readArrayNumber(rect, 3);
  if ([left, bottom, right, top].some((value) => value === null)) return null;
  return {
    x: left!,
    y: pageHeight - top!,
    width: right! - left!,
    height: top! - bottom!,
  };
}

function toPdfQuadPoints(quadPoints: number[], pageHeight: number): number[] {
  const converted = new Array<number>(quadPoints.length);
  for (let i = 0; i < quadPoints.length; i += 2) {
    converted[i] = quadPoints[i];
    converted[i + 1] = pageHeight - quadPoints[i + 1];
  }
  return converted;
}

function fromPdfQuadPoints(quadPoints: PDFArray | undefined, pageHeight: number): number[] | null {
  if (!quadPoints || quadPoints.size() < 8) return null;
  const converted: number[] = [];
  for (let i = 0; i < quadPoints.size(); i += 2) {
    const x = readArrayNumber(quadPoints, i);
    const y = readArrayNumber(quadPoints, i + 1);
    if (x === null || y === null) return null;
    converted.push(x, pageHeight - y);
  }
  return converted;
}

function colorArray(color: string): number[] {
  return hexToRgb(color);
}

function hexToRgb(color: string): [number, number, number] {
  const normalized = color.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return [0, 0, 0];
  const value = Number.parseInt(normalized, 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

function readColor(array: PDFArray | undefined): string | null {
  if (!array || array.size() < 3) return null;
  const r = readArrayNumber(array, 0);
  const g = readArrayNumber(array, 1);
  const b = readArrayNumber(array, 2);
  if (r === null || g === null || b === null) return null;
  return `#${[r, g, b]
    .map((value) =>
      Math.round(Math.max(0, Math.min(1, value)) * 255)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')
    .toUpperCase()}`;
}

function readText(dict: PDFDict, key: PDFName): string | null {
  try {
    const value = dict.lookupMaybe(key, PDFString, PDFHexString);
    return value?.decodeText() ?? null;
  } catch {
    return null;
  }
}

function readArrayNumber(array: PDFArray, index: number): number | null {
  return readNumber(array.lookupMaybe(index, PDFNumber));
}

function readNumber(value: PDFNumber | undefined): number | null {
  return value?.asNumber() ?? null;
}

function pdfDate(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `D:${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}${pad(
    date.getUTCHours()
  )}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function ownedArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
