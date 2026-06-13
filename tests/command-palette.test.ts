import { describe, expect, it } from 'vitest';
import {
  COMMAND_DEFINITIONS,
  filterCommands,
  isCommandPaletteShortcut,
  type CommandItem,
} from '../src/renderer/lib/command-palette';

function command(id: string, label: string, group: CommandItem['group'] = 'file'): CommandItem {
  return {
    id,
    label,
    labelKey: id,
    group,
    run: () => undefined,
  };
}

describe('command palette helpers', () => {
  it('maps Cmd/Ctrl+K to the command palette shortcut', () => {
    expect(
      isCommandPaletteShortcut({
        key: 'k',
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        altKey: false,
      })
    ).toBe(true);

    expect(
      isCommandPaletteShortcut({
        key: 'K',
        ctrlKey: false,
        metaKey: true,
        shiftKey: false,
        altKey: false,
      })
    ).toBe(true);
  });

  it('ignores modified or unrelated shortcuts', () => {
    expect(
      isCommandPaletteShortcut({
        key: 'k',
        ctrlKey: true,
        metaKey: false,
        shiftKey: true,
        altKey: false,
      })
    ).toBe(false);
    expect(
      isCommandPaletteShortcut({
        key: 's',
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        altKey: false,
      })
    ).toBe(false);
  });

  it('registers the required command groups', () => {
    const ids = COMMAND_DEFINITIONS.map((item) => item.id);

    expect(ids).toEqual(
      expect.arrayContaining([
        'file.open',
        'file.save',
        'file.saveAs',
        'file.print',
        'view.zoomIn',
        'view.zoomOut',
        'view.fitPage',
        'view.fitWidth',
        'view.actualSize',
        'view.handTool',
        'view.selectTool',
        'navigation.nextPage',
        'navigation.previousPage',
        'navigation.goToPage',
        'annotate.highlight',
        'annotate.underline',
        'annotate.strikeout',
        'annotate.note',
        'annotate.addText',
        'app.preferences',
        'app.closeTab',
      ])
    );
  });

  it('filters commands by label, group, and id tokens', () => {
    const commands = [
      command('file.save', 'Save'),
      command('view.fitWidth', 'Fit Width', 'view'),
      command('annotate.highlight', 'Highlight', 'annotate'),
    ];

    expect(filterCommands(commands, 'save').map((item) => item.id)).toEqual(['file.save']);
    expect(filterCommands(commands, 'view width').map((item) => item.id)).toEqual([
      'view.fitWidth',
    ]);
    expect(filterCommands(commands, 'annotate highlight').map((item) => item.id)).toEqual([
      'annotate.highlight',
    ]);
  });
});
