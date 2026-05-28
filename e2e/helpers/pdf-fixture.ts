import path from 'node:path';
import fs from 'node:fs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const FIXTURE_DIR = path.resolve(__dirname, '../.fixtures');

export function getFixtureDir(): string {
  if (!fs.existsSync(FIXTURE_DIR)) {
    fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  }
  return FIXTURE_DIR;
}

export async function createTestPdf(name: string, pageCount = 2): Promise<string> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([612, 792]);
    page.drawText(`E2E Test Page ${i + 1}`, {
      x: 72,
      y: 700,
      size: 14,
      font,
      color: rgb(0, 0, 0),
    });
    page.drawText(`E2E_CONTENT_PAGE_${i + 1}`, {
      x: 72,
      y: 680,
      size: 14,
      font,
      color: rgb(0, 0, 0),
    });
  }

  const bytes = await doc.save();
  const filePath = path.join(getFixtureDir(), name);
  fs.writeFileSync(filePath, bytes);
  return filePath;
}

export async function createViewerFixture(): Promise<string> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  // Page 1 — searchable marker token
  const p1 = doc.addPage([612, 792]);
  p1.drawText('FIXTURE_SEARCH_TOKEN_ALPHA', { x: 72, y: 700, size: 14, font, color: rgb(0, 0, 0) });
  p1.drawText('This is page one of the E2E fixture document.', {
    x: 72,
    y: 670,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });

  // Page 2 — different marker
  const p2 = doc.addPage([612, 792]);
  p2.drawText('FIXTURE_SEARCH_TOKEN_BRAVO', { x: 72, y: 700, size: 14, font, color: rgb(0, 0, 0) });
  p2.drawText('This is page two — navigation target.', {
    x: 72,
    y: 670,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });

  // Page 3 — another marker
  const p3 = doc.addPage([612, 792]);
  p3.drawText('FIXTURE_SEARCH_TOKEN_CHARLIE', {
    x: 72,
    y: 700,
    size: 14,
    font,
    color: rgb(0, 0, 0),
  });
  p3.drawText('End of fixture.', { x: 72, y: 670, size: 12, font, color: rgb(0, 0, 0) });

  const bytes = await doc.save();
  const filePath = path.join(getFixtureDir(), 'viewer-fixture.pdf');
  fs.writeFileSync(filePath, bytes);
  return filePath;
}
