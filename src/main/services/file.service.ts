import fs from 'node:fs/promises';
import path from 'node:path';
import { getTempPath } from '../utils/paths';

export async function ensureTempDir(): Promise<void> {
  const tempPath = getTempPath();
  await fs.mkdir(tempPath, { recursive: true });
}

export async function readFileBuffer(filePath: string): Promise<ArrayBuffer> {
  const buffer = await fs.readFile(filePath);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

export async function writeFileAtomic(filePath: string, data: ArrayBuffer): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  const tempPath = filePath + '.crosspdf-tmp-' + Date.now();
  try {
    await fs.writeFile(tempPath, Buffer.from(data));
    await fs.rename(tempPath, filePath);
  } catch (err) {
    // Clean up temp file on failure
    try {
      await fs.unlink(tempPath);
    } catch {
      /* ignore cleanup errors */
    }
    throw err;
  }
}
