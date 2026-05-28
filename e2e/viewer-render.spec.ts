import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchApp } from './helpers/electron';
import { createViewerFixture } from './helpers/pdf-fixture';

let electronApp: ElectronApplication;
let page: Page;
let fixturePath: string;

test.describe('PDF viewer', () => {
  test.beforeAll(async () => {
    fixturePath = await createViewerFixture();

    const launched = await launchApp();
    electronApp = launched.electronApp;
    page = launched.page;

    // Open fixture via crosspdf:open-file custom event (bypasses native dialog)
    await page.evaluate((filePath: string) => {
      window.dispatchEvent(new CustomEvent('crosspdf:open-file', { detail: { filePath } }));
    }, fixturePath);

    // Wait for the PDF canvas to render
    await page.waitForSelector('canvas', { timeout: 15000 });
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  // ── Viewer render ─────────────────────────────────────────────

  test('canvas element renders after opening PDF', async () => {
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();
  });

  test('tab bar shows the fixture filename', async () => {
    const tabLabel = page.getByText('viewer-fixture.pdf').first();
    await expect(tabLabel).toBeVisible();
  });

  test('page count indicator shows / 3', async () => {
    const pageCount = page.getByText('/ 3').first();
    await expect(pageCount).toBeVisible();
  });

  test('page number input starts at 1', async () => {
    const pageInput = page.locator('input[aria-label="Page number"]');
    await expect(pageInput).toHaveValue('1');
  });

  // ── Page navigation ───────────────────────────────────────────

  test('Next page button navigates to page 2', async () => {
    const nextButton = page.locator('button[aria-label="Next page"]');
    await nextButton.click();
    await page.waitForTimeout(400);

    const pageInput = page.locator('input[aria-label="Page number"]');
    await expect(pageInput).toHaveValue('2');
  });

  test('Previous page button navigates back to page 1', async () => {
    const prevButton = page.locator('button[aria-label="Previous page"]');
    await prevButton.click();
    await page.waitForTimeout(400);

    const pageInput = page.locator('input[aria-label="Page number"]');
    await expect(pageInput).toHaveValue('1');
  });

  test('Last page button navigates to page 3', async () => {
    const lastButton = page.locator('button[aria-label="Last page"]');
    await lastButton.click();
    await page.waitForTimeout(400);

    const pageInput = page.locator('input[aria-label="Page number"]');
    await expect(pageInput).toHaveValue('3');
  });

  test('First page button navigates to page 1', async () => {
    const firstButton = page.locator('button[aria-label="First page"]');
    await firstButton.click();
    await page.waitForTimeout(400);

    const pageInput = page.locator('input[aria-label="Page number"]');
    await expect(pageInput).toHaveValue('1');
  });

  test('direct page input navigates to page 2', async () => {
    const pageInput = page.locator('input[aria-label="Page number"]');
    await pageInput.click();
    await pageInput.fill('2');
    await pageInput.press('Enter');
    await page.waitForTimeout(400);

    await expect(pageInput).toHaveValue('2');
  });

  // ── Zoom interaction ──────────────────────────────────────────

  test('zoom label is visible in toolbar', async () => {
    // Zoom label uses formatZoomPercent — shows percent or fit label
    const zoomLabel = page.locator('span:has-text("%"), span:has-text("Fit")').first();
    await expect(zoomLabel).toBeVisible({ timeout: 3000 });
  });

  test('Zoom in button is enabled', async () => {
    const zoomIn = page.locator('button[aria-label="Zoom in"]');
    await expect(zoomIn).toBeEnabled();
  });

  test('Zoom out button is enabled', async () => {
    const zoomOut = page.locator('button[aria-label="Zoom out"]');
    await expect(zoomOut).toBeEnabled();
  });

  test('zoom slider is visible', async () => {
    const slider = page.locator('input[aria-label="Zoom slider"]');
    await expect(slider).toBeVisible();
  });

  test('fit mode Width/Page/100% buttons exist', async () => {
    const fitWidth = page.locator('button').filter({ hasText: 'Width' });
    const fitPage = page.locator('button').filter({ hasText: 'Page' });
    const actual = page.locator('button').filter({ hasText: '100%' });

    await expect(fitWidth.first()).toBeVisible();
    await expect(fitPage.first()).toBeVisible();
    await expect(actual.first()).toBeVisible();
  });

  // ── View mode ─────────────────────────────────────────────────

  test('view mode Single/Scroll buttons exist', async () => {
    const single = page.locator('button').filter({ hasText: 'Single' });
    const scroll = page.locator('button').filter({ hasText: 'Scroll' });

    await expect(single.first()).toBeVisible();
    await expect(scroll.first()).toBeVisible();
  });

  // ── Annotation tools ──────────────────────────────────────────

  test('annotation tools are visible in toolbar', async () => {
    const selectTool = page.locator('button[aria-label="Select"]');
    const highlightTool = page.locator('button[aria-label="Highlight"]');
    await expect(selectTool).toBeVisible();
    await expect(highlightTool).toBeVisible();
  });

  // ── Search panel ──────────────────────────────────────────────

  test('search panel opens via Meta+F', async () => {
    await page.keyboard.press('Meta+f');
    await page.waitForTimeout(500);

    const searchInput = page.locator('input[aria-label="Search text"]');
    await expect(searchInput).toBeVisible({ timeout: 3000 });
  });

  test('search finds known fixture token', async () => {
    const searchInput = page.locator('input[aria-label="Search text"]');
    await searchInput.fill('FIXTURE_SEARCH_TOKEN_ALPHA');

    // Click the search button or press Enter to execute search
    await searchInput.press('Enter');
    await page.waitForTimeout(1000);

    // Results should appear — look for "Page 1" in search results
    const page1Result = page.locator('text=Page 1').first();
    const found = await page1Result.isVisible().catch(() => false);
    // Search should either show result items or the token text somewhere
    const tokenMatch = await page.getByText('FIXTURE_SEARCH_TOKEN_ALPHA').count();
    expect(found || tokenMatch > 0).toBeTruthy();
  });
});
