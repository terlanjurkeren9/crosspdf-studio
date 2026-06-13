import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchApp } from './helpers/electron';

let electronApp: ElectronApplication;
let page: Page;

test.describe('Batch dialog', () => {
  test.beforeAll(async () => {
    const launched = await launchApp();
    electronApp = launched.electronApp;
    page = launched.page;
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test('Batch dialog opens, shows correct UI state, and closes', async () => {
    // Open from Tools menu
    const toolsMenu = page.getByText('Tools', { exact: true }).first();
    await toolsMenu.click();
    await page.waitForTimeout(300);

    const batchItem = page.getByText('Batch Processing').first();
    await batchItem.click();

    const dialogTitle = page.getByText('Batch Processing');
    await expect(dialogTitle).toBeVisible({ timeout: 5000 });

    // Merge option available
    const select = page.locator('select');
    await expect(select).toBeVisible();
    const mergeOption = select.locator('option', { hasText: 'Merge PDFs' });
    await expect(mergeOption).toBeAttached();

    // Planned operations labeled
    const options = await select.locator('option').allTextContents();
    const plannedCount = options.filter((o) => o.includes('planned')).length;
    expect(plannedCount).toBeGreaterThanOrEqual(3);

    // Real notice banner
    const notice = page.getByText(/merge is fully functional/i);
    await expect(notice).toBeVisible();

    // Empty queue message
    const emptyMsg = page.getByText('No jobs in queue');
    await expect(emptyMsg).toBeVisible();

    // Process Queue disabled when no jobs
    const processBtn = page.getByRole('button', { name: /Process Queue/i });
    await expect(processBtn).toBeDisabled();

    // Close dialog
    const closeBtn = page.getByRole('button', { name: /Close/i }).last();
    await closeBtn.click();
    await expect(dialogTitle).not.toBeVisible({ timeout: 3000 });
  });
});
