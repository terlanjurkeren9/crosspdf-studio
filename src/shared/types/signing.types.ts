import { z } from 'zod';

/**
 * Zod schema for digital signing payload.
 * Validates required fields before IPC call.
 */
export const SignDigitalPayloadSchema = z.object({
  /** Absolute path to the source PDF file */
  filePath: z.string().min(1, 'File path is required'),
  /** Absolute path to the .p12 / .pfx certificate file */
  certificatePath: z.string().min(1, 'Certificate path is required'),
  /** Passphrase for the certificate */
  passphrase: z.string().min(1, 'Passphrase is required'),
  /** Output file path where the signed PDF will be written. If empty, returns signed bytes. */
  outputPath: z.string().optional(),
  /** Signer name (optional) */
  name: z.string().optional(),
  /** Signing reason (optional) */
  reason: z.string().optional(),
  /** Signer location (optional) */
  location: z.string().optional(),
  /** Signer contact info (optional) */
  contactInfo: z.string().optional(),
  /** Page number (1-based) where the visible signature appears. Default: 1 */
  page: z.number().int().min(1).default(1),
  /**
   * Widget rectangle [x, y, width, height] in PDF points.
   * x/y must be >= 0, width and height must be > 0.
   * The service converts to PDF rect coordinates [x, y, x+w, y+h] before
   * passing to pdflibAddPlaceholder.
   */
  widgetRect: z
    .tuple([
      z.number().min(0),
      z.number().min(0),
      z.number().positive('Width must be > 0'),
      z.number().positive('Height must be > 0'),
    ])
    .default([50, 50, 200, 50]),
});

export type SignDigitalPayload = z.infer<typeof SignDigitalPayloadSchema>;

export interface SignDigitalResult {
  success: boolean;
  /** Signed PDF bytes (base64-encoded) when outputPath is not set */
  data?: string;
  /** Output path when outputPath was provided */
  outputPath?: string;
  error?: string;
}
