import type { Annotation } from '../types/annotation.types';

const SIDECAR_SUFFIX = '.crosspdf-annotations.json';

function sidecarPath(filePath: string): string {
  return filePath + SIDECAR_SUFFIX;
}

export async function saveAnnotationDraft(
  filePath: string,
  annotations: Annotation[]
): Promise<void> {
  const json = JSON.stringify(annotations, null, 2);
  const encoder = new TextEncoder();
  const data = encoder.encode(json);
  const arrayBuffer = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength
  ) as ArrayBuffer;

  try {
    await window.crosspdf.writeFile(sidecarPath(filePath), arrayBuffer);
  } catch (err) {
    console.error('Failed to save annotation draft:', err);
  }
}

export async function loadAnnotationDraft(filePath: string): Promise<Annotation[] | null> {
  try {
    const result = await window.crosspdf.readFile(sidecarPath(filePath));
    if (!result.success || !result.data) return null;

    const decoder = new TextDecoder();
    const text = decoder.decode(result.data);
    const parsed = JSON.parse(text);

    if (Array.isArray(parsed)) {
      return parsed as Annotation[];
    }
    return null;
  } catch {
    return null;
  }
}
