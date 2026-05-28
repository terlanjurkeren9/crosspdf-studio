import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { launchApp } from './helpers/electron';

let electronApp: ElectronApplication;
let page: Page;

test.describe('App launch', () => {
  test.beforeAll(async () => {
    const launched = await launchApp();
    electronApp = launched.electronApp;
    page = launched.page;
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test('window title contains CrossPDF Studio', async () => {
    const title = await page.title();
    expect(title).toContain('CrossPDF Studio');
  });

  test('home screen renders with app name', async () => {
    const heading = page.locator('h1');
    await expect(heading).toContainText('CrossPDF Studio');
  });

  test('home screen shows Quick Actions section', async () => {
    const quickActions = page.getByText('Quick Actions');
    await expect(quickActions).toBeVisible();
  });

  test('Open PDF button is visible', async () => {
    const openButton = page.getByRole('button', { name: 'Open PDF' });
    await expect(openButton).toBeVisible();
  });

  test('Images to PDF button is visible', async () => {
    const imagesButton = page.getByRole('button', { name: 'Images to PDF' });
    await expect(imagesButton).toBeVisible();
  });

  test('Merge PDFs button is visible', async () => {
    const mergeButton = page.getByRole('button', { name: 'Merge PDFs' });
    await expect(mergeButton).toBeVisible();
  });

  test('Recent Documents section is visible', async () => {
    const recentSection = page.getByText('Recent Documents').first();
    await expect(recentSection).toBeVisible();
  });

  test('footer shows Ready status', async () => {
    const footer = page.getByText('Ready');
    await expect(footer).toBeVisible();
  });

  test('menu bar contains File', async () => {
    const fileMenu = page.getByText('File', { exact: true }).first();
    await expect(fileMenu).toBeVisible();
  });

  test('menu bar contains Edit', async () => {
    const editMenu = page.getByText('Edit', { exact: true }).first();
    await expect(editMenu).toBeVisible();
  });

  test('menu bar contains View', async () => {
    const viewMenu = page.getByText('View', { exact: true }).first();
    await expect(viewMenu).toBeVisible();
  });

  test('menu bar contains Tools', async () => {
    const toolsMenu = page.getByText('Tools', { exact: true }).first();
    await expect(toolsMenu).toBeVisible();
  });

  test('menu bar contains Help', async () => {
    const helpMenu = page.getByText('Help', { exact: true }).first();
    await expect(helpMenu).toBeVisible();
  });

  test('preferences button is visible in header', async () => {
    const prefsButton = page.locator('button[aria-label="Preferences"]');
    await expect(prefsButton).toBeVisible();
  });

  test('sidebar toggle button is visible', async () => {
    const toggleButton = page.locator('button[aria-label="Toggle sidebar"]');
    await expect(toggleButton).toBeVisible();
  });

  test('logo icon renders in header', async () => {
    const logoContainer = page.locator('header .rounded-lg.bg-brand-600');
    await expect(logoContainer).toBeVisible();
  });

  test('Preferences dialog opens and closes', async () => {
    const prefsButton = page.locator('button[aria-label="Preferences"]');
    await prefsButton.click();

    // Dialog renders as fixed overlay — wait for the heading
    const dialogTitle = page.getByRole('heading', { name: 'Preferences' });
    await expect(dialogTitle).toBeVisible({ timeout: 5000 });

    // Close via the X button in the dialog header
    const closeButton = page.locator('button[aria-label="Close dialog"]');
    await closeButton.click();

    // Dialog should be removed from DOM
    await expect(dialogTitle).not.toBeVisible({ timeout: 3000 });
  });
});
