export interface SearchMatch {
  pageNumber: number;
  matchIndex: number;
  /** Character position of the match start in the page text. */
  charIndex: number;
  text: string;
}

export interface SearchResult {
  pageNumber: number;
  matchIndex: number;
  text: string;
  contextBefore: string;
  contextAfter: string;
}

export interface SearchOptions {
  query: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  contextChars: number;
}

const DEFAULT_CONTEXT_CHARS = 40;

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeSnippetText(str: string): string {
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Find all matches of query in a single page's text content.
 */
export function findMatchesInText(
  pageText: string,
  pageNumber: number,
  options: { query: string; caseSensitive: boolean; wholeWord: boolean }
): SearchMatch[] {
  const { query, caseSensitive, wholeWord } = options;

  if (!query || !pageText) return [];

  const flags = caseSensitive ? 'g' : 'gi';
  const pattern = wholeWord
    ? new RegExp(`\\b${escapeRegex(query)}\\b`, flags)
    : new RegExp(escapeRegex(query), flags);

  const matches: SearchMatch[] = [];
  let matchIndex = 0;
  let execResult: RegExpExecArray | null;

  while ((execResult = pattern.exec(pageText)) !== null) {
    matches.push({
      pageNumber,
      matchIndex,
      charIndex: execResult.index,
      text: execResult[0],
    });
    matchIndex++;
    if (execResult.index === pattern.lastIndex) {
      pattern.lastIndex++;
    }
  }

  return matches;
}

/**
 * Search across all pages, returning enriched results with context.
 */
export function searchPages(
  pageTexts: Map<number, string>,
  options: SearchOptions
): SearchResult[] {
  const { query, caseSensitive, wholeWord, contextChars } = options;

  if (!query) return [];

  const results: SearchResult[] = [];
  let globalMatchIndex = 0;
  const searchOpts = { query, caseSensitive, wholeWord };

  for (const pageNumber of [...pageTexts.keys()].sort((a, b) => a - b)) {
    const text = pageTexts.get(pageNumber);
    if (!text) continue;

    const matches = findMatchesInText(text, pageNumber, searchOpts);

    for (const match of matches) {
      const start = Math.max(0, match.charIndex - contextChars);
      const end = Math.min(text.length, match.charIndex + match.text.length + contextChars);

      const contextBefore = text.substring(start, match.charIndex);
      const contextAfter = text.substring(match.charIndex + match.text.length, end);

      results.push({
        pageNumber,
        matchIndex: globalMatchIndex,
        text: normalizeSnippetText(match.text),
        contextBefore: normalizeSnippetText(contextBefore),
        contextAfter: normalizeSnippetText(contextAfter),
      });
      globalMatchIndex++;
    }
  }

  return results;
}

/**
 * Create search options with defaults.
 */
export function createSearchOptions(
  query: string,
  caseSensitive = false,
  wholeWord = false
): SearchOptions {
  return {
    query,
    caseSensitive,
    wholeWord,
    contextChars: DEFAULT_CONTEXT_CHARS,
  };
}
