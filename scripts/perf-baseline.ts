import path from 'node:path';
import fs from 'node:fs';
import { _electron as electron } from 'playwright';
import type { ElectronApplication, Page } from 'playwright';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const MAIN_ENTRY = path.join(PROJECT_ROOT, 'dist/main/index.cjs');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'docs/performance');
const FIXTURE_DIR = path.join(PROJECT_ROOT, 'e2e/.fixtures');

interface TimingEntry {
  label: string;
  durationMs: number;
}

interface MemorySnapshot {
  label: string;
  usedJSHeapSize?: number;
  totalJSHeapSize?: number;
  jsHeapSizeLimit?: number;
}

interface BaselineReport {
  timestamp: string;
  platform: string;
  arch: string;
  timings: TimingEntry[];
  memory: MemorySnapshot[];
}

function now(): number {
  return performance.now();
}

async function createFixture(): Promise<string> {
  if (!fs.existsSync(FIXTURE_DIR)) {
    fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  }

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (let i = 0; i < 5; i++) {
    const page = doc.addPage([612, 792]);
    page.drawText(`Performance Test Page ${i + 1}`, {
      x: 72,
      y: 700,
      size: 14,
      font,
      color: rgb(0, 0, 0),
    });
    page.drawText(`Baseline content line ${i + 1}`, {
      x: 72,
      y: 670,
      size: 12,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
  }

  const filePath = path.join(FIXTURE_DIR, 'perf-baseline-fixture.pdf');
  fs.writeFileSync(filePath, await doc.save());
  return filePath;
}

async function collectMemory(page: Page, label: string): Promise<MemorySnapshot> {
  const mem = await page.evaluate(() => {
    const m = (performance as unknown as { memory?: MemorySnapshot }).memory;
    return {
      usedJSHeapSize: m?.usedJSHeapSize,
      totalJSHeapSize: m?.totalJSHeapSize,
      jsHeapSizeLimit: m?.jsHeapSizeLimit,
    };
  });
  return { label, ...mem };
}

function toMB(bytes?: number): string {
  if (bytes == null) return 'N/A';
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function run(): Promise<void> {
  console.log('CrossPDF Studio — Performance Baseline\n');

  // ── Create fixture ──────────────────────────────────────────────
  const fixturePath = await createFixture();
  console.log(`Fixture: ${fixturePath}`);

  // ── Launch app ──────────────────────────────────────────────────
  const t0 = now();
  const electronApp: ElectronApplication = await electron.launch({
    args: [MAIN_ENTRY],
    env: { ...process.env, CROSSPDF_E2E: '1' },
  });
  const page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  const launchMs = Math.round(now() - t0);
  console.log(`App launch: ${launchMs}ms`);

  const memAfterLaunch = await collectMemory(page, 'after-launch');

  // ── Open PDF fixture ────────────────────────────────────────────
  const t1 = now();
  await page.evaluate((filePath: string) => {
    window.dispatchEvent(new CustomEvent('crosspdf:open-file', { detail: { filePath } }));
  }, fixturePath);
  // Wait for canvas render
  await page.waitForSelector('canvas', { timeout: 15000 });
  const openMs = Math.round(now() - t1);
  console.log(`PDF open + first render: ${openMs}ms`);

  const memAfterOpen = await collectMemory(page, 'after-pdf-open');

  // ── Page navigation: next page ──────────────────────────────────
  const navTimings: number[] = [];
  for (let i = 0; i < 4; i++) {
    const currentVal = await page.locator('input[aria-label="Page number"]').inputValue();
    const tn = now();
    await page.locator('button[aria-label="Next page"]').click();
    // Wait for the page input value to actually change (not a fixed timeout)
    await page.waitForFunction(
      (prevVal: string) => {
        const input = document.querySelector('input[aria-label="Page number"]') as HTMLInputElement;
        return input && input.value !== prevVal;
      },
      currentVal,
      { timeout: 3000 }
    );
    navTimings.push(Math.round(now() - tn));
  }
  const avgNavMs = Math.round(navTimings.reduce((a, b) => a + b, 0) / navTimings.length);
  console.log(`Page navigation (next ×4): avg ${avgNavMs}ms, samples [${navTimings.join(', ')}]`);

  const memAfterNav = await collectMemory(page, 'after-page-navigation');

  // ── Continuous mode switch ────────────────────────────────────
  const tScroll = now();
  const scrollBtn = page.locator('button').filter({ hasText: 'Scroll' }).first();
  await scrollBtn.click();
  // Wait for at least 2 canvases to appear (real render, not timeout)
  try {
    await page.waitForFunction(() => document.querySelectorAll('canvas').length >= 2, {
      timeout: 5000,
    });
  } catch {
    // Fallback: give extra time if observer hasn't triggered yet
    await page.waitForTimeout(500);
  }
  const canvasCount = await page.locator('canvas').count();
  const scrollModeMs = Math.round(now() - tScroll);
  console.log(`Continuous mode switch: ${scrollModeMs}ms (${canvasCount} canvases visible)`);

  const memAfterScroll = await collectMemory(page, 'after-continuous-scroll');

  // ── Zoom interaction ────────────────────────────────────────────
  // Read initial canvas dimensions as a proxy for zoom state
  const initialCanvasWidth = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    return c ? (c as HTMLCanvasElement).width : 0;
  });
  const tZoom = now();
  const zoomIn = page.locator('button[aria-label="Zoom in"]');
  await zoomIn.click();
  // Wait for canvas dimensions to change (zoom re-renders at new scale)
  try {
    await page.waitForFunction(
      (prevWidth: number) => {
        const c = document.querySelector('canvas') as HTMLCanvasElement;
        return c && c.width !== prevWidth;
      },
      initialCanvasWidth,
      { timeout: 3000 }
    );
  } catch {
    await page.waitForTimeout(300);
  }
  await zoomIn.click();
  await page.waitForTimeout(200);
  const zoomMs = Math.round(now() - tZoom);
  console.log(`Zoom in ×2: ${zoomMs}ms`);

  const memAfterZoom = await collectMemory(page, 'after-zoom-in');

  // ── Compile report ──────────────────────────────────────────────
  const report: BaselineReport = {
    timestamp: new Date().toISOString(),
    platform: process.platform,
    arch: process.arch,
    timings: [
      { label: 'app-launch', durationMs: launchMs },
      { label: 'pdf-open-first-render', durationMs: openMs },
      { label: 'page-navigation-avg-4x', durationMs: avgNavMs },
      { label: 'continuous-mode-switch', durationMs: scrollModeMs },
      { label: 'zoom-in-2x', durationMs: zoomMs },
    ],
    memory: [memAfterLaunch, memAfterOpen, memAfterNav, memAfterScroll, memAfterZoom],
  };

  // ── Write output ────────────────────────────────────────────────
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const jsonPath = path.join(OUTPUT_DIR, 'baseline.json');
  const mdPath = path.join(OUTPUT_DIR, 'baseline.md');

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  // Markdown summary
  const lines = [
    '# CrossPDF Studio — Performance Baseline',
    '',
    `**Timestamp:** ${report.timestamp}`,
    `**Platform:** ${report.platform} (${report.arch})`,
    '',
    '## Timings',
    '',
    '| Phase | Duration (ms) |',
    '| ----- | ------------: |',
    ...report.timings.map((t) => `| ${t.label} | ${t.durationMs} |`),
    '',
    '## Memory',
    '',
    '| Phase | Used JS Heap | Total JS Heap | Heap Limit |',
    '| ----- | -----------: | ------------: | ---------: |',
    ...report.memory.map((m) =>
      [
        `| ${m.label}`,
        toMB(m.usedJSHeapSize),
        toMB(m.totalJSHeapSize),
        toMB(m.jsHeapSizeLimit),
      ].join(' | ')
    ),
    '',
    '## Notes',
    '',
    '- Generated by `scripts/perf-baseline.ts` via Playwright Electron launch.',
    '- App runs headless; results approximate real user experience.',
    '- Memory metrics from `performance.memory` (Chrome/V8 — Electron only).',
    '- Re-run with `pnpm perf:baseline` after any render-path changes.',
    '',
  ];
  fs.writeFileSync(mdPath, lines.join('\n'));

  console.log(`\nOutput: ${jsonPath}`);
  console.log(`Output: ${mdPath}`);

  // ── Cleanup ────────────────────────────────────────────────────
  await electronApp.close();
}

run().catch((err) => {
  console.error('Performance baseline failed:', err);
  process.exit(1);
});
