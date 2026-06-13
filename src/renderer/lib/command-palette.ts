import type { AnnotationTool } from '../types/annotation.types';

export type CommandGroup = 'file' | 'view' | 'navigation' | 'annotate' | 'app';

export interface CommandDefinition {
  id: string;
  labelKey: string;
  group: CommandGroup;
  shortcut?: string;
  tool?: AnnotationTool;
  requiresDocument?: boolean;
}

export interface CommandItem extends CommandDefinition {
  label: string;
  disabled?: boolean;
  run: () => void | Promise<void>;
}

export const COMMAND_DEFINITIONS: CommandDefinition[] = [
  { id: 'file.open', labelKey: 'commandPalette.commands.openPdf', group: 'file', shortcut: '⌘O' },
  {
    id: 'file.save',
    labelKey: 'commandPalette.commands.save',
    group: 'file',
    shortcut: '⌘S',
    requiresDocument: true,
  },
  {
    id: 'file.saveAs',
    labelKey: 'commandPalette.commands.saveAs',
    group: 'file',
    shortcut: '⇧⌘S',
    requiresDocument: true,
  },
  {
    id: 'file.print',
    labelKey: 'commandPalette.commands.print',
    group: 'file',
    shortcut: '⌘P',
    requiresDocument: true,
  },
  {
    id: 'view.zoomIn',
    labelKey: 'commandPalette.commands.zoomIn',
    group: 'view',
    shortcut: '⌘+',
    requiresDocument: true,
  },
  {
    id: 'view.zoomOut',
    labelKey: 'commandPalette.commands.zoomOut',
    group: 'view',
    shortcut: '⌘-',
    requiresDocument: true,
  },
  {
    id: 'view.fitPage',
    labelKey: 'commandPalette.commands.fitPage',
    group: 'view',
    shortcut: '⌘0',
    requiresDocument: true,
  },
  {
    id: 'view.fitWidth',
    labelKey: 'commandPalette.commands.fitWidth',
    group: 'view',
    shortcut: '⌘2',
    requiresDocument: true,
  },
  {
    id: 'view.actualSize',
    labelKey: 'commandPalette.commands.actualSize',
    group: 'view',
    shortcut: '⌘1',
    requiresDocument: true,
  },
  {
    id: 'view.handTool',
    labelKey: 'commandPalette.commands.handTool',
    group: 'view',
    tool: 'hand',
    requiresDocument: true,
  },
  {
    id: 'view.selectTool',
    labelKey: 'commandPalette.commands.selectTool',
    group: 'view',
    tool: 'select',
    requiresDocument: true,
  },
  {
    id: 'navigation.nextPage',
    labelKey: 'commandPalette.commands.nextPage',
    group: 'navigation',
    requiresDocument: true,
  },
  {
    id: 'navigation.previousPage',
    labelKey: 'commandPalette.commands.previousPage',
    group: 'navigation',
    requiresDocument: true,
  },
  {
    id: 'navigation.goToPage',
    labelKey: 'commandPalette.commands.goToPage',
    group: 'navigation',
    shortcut: 'G',
    requiresDocument: true,
  },
  {
    id: 'annotate.highlight',
    labelKey: 'commandPalette.commands.highlight',
    group: 'annotate',
    tool: 'highlight',
    requiresDocument: true,
  },
  {
    id: 'annotate.underline',
    labelKey: 'commandPalette.commands.underline',
    group: 'annotate',
    tool: 'underline',
    requiresDocument: true,
  },
  {
    id: 'annotate.strikeout',
    labelKey: 'commandPalette.commands.strikeout',
    group: 'annotate',
    tool: 'strikeout',
    requiresDocument: true,
  },
  {
    id: 'annotate.note',
    labelKey: 'commandPalette.commands.note',
    group: 'annotate',
    tool: 'sticky-note',
    requiresDocument: true,
  },
  {
    id: 'annotate.addText',
    labelKey: 'commandPalette.commands.addText',
    group: 'annotate',
    tool: 'free-text',
    requiresDocument: true,
  },
  {
    id: 'app.preferences',
    labelKey: 'commandPalette.commands.preferences',
    group: 'app',
    shortcut: '⌘,',
  },
  {
    id: 'app.closeTab',
    labelKey: 'commandPalette.commands.closeTab',
    group: 'app',
    shortcut: '⌘W',
    requiresDocument: true,
  },
];

export function isCommandPaletteShortcut(
  e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>
): boolean {
  return (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k';
}

export function filterCommands(commands: CommandItem[], query: string): CommandItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return commands;

  return commands.filter((command) => {
    const haystack = `${command.label} ${command.group} ${command.id}`.toLowerCase();
    return normalized
      .split(/\s+/)
      .filter(Boolean)
      .every((part) => haystack.includes(part));
  });
}
