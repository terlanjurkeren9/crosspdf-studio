/**
 * Export service for OCR text and other export operations.
 */

export function formatOcrExport(
  results: Array<{ pageNumber: number; text: string; confidence: number }>,
  options: { includePageNumbers?: boolean; includeConfidence?: boolean } = {}
): string {
  const parts: string[] = [];

  for (const r of results) {
    if (options.includePageNumbers) {
      parts.push(`--- Page ${r.pageNumber} ---\n`);
      if (options.includeConfidence) {
        parts.push(`(confidence: ${(r.confidence * 100).toFixed(1)}%)\n\n`);
      }
    }
    parts.push(r.text);
    parts.push('\n\n');
  }

  return parts.join('');
}

export async function saveOcrText(
  text: string,
  defaultFileName: string
): Promise<string> {
  const result = await window.crosspdf.saveTextFile(defaultFileName, text);
  if (!result.success) {
    throw new Error(result.error ?? 'Failed to save text file');
  }
  return result.filePath ?? '';
}
