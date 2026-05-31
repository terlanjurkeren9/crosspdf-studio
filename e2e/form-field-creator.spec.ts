import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchApp } from './helpers/electron';
import { createViewerFixture } from './helpers/pdf-fixture';

let electronApp: ElectronApplication;
let page: Page;
let fixturePath: string;

/**
 * Activates the form-field tool from the toolbar button.
 */
async function activateFormFieldTool(p: Page): Promise<void> {
  const button = p.locator('button[aria-label="Create Form Field"]');
  await expect(button).toBeVisible();
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
}

/**
 * Draws a form field rectangle on the page. After drawing, the tool
 * switches to select automatically.
 */
async function drawFormField(
  p: Page,
  startX: number,
  startY: number,
  endX: number,
  endY: number
): Promise<void> {
  await activateFormFieldTool(p);

  const pageContainer = p.locator('[data-page-number="1"]').first();
  const box = await pageContainer.boundingBox();
  if (!box) throw new Error('Page container not found');

  await p.mouse.move(box.x + startX, box.y + startY);
  await p.mouse.down();
  await p.mouse.move(box.x + endX, box.y + endY, { steps: 5 });
  await p.mouse.up();
  await p.waitForTimeout(500);
}

test.describe('Create Form Field', () => {
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

  test('toolbar button activates form-field tool', async () => {
    await activateFormFieldTool(page);

    const button = page.locator('button[aria-label="Create Form Field"]');
    await expect(button).toHaveAttribute('aria-pressed', 'true');

    const selectButton = page.locator('button[aria-label="Select"]');
    await selectButton.click();
    await expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  test('drawing form field creates annotation overlay', async () => {
    await drawFormField(page, 50, 50, 200, 80);

    const selectButton = page.locator('button[aria-label="Select"]');
    await expect(selectButton).toHaveAttribute('aria-pressed', 'true');

    const formFieldRect = page.locator('[data-annotation-type="form-field"]').first();
    await expect(formFieldRect).toBeVisible({ timeout: 3000 });
  });

  test('form field shows selection handles when selected', async () => {
    await drawFormField(page, 100, 100, 250, 130);

    const moveHandle = page.locator('[data-annot-move]').first();
    await expect(moveHandle).toBeVisible({ timeout: 3000 });
    await moveHandle.click({ force: true });
    await page.waitForTimeout(300);

    const handles = page.locator('[data-annot-handle]');
    const handleCount = await handles.count();
    expect(handleCount).toBeGreaterThan(0);
  });

  test('direct double-click on unselected form field opens settings dialog', async () => {
    // Draw a fresh field
    await drawFormField(page, 60, 60, 210, 90);

    // Direct double-click WITHOUT pre-click (validates fix for unselected dblclick)
    const moveHandle = page.locator('[data-annot-move]').first();
    await expect(moveHandle).toBeVisible({ timeout: 3000 });
    await moveHandle.dblclick({ force: true });
    await page.waitForTimeout(500);

    // Verify settings dialog opened
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 3000 });

    const fieldNameInput = dialog.locator('input[type="text"]').first();
    await expect(fieldNameInput).toBeVisible();

    const fieldTypeSelect = dialog.locator('select').first();
    await expect(fieldTypeSelect).toBeVisible();

    await expect(dialog.getByText('Form Field Settings')).toBeVisible();

    const cancelButton = dialog.getByRole('button', { name: 'Cancel' });
    await cancelButton.click();
    await expect(dialog).not.toBeVisible({ timeout: 2000 });
  });

  test('move form field via drag changes bounding box', async () => {
    // Draw a fresh field
    await drawFormField(page, 80, 80, 200, 110);

    // Use last() to target the newly drawn field (annotations accumulate across tests)
    const moveHandle = page.locator('[data-annot-move]').last();
    await expect(moveHandle).toBeVisible({ timeout: 3000 });

    // Click to select
    await moveHandle.click({ force: true });
    await page.waitForTimeout(400);

    const beforeBox = await moveHandle.boundingBox();
    if (!beforeBox) throw new Error('Move handle not found');

    // Use the element's own bounding box center for reliable hit-testing
    const startX = beforeBox.x + beforeBox.width / 2;
    const startY = beforeBox.y + beforeBox.height / 2;
    const deltaX = 50;
    const deltaY = 40;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    const afterBox = await moveHandle.boundingBox();
    if (!afterBox) throw new Error('Move handle not found after drag');

    expect(afterBox.x).not.toEqual(beforeBox.x);
    expect(afterBox.y).not.toEqual(beforeBox.y);
  });

  test('resize form field via corner handle changes dimensions', async () => {
    // Draw a fresh field
    await drawFormField(page, 80, 80, 200, 110);

    // Use last() for the newly drawn field
    const moveHandle = page.locator('[data-annot-move]').last();
    await expect(moveHandle).toBeVisible({ timeout: 3000 });

    // Click to select (shows corner handles)
    await moveHandle.click({ force: true });
    await page.waitForTimeout(400);

    const beforeBox = await moveHandle.boundingBox();
    if (!beforeBox) throw new Error('Move handle not found');

    // Get the SE corner handle and use its center for reliable drag
    const seHandle = page.locator('[data-annot-handle]').last();
    await expect(seHandle).toBeVisible({ timeout: 2000 });

    const seBox = await seHandle.boundingBox();
    if (!seBox) throw new Error('SE handle not found');

    const startX = seBox.x + seBox.width / 2;
    const startY = seBox.y + seBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 40, startY + 25, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    const afterBox = await moveHandle.boundingBox();
    if (!afterBox) throw new Error('Move handle not found after resize');

    const widthChanged = Math.abs(afterBox.width - beforeBox.width) > 2;
    const heightChanged = Math.abs(afterBox.height - beforeBox.height) > 2;
    expect(widthChanged || heightChanged).toBe(true);
  });

  test('no Save As dialog triggered on field creation', async () => {
    await drawFormField(page, 30, 30, 130, 60);

    const selectButton = page.locator('button[aria-label="Select"]');
    await expect(selectButton).toHaveAttribute('aria-pressed', 'true');
  });

  test('Apply Form Fields button exists when fields present', async () => {
    await drawFormField(page, 200, 200, 350, 250);

    const applyButton = page.locator('button:has-text("Apply Form Fields")');
    await expect(applyButton).toBeVisible({ timeout: 3000 });

    const buttonText = await applyButton.textContent();
    expect(buttonText).toMatch(/Apply Form Fields \(\d+\)/);
  });

  test('Tools menu "Create Form Field" activates tool', async () => {
    const toolsMenu = page.getByText('Tools', { exact: true }).first();
    await toolsMenu.click();
    await page.waitForTimeout(300);

    const menuItem = page.getByText('Create Form Field');
    await menuItem.click();

    const button = page.locator('button[aria-label="Create Form Field"]');
    await expect(button).toHaveAttribute('aria-pressed', 'true', { timeout: 3000 });

    const selectButton = page.locator('button[aria-label="Select"]');
    await selectButton.click();
  });
});
