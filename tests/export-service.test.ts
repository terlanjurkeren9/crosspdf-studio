import { describe, expect, it } from 'vitest';
import { formatOcrExport } from '../src/renderer/services/export.service';

describe('formatOcrExport', () => {
  const results = [
    { pageNumber: 1, text: 'Hello world', confidence: 0.95 },
    { pageNumber: 2, text: 'Page two text', confidence: 0.82 },
  ];

  it('joins page text without page numbers by default', () => {
    const output = formatOcrExport(results, {});
    expect(output).toContain('Hello world');
    expect(output).toContain('Page two text');
    expect(output).not.toContain('--- Page 1 ---');
  });

  it('includes page numbers when enabled', () => {
    const output = formatOcrExport(results, { includePageNumbers: true });
    expect(output).toContain('--- Page 1 ---\n');
    expect(output).toContain('--- Page 2 ---\n');
  });

  it('includes confidence when both options enabled', () => {
    const output = formatOcrExport(results, {
      includePageNumbers: true,
      includeConfidence: true,
    });
    expect(output).toContain('(confidence: 95.0%)');
    expect(output).toContain('(confidence: 82.0%)');
  });

  it('handles empty results', () => {
    const output = formatOcrExport([], {});
    expect(output).toBe('');
  });

  it('handles empty text in results', () => {
    const output = formatOcrExport(
      [{ pageNumber: 1, text: '', confidence: 0 }],
      { includePageNumbers: true }
    );
    expect(output).toContain('--- Page 1 ---');
  });
});
