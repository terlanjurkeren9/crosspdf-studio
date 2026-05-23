type OpsRequest =
  | { id: string; type: 'merge'; sources: ArrayBuffer[] }
  | { id: string; type: 'split'; source: ArrayBuffer; pagesPerFile?: number; ranges?: number[][] }
  | { id: string; type: 'reorder'; source: ArrayBuffer; newOrder: number[] }
  | { id: string; type: 'delete'; source: ArrayBuffer; pagesToDelete: number[] }
  | { id: string; type: 'extract'; source: ArrayBuffer; pages: number[] }
  | { id: string; type: 'rotate'; source: ArrayBuffer; rotations: [number, number][] };

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
  | { type: 'flattenForm'; source: ArrayBuffer };

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

let workerPromise: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = new Promise<Worker>((resolve, reject) => {
      try {
        const worker = new Worker(
          new URL('../workers/pdf-ops.worker.ts', import.meta.url),
          { type: 'module' }
        );
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

function sendRequest(
  worker: Worker,
  params: OpsRequestParams
): Promise<OpsResponse> {
  const id = String(++requestIdCounter);

  return new Promise((resolve) => {
    const handler = (e: MessageEvent<OpsResponse>) => {
      if (e.data.id === id) {
        worker.removeEventListener('message', handler);
        resolve(e.data);
      }
    };

    worker.addEventListener('message', handler);

    const message = { ...params, id } as OpsRequest;

    if (message.type === 'merge') {
      worker.postMessage(message, message.sources);
    } else if ('source' in message) {
      worker.postMessage(message, [message.source]);
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

export async function reorderPages(
  source: ArrayBuffer,
  newOrder: number[]
): Promise<Uint8Array> {
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

export async function extractPages(
  source: ArrayBuffer,
  pages: number[]
): Promise<Uint8Array> {
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

export async function getFormFields(
  source: ArrayBuffer
): Promise<FormFieldInfo[]> {
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

export async function flattenForm(
  source: ArrayBuffer
): Promise<Uint8Array> {
  const worker = await getWorker();
  const result = await sendRequest(worker, { type: 'flattenForm', source });
  if (result.type === 'error') throw new Error(result.message);
  if (result.type === 'success-multi') throw new Error('Unexpected multi result');
  return result.data;
}
