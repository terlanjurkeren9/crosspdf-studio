import { z } from 'zod';

// ── Zod Schemas ─────────────────────────────────────────────────

export const OpenDialogOptionsSchema = z.object({
  title: z.string().optional(),
  filters: z
    .array(
      z.object({
        name: z.string(),
        extensions: z.array(z.string()),
      })
    )
    .optional(),
  multiSelections: z.boolean().optional(),
  properties: z.array(z.string()).optional(),
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

export const PdfEncryptPayloadSchema = z.object({
  filePath: z.string().min(1),
  userPassword: z.string().min(1),
  ownerPassword: z.string().optional(),
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
  canceled?: boolean;
  filePath?: string;
  error?: string;
}

// ── Auto-Update Types ──────────────────────────────────────────

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdateProgressInfo {
  percent: number;
  transferred: number;
  total: number;
}

export interface UpdateState {
  status: UpdateStatus;
  version?: string;
  progress?: UpdateProgressInfo;
  error?: string;
}

export interface UpdateStatusResult {
  state: UpdateState;
}

const VALID_UPDATE_STATUSES: ReadonlySet<string> = new Set([
  'idle',
  'checking',
  'available',
  'not-available',
  'downloading',
  'downloaded',
  'error',
]);

export function sanitizeUpdateState(raw: unknown): UpdateState {
  if (typeof raw !== 'object' || raw === null) {
    return { status: 'error', error: 'Invalid update state payload' };
  }

  const obj = raw as Record<string, unknown>;
  const status = obj.status;

  if (typeof status !== 'string' || !VALID_UPDATE_STATUSES.has(status)) {
    return { status: 'error', error: 'Invalid update status value' };
  }

  const result: UpdateState = { status: status as UpdateStatus };

  if (typeof obj.version === 'string') {
    result.version = obj.version;
  }

  if (typeof obj.error === 'string') {
    result.error = obj.error;
  }

  if (typeof obj.progress === 'object' && obj.progress !== null) {
    const p = obj.progress as Record<string, unknown>;
    if (typeof p.percent === 'number' && Number.isFinite(p.percent)) {
      result.progress = {
        percent: p.percent,
        transferred: typeof p.transferred === 'number' ? p.transferred : 0,
        total: typeof p.total === 'number' ? p.total : 0,
      };
    }
  }

  return result;
}
