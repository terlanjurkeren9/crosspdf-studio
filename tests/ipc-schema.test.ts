import { describe, it, expect } from 'vitest';
import {
  FileReadPayloadSchema,
  FileWritePayloadSchema,
  DbGetPreferencePayloadSchema,
  DbSetPreferencePayloadSchema,
  SystemOpenExternalPayloadSchema,
  OpenDialogOptionsSchema,
  SaveDialogOptionsSchema,
} from '../src/shared/types/ipc.types';

describe('IPC Zod Schemas', () => {
  describe('FileReadPayloadSchema', () => {
    it('accepts valid payload', () => {
      const result = FileReadPayloadSchema.safeParse({ filePath: '/path/to/file.pdf' });
      expect(result.success).toBe(true);
    });

    it('rejects empty filePath', () => {
      const result = FileReadPayloadSchema.safeParse({ filePath: '' });
      expect(result.success).toBe(false);
    });

    it('rejects missing filePath', () => {
      const result = FileReadPayloadSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('FileWritePayloadSchema', () => {
    it('accepts valid payload', () => {
      const buffer = new ArrayBuffer(8);
      const result = FileWritePayloadSchema.safeParse({
        filePath: '/path/to/file.pdf',
        data: buffer,
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing data', () => {
      const result = FileWritePayloadSchema.safeParse({ filePath: '/path/to/file.pdf' });
      expect(result.success).toBe(false);
    });

    it('rejects non-ArrayBuffer data', () => {
      const result = FileWritePayloadSchema.safeParse({
        filePath: '/path/to/file.pdf',
        data: 'not a buffer',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('DbGetPreferencePayloadSchema', () => {
    it('accepts valid key', () => {
      const result = DbGetPreferencePayloadSchema.safeParse({ key: 'theme' });
      expect(result.success).toBe(true);
    });

    it('rejects empty key', () => {
      const result = DbGetPreferencePayloadSchema.safeParse({ key: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('DbSetPreferencePayloadSchema', () => {
    it('accepts valid payload', () => {
      const result = DbSetPreferencePayloadSchema.safeParse({
        key: 'theme',
        value: 'dark',
      });
      expect(result.success).toBe(true);
    });

    it('accepts null value', () => {
      const result = DbSetPreferencePayloadSchema.safeParse({
        key: 'theme',
        value: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('SystemOpenExternalPayloadSchema', () => {
    it('accepts valid https URL', () => {
      const result = SystemOpenExternalPayloadSchema.safeParse({
        url: 'https://example.com',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid URL', () => {
      const result = SystemOpenExternalPayloadSchema.safeParse({ url: 'not-a-url' });
      expect(result.success).toBe(false);
    });
  });

  describe('OpenDialogOptionsSchema', () => {
    it('accepts empty options', () => {
      const result = OpenDialogOptionsSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('accepts with filters', () => {
      const result = OpenDialogOptionsSchema.safeParse({
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('SaveDialogOptionsSchema', () => {
    it('accepts with defaultPath', () => {
      const result = SaveDialogOptionsSchema.safeParse({ defaultPath: '/output.pdf' });
      expect(result.success).toBe(true);
    });
  });
});
