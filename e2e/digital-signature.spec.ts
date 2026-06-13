import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { ElectronApplication, Page } from 'playwright';
import { launchApp } from './helpers/electron';
import { createViewerFixture, getFixtureDir } from './helpers/pdf-fixture';

let electronApp: ElectronApplication;
let page: Page;
let fixturePath: string;
let certificatePath: string;
let outputPath: string;

const PASSPHRASE = 'crosspdf-e2e-passphrase';

function hasOpenSsl(): boolean {
  try {
    execFileSync('openssl', ['version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function generateP12(targetPath: string): void {
  const dir = path.dirname(targetPath);
  const keyPath = path.join(dir, 'digital-signature-e2e.key');
  const certPath = path.join(dir, 'digital-signature-e2e.crt');

  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-keyout',
      keyPath,
      '-out',
      certPath,
      '-days',
      '1',
      '-nodes',
      '-subj',
      '/CN=CrossPDF E2E Signer',
    ],
    { stdio: 'ignore' }
  );

  execFileSync(
    'openssl',
    [
      'pkcs12',
      '-export',
      '-inkey',
      keyPath,
      '-in',
      certPath,
      '-out',
      targetPath,
      '-passout',
      `pass:${PASSPHRASE}`,
    ],
    { stdio: 'ignore' }
  );
}

test.describe('Digital Signature', () => {
  test.beforeAll(async () => {
    test.skip(!hasOpenSsl(), 'OpenSSL is required to generate the E2E P12 certificate');

    fixturePath = await createViewerFixture();
    certificatePath = path.join(getFixtureDir(), 'digital-signature-e2e.p12');
    outputPath = path.join(getFixtureDir(), 'digital-signature-e2e.signed.pdf');
    generateP12(certificatePath);

    const launched = await launchApp();
    electronApp = launched.electronApp;
    page = launched.page;

    await electronApp.evaluate(
      async ({ dialog }, paths: { certificatePath: string; outputPath: string }) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [paths.certificatePath],
        });
        dialog.showSaveDialog = async () => ({
          canceled: false,
          filePath: paths.outputPath,
        });
      },
      { certificatePath, outputPath }
    );

    await page.evaluate((filePath: string) => {
      window.dispatchEvent(new CustomEvent('crosspdf:open-file', { detail: { filePath } }));
    }, fixturePath);

    await page.waitForSelector('canvas', { timeout: 15000 });
  });

  test.afterAll(async () => {
    await electronApp?.close();
  });

  test('toolbar opens active cryptographic signing dialog', async () => {
    await page.locator('button[aria-label="Digital Signature"]').click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 3000 });
    await expect(dialog.getByText('Document', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Certificate (.p12 / .pfx)', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Certificate Passphrase', { exact: true })).toBeVisible();
    await expect(dialog.getByTestId('signature-place-button')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Sign & Save As…' })).toBeDisabled();
    await expect(dialog.locator('input[type="number"]')).toHaveCount(0);
    await expect(dialog.getByText('Digital Signature Support')).toHaveCount(0);
    await expect(dialog.getByText('Coming Soon')).toHaveCount(0);

    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialog).not.toBeVisible({ timeout: 2000 });
  });

  test('sign flow places signature by dragging on the page and writes signed PDF', async () => {
    fs.rmSync(outputPath, { force: true });
    await page.locator('button[aria-label="Digital Signature"]').click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 3000 });

    await dialog.getByRole('button', { name: 'Browse...' }).click();
    await dialog.getByPlaceholder('••••••••').fill(PASSPHRASE);
    await dialog.getByPlaceholder('e.g. John Doe').fill('CrossPDF E2E Signer');
    await dialog.getByPlaceholder('e.g. I approve this document').fill('Approved in E2E');
    await dialog.getByPlaceholder('e.g. New York').fill('Jakarta');
    await dialog.getByPlaceholder('e.g. john@example.com').fill('signer@example.com');

    await dialog.getByTestId('signature-place-button').click();
    await expect(dialog).not.toBeVisible({ timeout: 2000 });

    const placementLayer = page.getByTestId('signature-placement-layer');
    await expect(placementLayer).toBeVisible({ timeout: 3000 });
    const box = await placementLayer.boundingBox();
    expect(box).toBeTruthy();

    const startX = (box?.x ?? 0) + 50;
    const startY = (box?.y ?? 0) + 60;
    const endX = startX + 200;
    const endY = startY + 40;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 8 });
    await page.mouse.up();

    await expect(dialog).toBeVisible({ timeout: 3000 });
    await expect(dialog.getByTestId('signature-placement-summary')).toBeVisible();

    await dialog.getByRole('button', { name: 'Sign & Save As…' }).click();

    await expect(dialog.getByText('PDF signed successfully.')).toBeVisible({ timeout: 3000 });
    await expect.poll(() => fs.existsSync(outputPath)).toBe(true);

    const signed = fs.readFileSync(outputPath);
    const sourceSize = fs.statSync(fixturePath).size;
    const signedText = signed.toString('latin1');
    expect(signed.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(signed.length).toBeGreaterThan(sourceSize);
    expect(signedText).toContain('/ByteRange');
    expect(signedText).toContain('/Contents');
    expect(signedText).toContain('/SubFilter /adbe.pkcs7.detached');
  });
});
