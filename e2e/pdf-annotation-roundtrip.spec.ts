import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import type { ElectronApplication, Page } from 'playwright';
import { extractAnnotationsFromPdf } from '../src/renderer/lib/pdf-annotation-embed';
import type { Annotation } from '../src/renderer/types/annotation.types';
import { launchApp } from './helpers/electron';
import { createViewerFixture } from './helpers/pdf-fixture';

declare global {
  interface Window {
    __crosspdfE2ESaveFilePath?: string;
  }
}

let electronApp: ElectronApplication;
let page: Page;
let fixturePath: string;
let saveAsPath: string;

function annotation(overrides: Partial<Annotation>): Annotation {
  return {
    id: 'e2e-ann',
    type: 'highlight',
    pageNumber: 1,
    rect: { x: 72, y: 90, width: 180, height: 24 },
    color: '#FFEB3B',
    opacity: 0.3,
    author: 'E2E',
    createdAt: 1_700_000_000_000,
    modifiedAt: 1_700_000_000_000,
    quadPoints: [72, 90, 252, 90, 252, 114, 72, 114],
    ...overrides,
  } as Annotation;
}

test.describe('PDF annotation save/load round-trip', () => {
  test.beforeAll(async () => {
    fixturePath = await createViewerFixture();
    saveAsPath = `${fixturePath}.annotations.pdf`;

    const launched = await launchApp();
    electronApp = launched.electronApp;
    page = launched.page;

    await page.evaluate((filePath: string) => {
      window.dispatchEvent(new CustomEvent('crosspdf:open-file', { detail: { filePath } }));
    }, fixturePath);

    await page.waitForSelector('canvas', { timeout: 15000 });
    await page.evaluate((path) => {
      window.__crosspdfE2ESaveFilePath = path;
    }, saveAsPath);
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test('saves annotations into the PDF and loads them after reopening', async () => {
    try {
      fs.unlinkSync(saveAsPath);
    } catch {
      // Ignore missing file.
    }

    const annotations: Annotation[] = [
      annotation({ id: 'h1', type: 'highlight' }),
      annotation({ id: 'u1', type: 'underline', color: '#F44336', opacity: 1 }),
      annotation({ id: 's1', type: 'strikeout', color: '#2196F3', opacity: 1 }),
      annotation({
        id: 'n1',
        type: 'sticky-note',
        rect: { x: 80, y: 150, width: 24, height: 24 },
        color: '#FFEB3B',
        opacity: 1,
        content: 'Saved note',
      }),
      annotation({
        id: 't1',
        type: 'free-text',
        rect: { x: 120, y: 210, width: 160, height: 32 },
        color: '#000000',
        opacity: 1,
        content: 'Saved text',
        fontSize: 14,
      }),
    ];

    await page.evaluate((items) => {
      window.dispatchEvent(new CustomEvent('crosspdf:e2e-set-annotations', { detail: items }));
    }, annotations);

    await expect(page.locator('[data-annotation-type]')).toHaveCount(5);
    await page.locator('button[aria-label="Save As"]').click();
    await expect.poll(() => fs.existsSync(saveAsPath)).toBe(true);

    const bytes = fs.readFileSync(saveAsPath);
    const embedded = await extractAnnotationsFromPdf(bytes);
    expect(embedded.map((item) => item.type)).toEqual([
      'highlight',
      'underline',
      'strikeout',
      'sticky-note',
      'free-text',
    ]);

    await page.evaluate((filePath: string) => {
      window.dispatchEvent(new CustomEvent('crosspdf:open-file', { detail: { filePath } }));
    }, saveAsPath);
    await page.waitForSelector('canvas', { timeout: 15000 });

    await expect(page.locator('[data-annotation-type="highlight"]')).toBeVisible();
    await expect(page.locator('[data-annotation-type="underline"]')).toBeVisible();
    await expect(page.locator('[data-annotation-type="strikeout"]')).toBeVisible();
    await expect(page.locator('[data-annotation-type="sticky-note"]')).toBeVisible();
    await expect(page.locator('[data-annotation-type="free-text"]')).toBeVisible();
  });
});
