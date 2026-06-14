import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchApp } from './helpers/electron';
import { createViewerFixture } from './helpers/pdf-fixture';

let electronApp: ElectronApplication;
let page: Page;
let fixturePath: string;

async function drawOnPage(
  p: Page,
  startX: number,
  startY: number,
  endX: number,
  endY: number
): Promise<void> {
  const pageContainer = p.locator('[data-page-number="1"]').first();
  const box = await pageContainer.boundingBox();
  if (!box) throw new Error('Page container not found');

  await p.mouse.move(box.x + startX, box.y + startY);
  await p.mouse.down();
  await p.mouse.move(box.x + endX, box.y + endY, { steps: 8 });
  await p.mouse.up();
}

test.describe('Drawing tools in single page mode', () => {
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

  test('freehand tool creates an annotation in single page mode', async () => {
    await page.getByRole('button', { name: 'Single' }).click();

    const freehandButton = page.locator('button[aria-label="Freehand"]');
    await freehandButton.click();
    await expect(freehandButton).toHaveAttribute('aria-pressed', 'true');

    await drawOnPage(page, 80, 90, 170, 130);

    await expect(page.locator('[data-annotation-type="freehand"]').first()).toBeVisible({
      timeout: 3000,
    });
  });

  test('rectangle tool creates an annotation in single page mode', async () => {
    await page.getByRole('button', { name: 'Single' }).click();

    const rectangleButton = page.locator('button[aria-label="Rectangle"]');
    await rectangleButton.click();
    await expect(rectangleButton).toHaveAttribute('aria-pressed', 'true');

    await drawOnPage(page, 120, 150, 250, 230);

    await expect(page.locator('[data-annotation-type="rectangle"]').first()).toBeVisible({
      timeout: 3000,
    });
  });

  test('ellipse tool creates an annotation in single page mode', async () => {
    await page.getByRole('button', { name: 'Single' }).click();

    const ellipseButton = page.locator('button[aria-label="Ellipse"]');
    await ellipseButton.click();
    await expect(ellipseButton).toHaveAttribute('aria-pressed', 'true');

    await drawOnPage(page, 150, 260, 290, 335);

    await expect(page.locator('[data-annotation-type="ellipse"]').first()).toBeVisible({
      timeout: 3000,
    });
  });

  test('arrowhead points toward the drag end in single page mode', async () => {
    await page.getByRole('button', { name: 'Single' }).click();

    const arrowButton = page.locator('button[aria-label="Arrow"]');
    await arrowButton.click();
    await expect(arrowButton).toHaveAttribute('aria-pressed', 'true');

    const beforeCount = await page.locator('svg polygon').count();
    await drawOnPage(page, 170, 390, 340, 390);

    await expect(page.locator('[data-annotation-type="arrow"]').first()).toBeVisible({
      timeout: 3000,
    });

    const points = await page.locator('svg polygon').nth(beforeCount).getAttribute('points');
    if (!points) throw new Error('Arrowhead polygon points missing');

    const coords = points
      .trim()
      .split(/\s+/)
      .map((pair) => pair.split(',').map(Number));
    const [tip, base1, base2] = coords;

    expect(tip[0]).toBeGreaterThan(base1[0]);
    expect(tip[0]).toBeGreaterThan(base2[0]);
  });
});
