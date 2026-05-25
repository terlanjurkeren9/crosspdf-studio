import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const execFileAsync = promisify(execFile);

export interface QpdfStatus {
  available: boolean;
  path?: string;
  version?: string;
  error?: string;
}

let cachedStatus: QpdfStatus | null = null;

function getBinaryName(): string {
  return os.platform() === 'win32' ? 'qpdf.exe' : 'qpdf';
}

function getPlatformDir(): string | null {
  const platform = os.platform();
  const arch = os.arch();
  if (platform === 'darwin' && arch === 'arm64') return 'darwin-arm64';
  if (platform === 'darwin' && arch === 'x64') return 'darwin-x64';
  if (platform === 'win32' && arch === 'x64') return 'win-x64';
  return null;
}

export function resolveQpdfPath(): string | null {
  if (app.isPackaged) {
    const platformDir = getPlatformDir();
    if (!platformDir) return null;
    const bundledPath = path.join(process.resourcesPath, platformDir, getBinaryName());
    if (fs.existsSync(bundledPath)) return bundledPath;
    return null;
  }

  const projectRoot = path.resolve(app.getAppPath());
  const platformDir = getPlatformDir();
  if (platformDir) {
    const devBundledPath = path.join(projectRoot, 'resources', platformDir, getBinaryName());
    if (fs.existsSync(devBundledPath)) return devBundledPath;
  }

  return null;
}

export async function checkQpdfAvailable(): Promise<QpdfStatus> {
  if (cachedStatus) return cachedStatus;

  const qpdfPath = resolveQpdfPath();
  if (!qpdfPath) {
    const platformDir = getPlatformDir();
    cachedStatus = {
      available: false,
      error: platformDir
        ? `QPDF binary not found at resources/${platformDir}/${getBinaryName()}`
        : `QPDF not supported on ${os.platform()}-${os.arch()}`,
    };
    return cachedStatus;
  }

  try {
    const { stdout } = await execFileAsync(qpdfPath, ['--version'], { timeout: 5000 });
    const versionLine = stdout.split('\n')[0] || '';
    cachedStatus = {
      available: true,
      path: qpdfPath,
      version: versionLine.replace(/^qpdf\s+/i, '').trim(),
    };
    return cachedStatus;
  } catch (err) {
    cachedStatus = {
      available: false,
      path: qpdfPath,
      error: `QPDF binary failed to execute: ${(err as Error).message}`,
    };
    return cachedStatus;
  }
}

/** Clear cached availability check so the next call re-resolves. */
export function clearQpdfCache(): void {
  cachedStatus = null;
}

/**
 * Build the QPDF encrypt arguments array.
 * Exported for testing — never log password-containing arrays.
 */
export function buildEncryptArgs(
  userPassword: string,
  ownerPassword: string,
  inputPath: string,
  outputPath: string
): string[] {
  return ['--encrypt', userPassword, ownerPassword, '256', '--', inputPath, outputPath];
}

/**
 * Build the QPDF decrypt arguments array.
 * Exported for testing — never log password-containing arrays.
 */
export function buildDecryptArgs(
  password: string,
  inputPath: string,
  outputPath: string
): string[] {
  return [`--password=${password}`, '--decrypt', inputPath, outputPath];
}

/**
 * Strip password values from stderr in case QPDF echoes them.
 * Redacts `--password=<value>` patterns and raw password strings
 * (including positional args after --encrypt).
 */
function sanitizeStderr(stderr: string, passwords: string[] = []): string {
  let sanitized = stderr.replace(/--password=\S+/g, '--password=***');
  for (const pwd of passwords) {
    if (pwd && pwd.length > 0) {
      sanitized = sanitized.replaceAll(pwd, '***');
    }
  }
  return sanitized;
}

/**
 * Encrypt a PDF with a user password and optional owner password.
 * Returns the encrypted PDF buffer. Never logs passwords.
 */
export async function encryptPdf(
  inputPath: string,
  userPassword: string,
  ownerPassword?: string
): Promise<Buffer> {
  const status = await checkQpdfAvailable();
  if (!status.available || !status.path) {
    throw new Error(status.error ?? 'QPDF is not available on this system.');
  }

  const outputPath = inputPath + '.crosspdf-encrypt-' + Date.now() + '.pdf';
  const ownerPwd = ownerPassword || userPassword;
  const args = buildEncryptArgs(userPassword, ownerPwd, inputPath, outputPath);

  try {
    await execFileAsync(status.path, args, { timeout: 30000 });
    return await fs.promises.readFile(outputPath);
  } catch (err) {
    const stderr = (err as { stderr?: string }).stderr || '';
    const toRedact = [userPassword, ownerPwd].filter((p, i, a) => a.indexOf(p) === i);
    throw new Error(
      `QPDF encrypt failed: ${sanitizeStderr(stderr, toRedact) || (err as Error).message}`,
      { cause: err }
    );
  } finally {
    try {
      await fs.promises.unlink(outputPath);
    } catch {
      /* ignore cleanup errors */
    }
  }
}

/**
 * Decrypt (remove password from) a PDF.
 * Returns the decrypted PDF buffer. Never logs passwords.
 */
export async function decryptPdf(inputPath: string, password: string): Promise<Buffer> {
  const status = await checkQpdfAvailable();
  if (!status.available || !status.path) {
    throw new Error(status.error ?? 'QPDF is not available on this system.');
  }

  const outputPath = inputPath + '.crosspdf-decrypt-' + Date.now() + '.pdf';
  const args = buildDecryptArgs(password, inputPath, outputPath);

  try {
    await execFileAsync(status.path, args, { timeout: 30000 });
    return await fs.promises.readFile(outputPath);
  } catch (err) {
    const stderr = (err as { stderr?: string }).stderr || '';
    throw new Error(
      `QPDF decrypt failed: ${sanitizeStderr(stderr, [password]) || (err as Error).message}`,
      { cause: err }
    );
  } finally {
    try {
      await fs.promises.unlink(outputPath);
    } catch {
      /* ignore cleanup errors */
    }
  }
}
