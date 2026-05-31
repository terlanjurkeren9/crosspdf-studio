import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchApp } from './helpers/electron';
import { createViewerFixture } from './helpers/pdf-fixture';

let electronApp: ElectronApplication;
let page: Page;
let fixturePath: string;

test.describe('Digital Signature Placeholder', () => {
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

  test('toolbar button opens digital signature placeholder dialog', async () => {
    const button = page.locator('button[aria-label="Digital Signature"]');
    await expect(button).toBeVisible();

    await button.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 3000 });

    await expect(dialog.getByText('Digital Signature Support', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Digital signature support is not yet available')).toBeVisible();

    const comingSoonBtn = dialog.getByRole('button', { name: 'Coming Soon' });
    await expect(comingSoonBtn).toBeVisible();
    await expect(comingSoonBtn).toBeDisabled();

    const closeBtn = dialog.getByRole('button', { name: 'Close', exact: true });
    await closeBtn.click();
    await expect(dialog).not.toBeVisible({ timeout: 2000 });
  });

  test('Tools menu entry opens digital signature placeholder dialog', async () => {
    const toolsMenu = page.getByText('Tools', { exact: true }).first();
    await toolsMenu.click();
    await page.waitForTimeout(300);

    const menuItem = page.getByText('Digital Signature…');
    await menuItem.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 3000 });

    await expect(dialog.getByText('Digital Signature Support', { exact: true })).toBeVisible();

    const noSignMessage = dialog.getByText('No cryptographic signing is performed at this time.');
    await expect(noSignMessage).toBeVisible();

    const closeBtn = dialog.getByRole('button', { name: 'Close', exact: true });
    await closeBtn.click();
    await expect(dialog).not.toBeVisible({ timeout: 2000 });
  });

  test('digital signature toolbar button disabled without PDF open', async () => {
    const closeDocBtn = page.locator('button[aria-label="Close document"]');
    await closeDocBtn.click();
    await page.waitForTimeout(500);

    const button = page.locator('button[aria-label="Digital Signature"]');
    const exists = await button.count();
    expect(exists).toBe(0);
  });
});
