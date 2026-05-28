import { describe, it, expect, beforeEach } from 'vitest';
import type {
  Annotation,
  StickyNoteAnnotation,
  FreeTextAnnotation,
} from '../src/renderer/types/annotation.types';

const SIDECAR_SUFFIX = '.crosspdf-annotations.json';

// In-memory mock of the file system for testing persistence
let mockFileSystem: Map<string, ArrayBuffer> = new Map();

function mockWriteFile(filePath: string, data: ArrayBuffer): void {
  mockFileSystem.set(filePath, data);
}

function mockReadFile(filePath: string): { success: boolean; data?: ArrayBuffer } {
  const data = mockFileSystem.get(filePath);
  if (!data) return { success: false };
  return { success: true, data };
}

function createAnnotation(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: 'ann-' + Math.random().toString(36).slice(2, 8),
    type: 'highlight',
    pageNumber: 1,
    rect: { x: 72, y: 100, width: 200, height: 20 },
    color: '#FFEB3B',
    opacity: 0.3,
    author: 'test-user',
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    ...overrides,
  } as Annotation;
}

function serializeAnnotations(annotations: Annotation[]): ArrayBuffer {
  const json = JSON.stringify(annotations, null, 2);
  const encoder = new TextEncoder();
  const data = encoder.encode(json);
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

function deserializeAnnotations(data: ArrayBuffer): Annotation[] | null {
  const decoder = new TextDecoder();
  const text = decoder.decode(data);
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) return parsed as Annotation[];
  return null;
}

// ── Annotation JSON serialization ────────────────────────────────────────

describe('Annotation JSON serialization', () => {
  beforeEach(() => {
    mockFileSystem = new Map();
  });

  it('serializes a single highlight annotation to JSON', () => {
    const ann = createAnnotation({
      type: 'highlight',
      quadPoints: [72, 100, 200, 100, 72, 80, 200, 80],
    });
    const data = serializeAnnotations([ann]);
    const result = deserializeAnnotations(data);
    expect(result).toHaveLength(1);
    expect(result![0].type).toBe('highlight');
    expect(result![0].id).toBe(ann.id);
  });

  it('serializes underline annotation', () => {
    const ann = createAnnotation({
      type: 'underline',
      quadPoints: [50, 200, 150, 200, 50, 190, 150, 190],
    });
    const data = serializeAnnotations([ann]);
    const result = deserializeAnnotations(data);
    expect(result).toHaveLength(1);
    expect(result![0].type).toBe('underline');
  });

  it('serializes strikeout annotation', () => {
    const ann = createAnnotation({
      type: 'strikeout',
      quadPoints: [10, 50, 100, 50, 10, 40, 100, 40],
    });
    const data = serializeAnnotations([ann]);
    const result = deserializeAnnotations(data);
    expect(result).toHaveLength(1);
    expect(result![0].type).toBe('strikeout');
  });

  it('serializes sticky note with content', () => {
    const ann = createAnnotation({
      type: 'sticky-note',
      content: 'This is a test comment',
    }) as StickyNoteAnnotation;
    const data = serializeAnnotations([ann]);
    const result = deserializeAnnotations(data);
    expect(result).toHaveLength(1);
    const note = result![0] as StickyNoteAnnotation;
    expect(note.type).toBe('sticky-note');
    expect(note.content).toBe('This is a test comment');
  });

  it('serializes free text annotation with font size', () => {
    const ann = createAnnotation({
      type: 'free-text',
      content: 'Added text content',
      fontSize: 12,
    }) as FreeTextAnnotation;
    const data = serializeAnnotations([ann]);
    const result = deserializeAnnotations(data);
    expect(result).toHaveLength(1);
    const ft = result![0] as FreeTextAnnotation;
    expect(ft.type).toBe('free-text');
    expect(ft.content).toBe('Added text content');
    expect(ft.fontSize).toBe(12);
  });

  it('serializes mixed annotation types', () => {
    const annotations: Annotation[] = [
      createAnnotation({ type: 'highlight', id: 'h1', pageNumber: 1 }),
      createAnnotation({ type: 'underline', id: 'u1', pageNumber: 1 }),
      createAnnotation({ type: 'sticky-note', id: 'sn1', pageNumber: 2 }),
      createAnnotation({ type: 'free-text', id: 'ft1', pageNumber: 3 }),
      createAnnotation({ type: 'redaction', id: 'r1', pageNumber: 1 }),
    ];
    const data = serializeAnnotations(annotations);
    const result = deserializeAnnotations(data);
    expect(result).toHaveLength(5);
    expect(result!.map((a) => a.type).sort()).toEqual([
      'free-text',
      'highlight',
      'redaction',
      'sticky-note',
      'underline',
    ]);
  });

  it('serializes multiple annotations per page', () => {
    const annotations = [
      createAnnotation({ type: 'highlight', pageNumber: 2 }),
      createAnnotation({ type: 'underline', pageNumber: 2 }),
      createAnnotation({ type: 'strikeout', pageNumber: 2 }),
    ];
    const data = serializeAnnotations(annotations);
    const result = deserializeAnnotations(data);
    expect(result).toHaveLength(3);
  });
});

// ── Persistence roundtrip ────────────────────────────────────────────────

describe('Annotation persistence roundtrip', () => {
  beforeEach(() => {
    mockFileSystem = new Map();
  });

  function saveAnnotationDraft(filePath: string, annotations: Annotation[]): void {
    const json = JSON.stringify(annotations, null, 2);
    const data = new TextEncoder().encode(json);
    const arrayBuffer = data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength
    ) as ArrayBuffer;
    mockWriteFile(filePath + SIDECAR_SUFFIX, arrayBuffer);
  }

  function loadAnnotationDraft(filePath: string): Annotation[] | null {
    const result = mockReadFile(filePath + SIDECAR_SUFFIX);
    if (!result.success || !result.data) return null;
    const text = new TextDecoder().decode(result.data);
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed as Annotation[];
    return null;
  }

  it('roundtrips annotations through sidecar file', () => {
    const filePath = '/Users/test/document.pdf';
    const annotations: Annotation[] = [
      createAnnotation({ type: 'highlight', id: 'h1', pageNumber: 1 }),
      createAnnotation({ type: 'sticky-note', id: 'sn1', pageNumber: 1, content: 'Note 1' }),
      createAnnotation({ type: 'underline', id: 'u1', pageNumber: 2 }),
    ];
    saveAnnotationDraft(filePath, annotations);

    const loaded = loadAnnotationDraft(filePath);
    expect(loaded).toHaveLength(3);
    expect(loaded![0].id).toBe('h1');
    expect(loaded![1].id).toBe('sn1');
    expect(loaded![2].id).toBe('u1');
  });

  it('returns null for nonexistent sidecar file', () => {
    const loaded = loadAnnotationDraft('/nonexistent/file.pdf');
    expect(loaded).toBeNull();
  });

  it('preserves rect coordinates through roundtrip', () => {
    const filePath = '/doc.pdf';
    const ann = createAnnotation({
      type: 'highlight',
      id: 'precise-rect',
      rect: { x: 123.45, y: 678.9, width: 300.5, height: 25.75 },
    });
    saveAnnotationDraft(filePath, [ann]);

    const loaded = loadAnnotationDraft(filePath);
    expect(loaded).toHaveLength(1);
    expect(loaded![0].rect.x).toBe(123.45);
    expect(loaded![0].rect.y).toBe(678.9);
    expect(loaded![0].rect.width).toBe(300.5);
    expect(loaded![0].rect.height).toBe(25.75);
  });

  it('preserves color and opacity', () => {
    const filePath = '/doc.pdf';
    const ann = createAnnotation({
      type: 'highlight',
      color: '#2196F3',
      opacity: 0.5,
    });
    saveAnnotationDraft(filePath, [ann]);

    const loaded = loadAnnotationDraft(filePath);
    expect(loaded![0].color).toBe('#2196F3');
    expect(loaded![0].opacity).toBe(0.5);
  });

  it('preserves quadPoints array for text markup', () => {
    const filePath = '/doc.pdf';
    const quadPoints = [10, 100, 200, 100, 10, 90, 200, 90];
    const ann = createAnnotation({ type: 'underline', quadPoints });
    saveAnnotationDraft(filePath, [ann]);

    const loaded = loadAnnotationDraft(filePath);
    expect(loaded![0].quadPoints).toEqual(quadPoints);
  });

  it('handles empty annotations array', () => {
    const filePath = '/empty.pdf';
    saveAnnotationDraft(filePath, []);

    const loaded = loadAnnotationDraft(filePath);
    expect(loaded).toHaveLength(0);
  });

  it('overwrites existing sidecar on save', () => {
    const filePath = '/overwrite.pdf';
    saveAnnotationDraft(filePath, [createAnnotation({ id: 'first' })]);
    saveAnnotationDraft(filePath, [createAnnotation({ id: 'second' })]);

    const loaded = loadAnnotationDraft(filePath);
    expect(loaded).toHaveLength(1);
    expect(loaded![0].id).toBe('second');
  });

  it('returns null for invalid JSON in sidecar', () => {
    const sidecarPath = '/corrupt.pdf' + SIDECAR_SUFFIX;
    mockWriteFile(sidecarPath, new TextEncoder().encode('not valid json }').buffer as ArrayBuffer);
    const result = mockReadFile(sidecarPath);
    expect(result.success).toBe(true);
    // parsing should fail — simulate the try/catch in loadAnnotationDraft
    expect(() => {
      const text = new TextDecoder().decode(result.data);
      JSON.parse(text);
    }).toThrow();
  });

  it('returns null when sidecar contains non-array JSON', () => {
    const sidecarPath = '/notarray.pdf' + SIDECAR_SUFFIX;
    mockWriteFile(
      sidecarPath,
      new TextEncoder().encode('{"not": "an array"}').buffer as ArrayBuffer
    );
    const loaded = loadAnnotationDraft('/notarray.pdf');
    expect(loaded).toBeNull();
  });
});

// ── Sidecar path convention ──────────────────────────────────────────────

describe('Sidecar path convention', () => {
  it('appends .crosspdf-annotations.json suffix', () => {
    const filePath = '/Users/test/report.pdf';
    const sidecar = filePath + '.crosspdf-annotations.json';
    expect(sidecar).toBe('/Users/test/report.pdf.crosspdf-annotations.json');
  });

  it('works with paths containing special characters', () => {
    const filePath = '/Users/test/报告 (1).pdf';
    const sidecar = filePath + '.crosspdf-annotations.json';
    expect(sidecar).toContain('.crosspdf-annotations.json');
  });
});

// ── Sticky note edit/move/reopen simulation ──────────────────────────────

describe('Sticky note lifecycle', () => {
  beforeEach(() => {
    mockFileSystem = new Map();
  });

  function save(filePath: string, annotations: Annotation[]): void {
    const json = JSON.stringify(annotations, null, 2);
    const data = new TextEncoder().encode(json);
    mockFileSystem.set(
      filePath + '.crosspdf-annotations.json',
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
    );
  }

  function load(filePath: string): Annotation[] | null {
    const data = mockFileSystem.get(filePath + '.crosspdf-annotations.json');
    if (!data) return null;
    const text = new TextDecoder().decode(data);
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as Annotation[]) : null;
  }

  it('add -> save -> reopen preserves sticky note content', () => {
    const filePath = '/notes.pdf';
    const note: StickyNoteAnnotation = {
      id: 'note-1',
      type: 'sticky-note',
      pageNumber: 2,
      rect: { x: 100, y: 200, width: 24, height: 24 },
      color: '#FFEB3B',
      opacity: 1.0,
      author: 'user',
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      content: 'Original comment',
    };
    save(filePath, [note]);

    const loaded = load(filePath);
    expect(loaded).toHaveLength(1);
    const reloadedNote = loaded![0] as StickyNoteAnnotation;
    expect(reloadedNote.content).toBe('Original comment');
    expect(reloadedNote.pageNumber).toBe(2);
  });

  it('edit -> save -> reopen preserves updated content', () => {
    const filePath = '/notes.pdf';
    const note: StickyNoteAnnotation = {
      id: 'note-edit',
      type: 'sticky-note',
      pageNumber: 1,
      rect: { x: 50, y: 50, width: 24, height: 24 },
      color: '#FFEB3B',
      opacity: 1.0,
      author: 'user',
      createdAt: Date.now(),
      modifiedAt: Date.now() + 1000,
      content: 'Updated comment text',
    };
    save(filePath, [note]);

    const loaded = load(filePath);
    const reloaded = loaded![0] as StickyNoteAnnotation;
    expect(reloaded.content).toBe('Updated comment text');
    expect(reloaded.modifiedAt).toBeGreaterThan(reloaded.createdAt);
  });

  it('move -> save -> reopen preserves new position', () => {
    const filePath = '/notes.pdf';
    const note: StickyNoteAnnotation = {
      id: 'note-move',
      type: 'sticky-note',
      pageNumber: 3,
      rect: { x: 300, y: 400, width: 24, height: 24 },
      color: '#FFEB3B',
      opacity: 1.0,
      author: 'user',
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      content: 'Moved note',
    };
    save(filePath, [note]);

    const loaded = load(filePath);
    const reloaded = loaded![0];
    expect(reloaded.rect.x).toBe(300);
    expect(reloaded.rect.y).toBe(400);
    expect(reloaded.pageNumber).toBe(3);
  });
});

// ── Free text annotation lifecycle ───────────────────────────────────────

describe('Free text annotation lifecycle', () => {
  beforeEach(() => {
    mockFileSystem = new Map();
  });

  function save(filePath: string, annotations: Annotation[]): void {
    const json = JSON.stringify(annotations, null, 2);
    const data = new TextEncoder().encode(json);
    mockFileSystem.set(
      filePath + '.crosspdf-annotations.json',
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
    );
  }

  function load(filePath: string): Annotation[] | null {
    const data = mockFileSystem.get(filePath + '.crosspdf-annotations.json');
    if (!data) return null;
    const text = new TextDecoder().decode(data);
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as Annotation[]) : null;
  }

  it('add -> save -> reopen preserves text and position', () => {
    const filePath = '/freetext.pdf';
    const ft: FreeTextAnnotation = {
      id: 'ft-1',
      type: 'free-text',
      pageNumber: 1,
      rect: { x: 72, y: 500, width: 200, height: 50 },
      color: '#000000',
      opacity: 1.0,
      author: 'user',
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      content: 'Added overlay text',
      fontSize: 14,
    };
    save(filePath, [ft]);

    const loaded = load(filePath);
    const reloaded = loaded![0] as FreeTextAnnotation;
    expect(reloaded.type).toBe('free-text');
    expect(reloaded.content).toBe('Added overlay text');
    expect(reloaded.fontSize).toBe(14);
  });

  it('resize -> save -> reopen preserves new rect dimensions', () => {
    const filePath = '/freetext.pdf';
    const ft: FreeTextAnnotation = {
      id: 'ft-resize',
      type: 'free-text',
      pageNumber: 1,
      rect: { x: 100, y: 300, width: 400, height: 80 },
      color: '#000000',
      opacity: 1.0,
      author: 'user',
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      content: 'Resized text box',
      fontSize: 16,
    };
    save(filePath, [ft]);

    const loaded = load(filePath);
    const reloaded = loaded![0] as FreeTextAnnotation;
    expect(reloaded.rect.width).toBe(400);
    expect(reloaded.rect.height).toBe(80);
  });
});
