import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

import type { SignDigitalPayload, SignDigitalResult } from '@shared/types/signing.types';

/* ------------------------------------------------------------------ */
/*  Lazy module loader via createRequire                               */
/*                                                                     */
/*  Loads @signpdf deps lazily at runtime via Node's native CJS        */
/*  require(), bypassing Vite's bundler entirely. This avoids          */
/*  Vite bundling node-forge/tslib (transitive deps of @signpdf)       */
/*  into the main chunk, which causes the "__extends" destructure      */
/*  runtime crash.                                                     */
/*                                                                     */
/*  __dirname is available in both Vite CJS build output and Vitest.   */
/* ------------------------------------------------------------------ */

/* eslint-disable @typescript-eslint/no-explicit-any */

declare let __dirname: string | undefined;

let _loaded = false;
let _signPdf: any = null;
let _pdflibAddPlaceholder: any = null;
let _P12Signer: any = null;
let _PDFDocument: any = null;

function loadModules() {
  if (_loaded) {
    return {
      signPdf: _signPdf,
      pdflibAddPlaceholder: _pdflibAddPlaceholder,
      P12Signer: _P12Signer,
      PDFDocument: _PDFDocument,
    };
  }

  const resolveFrom =
    typeof __dirname === 'string'
      ? __dirname + '/dummy.cjs'
      : process.cwd() + '/node_modules/dummy.cjs';

  const req = createRequire(resolveFrom);
  const { SignPdf } = req('@signpdf/signpdf');
  const { pdflibAddPlaceholder: Placeholder } = req('@signpdf/placeholder-pdf-lib');
  const { P12Signer: P12 } = req('@signpdf/signer-p12');
  const { PDFDocument: PdfDoc } = req('pdf-lib');
  _signPdf = new SignPdf();
  _pdflibAddPlaceholder = Placeholder;
  _P12Signer = P12;
  _PDFDocument = PdfDoc;
  _loaded = true;

  return {
    signPdf: _signPdf,
    pdflibAddPlaceholder: _pdflibAddPlaceholder,
    P12Signer: _P12Signer,
    PDFDocument: _PDFDocument,
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Validate that the file starts with a PDF header (%PDF-).
 * Returns null if valid, or an error string if not.
 */
function validatePdfHeader(filePath: string): string | null {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(8);
    const bytesRead = fs.readSync(fd, buf, 0, 8, 0);
    if (bytesRead < 5) {
      return 'File is too small to be a valid PDF';
    }
    const header = buf.toString('ascii', 0, 5);
    if (header !== '%PDF-') {
      return 'File does not have a valid PDF header';
    }
    return null;
  } finally {
    fs.closeSync(fd);
  }
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Digitally sign a PDF using a P12/PFX certificate.
 * Produces a PAdES-B-B (CMS signed data) compliant signature with
 * visible signature annotation field. No timestamp/LTV.
 *
 * Pipeline (all deps loaded lazily at runtime):
 *  1. Load PDF via pdf-lib
 *  2. Add placeholder (signature field + widget annotation) via pdflibAddPlaceholder
 *  3. Serialize to bytes
 *  4. Sign with P12Signer (node-forge under the hood)
 *  5. Write signed bytes to outputPath or return as base64
 */
export async function signPdfDigital(payload: SignDigitalPayload): Promise<SignDigitalResult> {
  const {
    filePath,
    certificatePath,
    passphrase,
    outputPath,
    name,
    reason,
    location,
    contactInfo,
    page,
    widgetRect,
  } = payload;

  // Basic input validation
  if (!fs.existsSync(filePath)) {
    return { success: false, error: `File not found: ${filePath}` };
  }
  if (!fs.existsSync(certificatePath)) {
    return { success: false, error: `Certificate not found: ${certificatePath}` };
  }

  const headerError = validatePdfHeader(filePath);
  if (headerError) {
    return { success: false, error: headerError };
  }

  try {
    // Lazy-load all signing modules at runtime (avoids Vite bundling issues)
    const { signPdf, pdflibAddPlaceholder, P12Signer, PDFDocument } = loadModules();

    // 1. Read source PDF bytes
    const pdfBytes = fs.readFileSync(filePath);

    // 2. Load with pdf-lib
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

    // Validate page exists
    const pageCount = pdfDoc.getPageCount();
    const pageIndex = page - 1;
    if (pageIndex < 0 || pageIndex >= pageCount) {
      return {
        success: false,
        error: `Invalid page number ${page}. PDF has ${pageCount} page(s).`,
      };
    }

    // Get target page for annotation
    const pdfPage = pdfDoc.getPage(pageIndex);

    // Convert [x, y, width, height] → PDF rect [x1, y1, x2, y2]
    const [rx, ry, rw, rh] = widgetRect;
    const pdfRect: [number, number, number, number] = [rx, ry, rx + rw, ry + rh];

    pdflibAddPlaceholder({
      pdfDoc,
      pdfPage,
      name: name ?? '',
      reason: reason ?? '',
      location: location ?? '',
      contactInfo: contactInfo ?? '',
      widgetRect: pdfRect,
      signatureLength: 8192,
      subFilter: 'adbe.pkcs7.detached',
    });

    // 3. Serialize (placeholder bytes → Buffer)
    const placeholderBytes = Buffer.from(await pdfDoc.save());

    // 4. Create P12 signer
    const certBytes = fs.readFileSync(certificatePath);
    const signer = new P12Signer(certBytes, { passphrase });

    // 5. Sign (returns Buffer with full CMS signature)
    const signedBuffer = await signPdf.sign(placeholderBytes, signer);

    // 6. Write or return
    if (outputPath) {
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(outputPath, signedBuffer);
      return { success: true, outputPath };
    }

    return { success: true, data: signedBuffer.toString('base64') };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // Sanitize: never leak passphrase or cert secrets
    const sanitized = message.replace(passphrase, '***');
    return { success: false, error: `Signing failed: ${sanitized}` };
  }
}
