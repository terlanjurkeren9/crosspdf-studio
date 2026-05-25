import { describe, it, expect, beforeEach } from 'vitest';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { useAnnotationStore, createAnnotation } from '../src/renderer/stores/annotation.store';
import { isRedaction } from '../src/renderer/types/annotation.types';
import type { Annotation, RedactionAnnotation } from '../src/renderer/types/annotation.types';
import { applyRedactionsToPdf } from '../src/renderer/lib/redaction-apply';

const TARGET_TEXT = 'SECRET_TOKEN_PHASE4_REDACTION_TEST';
const SAFE_TEXT = 'PUBLIC_INFORMATION_KEPT_INTACT';

function resetStore() {
  useAnnotationStore.setState({
    activeTool: 'select',
    annotationsByTab: {},
    selectedIds: new Set(),
    undoStacksByTab: {},
    redoStacksByTab: {},
  });
}

describe('Redaction', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('createAnnotation', () => {
    it('creates redaction annotation with correct defaults', () => {
      const ann = createAnnotation('redaction', 3);
      expect(ann.type).toBe('redaction');
      expect(ann.pageNumber).toBe(3);
      expect(ann.color).toBe('#000000');
      expect(ann.opacity).toBe(0.5);
      expect(ann.id).toBeTruthy();
    });

    it('creates redaction annotation with custom rect', () => {
      const ann = createAnnotation('redaction', 1, {
        rect: { x: 100, y: 200, width: 300, height: 50 },
      });
      expect(ann.rect.x).toBe(100);
      expect(ann.rect.y).toBe(200);
      expect(ann.rect.width).toBe(300);
      expect(ann.rect.height).toBe(50);
    });
  });

  describe('isRedaction type guard', () => {
    it('returns true for redaction annotations', () => {
      const ann: Annotation = createAnnotation('redaction', 1);
      expect(isRedaction(ann)).toBe(true);
    });

    it('returns false for non-redaction annotations', () => {
      const ann: Annotation = createAnnotation('highlight', 1);
      expect(isRedaction(ann)).toBe(false);
    });

    it('narrows type correctly', () => {
      const ann: Annotation = createAnnotation('redaction', 2, {
        rect: { x: 10, y: 20, width: 100, height: 40 },
      });
      if (isRedaction(ann)) {
        // ann should be narrowed to RedactionAnnotation
        const redaction: RedactionAnnotation = ann;
        expect(redaction.type).toBe('redaction');
        expect(redaction.rect.width).toBe(100);
      } else {
        expect.fail('isRedaction should return true');
      }
    });
  });

  describe('annotation store integration', () => {
    it('stores and retrieves redaction annotations', () => {
      const ann = createAnnotation('redaction', 1, {
        rect: { x: 10, y: 20, width: 100, height: 40 },
      });
      useAnnotationStore.getState().addAnnotation('tab1', ann);

      const forTab = useAnnotationStore.getState().getAnnotationsForTab('tab1');
      expect(forTab).toHaveLength(1);
      expect(forTab[0].type).toBe('redaction');
    });

    it('can filter redactions from mixed annotations', () => {
      const highlight = createAnnotation('highlight', 1);
      const redaction = createAnnotation('redaction', 1);
      const note = createAnnotation('sticky-note', 2);

      useAnnotationStore.getState().addAnnotation('tab1', highlight);
      useAnnotationStore.getState().addAnnotation('tab1', redaction);
      useAnnotationStore.getState().addAnnotation('tab1', note);

      const all = useAnnotationStore.getState().getAnnotationsForTab('tab1');
      const redactions = all.filter(isRedaction);
      expect(redactions).toHaveLength(1);
      expect(redactions[0].type).toBe('redaction');
    });

    it('getAnnotationsForPage returns redactions for correct page', () => {
      const ann1 = createAnnotation('redaction', 1, {
        rect: { x: 0, y: 0, width: 50, height: 20 },
      });
      const ann2 = createAnnotation('redaction', 2, {
        rect: { x: 10, y: 10, width: 30, height: 15 },
      });
      useAnnotationStore.getState().addAnnotation('tab1', ann1);
      useAnnotationStore.getState().addAnnotation('tab1', ann2);

      expect(useAnnotationStore.getState().getAnnotationsForPage('tab1', 1)).toHaveLength(1);
      expect(useAnnotationStore.getState().getAnnotationsForPage('tab1', 2)).toHaveLength(1);
      expect(useAnnotationStore.getState().getAnnotationsForPage('tab1', 3)).toHaveLength(0);
    });

    it('undo/redo works for redaction annotations', () => {
      const ann = createAnnotation('redaction', 1, {
        rect: { x: 0, y: 0, width: 100, height: 50 },
      });
      useAnnotationStore.getState().addAnnotation('tab1', ann);
      expect(useAnnotationStore.getState().getAnnotationsForTab('tab1')).toHaveLength(1);

      useAnnotationStore.getState().undo('tab1');
      expect(useAnnotationStore.getState().getAnnotationsForTab('tab1')).toHaveLength(0);

      useAnnotationStore.getState().redo('tab1');
      expect(useAnnotationStore.getState().getAnnotationsForTab('tab1')).toHaveLength(1);
    });

    it('deleteAnnotation removes redaction', () => {
      const ann = createAnnotation('redaction', 1);
      useAnnotationStore.getState().addAnnotation('tab1', ann);
      useAnnotationStore.getState().deleteAnnotation('tab1', ann.id);
      expect(useAnnotationStore.getState().getAnnotationsForTab('tab1')).toHaveLength(0);
    });

    it('clearTab removes all redactions for that tab', () => {
      useAnnotationStore.getState().addAnnotation('tab1', createAnnotation('redaction', 1));
      useAnnotationStore.getState().addAnnotation('tab1', createAnnotation('redaction', 2));
      useAnnotationStore.getState().clearTab('tab1');
      expect(useAnnotationStore.getState().getAnnotationsForTab('tab1')).toHaveLength(0);
    });
  });

  describe('redaction verification contract', () => {
    it('redaction rect contains position data needed for burning', () => {
      const ann = createAnnotation('redaction', 5, {
        rect: { x: 72, y: 144, width: 216, height: 36 },
      });
      const redaction = ann as RedactionAnnotation;
      // These values are in PDF points (1/72 inch) — the renderer
      // will scale them to the output DPI when burning.
      expect(redaction.rect.x).toBe(72);
      expect(redaction.rect.y).toBe(144);
      expect(redaction.rect.width).toBe(216);
      expect(redaction.rect.height).toBe(36);
      expect(redaction.pageNumber).toBe(5);
      expect(redaction.type).toBe('redaction');
    });

    it('redaction annotations are distinguishable from other rect annotations', () => {
      const redact = createAnnotation('redaction', 1);
      const rect = createAnnotation('rectangle', 1);

      expect(redact.type).toBe('redaction');
      expect(rect.type).toBe('rectangle');
      expect(redact.type).not.toBe(rect.type);
      expect(isRedaction(redact)).toBe(true);
      expect(isRedaction(rect)).toBe(false);
    });
  });

  describe('redaction pipeline verification', () => {
    const REDACTION_TARGET = TARGET_TEXT;

    async function createFixturePdf(): Promise<Uint8Array> {
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);

      const page1 = doc.addPage([612, 792]);
      page1.drawText(`Top secret: ${REDACTION_TARGET}`, {
        x: 72,
        y: 700,
        size: 14,
        font,
        color: rgb(0, 0, 0),
      });

      const page2 = doc.addPage([612, 792]);
      page2.drawText(`Page 2: ${SAFE_TEXT}`, {
        x: 72,
        y: 700,
        size: 14,
        font,
        color: rgb(0, 0, 0),
      });

      return doc.save();
    }

    const BLACK_PNG_BASE64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

    function base64ToArrayBuffer(b64: string): ArrayBuffer {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes.buffer;
    }

    it('target text absent via PDF.js text extraction after redaction', async () => {
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

      const sourceBytes = await createFixturePdf();
      const png = base64ToArrayBuffer(BLACK_PNG_BASE64);
      const outputBytes = await applyRedactionsToPdf(sourceBytes, [png], [1]);

      const loadingTask = pdfjsLib.getDocument({ data: outputBytes });
      const outputDoc = await loadingTask.promise;

      const page1 = await outputDoc.getPage(1);
      const text1 = await page1.getTextContent();
      const page1All = text1.items
        .map((item: { str?: string }) => ('str' in item ? item.str : ''))
        .join(' ');
      expect(page1All).not.toContain(REDACTION_TARGET);
      page1.cleanup();

      const page2 = await outputDoc.getPage(2);
      const text2 = await page2.getTextContent();
      const page2All = text2.items
        .map((item: { str?: string }) => ('str' in item ? item.str : ''))
        .join(' ');
      expect(page2All).toContain(SAFE_TEXT);
      page2.cleanup();

      outputDoc.destroy();
    });

    it('output PDF has correct page count after redaction', async () => {
      const sourceBytes = await createFixturePdf();
      const png = base64ToArrayBuffer(BLACK_PNG_BASE64);
      const outputBytes = await applyRedactionsToPdf(sourceBytes, [png], [1]);

      const doc = await PDFDocument.load(outputBytes);
      expect(doc.getPageCount()).toBe(2);
    });

    it('unaffected page preserves original page size', async () => {
      const sourceBytes = await createFixturePdf();
      const png = base64ToArrayBuffer(BLACK_PNG_BASE64);
      const outputBytes = await applyRedactionsToPdf(sourceBytes, [png], [1]);

      const doc = await PDFDocument.load(outputBytes);
      const page2 = doc.getPage(1);
      const { width, height } = page2.getSize();
      expect(width).toBe(612);
      expect(height).toBe(792);
    });

    it('redacted page has original dimensions', async () => {
      const sourceBytes = await createFixturePdf();
      const png = base64ToArrayBuffer(BLACK_PNG_BASE64);
      const outputBytes = await applyRedactionsToPdf(sourceBytes, [png], [1]);

      const doc = await PDFDocument.load(outputBytes);
      const page1 = doc.getPage(0);
      const { width, height } = page1.getSize();
      expect(width).toBe(612);
      expect(height).toBe(792);
    });
  });
});
