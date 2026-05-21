/**
 * Remove null characters from a string.
 * Mirrors pdfjs-dist/web/pdf_viewer.mjs `removeNullCharacters`.
 */
export function removeNullCharacters(str: string): string {
  return str.replaceAll(String.fromCharCode(0), '');
}
