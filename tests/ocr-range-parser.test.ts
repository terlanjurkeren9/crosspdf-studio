import { describe, expect, it } from 'vitest';

/**
 * Ported parseRange from OcrDialog for isolated testing.
 */
function parseRange(input: string, maxPage: number): number[] {
  const pages = new Set<number>();
  const parts = input.split(',').map((s) => s.trim()).filter(Boolean);

  for (const part of parts) {
    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const start = Math.max(1, parseInt(rangeMatch[1], 10));
      const end = Math.min(parseInt(rangeMatch[2], 10), maxPage);
      for (let i = start; i <= end; i++) pages.add(i);
    } else {
      const num = parseInt(part, 10);
      if (num >= 1 && num <= maxPage) pages.add(num);
    }
  }

  return Array.from(pages).sort((a, b) => a - b);
}

describe('parseRange', () => {
  it('parses single page', () => {
    expect(parseRange('5', 100)).toEqual([5]);
  });

  it('parses comma-separated pages', () => {
    expect(parseRange('1,3,5', 10)).toEqual([1, 3, 5]);
  });

  it('parses a range', () => {
    expect(parseRange('1-5', 100)).toEqual([1, 2, 3, 4, 5]);
  });

  it('parses multiple ranges mixed with single pages', () => {
    expect(parseRange('1-3, 7, 10-12', 20)).toEqual([1, 2, 3, 7, 10, 11, 12]);
  });

  it('clamps to maxPage', () => {
    expect(parseRange('1-10', 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('clamps start to 1', () => {
    expect(parseRange('0-5', 10)).toEqual([1, 2, 3, 4, 5]);
  });

  it('filters out pages beyond maxPage', () => {
    expect(parseRange('8,9,10,11', 10)).toEqual([8, 9, 10]);
  });

  it('returns empty for invalid input', () => {
    expect(parseRange('', 100)).toEqual([]);
    expect(parseRange('invalid', 100)).toEqual([]);
  });

  it('deduplicates pages', () => {
    expect(parseRange('1-5, 3, 3, 5-6', 10)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('handles whitespace in input', () => {
    expect(parseRange('  1  ,  3 - 5  ', 10)).toEqual([1, 3, 4, 5]);
  });

  it('returns sorted results', () => {
    expect(parseRange('5,3,1', 10)).toEqual([1, 3, 5]);
  });
});
