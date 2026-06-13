import { describe, expect, it } from 'vitest';
import { PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import {
  embedAnnotationsInPdf,
  extractAnnotationsFromPdf,
} from '../src/renderer/lib/pdf-annotation-embed';
import type { Annotation } from '../src/renderer/types/annotation.types';

function annotation(overrides: Partial<Annotation>): Annotation {
  return {
    id: 'ann',
    type: 'highlight',
    pageNumber: 1,
    rect: { x: 72, y: 90, width: 180, height: 24 },
    color: '#FFEB3B',
    opacity: 0.3,
    author: 'Tester',
    createdAt: 1_700_000_000_000,
    modifiedAt: 1_700_000_000_000,
    quadPoints: [72, 90, 252, 90, 252, 114, 72, 114],
    ...overrides,
  } as Annotation;
}

async function sourcePdf(): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  doc.addPage([612, 792]);
  doc.addPage([612, 792]);
  const bytes = await doc.save();
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

describe('PDF annotation embedding', () => {
  it('roundtrips highlight, underline, strikeout, sticky note, and free text annotations', async () => {
    const annotations: Annotation[] = [
      annotation({ id: 'h1', type: 'highlight', color: '#FFEB3B', opacity: 0.35 }),
      annotation({ id: 'u1', type: 'underline', color: '#F44336', opacity: 1 }),
      annotation({ id: 's1', type: 'strikeout', color: '#2196F3', opacity: 0.8 }),
      annotation({
        id: 'n1',
        type: 'sticky-note',
        pageNumber: 2,
        rect: { x: 40, y: 50, width: 24, height: 24 },
        color: '#FFEB3B',
        opacity: 1,
        content: 'Review this',
      }),
      annotation({
        id: 't1',
        type: 'free-text',
        pageNumber: 2,
        rect: { x: 80, y: 120, width: 160, height: 32 },
        color: '#000000',
        opacity: 1,
        content: 'Typed text',
        fontSize: 14,
      }),
    ];

    const embedded = await embedAnnotationsInPdf(await sourcePdf(), annotations);
    const loaded = await extractAnnotationsFromPdf(embedded);

    expect(loaded).toHaveLength(5);
    expect(loaded.map((item) => item.type)).toEqual([
      'highlight',
      'underline',
      'strikeout',
      'sticky-note',
      'free-text',
    ]);
    expect(loaded.find((item) => item.id === 'h1')).toMatchObject({
      color: '#FFEB3B',
      opacity: 0.35,
      rect: { x: 72, y: 90, width: 180, height: 24 },
    });
    expect(loaded.find((item) => item.id === 'u1')).toMatchObject({
      quadPoints: [72, 90, 252, 90, 252, 114, 72, 114],
    });
    expect(loaded.find((item) => item.id === 'n1')).toMatchObject({
      pageNumber: 2,
      content: 'Review this',
    });
    expect(loaded.find((item) => item.id === 't1')).toMatchObject({
      pageNumber: 2,
      content: 'Typed text',
      fontSize: 14,
    });
  });

  it('creates native PDF annotation dictionaries', async () => {
    const embedded = await embedAnnotationsInPdf(await sourcePdf(), [
      annotation({ id: 'h1', type: 'highlight' }),
      annotation({ id: 'n1', type: 'sticky-note', content: 'Native note' }),
    ]);
    const doc = await PDFDocument.load(embedded, { ignoreEncryption: true });

    const annots = doc.getPage(0).node.Annots();
    expect(annots?.size()).toBe(2);

    const subtypes = [0, 1].map((index) => {
      const dict = doc.context.lookup(annots!.get(index), PDFDict);
      return dict.lookup(PDFName.of('Subtype'), PDFName).asString();
    });
    expect(subtypes).toEqual(['/Highlight', '/Text']);
  });

  it('replaces previous CrossPDF annotations instead of duplicating them', async () => {
    const first = await embedAnnotationsInPdf(await sourcePdf(), [
      annotation({ id: 'h1', type: 'highlight' }),
    ]);
    const second = await embedAnnotationsInPdf(first, [
      annotation({ id: 't1', type: 'free-text', content: 'Only latest', fontSize: 12 }),
    ]);

    const loaded = await extractAnnotationsFromPdf(second);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toMatchObject({ id: 't1', type: 'free-text' });
  });
});
