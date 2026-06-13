import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchApp } from './helpers/electron';
import { createViewerFixture } from './helpers/pdf-fixture';

let electronApp: ElectronApplication;
let page: Page;
let fixturePath: string;

test.describe('Command palette', () => {
  test.beforeAll(async () => {
    fixturePath = await createViewerFixture();

    const launched = await launchApp();
    electronApp = launched.electronApp;
    page = launched.page;

    await page.evaluate((filePath: string) => {
      window.dispatchEvent(new CustomEvent('crosspdf:open-file', { detail: { filePath } }));
    }, fixturePath);

    await page.waitForSelector('canvas', { timeout: 15000 });
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test('opens with keyboard shortcut, filters commands, and runs selected command', async () => {
    const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${mod}+K`);

    const dialog = page.getByRole('dialog', { name: 'Command Palette' });
    await expect(dialog).toBeVisible();

    await page.getByRole('textbox', { name: 'Search commands' }).fill('hand');
    await expect(page.getByRole('option', { name: /Toggle Hand Tool/ })).toBeVisible();
    await expect(page.getByRole('option', { name: /Save/ })).toHaveCount(0);

    await page.keyboard.press('Enter');
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('button[aria-label="Hand tool"]')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  test('closes with Escape', async () => {
    const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${mod}+K`);

    const dialog = page.getByRole('dialog', { name: 'Command Palette' });
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });
});
