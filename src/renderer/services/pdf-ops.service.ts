type OpsRequest =
  | { id: string; type: 'merge'; sources: ArrayBuffer[] }
  | { id: string; type: 'split'; source: ArrayBuffer; pagesPerFile?: number; ranges?: number[][] }
  | { id: string; type: 'reorder'; source: ArrayBuffer; newOrder: number[] }
  | { id: string; type: 'delete'; source: ArrayBuffer; pagesToDelete: number[] }
  | { id: string; type: 'extract'; source: ArrayBuffer; pages: number[] }
  | { id: string; type: 'rotate'; source: ArrayBuffer; rotations: [number, number][] }
  | {
      id: string;
      type: 'apply-redactions';
      source: ArrayBuffer;
      pngs: ArrayBuffer[];
      redactedPageNumbers: number[];
    }
  | { id: string; type: 'embed-stamps'; source: ArrayBuffer; stamps: StampInput[] }
  | { id: string; type: 'addFormField'; source: ArrayBuffer; field: FormFieldSpec }
  | { id: string; type: 'addFormFields'; source: ArrayBuffer; fields: FormFieldSpec[] };

type OpsResponse =
  | { id: string; type: 'success'; data: Uint8Array }
  | { id: string; type: 'success-multi'; data: Uint8Array[] }
  | { id: string; type: 'error'; message: string };

type OpsRequestParams =
  | { type: 'merge'; sources: ArrayBuffer[] }
  | { type: 'split'; source: ArrayBuffer; pagesPerFile?: number; ranges?: number[][] }
  | { type: 'reorder'; source: ArrayBuffer; newOrder: number[] }
  | { type: 'delete'; source: ArrayBuffer; pagesToDelete: number[] }
  | { type: 'extract'; source: ArrayBuffer; pages: number[] }
  | { type: 'rotate'; source: ArrayBuffer; rotations: [number, number][] }
  | { type: 'getFormFields'; source: ArrayBuffer }
  | { type: 'fillFormFields'; source: ArrayBuffer; fieldValues: Record<string, string> }
  | { type: 'flattenForm'; source: ArrayBuffer }
  | {
      type: 'apply-redactions';
      source: ArrayBuffer;
      pngs: ArrayBuffer[];
      redactedPageNumbers: number[];
    }
  | { type: 'embed-stamps'; source: ArrayBuffer; stamps: StampInput[] }
  | { type: 'addFormField'; source: ArrayBuffer; field: FormFieldSpec }
  | { type: 'addFormFields'; source: ArrayBuffer; fields: FormFieldSpec[] };

export interface FormFieldInfo {
  name: string;
  type: string;
  value: string | undefined;
  defaultValue: string | undefined;
  isReadonly: boolean;
  isRequired: boolean;
  maxLength: number | undefined;
  options: string[];
}

export interface FormFieldSpec {
  name: string;
  type: 'text' | 'checkbox' | 'dropdown' | 'radiogroup';
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  defaultValue?: string;
  options?: string[];
  maxLength?: number;
}

let workerPromise: Promise<Worker> | null = null;

const OP_TIMEOUTS: Partial<Record<OpsRequestParams['type'], number>> = {
  'embed-stamps': 30_000,
};
const DEFAULT_OP_TIMEOUT = 60_000;

export function resetWorker(): void {
  workerPromise = null;
}

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = new Promise<Worker>((resolve, reject) => {
      try {
        const worker = new Worker(new URL('../workers/pdf-ops.worker.ts', import.meta.url), {
          type: 'module',
        });
        worker.onerror = () => {
          workerPromise = null;
        };
        resolve(worker);
      } catch (err) {
        workerPromise = null;
        reject(err);
      }
    });
  }
  return workerPromise;
}

let requestIdCounter = 0;

function safeClone(buffer: ArrayBuffer): ArrayBuffer {
  try {
    return buffer.slice(0);
  } catch {
    throw new Error('PDF source buffer is no longer available; reload the document and try again.');
  }
}

function sendRequest(worker: Worker, params: OpsRequestParams): Promise<OpsResponse> {
  const id = String(++requestIdCounter);
  const timeoutMs = OP_TIMEOUTS[params.type] ?? DEFAULT_OP_TIMEOUT;

  return new Promise((resolve, reject) => {
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const handler = (e: MessageEvent<OpsResponse>) => {
      if (e.data.id === id) {
        settled = true;
        if (timeoutId !== null) clearTimeout(timeoutId);
        worker.removeEventListener('message', handler);
        resolve(e.data);
      }
    };

    worker.addEventListener('message', handler);

    timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      worker.removeEventListener('message', handler);
      worker.terminate();
      workerPromise = null;
      reject(
        new Error(
          params.type === 'embed-stamps'
            ? 'PDF image export timed out; try a different image or reload document'
            : `PDF operation "${params.type}" timed out`
        )
      );
    }, timeoutMs);

    const message = { ...params, id } as OpsRequest;

    if (message.type === 'merge') {
      const sourcesCopy = message.sources.map((s) => safeClone(s));
      worker.postMessage({ ...message, sources: sourcesCopy }, sourcesCopy);
    } else if (message.type === 'apply-redactions') {
      const sourceCopy = safeClone(message.source);
      const pngsCopy = message.pngs.map((p) => safeClone(p));
      worker.postMessage({ ...message, source: sourceCopy, pngs: pngsCopy }, [
        sourceCopy,
        ...pngsCopy,
      ]);
    } else if (message.type === 'embed-stamps') {
      const sourceCopy = safeClone(message.source);
      const stampsCopy = message.stamps.map((s) => ({ ...s, imageBytes: safeClone(s.imageBytes) }));
      const transferables = [sourceCopy, ...stampsCopy.map((s) => s.imageBytes)];
      worker.postMessage({ ...message, source: sourceCopy, stamps: stampsCopy }, transferables);
    } else if ('source' in message) {
      const sourceCopy = safeClone(message.source);
      worker.postMessage({ ...message, source: sourceCopy }, [sourceCopy]);
    } else {
      worker.postMessage(message);
    }
  });
}

export async function mergePDFs(sources: ArrayBuffer[]): Promise<Uint8Array> {
  const worker = await getWorker();
  const result = await sendRequest(worker, { type: 'merge', sources });
  if (result.type === 'error') throw new Error(result.message);
  if (result.type === 'success-multi') throw new Error('Unexpected multi result');
  return result.data;
}

export async function splitPDF(
  source: ArrayBuffer,
  options: { pagesPerFile?: number; ranges?: number[][] }
): Promise<Uint8Array[]> {
  const worker = await getWorker();
  const result = await sendRequest(worker, {
    type: 'split',
    source,
    pagesPerFile: options.pagesPerFile,
    ranges: options.ranges,
  });
  if (result.type === 'error') throw new Error(result.message);
  if (result.type === 'success') throw new Error('Unexpected single result');
  return result.data;
}

export async function reorderPages(source: ArrayBuffer, newOrder: number[]): Promise<Uint8Array> {
  const worker = await getWorker();
  const result = await sendRequest(worker, { type: 'reorder', source, newOrder });
  if (result.type === 'error') throw new Error(result.message);
  if (result.type === 'success-multi') throw new Error('Unexpected multi result');
  return result.data;
}

export async function deletePages(
  source: ArrayBuffer,
  pagesToDelete: number[]
): Promise<Uint8Array> {
  const worker = await getWorker();
  const result = await sendRequest(worker, {
    type: 'delete',
    source,
    pagesToDelete,
  });
  if (result.type === 'error') throw new Error(result.message);
  if (result.type === 'success-multi') throw new Error('Unexpected multi result');
  return result.data;
}

export async function extractPages(source: ArrayBuffer, pages: number[]): Promise<Uint8Array> {
  const worker = await getWorker();
  const result = await sendRequest(worker, { type: 'extract', source, pages });
  if (result.type === 'error') throw new Error(result.message);
  if (result.type === 'success-multi') throw new Error('Unexpected multi result');
  return result.data;
}

export async function rotatePages(
  source: ArrayBuffer,
  rotations: Map<number, number>
): Promise<Uint8Array> {
  const worker = await getWorker();
  const rotationArray: [number, number][] = Array.from(rotations.entries());
  const result = await sendRequest(worker, {
    type: 'rotate',
    source,
    rotations: rotationArray,
  });
  if (result.type === 'error') throw new Error(result.message);
  if (result.type === 'success-multi') throw new Error('Unexpected multi result');
  return result.data;
}

export async function getFormFields(source: ArrayBuffer): Promise<FormFieldInfo[]> {
  const worker = await getWorker();
  const result = await sendRequest(worker, { type: 'getFormFields', source });
  if (result.type === 'error') throw new Error(result.message);
  if (result.type === 'success-multi') throw new Error('Unexpected multi result');
  const json = new TextDecoder().decode(result.data);
  return JSON.parse(json) as FormFieldInfo[];
}

export async function fillFormFields(
  source: ArrayBuffer,
  fieldValues: Record<string, string>
): Promise<Uint8Array> {
  const worker = await getWorker();
  const result = await sendRequest(worker, {
    type: 'fillFormFields',
    source,
    fieldValues,
  });
  if (result.type === 'error') throw new Error(result.message);
  if (result.type === 'success-multi') throw new Error('Unexpected multi result');
  return result.data;
}

export async function flattenForm(source: ArrayBuffer): Promise<Uint8Array> {
  const worker = await getWorker();
  const result = await sendRequest(worker, { type: 'flattenForm', source });
  if (result.type === 'error') throw new Error(result.message);
  if (result.type === 'success-multi') throw new Error('Unexpected multi result');
  return result.data;
}

export interface StampInput {
  pageNumber: number;
  rect: { x: number; y: number; width: number; height: number };
  imageBytes: ArrayBuffer;
  mimeType: string;
  opacity: number;
}

export interface RedactedPageInput {
  pageNumber: number;
  pngData: ArrayBuffer;
}

export async function applyStamps(source: ArrayBuffer, stamps: StampInput[]): Promise<Uint8Array> {
  const worker = await getWorker();
  const result = await sendRequest(worker, { type: 'embed-stamps', source, stamps });
  if (result.type === 'error') throw new Error(result.message);
  if (result.type === 'success-multi') throw new Error('Unexpected multi result');
  return result.data;
}

export async function applyRedactions(
  source: ArrayBuffer,
  redactedPages: RedactedPageInput[]
): Promise<Uint8Array> {
  const worker = await getWorker();
  const pngs = redactedPages.map((p) => p.pngData);
  const redactedPageNumbers = redactedPages.map((p) => p.pageNumber);
  const result = await sendRequest(worker, {
    type: 'apply-redactions',
    source,
    pngs,
    redactedPageNumbers,
  });
  if (result.type === 'error') throw new Error(result.message);
  if (result.type === 'success-multi') throw new Error('Unexpected multi result');
  return result.data;
}

export async function addFormField(source: ArrayBuffer, field: FormFieldSpec): Promise<Uint8Array> {
  const worker = await getWorker();
  const result = await sendRequest(worker, { type: 'addFormField', source, field });
  if (result.type === 'error') throw new Error(result.message);
  if (result.type === 'success-multi') throw new Error('Unexpected multi result');
  return result.data;
}

export async function addFormFields(
  source: ArrayBuffer,
  fields: FormFieldSpec[]
): Promise<Uint8Array> {
  const worker = await getWorker();
  const result = await sendRequest(worker, { type: 'addFormFields', source, fields });
  if (result.type === 'error') throw new Error(result.message);
  if (result.type === 'success-multi') throw new Error('Unexpected multi result');
  return result.data;
}
