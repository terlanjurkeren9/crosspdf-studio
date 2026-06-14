import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../ui/Dialog';
import {
  diffTexts,
  type CompareResult,
  type DiffLine,
  type VisualDiffPage,
  type VisualDiffRegion,
} from '../../lib/diff';

interface CompareDialogProps {
  open: boolean;
  onClose: () => void;
}

interface CompareFile {
  path: string;
  name: string;
  bytes: ArrayBuffer;
  text: string;
  pageCount: number;
}

type PdfJsModule = typeof import('pdfjs-dist');

const PREVIEW_WIDTH = 360;
const CELL_SIZE = 16;
const PIXEL_THRESHOLD = 32;

async function loadPdfJs(): Promise<PdfJsModule> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
  ).toString();
  return pdfjsLib;
}

function cloneBytes(bytes: ArrayBuffer): Uint8Array {
  return new Uint8Array(bytes.slice(0));
}

async function extractPdfTextAndCount(
  bytes: ArrayBuffer
): Promise<{ text: string; pageCount: number }> {
  const pdfjsLib = await loadPdfJs();
  const doc = await pdfjsLib.getDocument({ data: cloneBytes(bytes) }).promise;
  const pageTexts: string[] = [];

  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      pageTexts.push(textContent.items.map((item) => ('str' in item ? item.str : '')).join(' '));
      page.cleanup();
    }
    return { text: pageTexts.join('\n'), pageCount: doc.numPages };
  } finally {
    await doc.destroy();
  }
}

async function loadCompareFile(filePath: string): Promise<CompareFile> {
  const readResult = await window.crosspdf.readFile(filePath);
  if (!readResult.success || !readResult.data) {
    throw new Error(readResult.error ?? 'Failed to read file');
  }

  const bytes = readResult.data.slice(0);
  const name = filePath.split(/[/\\]/).pop() ?? filePath;
  const { text, pageCount } = await extractPdfTextAndCount(bytes);

  return { path: filePath, name, bytes, text, pageCount };
}

function compareImageData(
  left: ImageData | null,
  right: ImageData | null
): {
  diffPercent: number;
  regions: VisualDiffRegion[];
} {
  if (!left || !right) {
    return { diffPercent: 100, regions: [] };
  }

  const width = Math.min(left.width, right.width);
  const height = Math.min(left.height, right.height);
  const cols = Math.ceil(width / CELL_SIZE);
  const rows = Math.ceil(height / CELL_SIZE);
  const changed = new Set<string>();
  let changedPixels = 0;
  let totalPixels = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const leftIndex = (y * left.width + x) * 4;
      const rightIndex = (y * right.width + x) * 4;
      const delta =
        Math.abs(left.data[leftIndex] - right.data[rightIndex]) +
        Math.abs(left.data[leftIndex + 1] - right.data[rightIndex + 1]) +
        Math.abs(left.data[leftIndex + 2] - right.data[rightIndex + 2]);

      if (delta > PIXEL_THRESHOLD) {
        changedPixels++;
        changed.add(`${Math.floor(x / CELL_SIZE)},${Math.floor(y / CELL_SIZE)}`);
      }
      totalPixels++;
    }
  }

  const regions: VisualDiffRegion[] = [];
  const visited = new Set<string>();

  for (const key of changed) {
    if (visited.has(key)) continue;

    const queue = [key];
    visited.add(key);
    let minCol = Number.POSITIVE_INFINITY;
    let minRow = Number.POSITIVE_INFINITY;
    let maxCol = 0;
    let maxRow = 0;

    while (queue.length > 0) {
      const current = queue.pop();
      if (!current) continue;
      const [col, row] = current.split(',').map(Number);
      minCol = Math.min(minCol, col);
      minRow = Math.min(minRow, row);
      maxCol = Math.max(maxCol, col);
      maxRow = Math.max(maxRow, row);

      for (const [nextCol, nextRow] of [
        [col - 1, row],
        [col + 1, row],
        [col, row - 1],
        [col, row + 1],
      ]) {
        if (nextCol < 0 || nextRow < 0 || nextCol >= cols || nextRow >= rows) continue;
        const nextKey = `${nextCol},${nextRow}`;
        if (changed.has(nextKey) && !visited.has(nextKey)) {
          visited.add(nextKey);
          queue.push(nextKey);
        }
      }
    }

    regions.push({
      x: Math.max(0, minCol * CELL_SIZE),
      y: Math.max(0, minRow * CELL_SIZE),
      width: Math.min(width - minCol * CELL_SIZE, (maxCol - minCol + 1) * CELL_SIZE),
      height: Math.min(height - minRow * CELL_SIZE, (maxRow - minRow + 1) * CELL_SIZE),
    });
  }

  return {
    diffPercent: totalPixels === 0 ? 0 : (changedPixels / totalPixels) * 100,
    regions: regions.sort((a, b) => b.width * b.height - a.width * a.height).slice(0, 16),
  };
}

async function renderPageToPreview(
  doc: import('pdfjs-dist').PDFDocumentProxy,
  pageNumber: number
): Promise<{ imageUrl: string; imageData: ImageData; width: number; height: number }> {
  const page = await doc.getPage(pageNumber);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(1, PREVIEW_WIDTH / baseViewport.width);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas rendering is unavailable');

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvas, canvasContext: context, viewport }).promise;

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const imageUrl = canvas.toDataURL('image/png');
  page.cleanup();

  return { imageUrl, imageData, width: canvas.width, height: canvas.height };
}

async function buildVisualDiff(
  leftBytes: ArrayBuffer,
  rightBytes: ArrayBuffer
): Promise<VisualDiffPage[]> {
  const pdfjsLib = await loadPdfJs();
  const leftDoc = await pdfjsLib.getDocument({ data: cloneBytes(leftBytes) }).promise;
  const rightDoc = await pdfjsLib.getDocument({ data: cloneBytes(rightBytes) }).promise;
  const pageCount = Math.max(leftDoc.numPages, rightDoc.numPages);
  const pages: VisualDiffPage[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      const leftPreview =
        pageNumber <= leftDoc.numPages ? await renderPageToPreview(leftDoc, pageNumber) : null;
      const rightPreview =
        pageNumber <= rightDoc.numPages ? await renderPageToPreview(rightDoc, pageNumber) : null;
      const visual = compareImageData(
        leftPreview?.imageData ?? null,
        rightPreview?.imageData ?? null
      );
      const status = !leftPreview
        ? 'added'
        : !rightPreview
          ? 'removed'
          : visual.diffPercent > 0.15
            ? 'changed'
            : 'equal';

      pages.push({
        pageNumber,
        leftImageUrl: leftPreview?.imageUrl ?? null,
        rightImageUrl: rightPreview?.imageUrl ?? null,
        width: Math.max(leftPreview?.width ?? 0, rightPreview?.width ?? 0),
        height: Math.max(leftPreview?.height ?? 0, rightPreview?.height ?? 0),
        diffPercent: visual.diffPercent,
        regions: visual.regions,
        status,
      });
    }
  } finally {
    await leftDoc.destroy();
    await rightDoc.destroy();
  }

  return pages;
}

export function CompareDialog({ open, onClose }: CompareDialogProps) {
  const { t } = useTranslation();
  const [leftFile, setLeftFile] = useState<CompareFile | null>(null);
  const [rightFile, setRightFile] = useState<CompareFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [view, setView] = useState<'text' | 'visual'>('text');

  const handleSelectFile = useCallback(async (side: 'left' | 'right') => {
    try {
      const selected = await window.crosspdf.openFileDialog({
        filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
      });
      if (selected.canceled || selected.filePaths.length === 0) return;

      setLoading(true);
      setError(null);
      setResult(null);

      const file = await loadCompareFile(selected.filePaths[0]);
      if (side === 'left') {
        setLeftFile(file);
      } else {
        setRightFile(file);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCompare = useCallback(async () => {
    if (!leftFile || !rightFile) return;

    setLoading(true);
    setError(null);

    try {
      const diffs = diffTexts(leftFile.text, rightFile.text);
      const visualPages = await buildVisualDiff(leftFile.bytes, rightFile.bytes);
      const stats = {
        added: diffs.filter((d) => d.type === 'added').length,
        removed: diffs.filter((d) => d.type === 'removed').length,
        equal: diffs.filter((d) => d.type === 'equal').length,
        total: diffs.length,
        visualChanged: visualPages.filter((page) => page.status !== 'equal').length,
      };

      setResult({
        leftText: leftFile.text,
        rightText: rightFile.text,
        leftFileName: leftFile.name,
        rightFileName: rightFile.name,
        leftPageCount: leftFile.pageCount,
        rightPageCount: rightFile.pageCount,
        diffs,
        visualPages,
        stats,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compare documents');
    } finally {
      setLoading(false);
    }
  }, [leftFile, rightFile]);

  const handleReset = useCallback(() => {
    setLeftFile(null);
    setRightFile(null);
    setResult(null);
    setError(null);
    setView('text');
  }, []);

  const renderDiffLine = (line: DiffLine, side: 'left' | 'right') => {
    const isLeft = side === 'left';
    const lineNum = isLeft ? line.leftLineNum : line.rightLineNum;
    const showContent = isLeft ? line.type !== 'added' : line.type !== 'removed';
    let bgColor = 'bg-transparent';
    if (line.type === 'added' && !isLeft) bgColor = 'bg-green-100 dark:bg-green-900/30';
    if (line.type === 'removed' && isLeft) bgColor = 'bg-red-100 dark:bg-red-900/30';

    return (
      <div
        key={`${side}-${line.leftLineNum ?? 'x'}-${line.rightLineNum ?? 'x'}-${line.content}`}
        className={`flex min-h-5 text-xs font-mono ${bgColor}`}
      >
        <span className="w-12 shrink-0 px-2 py-0.5 text-right text-surface-400 select-none">
          {lineNum ?? ''}
        </span>
        <span className="flex-1 px-2 py-0.5 whitespace-pre-wrap break-words">
          {showContent ? line.content : ''}
        </span>
      </div>
    );
  };

  const renderVisualPane = (imageUrl: string | null, page: VisualDiffPage, emptyLabel: string) => (
    <div className="min-w-0 flex-1 rounded border border-surface-200 bg-surface-50 p-2 dark:border-surface-700 dark:bg-surface-900">
      <div className="relative mx-auto" style={{ width: page.width || PREVIEW_WIDTH }}>
        {imageUrl ? (
          <img src={imageUrl} alt="" className="block w-full select-none" draggable={false} />
        ) : (
          <div
            className="flex items-center justify-center text-xs text-surface-400"
            style={{ height: page.height || 480 }}
          >
            {emptyLabel}
          </div>
        )}
        {imageUrl &&
          page.regions.map((region, index) => (
            <span
              key={`${page.pageNumber}-${index}`}
              className="pointer-events-none absolute border-2 border-red-500 bg-red-500/15"
              style={{
                left: region.x,
                top: region.y,
                width: region.width,
                height: region.height,
              }}
            />
          ))}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onClose={onClose} title={t('compare.title', 'Compare Documents')}>
      <div className="w-[min(92vw,1100px)]">
        {!result ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {(['left', 'right'] as const).map((side) => {
                const file = side === 'left' ? leftFile : rightFile;
                const label =
                  side === 'left'
                    ? t('compare.leftFile', 'Original (Left)')
                    : t('compare.rightFile', 'Modified (Right)');

                return (
                  <div key={side} className="min-w-0">
                    <label className="mb-1 block text-xs font-medium text-surface-500">
                      {label}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={file?.name ?? ''}
                        readOnly
                        placeholder={t('compare.selectFile', 'Select PDF...')}
                        className="h-8 min-w-0 flex-1 rounded border border-surface-300 bg-white px-2 text-xs dark:border-surface-600 dark:bg-surface-800"
                      />
                      <button
                        type="button"
                        onClick={() => handleSelectFile(side)}
                        className="h-8 px-3 text-xs font-medium rounded bg-surface-100 hover:bg-surface-200 dark:bg-surface-700 dark:hover:bg-surface-600"
                      >
                        {t('common.open', 'Open')}
                      </button>
                    </div>
                    {file && (
                      <p className="mt-1 text-[10px] text-surface-400">
                        {file.pageCount} {file.pageCount === 1 ? 'page' : 'pages'}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {error && (
              <div className="mt-4 rounded bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/30">
                {error}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-8 rounded border border-surface-300 px-4 text-xs font-medium hover:bg-surface-100 dark:border-surface-600 dark:hover:bg-surface-700"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleCompare}
                disabled={!leftFile || !rightFile || loading}
                className="h-8 rounded bg-brand-500 px-4 text-xs font-medium text-white hover:bg-brand-600 disabled:pointer-events-none disabled:opacity-30"
              >
                {loading ? t('common.loading', 'Loading...') : t('compare.compare', 'Compare')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-surface-500">
              <span className="text-green-600">+{result.stats.added} added</span>
              <span className="text-red-600">-{result.stats.removed} removed</span>
              <span>{result.stats.equal} unchanged</span>
              <span>
                {result.stats.visualChanged}/{result.visualPages.length} pages visually changed
              </span>
            </div>

            <div className="mb-3 flex min-w-0 items-center gap-2 text-[10px] text-surface-400">
              <span className="truncate font-medium">
                {result.leftFileName} ({result.leftPageCount})
              </span>
              <span>vs</span>
              <span className="truncate font-medium">
                {result.rightFileName} ({result.rightPageCount})
              </span>
            </div>

            <div className="mb-3 flex gap-1 rounded bg-surface-100 p-1 dark:bg-surface-800">
              <button
                type="button"
                onClick={() => setView('text')}
                className={`h-7 rounded px-3 text-xs font-medium ${
                  view === 'text' ? 'bg-white shadow-sm dark:bg-surface-700' : 'text-surface-500'
                }`}
              >
                Text Diff
              </button>
              <button
                type="button"
                onClick={() => setView('visual')}
                className={`h-7 rounded px-3 text-xs font-medium ${
                  view === 'visual' ? 'bg-white shadow-sm dark:bg-surface-700' : 'text-surface-500'
                }`}
              >
                Visual Overlay
              </button>
            </div>

            {view === 'text' ? (
              <div className="flex max-h-[52vh] gap-2 overflow-auto rounded border border-surface-200 dark:border-surface-700">
                <div className="min-w-[360px] flex-1 overflow-auto">
                  {result.diffs.map((line) => renderDiffLine(line, 'left'))}
                </div>
                <div className="w-px shrink-0 bg-surface-200 dark:bg-surface-700" />
                <div className="min-w-[360px] flex-1 overflow-auto">
                  {result.diffs.map((line) => renderDiffLine(line, 'right'))}
                </div>
              </div>
            ) : (
              <div className="max-h-[58vh] space-y-4 overflow-auto pr-1">
                {result.visualPages.map((page) => (
                  <section key={page.pageNumber}>
                    <div className="mb-1 flex items-center justify-between text-xs text-surface-500">
                      <span>Page {page.pageNumber}</span>
                      <span>
                        {page.status === 'equal'
                          ? 'No visual difference'
                          : `${page.diffPercent.toFixed(2)}% different`}
                      </span>
                    </div>
                    <div className="flex min-w-[720px] gap-3">
                      {renderVisualPane(page.leftImageUrl, page, 'Missing page')}
                      {renderVisualPane(page.rightImageUrl, page, 'Missing page')}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {error && (
              <div className="mt-4 rounded bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/30">
                {error}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="h-8 rounded border border-surface-300 px-4 text-xs font-medium hover:bg-surface-100 dark:border-surface-600 dark:hover:bg-surface-700"
              >
                {t('compare.compareAgain', 'Compare Again')}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="h-8 rounded bg-brand-500 px-4 text-xs font-medium text-white hover:bg-brand-600"
              >
                {t('common.close', 'Close')}
              </button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
