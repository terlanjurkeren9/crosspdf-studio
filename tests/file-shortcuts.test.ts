import { describe, it, expect } from 'vitest';
import { getFileShortcutAction, saveAsDefaultPath } from '../src/renderer/lib/file-shortcuts';

describe('file shortcut helpers', () => {
  it('maps Ctrl/Cmd+S to save', () => {
    expect(
      getFileShortcutAction({ key: 's', ctrlKey: true, metaKey: false, shiftKey: false })
    ).toBe('save');
    expect(
      getFileShortcutAction({ key: 'S', ctrlKey: false, metaKey: true, shiftKey: false })
    ).toBe('save');
  });

  it('maps Ctrl/Cmd+Shift+S to save-as', () => {
    expect(getFileShortcutAction({ key: 's', ctrlKey: true, metaKey: false, shiftKey: true })).toBe(
      'save-as'
    );
  });

  it('maps Ctrl/Cmd+P to print', () => {
    expect(
      getFileShortcutAction({ key: 'p', ctrlKey: true, metaKey: false, shiftKey: false })
    ).toBe('print');
  });

  it('ignores unrelated shortcuts', () => {
    expect(
      getFileShortcutAction({ key: 's', ctrlKey: false, metaKey: false, shiftKey: false })
    ).toBe(null);
    expect(
      getFileShortcutAction({ key: 'o', ctrlKey: true, metaKey: false, shiftKey: false })
    ).toBe(null);
  });

  it('adds a pdf extension for save-as defaults when needed', () => {
    expect(saveAsDefaultPath('document')).toBe('document.pdf');
    expect(saveAsDefaultPath('document.pdf')).toBe('document.pdf');
    expect(saveAsDefaultPath('DOCUMENT.PDF')).toBe('DOCUMENT.PDF');
  });
});
