import { describe, it, expect } from 'vitest';

/**
 * Test preference value serialization/deserialization logic.
 *
 * These tests validate the JSON round-trip behavior that the
 * preferences.repo.ts module relies on, without requiring a
 * running SQLite database.
 */

function serializePreference(value: unknown): string {
  return JSON.stringify(value);
}

function deserializePreference(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

describe('Preference serialization', () => {
  describe('serializePreference', () => {
    it('serializes string', () => {
      expect(serializePreference('hello')).toBe('"hello"');
    });

    it('serializes number', () => {
      expect(serializePreference(42)).toBe('42');
    });

    it('serializes boolean', () => {
      expect(serializePreference(true)).toBe('true');
    });

    it('serializes object', () => {
      expect(serializePreference({ a: 1, b: 'two' })).toBe('{"a":1,"b":"two"}');
    });

    it('serializes array', () => {
      expect(serializePreference([1, 2, 3])).toBe('[1,2,3]');
    });

    it('serializes null', () => {
      expect(serializePreference(null)).toBe('null');
    });
  });

  describe('deserializePreference', () => {
    it('deserializes JSON string', () => {
      expect(deserializePreference('"hello"')).toBe('hello');
    });

    it('deserializes JSON number', () => {
      expect(deserializePreference('42')).toBe(42);
    });

    it('deserializes JSON object', () => {
      expect(deserializePreference('{"a":1}')).toEqual({ a: 1 });
    });

    it('returns raw string for non-JSON input', () => {
      expect(deserializePreference('not-json')).toBe('not-json');
    });

    it('round-trips complex object', () => {
      const original = { theme: 'dark', sidebarWidth: 280, panels: ['thumbnails', 'search'] };
      const serialized = serializePreference(original);
      const deserialized = deserializePreference(serialized);
      expect(deserialized).toEqual(original);
    });
  });
});
