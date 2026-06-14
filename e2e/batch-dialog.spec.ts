import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { launchApp } from './helpers/electron';
import { createTestPdf } from './helpers/pdf-fixture';

let electronApp: ElectronApplication;
let page: Page;
let fixturePath: string;
let outputDir: string;

test.describe('Batch dialog', () => {
  test.beforeAll(async () => {
    fixturePath = await createTestPdf('batch-convert-source.pdf', 2);
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crosspdf-batch-convert-'));

    const launched = await launchApp();
    electronApp = launched.electronApp;
    page = launched.page;

    await electronApp.evaluate(
      async ({ dialog }, paths: { fixturePath: string; outputDir: string }) => {
        dialog.showOpenDialog = async (_browserWindow, options) => {
          if (options?.properties?.includes('openDirectory')) {
            return {
              canceled: false,
              filePaths: [paths.outputDir],
            };
          }
          return {
            canceled: false,
            filePaths: [paths.fixturePath],
          };
        };
      },
      { fixturePath, outputDir }
    );
  });

  test.afterAll(async () => {
    await electronApp.close();
    fs.rmSync(outputDir, { recursive: true, force: true });
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

    // Convert and OCR are implemented; split is still planned.
    const options = await select.locator('option').allTextContents();
    expect(options).toContain('Convert to Images');
    expect(options).toContain('OCR Document');
    const plannedCount = options.filter((o) => o.includes('planned')).length;
    expect(plannedCount).toBe(1);

    // Real notice banner
    const notice = page.getByText(/merge, convert, and OCR are fully functional/i);
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

  test('converts one PDF job to page images', async () => {
    await fs.promises.rm(outputDir, { recursive: true, force: true });
    await fs.promises.mkdir(outputDir, { recursive: true });

    const toolsMenu = page.getByText('Tools', { exact: true }).first();
    await toolsMenu.click();
    await page.waitForTimeout(300);
    await page.getByText('Batch Processing').first().click();

    const dialogTitle = page.getByText('Batch Processing');
    await expect(dialogTitle).toBeVisible({ timeout: 5000 });

    const operationSelect = page.locator('select').first();
    await operationSelect.selectOption('convert');

    const formatSelect = page.locator('select').nth(1);
    await expect(formatSelect).toBeVisible();
    await expect(formatSelect).toHaveValue('png');
    await formatSelect.selectOption('jpeg');
    await expect(formatSelect).toHaveValue('jpeg');
    await formatSelect.selectOption('png');

    await page.getByRole('button', { name: /Add Job/i }).click();
    await expect(page.getByText('batch-convert-source.pdf')).toBeVisible();

    await page.getByRole('button', { name: /Process Queue/i }).click();
    await expect(page.getByText('1 completed')).toBeVisible({ timeout: 30000 });

    await expect
      .poll(
        () =>
          fs.readdirSync(outputDir).filter((name) => name.toLowerCase().endsWith('.png')).length,
        { timeout: 10000 }
      )
      .toBe(2);

    const files = fs.readdirSync(outputDir);
    expect(files.every((name) => fs.statSync(path.join(outputDir, name)).size > 0)).toBe(true);

    await page.getByRole('button', { name: /Close/i }).last().click();
    await expect(dialogTitle).not.toBeVisible({ timeout: 3000 });
  });

  test('configures one PDF batch OCR job', async () => {
    const toolsMenu = page.getByText('Tools', { exact: true }).first();
    await toolsMenu.click();
    await page.waitForTimeout(300);
    await page.getByText('Batch Processing').first().click();

    const dialogTitle = page.getByText('Batch Processing');
    await expect(dialogTitle).toBeVisible({ timeout: 5000 });

    const clearCompleted = page.getByRole('button', { name: /Clear Completed/i });
    if (await clearCompleted.isEnabled()) {
      await clearCompleted.click();
    }

    const operationSelect = page.locator('select').first();
    await operationSelect.selectOption('ocr');

    const languageSelect = page.locator('select').nth(1);
    await expect(languageSelect).toBeVisible();
    await expect(languageSelect).toHaveValue('eng');

    const pageRangeInput = page.getByPlaceholder('1-3, 5');
    await expect(pageRangeInput).toBeVisible();
    await expect(pageRangeInput).toHaveValue('1-');
    await pageRangeInput.fill('1');

    await page.getByRole('button', { name: /Add Job/i }).click();
    await expect(
      page
        .locator('div')
        .filter({ hasText: /^OCR Document$/ })
        .last()
    ).toBeVisible();
    await expect(page.getByText('batch-convert-source.pdf')).toBeVisible();

    const processBtn = page.getByRole('button', { name: /Process Queue/i });
    await expect(processBtn).toBeEnabled();

    await page.getByRole('button', { name: /Close/i }).last().click();
    await expect(dialogTitle).not.toBeVisible({ timeout: 3000 });
  });
});
