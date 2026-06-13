import { describe, it, expect } from 'vitest';
import { checkWriteResult } from '../src/renderer/lib/batch-merge';

describe('checkWriteResult', () => {
  it('does not throw when write succeeds', () => {
    expect(() => checkWriteResult({ success: true })).not.toThrow();
  });

  it('throws with error message when write fails', () => {
    expect(() => checkWriteResult({ success: false, error: 'Disk full' })).toThrow('Disk full');
  });

  it('throws generic message when write fails without error string', () => {
    expect(() => checkWriteResult({ success: false })).toThrow('Failed to write output file.');
  });

  it('throws generic message when write fails with empty error', () => {
    expect(() => checkWriteResult({ success: false, error: '' })).toThrow(
      'Failed to write output file.'
    );
  });
});
