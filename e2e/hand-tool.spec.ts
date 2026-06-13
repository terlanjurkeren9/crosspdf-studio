import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchApp } from './helpers/electron';
import { createViewerFixture } from './helpers/pdf-fixture';

let electronApp: ElectronApplication;
let page: Page;
let fixturePath: string;

test.describe('Hand tool panning', () => {
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

  test('activates hand tool and pans the PDF workspace by dragging', async () => {
    const handTool = page.locator('button[aria-label="Hand tool"]');
    await expect(handTool).toBeVisible();
    await handTool.click();
    await expect(handTool).toHaveAttribute('aria-pressed', 'true');

    const workspace = page.locator('.pdf-workspace').first();
    await expect(workspace).toBeVisible();

    await workspace.evaluate((el) => {
      el.scrollTop = 0;
      el.scrollLeft = 0;
    });

    const box = await workspace.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    const startX = box.x + box.width / 2;
    const startY = box.y + Math.min(box.height - 40, 260);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, startY - 180, { steps: 6 });
    await page.mouse.up();

    const scrollTop = await workspace.evaluate((el) => el.scrollTop);
    expect(scrollTop).toBeGreaterThan(0);
  });
});
