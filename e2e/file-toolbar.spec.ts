import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import type { ElectronApplication, Page } from 'playwright';
import { launchApp } from './helpers/electron';
import { createViewerFixture } from './helpers/pdf-fixture';

declare global {
  interface Window {
    __crosspdfE2ESaveFilePath?: string;
    __crosspdfFileActions?: Array<{ action: string; filePath?: string }>;
  }
}

let electronApp: ElectronApplication;
let page: Page;
let fixturePath: string;
let saveAsPath: string;

test.describe('Viewer file toolbar actions', () => {
  test.beforeAll(async () => {
    fixturePath = await createViewerFixture();
    saveAsPath = `${fixturePath}.save-as.pdf`;

    const launched = await launchApp();
    electronApp = launched.electronApp;
    page = launched.page;

    await page.evaluate((filePath: string) => {
      window.dispatchEvent(new CustomEvent('crosspdf:open-file', { detail: { filePath } }));
    }, fixturePath);

    await page.waitForSelector('canvas', { timeout: 15000 });

    await page.evaluate((path) => {
      window.__crosspdfE2ESaveFilePath = path;
      window.__crosspdfFileActions = [];
      window.addEventListener('crosspdf:e2e-file-action', (event) => {
        window.__crosspdfFileActions?.push(
          (event as CustomEvent<{ action: string; filePath?: string }>).detail
        );
      });
    }, saveAsPath);
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test('shows Save, Save As, and Print buttons', async () => {
    await expect(page.locator('button[aria-label="Save"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Save As"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Print"]')).toBeVisible();
  });

  test('Save overwrites the current file path', async () => {
    await page.locator('button[aria-label="Save"]').click();
    await expect
      .poll(() => page.evaluate(() => window.__crosspdfFileActions ?? []))
      .toContainEqual({ action: 'save', filePath: fixturePath });
  });

  test('Save As opens save dialog and writes the selected file path', async () => {
    try {
      fs.unlinkSync(saveAsPath);
    } catch {
      // Ignore missing file.
    }

    await page.locator('button[aria-label="Save As"]').click();

    await expect
      .poll(() => page.evaluate(() => window.__crosspdfFileActions ?? []))
      .toContainEqual({ action: 'save-as', filePath: saveAsPath });
    await expect.poll(() => fs.existsSync(saveAsPath)).toBe(true);
  });

  test('Print button calls the print surface', async () => {
    await page.locator('button[aria-label="Print"]').click();
    await expect
      .poll(() => page.evaluate(() => window.__crosspdfFileActions?.map((a) => a.action) ?? []))
      .toContain('print');
  });

  test('keyboard shortcuts trigger Save, Save As, and Print', async () => {
    await page.evaluate(() => {
      window.__crosspdfFileActions = [];
    });

    const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${mod}+S`);
    await page.keyboard.press(`${mod}+Shift+S`);
    await page.keyboard.press(`${mod}+P`);

    await expect
      .poll(() => page.evaluate(() => window.__crosspdfFileActions?.map((a) => a.action) ?? []))
      .toEqual(expect.arrayContaining(['save', 'save-as', 'print']));
  });
});
