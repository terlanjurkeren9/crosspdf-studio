import { describe, it, expect } from 'vitest';
import {
  pdfRectToPixel,
  pixelRectToPdf,
  screenPointToPdf,
  quadPointsToPixel,
  quadPointsToPdf,
} from '../src/renderer/lib/pdf-coordinates';
import type { PdfRect } from '../src/renderer/types/annotation.types';

describe('pdf-coordinates', () => {
  describe('pdfRectToPixel', () => {
    it('scales up with zoom > 1', () => {
      const rect: PdfRect = { x: 10, y: 20, width: 100, height: 50 };
      const result = pdfRectToPixel(rect, 2.0);
      expect(result).toEqual({ x: 20, y: 40, width: 200, height: 100 });
    });

    it('scales down with zoom < 1', () => {
      const rect: PdfRect = { x: 100, y: 200, width: 500, height: 300 };
      const result = pdfRectToPixel(rect, 0.5);
      expect(result).toEqual({ x: 50, y: 100, width: 250, height: 150 });
    });

    it('returns same at zoom = 1', () => {
      const rect: PdfRect = { x: 10, y: 20, width: 30, height: 40 };
      const result = pdfRectToPixel(rect, 1.0);
      expect(result).toEqual(rect);
    });

    it('handles zero values', () => {
      const rect: PdfRect = { x: 0, y: 0, width: 0, height: 0 };
      const result = pdfRectToPixel(rect, 1.5);
      expect(result).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    });
  });

  describe('pixelRectToPdf', () => {
    it('scales down with zoom > 1', () => {
      const rect: PdfRect = { x: 200, y: 400, width: 600, height: 300 };
      const result = pixelRectToPdf(rect, 2.0);
      expect(result).toEqual({ x: 100, y: 200, width: 300, height: 150 });
    });

    it('is inverse of pdfRectToPixel', () => {
      const rect: PdfRect = { x: 10, y: 20, width: 100, height: 50 };
      const zoom = 1.5;
      const pixel = pdfRectToPixel(rect, zoom);
      const pdf = pixelRectToPdf(pixel, zoom);
      expect(pdf).toEqual(rect);
    });
  });

  describe('screenPointToPdf', () => {
    it('converts screen coords relative to element', () => {
      const elementRect: DOMRect = {
        x: 100,
        y: 200,
        width: 500,
        height: 400,
        top: 200,
        left: 100,
        right: 600,
        bottom: 600,
      } as DOMRect;

      const result = screenPointToPdf(350, 400, elementRect, 1.5);
      // screenX=350 relative to element left=100 => 250px in element
      // 250 / 1.5 = 166.67
      expect(result.x).toBeCloseTo(166.67, 1);
      // screenY=400 relative to element top=200 => 200px in element
      // 200 / 1.5 = 133.33
      expect(result.y).toBeCloseTo(133.33, 1);
    });

    it('handles zoom = 1', () => {
      const elementRect: DOMRect = {
        x: 0,
        y: 0,
        width: 800,
        height: 600,
        top: 0,
        left: 0,
        right: 800,
        bottom: 600,
      } as DOMRect;

      const result = screenPointToPdf(400, 300, elementRect, 1.0);
      expect(result).toEqual({ x: 400, y: 300 });
    });
  });

  describe('quadPointsToPixel', () => {
    it('scales all values', () => {
      const quads = [10, 20, 30, 20, 30, 50, 10, 50];
      const result = quadPointsToPixel(quads, 2.0);
      expect(result).toEqual([20, 40, 60, 40, 60, 100, 20, 100]);
    });

    it('returns empty for empty input', () => {
      expect(quadPointsToPixel([], 2.0)).toEqual([]);
    });

    it('handles multiple quads', () => {
      const quads = [
        0, 0, 10, 0, 10, 10, 0, 10,
        10, 0, 20, 0, 20, 10, 10, 10,
      ];
      const result = quadPointsToPixel(quads, 0.5);
      expect(result.length).toBe(16);
      expect(result).toEqual([
        0, 0, 5, 0, 5, 5, 0, 5,
        5, 0, 10, 0, 10, 5, 5, 5,
      ]);
    });
  });

  describe('quadPointsToPdf', () => {
    it('is inverse of quadPointsToPixel', () => {
      const quads = [10, 20, 30, 20, 30, 50, 10, 50, 50, 20, 70, 20, 70, 50, 50, 50];
      const zoom = 1.5;
      const pixel = quadPointsToPixel(quads, zoom);
      const pdf = quadPointsToPdf(pixel, zoom);
      expect(pdf.length).toBe(quads.length);
      for (let i = 0; i < quads.length; i++) {
        expect(pdf[i]).toBeCloseTo(quads[i], 10);
      }
    });
  });
});
