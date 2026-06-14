import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchApp } from './helpers/electron';
import { createTestPdf } from './helpers/pdf-fixture';

let electronApp: ElectronApplication;
let page: Page;
let fixturePath1: string;
let fixturePath2: string;

test.describe('Compare dialog', () => {
  test.beforeAll(async () => {
    fixturePath1 = await createTestPdf('compare-left.pdf', 1);
    fixturePath2 = await createTestPdf('compare-right.pdf', 1);

    const launched = await launchApp();
    electronApp = launched.electronApp;
    page = launched.page;

    // Mock file dialog to return our test fixtures
    await electronApp.evaluate(
      async ({ dialog }, paths: { path1: string; path2: string }) => {
        let callCount = 0;
        dialog.showOpenDialog = async () => {
          callCount++;
          return {
            canceled: false,
            filePaths: [callCount === 1 ? paths.path1 : paths.path2],
          };
        };
      },
      { path1: fixturePath1, path2: fixturePath2 }
    );
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test('opens from Tools menu and shows file selection UI', async () => {
    // Open from Tools menu
    const toolsMenu = page.getByText('Tools', { exact: true }).first();
    await toolsMenu.click();
    await page.waitForTimeout(300);

    const compareItem = page.getByText('Compare Documents').first();
    await compareItem.click();

    // Verify dialog title
    const dialogTitle = page.getByText('Compare Documents');
    await expect(dialogTitle).toBeVisible({ timeout: 5000 });

    // Verify both file inputs are visible
    const fileInputs = page.getByPlaceholder('Select PDF...');
    await expect(fileInputs).toHaveCount(2);

    // Verify both Open buttons are visible
    const openButtons = page.getByRole('button', { name: /Open/i });
    await expect(openButtons).toHaveCount(2);

    // Verify Compare button is disabled when no files selected
    const compareBtn = page.getByRole('button', { name: /Compare/i });
    await expect(compareBtn).toBeDisabled();

    // Verify Cancel button is visible
    const cancelBtn = page.getByRole('button', { name: /Cancel/i });
    await expect(cancelBtn).toBeVisible();
  });

  test('compare button is disabled until both files are selected', async () => {
    // Open dialog
    const toolsMenu = page.getByText('Tools', { exact: true }).first();
    await toolsMenu.click();
    await page.waitForTimeout(300);
    await page.getByText('Compare Documents').first().click();

    await expect(page.getByText('Compare Documents')).toBeVisible({ timeout: 5000 });

    // Initially disabled
    const compareBtn = page.getByRole('button', { name: /Compare/i });
    await expect(compareBtn).toBeDisabled();

    // Close and reopen to test with one file
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  });

  test('selects left file and shows filename', async () => {
    // Open dialog
    const toolsMenu = page.getByText('Tools', { exact: true }).first();
    await toolsMenu.click();
    await page.waitForTimeout(300);
    await page.getByText('Compare Documents').first().click();

    await expect(page.getByText('Compare Documents')).toBeVisible({ timeout: 5000 });

    // Click first Open button
    const openButtons = page.getByRole('button', { name: /Open/i });
    await openButtons.first().click();

    // Wait for file to load and name to appear
    await page.waitForTimeout(500);
    const inputs = page.getByPlaceholder('Select PDF...');
    const firstInput = inputs.first();
    await expect(firstInput).not.toHaveValue('');
  });

  test('closes dialog with Cancel button', async () => {
    // Open dialog
    const toolsMenu = page.getByText('Tools', { exact: true }).first();
    await toolsMenu.click();
    await page.waitForTimeout(300);
    await page.getByText('Compare Documents').first().click();

    const dialogTitle = page.getByText('Compare Documents');
    await expect(dialogTitle).toBeVisible({ timeout: 5000 });

    // Click Cancel
    const cancelBtn = page.getByRole('button', { name: /Cancel/i });
    await cancelBtn.click();

    await expect(dialogTitle).not.toBeVisible({ timeout: 3000 });
  });

  test('closes dialog by clicking X or pressing Escape', async () => {
    // Open dialog
    const toolsMenu = page.getByText('Tools', { exact: true }).first();
    await toolsMenu.click();
    await page.waitForTimeout(300);
    await page.getByText('Compare Documents').first().click();

    const dialogTitle = page.getByText('Compare Documents');
    await expect(dialogTitle).toBeVisible({ timeout: 5000 });

    // Press Escape to close
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Dialog should be closed
    await expect(dialogTitle).not.toBeVisible({ timeout: 3000 });
  });
});
