export type FileShortcutAction = 'save' | 'save-as' | 'print';

export function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export function getFileShortcutAction(
  e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey'>
): FileShortcutAction | null {
  const meta = e.ctrlKey || e.metaKey;
  if (!meta) return null;

  const key = e.key.toLowerCase();
  if (key === 's' && e.shiftKey) return 'save-as';
  if (key === 's') return 'save';
  if (key === 'p') return 'print';
  return null;
}

export function saveAsDefaultPath(fileName: string): string {
  return fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`;
}
