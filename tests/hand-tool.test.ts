import { describe, it, expect, beforeEach } from 'vitest';
import { useAnnotationStore } from '../src/renderer/stores/annotation.store';
import type { AnnotationTool } from '../src/renderer/types/annotation.types';
import { toolCursor } from '../src/renderer/types/annotation.types';
import {
  calculateHandToolPanPosition,
  getAnnotationHitTargetCursor,
  getAnnotationHitTargetPointerEvents,
  getHandToolCursor,
  getHandToolUserSelect,
} from '../src/renderer/lib/hand-tool';

function resetStore() {
  useAnnotationStore.setState({
    activeTool: 'select',
    annotationsByTab: {},
    selectedIds: new Set(),
    undoStacksByTab: {},
    redoStacksByTab: {},
  });
}

describe('Hand tool', () => {
  beforeEach(() => {
    resetStore();
  });

  it('is a valid annotation tool type', () => {
    const tool: AnnotationTool = 'hand';
    expect(tool).toBe('hand');
  });

  it('keeps select as the default active tool', () => {
    expect(useAnnotationStore.getState().activeTool).toBe('select');
  });

  it('can be activated through the annotation store', () => {
    useAnnotationStore.getState().setActiveTool('hand');
    expect(useAnnotationStore.getState().activeTool).toBe('hand');
  });

  it('uses grab cursor metadata for hand tool', () => {
    expect(toolCursor('hand')).toBe('grab');
    expect(getHandToolCursor('hand', false)).toBe('grab');
    expect(getHandToolCursor('hand', true)).toBe('grabbing');
    expect(getHandToolCursor('select', false)).toBe('');
    expect(getHandToolUserSelect('hand')).toBe('none');
    expect(getHandToolUserSelect('select')).toBe('');
  });

  it('calculates drag-to-pan scroll deltas from pointer movement', () => {
    const next = calculateHandToolPanPosition(
      { clientX: 100, clientY: 100, scrollLeft: 20, scrollTop: 30 },
      70,
      40
    );

    expect(next).toEqual({
      scrollLeft: 50,
      scrollTop: 90,
    });
  });

  it('bypasses annotation hit targets while hand is active', () => {
    expect(getAnnotationHitTargetPointerEvents('hand')).toBe('none');
    expect(getAnnotationHitTargetCursor('hand')).toBe('grab');
    expect(getAnnotationHitTargetPointerEvents('select')).toBe('auto');
    expect(getAnnotationHitTargetCursor('select')).toBe('pointer');
  });
});
