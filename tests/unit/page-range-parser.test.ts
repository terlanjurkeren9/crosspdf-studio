import { describe, it, expect } from 'vitest';
import {
  parsePageRanges,
  rangesToPageNumbers,
  validatePageNumbers,
  buildSplitByCountPlan,
  buildSplitByRangesPlan,
  buildReorderPlan,
  splitOutputName,
  extractOutputName,
} from '../../src/renderer/lib/page-range-parser';

describe('parsePageRanges', () => {
  it('parses single pages', () => {
    expect(parsePageRanges('1,5,10', 20)).toEqual([1, 5, 10]);
  });

  it('parses a range', () => {
    expect(parsePageRanges('1-5', 20)).toEqual([1, 2, 3, 4, 5]);
  });

  it('parses mixed single pages and ranges', () => {
    expect(parsePageRanges('1-3,5,7-9', 20)).toEqual([1, 2, 3, 5, 7, 8, 9]);
  });

  it('handles ranges with spaces', () => {
    expect(parsePageRanges(' 1-3 , 5 , 7 - 9 ', 20)).toEqual([1, 2, 3, 5, 7, 8, 9]);
  });

  it('clamps out of bounds pages', () => {
    expect(parsePageRanges('0-3, 15-25', 20)).toEqual([1, 2, 3, 15, 16, 17, 18, 19, 20]);
  });

  it('deduplicates pages', () => {
    expect(parsePageRanges('1-3, 2-5', 20)).toEqual([1, 2, 3, 4, 5]);
  });

  it('handles reversed ranges', () => {
    expect(parsePageRanges('5-1', 20)).toEqual([1, 2, 3, 4, 5]);
  });

  it('returns empty for empty input', () => {
    expect(parsePageRanges('', 20)).toEqual([]);
  });

  it('returns empty for whitespace input', () => {
    expect(parsePageRanges('   ', 20)).toEqual([]);
  });

  it('ignores invalid entries', () => {
    expect(parsePageRanges('1, abc, 5', 20)).toEqual([1, 5]);
  });
});

describe('rangesToPageNumbers', () => {
  it('expands simple range', () => {
    expect(rangesToPageNumbers([{ start: 1, end: 3 }], 10)).toEqual([1, 2, 3]);
  });

  it('expands multiple ranges and deduplicates', () => {
    expect(
      rangesToPageNumbers(
        [
          { start: 1, end: 3 },
          { start: 2, end: 5 },
        ],
        10
      )
    ).toEqual([1, 2, 3, 4, 5]);
  });

  it('clamps to total pages', () => {
    expect(rangesToPageNumbers([{ start: 1, end: 100 }], 5)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('validatePageNumbers', () => {
  it('validates pages in range', () => {
    expect(validatePageNumbers([1, 5, 10], 20)).toEqual({ valid: true, errors: [] });
  });

  it('rejects out of range pages', () => {
    const result = validatePageNumbers([0, 21], 20);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects empty array', () => {
    const result = validatePageNumbers([], 20);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects when all pages selected', () => {
    const result = validatePageNumbers([1, 2, 3], 3);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('all pages'))).toBe(true);
  });
});

describe('buildSplitByCountPlan', () => {
  it('splits 10 pages into chunks of 3', () => {
    const plan = buildSplitByCountPlan(10, 3);
    expect(plan).toEqual([[1, 2, 3], [4, 5, 6], [7, 8, 9], [10]]);
  });

  it('single chunk for pagesPerFile >= totalPages', () => {
    const plan = buildSplitByCountPlan(5, 10);
    expect(plan).toEqual([[1, 2, 3, 4, 5]]);
  });

  it('handles exact division', () => {
    const plan = buildSplitByCountPlan(6, 2);
    expect(plan).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
  });

  it('handles pagesPerFile of 1', () => {
    const plan = buildSplitByCountPlan(3, 1);
    expect(plan).toEqual([[1], [2], [3]]);
  });
});

describe('buildSplitByRangesPlan', () => {
  it('splits by specified ranges', () => {
    const plan = buildSplitByRangesPlan(10, '1-3, 4-6, 7-10');
    expect(plan).toEqual([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9, 10],
    ]);
  });

  it('clamps out of bounds', () => {
    const plan = buildSplitByRangesPlan(5, '1-10');
    expect(plan).toEqual([[1, 2, 3, 4, 5]]);
  });
});

describe('buildReorderPlan', () => {
  it('validates a correct reorder plan', () => {
    const result = buildReorderPlan(3, [3, 1, 2]);
    expect(result.valid).toBe(true);
    expect(result.plan).toEqual([3, 1, 2]);
  });

  it('rejects wrong page count', () => {
    const result = buildReorderPlan(3, [1, 2]);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects out of range pages', () => {
    const result = buildReorderPlan(3, [0, 1, 2]);
    expect(result.valid).toBe(false);
  });

  it('rejects duplicate pages', () => {
    const result = buildReorderPlan(3, [1, 1, 2]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('more than once'))).toBe(true);
  });
});

describe('splitOutputName', () => {
  it('generates part filename', () => {
    expect(splitOutputName('/path/to/doc.pdf', 0)).toBe('/path/to/doc-part-1.pdf');
  });

  it('generates part filename for second part', () => {
    expect(splitOutputName('/path/to/doc.pdf', 2)).toBe('/path/to/doc-part-3.pdf');
  });

  it('handles files without extension', () => {
    expect(splitOutputName('/path/to/doc', 0)).toBe('/path/to/doc-part-1.pdf');
  });
});

describe('extractOutputName', () => {
  it('generates extracted filename', () => {
    expect(extractOutputName('/path/to/doc.pdf')).toBe('/path/to/doc-extracted.pdf');
  });
});
