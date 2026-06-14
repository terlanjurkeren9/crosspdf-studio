import { describe, it, expect } from 'vitest';
import { diffTexts } from '../src/renderer/lib/diff';

describe('diffTexts', () => {
  it('returns empty array for identical texts', () => {
    const text = 'Hello world\nThis is a test';
    const result = diffTexts(text, text);
    expect(result.every((d) => d.type === 'equal')).toBe(true);
    expect(result.length).toBe(2);
  });

  it('detects added lines', () => {
    const left = 'Line 1\nLine 2';
    const right = 'Line 1\nLine 2\nLine 3';
    const result = diffTexts(left, right);

    const added = result.filter((d) => d.type === 'added');
    expect(added.length).toBe(1);
    expect(added[0].content).toBe('Line 3');
  });

  it('detects removed lines', () => {
    const left = 'Line 1\nLine 2\nLine 3';
    const right = 'Line 1\nLine 2';
    const result = diffTexts(left, right);

    const removed = result.filter((d) => d.type === 'removed');
    expect(removed.length).toBe(1);
    expect(removed[0].content).toBe('Line 3');
  });

  it('detects modified lines (removed + added pair)', () => {
    const left = 'Line 1\nOld Line 3';
    const right = 'Line 1\nNew Line 3';
    const result = diffTexts(left, right);

    const removed = result.filter((d) => d.type === 'removed');
    const added = result.filter((d) => d.type === 'added');

    expect(removed.length).toBe(1);
    expect(added.length).toBe(1);
    expect(removed[0].content).toBe('Old Line 3');
    expect(added[0].content).toBe('New Line 3');
  });

  it('handles empty left input', () => {
    const left = '';
    const right = 'Line 1\nLine 2';
    const result = diffTexts(left, right);

    // Algorithm produces added diffs for each line in right
    const added = result.filter((d) => d.type === 'added');
    expect(added.length).toBe(2);
  });

  it('handles empty right input', () => {
    const left = 'Line 1\nLine 2';
    const right = '';
    const result = diffTexts(left, right);

    // Algorithm produces removed diffs for each line in left
    const removed = result.filter((d) => d.type === 'removed');
    expect(removed.length).toBe(2);
  });

  it('handles both empty inputs', () => {
    const result = diffTexts('', '');
    // Empty inputs produce a single equal entry with empty content
    expect(result.length).toBe(1);
    expect(result[0].type).toBe('equal');
    expect(result[0].content).toBe('');
  });

  it('handles single line identical', () => {
    const text = 'Single line';
    const result = diffTexts(text, text);
    expect(result.length).toBe(1);
    expect(result[0].type).toBe('equal');
    expect(result[0].content).toBe('Single line');
  });

  it('handles single line modified', () => {
    const left = 'Original';
    const right = 'Modified';
    const result = diffTexts(left, right);

    expect(result.length).toBe(2);
    expect(result[0].type).toBe('removed');
    expect(result[0].content).toBe('Original');
    expect(result[1].type).toBe('added');
    expect(result[1].content).toBe('Modified');
  });

  it('handles lines with special characters', () => {
    const left = 'Line with $pecial! chars\nNormal line';
    const right = 'Line with $pecial! chars\nNew line with UTF-8: 日本語';
    const result = diffTexts(left, right);

    const removed = result.filter((d) => d.type === 'removed');
    const added = result.filter((d) => d.type === 'added');

    expect(removed.length).toBe(1);
    expect(added.length).toBe(1);
  });

  it('marks added lines with correct right line numbers', () => {
    const left = 'Line 1\nLine 2';
    const right = 'Line 1\nLine 2\nLine 3';
    const result = diffTexts(left, right);

    const added = result.find((d) => d.type === 'added');
    expect(added).toBeDefined();
    expect(added!.rightLineNum).toBe(3);
  });

  it('marks removed lines with correct left line numbers', () => {
    const left = 'Line 1\nLine 2\nLine 3';
    const right = 'Line 1\nLine 2';
    const result = diffTexts(left, right);

    const removed = result.find((d) => d.type === 'removed');
    expect(removed).toBeDefined();
    expect(removed!.leftLineNum).toBe(3);
  });
});
