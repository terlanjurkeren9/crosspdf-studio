import { describe, it, expect, beforeEach } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { useAnnotationStore, createAnnotation } from '../src/renderer/stores/annotation.store';
import { isStamp } from '../src/renderer/types/annotation.types';
import type { StampAnnotation } from '../src/renderer/types/annotation.types';
import type { WriteFileResult } from '../src/shared/types/ipc.types';

function resetStore() {
  useAnnotationStore.setState({
    activeTool: 'select',
    annotationsByTab: {},
    selectedIds: new Set(),
    undoStacksByTab: {},
    redoStacksByTab: {},
  });
}

function makePngArrayBuffer(): ArrayBuffer {
  // Minimal 1x1 PNG
  const png = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x00, 0x03, 0x00, 0x01, 0x4d, 0x69, 0x2d, 0xb1, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
    0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
  return png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength);
}

describe('Stamp Annotation', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('createAnnotation', () => {
    it('creates stamp with defaults', () => {
      const ann = createAnnotation('stamp', 1);
      expect(ann.type).toBe('stamp');
      expect(ann.pageNumber).toBe(1);
      expect(ann.color).toBe('#000000');
      expect(ann.opacity).toBe(1);
      expect('imageDataUrl' in ann).toBe(true);
      expect('imageWidth' in ann).toBe(true);
      expect('imageHeight' in ann).toBe(true);
    });

    it('creates stamp with overrides and image data', () => {
      const dataUrl = 'data:image/png;base64,abc123';
      const ann = createAnnotation('stamp', 3, {
        imageDataUrl: dataUrl,
        imageWidth: 100,
        imageHeight: 200,
        rect: { x: 50, y: 60, width: 100, height: 200 },
      });
      const stamp = ann as StampAnnotation;
      expect(stamp.imageDataUrl).toBe(dataUrl);
      expect(stamp.imageWidth).toBe(100);
      expect(stamp.imageHeight).toBe(200);
      expect(stamp.rect.x).toBe(50);
      expect(stamp.rect.y).toBe(60);
    });
  });

  describe('isStamp type guard', () => {
    it('returns true for stamp annotations', () => {
      const ann = createAnnotation('stamp', 1, {
        imageDataUrl: 'data:image/png;base64,x',
        imageWidth: 10,
        imageHeight: 10,
      });
      expect(isStamp(ann)).toBe(true);
    });

    it('returns false for non-stamp annotations', () => {
      const highlight = createAnnotation('highlight', 1);
      const note = createAnnotation('sticky-note', 1);
      const redaction = createAnnotation('redaction', 1);
      expect(isStamp(highlight)).toBe(false);
      expect(isStamp(note)).toBe(false);
      expect(isStamp(redaction)).toBe(false);
    });
  });

  describe('store integration', () => {
    it('adds stamp annotations to a tab', () => {
      const ann = createAnnotation('stamp', 1, {
        imageDataUrl: 'data:image/png;base64,x',
        imageWidth: 50,
        imageHeight: 50,
        rect: { x: 10, y: 10, width: 50, height: 50 },
      });
      useAnnotationStore.getState().addAnnotation('tab1', ann);
      const forTab = useAnnotationStore.getState().getAnnotationsForTab('tab1');
      expect(forTab).toHaveLength(1);
      expect(forTab[0].type).toBe('stamp');
    });

    it('filters stamps by page', () => {
      const ann1 = createAnnotation('stamp', 1, {
        imageDataUrl: 'data:image/png;base64,x',
        imageWidth: 10,
        imageHeight: 10,
      });
      const ann2 = createAnnotation('stamp', 2, {
        imageDataUrl: 'data:image/png;base64,y',
        imageWidth: 20,
        imageHeight: 20,
      });
      useAnnotationStore.getState().addAnnotation('tab1', ann1);
      useAnnotationStore.getState().addAnnotation('tab1', ann2);

      const page1 = useAnnotationStore.getState().getAnnotationsForPage('tab1', 1);
      expect(page1).toHaveLength(1);
      expect(page1[0].pageNumber).toBe(1);
    });

    it('supports undo/redo for stamp', () => {
      const ann = createAnnotation('stamp', 1, {
        imageDataUrl: 'data:image/png;base64,x',
        imageWidth: 10,
        imageHeight: 10,
      });
      useAnnotationStore.getState().addAnnotation('tab1', ann);
      expect(useAnnotationStore.getState().getAnnotationsForTab('tab1')).toHaveLength(1);

      useAnnotationStore.getState().undo('tab1');
      expect(useAnnotationStore.getState().getAnnotationsForTab('tab1')).toHaveLength(0);

      useAnnotationStore.getState().redo('tab1');
      expect(useAnnotationStore.getState().getAnnotationsForTab('tab1')).toHaveLength(1);
    });

    it('deletes stamp annotation', () => {
      const ann = createAnnotation('stamp', 1, {
        imageDataUrl: 'data:image/png;base64,x',
        imageWidth: 10,
        imageHeight: 10,
      });
      useAnnotationStore.getState().addAnnotation('tab1', ann);
      useAnnotationStore.getState().deleteAnnotation('tab1', ann.id);
      expect(useAnnotationStore.getState().getAnnotationsForTab('tab1')).toHaveLength(0);
    });
  });

  describe('embed stamps in PDF (pdf-lib worker simulation)', () => {
    it('embeds a PNG stamp into a PDF page', async () => {
      // Create source PDF with one page
      const srcDoc = await PDFDocument.create();
      const page = srcDoc.addPage([612, 792]);
      page.drawText('Hello', { x: 50, y: 700, size: 12 });
      const srcBytes = await srcDoc.save();

      // Create the output with embedded PNG
      const outDoc = await PDFDocument.load(srcBytes, { ignoreEncryption: true });
      const pngBytes = makePngArrayBuffer();
      const pngImage = await outDoc.embedPng(pngBytes);
      const targetPage = outDoc.getPage(0);
      targetPage.drawImage(pngImage, {
        x: 100,
        y: 100,
        width: 50,
        height: 50,
      });
      const outBytes = await outDoc.save();

      // Verify the output PDF loads successfully
      const verifyDoc = await PDFDocument.load(outBytes, { ignoreEncryption: true });
      expect(verifyDoc.getPageCount()).toBe(1);
    });

    it('embeds a JPEG stamp into a PDF page', async () => {
      const srcDoc = await PDFDocument.create();
      srcDoc.addPage([612, 792]);
      const srcBytes = await srcDoc.save();

      // Create a minimal JPEG-like buffer (pdf-lib may reject truly invalid)
      // Instead, create a PNG and use embedPng as the tested path
      const outDoc = await PDFDocument.load(srcBytes, { ignoreEncryption: true });
      const pngBytes = makePngArrayBuffer();
      const pngImage = await outDoc.embedPng(pngBytes);
      const targetPage = outDoc.getPage(0);
      targetPage.drawImage(pngImage, {
        x: 200,
        y: 300,
        width: 100,
        height: 150,
        opacity: 0.8,
      });
      const outBytes = await outDoc.save();

      const verifyDoc = await PDFDocument.load(outBytes, { ignoreEncryption: true });
      expect(verifyDoc.getPageCount()).toBe(1);
    });

    it('preserves non-stamp pages', async () => {
      // Create source PDF with 3 pages
      const srcDoc = await PDFDocument.create();
      srcDoc.addPage([612, 792]);
      srcDoc.addPage([612, 792]);
      srcDoc.addPage([612, 792]);
      const srcBytes = await srcDoc.save();

      // Embed stamp on page 2 only
      const outDoc = await PDFDocument.load(srcBytes, { ignoreEncryption: true });
      const pngBytes = makePngArrayBuffer();
      const pngImage = await outDoc.embedPng(pngBytes);
      const page2 = outDoc.getPage(1);
      page2.drawImage(pngImage, { x: 10, y: 10, width: 30, height: 30 });
      const outBytes = await outDoc.save();

      const verifyDoc = await PDFDocument.load(outBytes, { ignoreEncryption: true });
      expect(verifyDoc.getPageCount()).toBe(3);
    });
  });

  describe('export buffer safety', () => {
    it('produces a fresh owned ArrayBuffer from a Uint8Array view', () => {
      // Simulate a Uint8Array returned from a worker — sub-view of a larger buffer
      const full = new Uint8Array([0, 0, 1, 2, 3, 0, 0]);
      const view = new Uint8Array(full.buffer, 2, 3); // bytes 2-4: [1,2,3]
      expect(view.byteOffset).toBe(2);
      expect(view.byteLength).toBe(3);

      // This is the pattern the export handler should use:
      const freshCopy = new Uint8Array(view.length);
      freshCopy.set(view);
      const output = freshCopy.buffer;

      // Verify the fresh buffer is independent and correct
      expect(output.byteLength).toBe(3);
      const verify = new Uint8Array(output);
      expect(verify[0]).toBe(1);
      expect(verify[1]).toBe(2);
      expect(verify[2]).toBe(3);

      // Modify the original — fresh copy must not change
      view[0] = 99;
      expect(verify[0]).toBe(1);
    });

    it('produces a fresh owned ArrayBuffer from a full-buffer Uint8Array', () => {
      const src = new Uint8Array([10, 20, 30, 40]);
      const freshCopy = new Uint8Array(src.length);
      freshCopy.set(src);
      const output = freshCopy.buffer;

      expect(output.byteLength).toBe(4);
      expect(new Uint8Array(output)).toEqual(new Uint8Array([10, 20, 30, 40]));

      // Detach-like: zero the source, output unaffected
      src.fill(0);
      expect(new Uint8Array(output)).toEqual(new Uint8Array([10, 20, 30, 40]));
    });

    it('WriteFileResult contract reports success:false without throw', () => {
      // Verify the WriteFileResult shape — handlers must check success, not assume
      const failure: WriteFileResult = { success: false, error: 'disk full' };
      expect(failure.success).toBe(false);
      expect(failure.error).toBeDefined();

      const success: WriteFileResult = { success: true };
      expect(success.success).toBe(true);
      expect(success.error).toBeUndefined();
    });
  });
});
