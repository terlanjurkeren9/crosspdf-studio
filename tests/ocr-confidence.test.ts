import { describe, expect, it } from 'vitest';

/**
 * Confidence normalization: Tesseract returns 0–100, but the internal contract
 * stores 0–1. This helper normalizes and clamps safely.
 */
function normalizeConfidence(raw: number | undefined | null): number {
  const val = raw ?? 0;
  if (!Number.isFinite(val)) return 0;
  // If value > 1, assume 0–100 scale from Tesseract
  const normalized = val > 1 ? val / 100 : val;
  return Math.max(0, Math.min(1, normalized));
}

function formatConfidencePct(confidence: number): string {
  return `${(confidence * 100).toFixed(0)}%`;
}

function formatConfidencePctDecimal(confidence: number): string {
  return `${(confidence * 100).toFixed(1)}%`;
}

describe('normalizeConfidence', () => {
  it('passes through 0–1 values unchanged', () => {
    expect(normalizeConfidence(0)).toBe(0);
    expect(normalizeConfidence(0.5)).toBe(0.5);
    expect(normalizeConfidence(0.95)).toBe(0.95);
    expect(normalizeConfidence(1)).toBe(1);
  });

  it('converts 0–100 values to 0–1', () => {
    expect(normalizeConfidence(95)).toBeCloseTo(0.95);
    expect(normalizeConfidence(50)).toBe(0.5);
    expect(normalizeConfidence(100)).toBe(1);
    expect(normalizeConfidence(0)).toBe(0);
  });

  it('handles edge case: exactly 1.0 stays 1.0', () => {
    expect(normalizeConfidence(1.0)).toBe(1);
  });

  it('clamps above 1 after normalization', () => {
    // e.g. raw=200 → 2.0 → clamp to 1
    expect(normalizeConfidence(200)).toBe(1);
  });

  it('handles undefined/null as 0', () => {
    expect(normalizeConfidence(undefined)).toBe(0);
    expect(normalizeConfidence(null)).toBe(0);
  });

  it('handles NaN gracefully', () => {
    // NaN > 1 is false, so stays NaN; clamp produces 0
    expect(normalizeConfidence(NaN)).toBe(0);
  });
});

describe('formatConfidencePct', () => {
  it('formats 0.95 as 95%', () => {
    expect(formatConfidencePct(0.95)).toBe('95%');
  });

  it('formats 0 as 0%', () => {
    expect(formatConfidencePct(0)).toBe('0%');
  });

  it('does not produce values above 100%', () => {
    expect(formatConfidencePct(0.95)).toBe('95%');
    // 95 as raw (pre-normalization) — caller must normalize first
    // After normalization 95 → 0.95 → format gives '95%'
    expect(formatConfidencePct(normalizeConfidence(95))).toBe('95%');
  });
});

describe('formatConfidencePctDecimal', () => {
  it('formats 0.95 as 95.0%', () => {
    expect(formatConfidencePctDecimal(0.95)).toBe('95.0%');
  });
});
