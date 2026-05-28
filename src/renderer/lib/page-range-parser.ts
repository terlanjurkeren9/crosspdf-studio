export interface PageRange {
  start: number;
  end: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Parse a page range string like "1-5,10,12-15" into an array of page numbers.
 * Ranges are inclusive. Pages are 1-indexed. Results are deduplicated and sorted.
 */
export function parsePageRanges(input: string, totalPages: number): number[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const ranges = parseRangeString(trimmed);
  return rangesToPageNumbers(ranges, totalPages);
}

/**
 * Parse the raw range string into PageRange objects.
 */
function parseRangeString(input: string): PageRange[] {
  const ranges: PageRange[] = [];
  const parts = input.split(',');

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const rangeMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      ranges.push({ start: Math.min(start, end), end: Math.max(start, end) });
    } else {
      const single = parseInt(trimmed, 10);
      if (!isNaN(single)) {
        ranges.push({ start: single, end: single });
      }
    }
  }

  return ranges;
}

/**
 * Expand PageRange objects into an array of page numbers.
 */
export function rangesToPageNumbers(ranges: PageRange[], totalPages: number): number[] {
  const set = new Set<number>();

  for (const range of ranges) {
    const start = Math.max(1, range.start);
    const end = Math.min(totalPages, range.end);
    for (let p = start; p <= end; p++) {
      set.add(p);
    }
  }

  return Array.from(set).sort((a, b) => a - b);
}

/**
 * Validate page numbers against total pages.
 */
export function validatePageNumbers(pages: number[], totalPages: number): ValidationResult {
  const errors: string[] = [];

  if (pages.length === 0) {
    errors.push('No pages specified.');
    return { valid: false, errors };
  }

  for (const p of pages) {
    if (p < 1 || p > totalPages) {
      errors.push(`Page ${p} is out of range (1–${totalPages}).`);
    }
  }

  if (pages.length >= totalPages) {
    errors.push('Cannot operate on all pages — the document would be empty.');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Generate a split plan: array of page number arrays, one per output file.
 */
export function buildSplitByCountPlan(totalPages: number, pagesPerFile: number): number[][] {
  const plan: number[][] = [];
  for (let start = 1; start <= totalPages; start += pagesPerFile) {
    const chunk: number[] = [];
    const end = Math.min(start + pagesPerFile - 1, totalPages);
    for (let p = start; p <= end; p++) {
      chunk.push(p);
    }
    plan.push(chunk);
  }
  return plan;
}

/**
 * Generate a split plan from page ranges.
 */
export function buildSplitByRangesPlan(totalPages: number, rangeInput: string): number[][] {
  const ranges = parseRangeString(rangeInput);
  return ranges.map((r) => {
    const start = Math.max(1, r.start);
    const end = Math.min(totalPages, r.end);
    const chunk: number[] = [];
    for (let p = start; p <= end; p++) {
      chunk.push(p);
    }
    return chunk;
  });
}

/**
 * Build a reorder mapping from current order to new order.
 * newOrder is an array of page numbers in the desired sequence.
 */
export function buildReorderPlan(
  totalPages: number,
  newOrder: number[]
): { valid: boolean; errors: string[]; plan: number[] } {
  const errors: string[] = [];

  if (newOrder.length !== totalPages) {
    errors.push(`Reorder plan must include exactly ${totalPages} pages, got ${newOrder.length}.`);
  }

  const seen = new Set<number>();
  for (const p of newOrder) {
    if (p < 1 || p > totalPages) {
      errors.push(`Page ${p} is out of range (1–${totalPages}).`);
    }
    if (seen.has(p)) {
      errors.push(`Page ${p} appears more than once.`);
    }
    seen.add(p);
  }

  return {
    valid: errors.length === 0,
    errors,
    plan: errors.length === 0 ? newOrder : [],
  };
}

/**
 * Get the output filename for split parts.
 */
export function splitOutputName(originalPath: string, partIndex: number): string {
  const dot = originalPath.lastIndexOf('.');
  const base = dot > 0 ? originalPath.slice(0, dot) : originalPath;
  const ext = dot > 0 ? originalPath.slice(dot) : '.pdf';
  return `${base}-part-${partIndex + 1}${ext}`;
}

/**
 * Get the output filename for extracted pages.
 */
export function extractOutputName(originalPath: string): string {
  const dot = originalPath.lastIndexOf('.');
  const base = dot > 0 ? originalPath.slice(0, dot) : originalPath;
  const ext = dot > 0 ? originalPath.slice(dot) : '.pdf';
  return `${base}-extracted${ext}`;
}
