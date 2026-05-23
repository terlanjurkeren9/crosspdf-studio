import { describe, expect, it } from 'vitest';

/**
 * Preference defaults as defined in PreferencesDialog.
 */
const DEFAULT_PREFS: Record<string, unknown> = {
  theme: 'system',
  defaultZoomMode: 'fit-width',
  defaultViewMode: 'continuous',
  renderAheadPages: 3,
  maxCanvasMemoryMb: 256,
  ocrDefaultDpi: 300,
  ocrDefaultLanguage: 'eng',
  restoreLastSession: true,
  maxRecentDocuments: 20,
};

describe('preference defaults', () => {
  it('has expected default keys', () => {
    expect(Object.keys(DEFAULT_PREFS)).toHaveLength(9);
  });

  it('theme defaults to system', () => {
    expect(DEFAULT_PREFS.theme).toBe('system');
  });

  it('ocr defaults are sensible', () => {
    expect(DEFAULT_PREFS.ocrDefaultDpi).toBe(300);
    expect(DEFAULT_PREFS.ocrDefaultLanguage).toBe('eng');
  });

  it('maxRecentDocuments is within valid range', () => {
    const max = DEFAULT_PREFS.maxRecentDocuments as number;
    expect(max).toBeGreaterThanOrEqual(5);
    expect(max).toBeLessThanOrEqual(50);
  });

  it('renderAheadPages is within valid range', () => {
    const pages = DEFAULT_PREFS.renderAheadPages as number;
    expect(pages).toBeGreaterThanOrEqual(1);
    expect(pages).toBeLessThanOrEqual(10);
  });

  it('maxCanvasMemoryMb is within valid range', () => {
    const mem = DEFAULT_PREFS.maxCanvasMemoryMb as number;
    expect(mem).toBeGreaterThanOrEqual(64);
    expect(mem).toBeLessThanOrEqual(1024);
  });

  it('defaultZoomMode is a known value', () => {
    expect(['fit-width', 'fit-page', 'actual']).toContain(DEFAULT_PREFS.defaultZoomMode);
  });

  it('defaultViewMode is a known value', () => {
    expect(['continuous', 'single']).toContain(DEFAULT_PREFS.defaultViewMode);
  });
});

describe('document store password flow', () => {
  it('TabState accepts optional password', () => {
    const tab = {
      id: 'test-1',
      filePath: '/test/encrypted.pdf',
      fileName: 'encrypted.pdf',
      currentPage: 1,
      zoom: 1,
      fitMode: 'fit-width' as const,
      viewMode: 'single' as const,
      rotation: 0 as const,
      password: 'secret',
    };
    expect(tab.password).toBe('secret');
  });

  it('TabState password is optional', () => {
    const tab = {
      id: 'test-2',
      filePath: '/test/normal.pdf',
      fileName: 'normal.pdf',
      currentPage: 1,
      zoom: 1,
      fitMode: 'fit-width' as const,
      viewMode: 'single' as const,
      rotation: 0 as const,
    };
    expect(tab.password).toBeUndefined();
  });
});
