import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchApp } from './helpers/electron';

let electronApp: ElectronApplication;
let page: Page;

test.describe('Auto-update smoke', () => {
  test.beforeAll(async () => {
    const launched = await launchApp();
    electronApp = launched.electronApp;
    page = launched.page;
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test('Help menu contains Check for Updates item', async () => {
    const helpMenu = page.getByRole('button', { name: 'Help' });
    await helpMenu.click();

    const updateItem = page.getByRole('menuitem', { name: /Check for Updates/i });
    await expect(updateItem).toBeVisible({ timeout: 5000 });

    // Close menu by pressing Escape
    await page.keyboard.press('Escape');
  });

  test('clicking Check for Updates does not crash in E2E mode', async () => {
    const helpMenu = page.getByRole('button', { name: 'Help' });
    await helpMenu.click();

    const updateItem = page.getByRole('menuitem', { name: /Check for Updates/i });
    await expect(updateItem).toBeVisible({ timeout: 5000 });
    await updateItem.click();

    // In E2E mode the updater is not initialized, so the menu click
    // should complete without crash. The app should still be functional.
    const heading = page.locator('h1');
    await expect(heading).toContainText('CrossPDF Studio');
  });

  test('window remains stable after update action', async () => {
    // Verify the app is still responsive
    const title = await page.title();
    expect(title).toContain('CrossPDF Studio');

    // Help menu should still be accessible
    const helpMenu = page.getByRole('button', { name: 'Help' });
    await expect(helpMenu).toBeVisible();
  });
});
