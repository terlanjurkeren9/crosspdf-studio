import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchApp } from './helpers/electron';
import { createViewerFixture } from './helpers/pdf-fixture';

let electronApp: ElectronApplication;
let page: Page;
let fixturePath: string;

test.describe('Drag and drop PDF open', () => {
  test.beforeAll(async () => {
    fixturePath = await createViewerFixture();
    const launched = await launchApp();
    electronApp = launched.electronApp;
    page = launched.page;
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test('opens PDF via programmatic file open event (simulating drop result)', async () => {
    // The drag-and-drop handler ultimately calls handleOpenFilePath,
    // which is the same logic triggered by the crosspdf:open-file custom event.
    await page.evaluate((filePath: string) => {
      window.dispatchEvent(new CustomEvent('crosspdf:open-file', { detail: { filePath } }));
    }, fixturePath);

    // Wait for the PDF canvas to render
    await page.waitForSelector('canvas', { timeout: 15000 });

    // Verify tab bar shows the fixture filename
    const tabLabel = page.getByText('viewer-fixture.pdf').first();
    await expect(tabLabel).toBeVisible();
  });
});
