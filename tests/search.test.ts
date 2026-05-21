import { describe, it, expect } from 'vitest';
import { findMatchesInText, searchPages, createSearchOptions } from '../src/renderer/lib/search';

describe('findMatchesInText', () => {
  const sampleText = 'The quick brown fox jumps over the lazy dog. The fox is quick.';

  it('finds basic matches', () => {
    const matches = findMatchesInText(sampleText, 1, {
      query: 'fox',
      caseSensitive: false,
      wholeWord: false,
    });
    expect(matches).toHaveLength(2);
    expect(matches[0]!.pageNumber).toBe(1);
    expect(matches[0]!.text).toBe('fox');
  });

  it('respects caseSensitive', () => {
    const matches = findMatchesInText(sampleText, 1, {
      query: 'the',
      caseSensitive: true,
      wholeWord: false,
    });
    // Only lowercase "the", not "The"
    expect(matches).toHaveLength(1);
    expect(matches[0]!.text).toBe('the');
  });

  it('case insensitive matches all variants', () => {
    const matches = findMatchesInText(sampleText, 1, {
      query: 'the',
      caseSensitive: false,
      wholeWord: false,
    });
    expect(matches.length).toBeGreaterThan(1);
  });

  it('respects wholeWord', () => {
    const matches = findMatchesInText('foxes and a fox', 1, {
      query: 'fox',
      caseSensitive: false,
      wholeWord: true,
    });
    expect(matches).toHaveLength(1);
    expect(matches[0]!.text).toBe('fox');
  });

  it('wholeWord + caseSensitive combined', () => {
    const matches = findMatchesInText('The fox and the Fox', 1, {
      query: 'Fox',
      caseSensitive: true,
      wholeWord: true,
    });
    expect(matches).toHaveLength(1);
  });

  it('returns empty for no match', () => {
    const matches = findMatchesInText(sampleText, 1, {
      query: 'nonexistent',
      caseSensitive: false,
      wholeWord: false,
    });
    expect(matches).toHaveLength(0);
  });

  it('returns empty for empty query', () => {
    const matches = findMatchesInText(sampleText, 1, {
      query: '',
      caseSensitive: false,
      wholeWord: false,
    });
    expect(matches).toHaveLength(0);
  });

  it('returns empty for empty text', () => {
    const matches = findMatchesInText('', 1, {
      query: 'foo',
      caseSensitive: false,
      wholeWord: false,
    });
    expect(matches).toHaveLength(0);
  });
});

describe('searchPages', () => {
  const pageTexts = new Map<number, string>([
    [1, 'The quick brown fox jumps over the lazy dog.'],
    [2, 'Another fox appeared. The fox ran away.'],
    [3, 'No matches on this page.'],
  ]);

  it('searches across all pages', () => {
    const options = createSearchOptions('fox');
    const results = searchPages(pageTexts, options);
    expect(results).toHaveLength(3);
    expect(results[0]!.pageNumber).toBe(1);
    expect(results[1]!.pageNumber).toBe(2);
    expect(results[2]!.pageNumber).toBe(2);
  });

  it('provides context in results', () => {
    const options = createSearchOptions('fox');
    const results = searchPages(pageTexts, options);
    for (const result of results) {
      expect(result.text).toBe('fox');
      expect(typeof result.contextBefore).toBe('string');
      expect(typeof result.contextAfter).toBe('string');
    }
  });

  it('match indices are globally sequential', () => {
    const options = createSearchOptions('fox');
    const results = searchPages(pageTexts, options);
    expect(results[0]!.matchIndex).toBe(0);
    expect(results[1]!.matchIndex).toBe(1);
    expect(results[2]!.matchIndex).toBe(2);
  });

  it('returns empty for empty query', () => {
    const options = createSearchOptions('');
    const results = searchPages(pageTexts, options);
    expect(results).toHaveLength(0);
  });

  it('returns empty for no matches', () => {
    const options = createSearchOptions('nonexistent');
    const results = searchPages(pageTexts, options);
    expect(results).toHaveLength(0);
  });
});

describe('createSearchOptions', () => {
  it('sets defaults', () => {
    const opts = createSearchOptions('test');
    expect(opts.query).toBe('test');
    expect(opts.caseSensitive).toBe(false);
    expect(opts.wholeWord).toBe(false);
    expect(opts.contextChars).toBe(40);
  });

  it('sets caseSensitive', () => {
    const opts = createSearchOptions('test', true);
    expect(opts.caseSensitive).toBe(true);
  });

  it('sets wholeWord', () => {
    const opts = createSearchOptions('test', false, true);
    expect(opts.wholeWord).toBe(true);
  });
});
