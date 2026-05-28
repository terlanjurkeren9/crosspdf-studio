import path from 'node:path';
import { _electron as electron } from 'playwright';
import type { ElectronApplication, Page } from 'playwright';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

export async function launchApp(): Promise<{ electronApp: ElectronApplication; page: Page }> {
  const mainEntry = path.join(PROJECT_ROOT, 'dist/main/index.cjs');

  const electronApp = await electron.launch({
    args: [mainEntry],
    env: { ...process.env, CROSSPDF_E2E: '1' },
  });

  const page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');

  return { electronApp, page };
}
