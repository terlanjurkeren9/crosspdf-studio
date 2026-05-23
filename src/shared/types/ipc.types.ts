import { z } from 'zod';

// ── Zod Schemas ─────────────────────────────────────────────────

export const OpenDialogOptionsSchema = z.object({
  filters: z
    .array(
      z.object({
        name: z.string(),
        extensions: z.array(z.string()),
      })
    )
    .optional(),
  multiSelections: z.boolean().optional(),
});

export const SaveDialogOptionsSchema = z.object({
  defaultPath: z.string().optional(),
  filters: z
    .array(
      z.object({
        name: z.string(),
        extensions: z.array(z.string()),
      })
    )
    .optional(),
});

export const FileReadPayloadSchema = z.object({
  filePath: z.string().min(1),
});

export const FileWritePayloadSchema = z.object({
  filePath: z.string().min(1),
  data: z.instanceof(ArrayBuffer),
});

export const DbGetPreferencePayloadSchema = z.object({
  key: z.string().min(1),
});

export const DbSetPreferencePayloadSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
});

export const RecentUpsertPayloadSchema = z.object({
  filePath: z.string().min(1),
  fileName: z.string().min(1),
  fileSize: z.number().optional(),
  pageCount: z.number().optional(),
});

export const SystemOpenExternalPayloadSchema = z.object({
  url: z.string().url(),
});

export const PdfCheckEncryptedPayloadSchema = z.object({
  filePath: z.string().min(1),
});

export const PdfPasswordPayloadSchema = z.object({
  filePath: z.string().min(1),
  password: z.string().min(1),
});

export const ExportSaveTextPayloadSchema = z.object({
  defaultPath: z.string(),
  text: z.string(),
});

// ── Derived Types ──────────────────────────────────────────────

export type OpenDialogOptions = z.infer<typeof OpenDialogOptionsSchema>;
export type SaveDialogOptions = z.infer<typeof SaveDialogOptionsSchema>;

// ── Result Types ───────────────────────────────────────────────

export interface OpenDialogResult {
  canceled: boolean;
  filePaths: string[];
}

export interface SaveDialogResult {
  canceled: boolean;
  filePath: string | null;
}

export interface ReadFileResult {
  success: boolean;
  data?: ArrayBuffer;
  error?: string;
}

export interface WriteFileResult {
  success: boolean;
  error?: string;
}

export interface PlatformInfo {
  platform: string;
  arch: string;
  version: string;
  electronVersion: string;
  chromeVersion: string;
  nodeVersion: string;
}

export interface RecentDocumentResult {
  id: number;
  filePath: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  pinned: number;
  lastOpened: string;
}

export interface PdfCheckEncryptedResult {
  success: boolean;
  isEncrypted?: boolean;
  error?: string;
}

export interface PdfPasswordResult {
  success: boolean;
  data?: ArrayBuffer;
  error?: string;
}

export interface ExportSaveTextResult {
  success: boolean;
  filePath?: string;
  error?: string;
}
