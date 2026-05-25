import { PDFDocument, degrees } from 'pdf-lib';
import { applyRedactionsToPdf } from '../lib/redaction-apply';

interface StampInput {
  pageNumber: number;
  rect: { x: number; y: number; width: number; height: number };
  imageBytes: ArrayBuffer;
  mimeType: string;
  opacity: number;
}

type OpsMessage =
  | { id: string; type: 'merge'; sources: ArrayBuffer[] }
  | { id: string; type: 'split'; source: ArrayBuffer; pagesPerFile?: number; ranges?: number[][] }
  | { id: string; type: 'reorder'; source: ArrayBuffer; newOrder: number[] }
  | { id: string; type: 'delete'; source: ArrayBuffer; pagesToDelete: number[] }
  | { id: string; type: 'extract'; source: ArrayBuffer; pages: number[] }
  | { id: string; type: 'rotate'; source: ArrayBuffer; rotations: [number, number][] }
  | { id: string; type: 'getFormFields'; source: ArrayBuffer }
  | { id: string; type: 'fillFormFields'; source: ArrayBuffer; fieldValues: Record<string, string> }
  | { id: string; type: 'flattenForm'; source: ArrayBuffer }
  | {
      id: string;
      type: 'apply-redactions';
      source: ArrayBuffer;
      pngs: ArrayBuffer[];
      redactedPageNumbers: number[];
    }
  | { id: string; type: 'embed-stamps'; source: ArrayBuffer; stamps: StampInput[] };

type OpsResponse =
  | { id: string; type: 'success'; data: Uint8Array }
  | { id: string; type: 'success-multi'; data: Uint8Array[] }
  | { id: string; type: 'error'; message: string };

async function handleMerge(sources: ArrayBuffer[]): Promise<Uint8Array> {
  const output = await PDFDocument.create();

  for (const bytes of sources) {
    const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pageIndices = source.getPageIndices();
    const pages = await output.copyPages(source, pageIndices);
    for (const page of pages) {
      output.addPage(page);
    }
  }

  output.setProducer('CrossPDF Studio');
  output.setCreator('CrossPDF Studio');
  return output.save({ useObjectStreams: true });
}

async function handleSplit(
  source: ArrayBuffer,
  pagesPerFile?: number,
  ranges?: number[][]
): Promise<Uint8Array[]> {
  const src = await PDFDocument.load(source, { ignoreEncryption: true });
  const totalPages = src.getPageCount();

  const chunks: number[][] = [];
  if (ranges && ranges.length > 0) {
    for (const range of ranges) {
      const chunk: number[] = [];
      for (const p of range) {
        if (p >= 1 && p <= totalPages) {
          chunk.push(p - 1);
        }
      }
      if (chunk.length > 0) chunks.push(chunk);
    }
  } else if (pagesPerFile && pagesPerFile > 0) {
    for (let start = 0; start < totalPages; start += pagesPerFile) {
      const chunk: number[] = [];
      const end = Math.min(start + pagesPerFile, totalPages);
      for (let i = start; i < end; i++) chunk.push(i);
      chunks.push(chunk);
    }
  }

  if (chunks.length === 0) {
    throw new Error('No valid split ranges or page count specified.');
  }

  const results: Uint8Array[] = [];
  for (const chunk of chunks) {
    const doc = await PDFDocument.create();
    const pages = await doc.copyPages(src, chunk);
    for (const page of pages) doc.addPage(page);
    doc.setProducer('CrossPDF Studio');
    results.push(await doc.save({ useObjectStreams: true }));
  }

  return results;
}

async function handleReorder(source: ArrayBuffer, newOrder: number[]): Promise<Uint8Array> {
  const src = await PDFDocument.load(source, { ignoreEncryption: true });
  const output = await PDFDocument.create();

  const zeroBased = newOrder.map((p) => p - 1);
  const pages = await output.copyPages(src, zeroBased);
  for (const page of pages) output.addPage(page);

  output.setProducer('CrossPDF Studio');
  output.setCreator('CrossPDF Studio');
  return output.save({ useObjectStreams: true });
}

async function handleDelete(source: ArrayBuffer, pagesToDelete: number[]): Promise<Uint8Array> {
  const src = await PDFDocument.load(source, { ignoreEncryption: true });
  const totalPages = src.getPageCount();
  const deleteSet = new Set(pagesToDelete.map((p) => p - 1));

  const keep: number[] = [];
  for (let i = 0; i < totalPages; i++) {
    if (!deleteSet.has(i)) keep.push(i);
  }

  if (keep.length === 0) {
    throw new Error('Cannot delete all pages — document would be empty.');
  }

  const output = await PDFDocument.create();
  const pages = await output.copyPages(src, keep);
  for (const page of pages) output.addPage(page);

  output.setProducer('CrossPDF Studio');
  output.setCreator('CrossPDF Studio');
  return output.save({ useObjectStreams: true });
}

async function handleExtract(source: ArrayBuffer, pages: number[]): Promise<Uint8Array> {
  const src = await PDFDocument.load(source, { ignoreEncryption: true });
  const totalPages = src.getPageCount();

  const zeroBased = pages.filter((p) => p >= 1 && p <= totalPages).map((p) => p - 1);

  if (zeroBased.length === 0) {
    throw new Error('No valid pages to extract.');
  }

  const output = await PDFDocument.create();
  const copied = await output.copyPages(src, zeroBased);
  for (const page of copied) output.addPage(page);

  output.setProducer('CrossPDF Studio');
  output.setCreator('CrossPDF Studio');
  return output.save({ useObjectStreams: true });
}

async function handleRotate(
  source: ArrayBuffer,
  rotations: [number, number][]
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(source, { ignoreEncryption: true });

  for (const [pageNum, amount] of rotations) {
    const page = doc.getPage(pageNum - 1);
    if (page) {
      const current = page.getRotation().angle;
      page.setRotation(degrees(current + amount));
    }
  }

  doc.setProducer('CrossPDF Studio');
  doc.setCreator('CrossPDF Studio');
  return doc.save({ useObjectStreams: true });
}

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

async function handleGetFormFields(source: ArrayBuffer): Promise<FormFieldInfo[]> {
  const doc = await PDFDocument.load(source, { ignoreEncryption: true });
  const form = doc.getForm();
  const fields = form.getFields();
  const result: FormFieldInfo[] = [];

  for (const field of fields) {
    const name = field.getName();
    const rawType = field.constructor.name;
    const isReadonly = field.isReadOnly();
    const isRequired = field.isRequired();

    let fieldType: string;
    let value: string | undefined;
    let options: string[] = [];
    let maxLength: number | undefined;

    try {
      if (rawType === 'PDFTextField') {
        fieldType = 'text';
        const textField = form.getTextField(name);
        value = textField.getText() ?? '';
        maxLength = textField.getMaxLength();
      } else if (rawType === 'PDFCheckBox') {
        fieldType = 'checkbox';
        const checkBox = form.getCheckBox(name);
        value = checkBox.isChecked() ? 'true' : 'false';
      } else if (rawType === 'PDFDropdown') {
        fieldType = 'dropdown';
        const dropdown = form.getDropdown(name);
        options = dropdown.getOptions();
        const selected = dropdown.getSelected();
        value = selected.length > 0 ? selected[0] : '';
      } else if (rawType === 'PDFOptionList') {
        fieldType = 'optionlist';
        const optionList = form.getOptionList(name);
        options = optionList.getOptions();
        const selected = optionList.getSelected();
        value = selected.length > 0 ? selected[0] : '';
      } else if (rawType === 'PDFRadioGroup') {
        fieldType = 'radiogroup';
        const radioGroup = form.getRadioGroup(name);
        options = radioGroup.getOptions();
        const selected = radioGroup.getSelected();
        value = selected ?? '';
      } else {
        // Unknown field type — skip
        continue;
      }
    } catch {
      // Field access error — skip this field
      continue;
    }

    result.push({
      name,
      type: fieldType,
      value,
      defaultValue: undefined,
      isReadonly,
      isRequired,
      maxLength,
      options,
    });
  }

  return result;
}

async function handleFillFormFields(
  source: ArrayBuffer,
  fieldValues: Record<string, string>
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(source, { ignoreEncryption: true });
  const form = doc.getForm();

  for (const [fieldName, fieldValue] of Object.entries(fieldValues)) {
    try {
      const field = form.getFieldMaybe(fieldName);
      if (!field) continue;

      const fieldType = field.constructor.name;

      if (fieldType === 'PDFTextField') {
        const textField = form.getTextField(fieldName);
        textField.setText(fieldValue);
      } else if (fieldType === 'PDFDropdown') {
        const dropdown = form.getDropdown(fieldName);
        dropdown.select(fieldValue);
      } else if (fieldType === 'PDFCheckBox') {
        const checkbox = form.getCheckBox(fieldName);
        if (fieldValue === 'true' || fieldValue === 'yes' || fieldValue === 'on') {
          checkbox.check();
        } else {
          checkbox.uncheck();
        }
      } else if (fieldType === 'PDFRadioGroup') {
        const radioGroup = form.getRadioGroup(fieldName);
        radioGroup.select(fieldValue);
      } else if (fieldType === 'PDFOptionList') {
        const optionList = form.getOptionList(fieldName);
        optionList.select(fieldValue);
      }
    } catch {
      // Ignore per-field errors — best-effort fill
    }
  }

  doc.setProducer('CrossPDF Studio');
  doc.setCreator('CrossPDF Studio');
  return doc.save({ useObjectStreams: true });
}

async function handleApplyRedactions(
  source: ArrayBuffer,
  pngs: ArrayBuffer[],
  redactedPageNumbers: number[]
): Promise<Uint8Array> {
  return applyRedactionsToPdf(source, pngs, redactedPageNumbers);
}

async function handleEmbedStamps(source: ArrayBuffer, stamps: StampInput[]): Promise<Uint8Array> {
  const doc = await PDFDocument.load(source, { ignoreEncryption: true });

  for (const stamp of stamps) {
    const page = doc.getPage(stamp.pageNumber - 1);

    let image;
    if (stamp.mimeType === 'image/png') {
      image = await doc.embedPng(stamp.imageBytes);
    } else if (stamp.mimeType === 'image/jpeg') {
      image = await doc.embedJpg(stamp.imageBytes);
    } else {
      // For unsupported formats, skip
      continue;
    }

    page.drawImage(image, {
      x: stamp.rect.x,
      y: stamp.rect.y,
      width: stamp.rect.width,
      height: stamp.rect.height,
      opacity: stamp.opacity,
    });
  }

  doc.setProducer('CrossPDF Studio');
  doc.setCreator('CrossPDF Studio');
  return doc.save({ useObjectStreams: true });
}

async function handleFlattenForm(source: ArrayBuffer): Promise<Uint8Array> {
  const doc = await PDFDocument.load(source, { ignoreEncryption: true });
  const form = doc.getForm();
  form.flatten();

  doc.setProducer('CrossPDF Studio');
  doc.setCreator('CrossPDF Studio');
  return doc.save({ useObjectStreams: true });
}

self.onmessage = async (event: MessageEvent<OpsMessage>) => {
  const msg = event.data;

  try {
    switch (msg.type) {
      case 'merge': {
        const data = await handleMerge(msg.sources);
        self.postMessage({ id: msg.id, type: 'success', data } satisfies OpsResponse);
        break;
      }
      case 'split': {
        const data = await handleSplit(msg.source, msg.pagesPerFile, msg.ranges);
        self.postMessage({ id: msg.id, type: 'success-multi', data } satisfies OpsResponse);
        break;
      }
      case 'reorder': {
        const data = await handleReorder(msg.source, msg.newOrder);
        self.postMessage({ id: msg.id, type: 'success', data } satisfies OpsResponse);
        break;
      }
      case 'delete': {
        const data = await handleDelete(msg.source, msg.pagesToDelete);
        self.postMessage({ id: msg.id, type: 'success', data } satisfies OpsResponse);
        break;
      }
      case 'extract': {
        const data = await handleExtract(msg.source, msg.pages);
        self.postMessage({ id: msg.id, type: 'success', data } satisfies OpsResponse);
        break;
      }
      case 'rotate': {
        const data = await handleRotate(msg.source, msg.rotations);
        self.postMessage({ id: msg.id, type: 'success', data } satisfies OpsResponse);
        break;
      }
      case 'getFormFields': {
        const fields = await handleGetFormFields(msg.source);
        self.postMessage({
          id: msg.id,
          type: 'success',
          data: new TextEncoder().encode(JSON.stringify(fields)),
        } satisfies OpsResponse);
        break;
      }
      case 'fillFormFields': {
        const data = await handleFillFormFields(msg.source, msg.fieldValues);
        self.postMessage({ id: msg.id, type: 'success', data } satisfies OpsResponse);
        break;
      }
      case 'flattenForm': {
        const data = await handleFlattenForm(msg.source);
        self.postMessage({ id: msg.id, type: 'success', data } satisfies OpsResponse);
        break;
      }
      case 'apply-redactions': {
        const data = await handleApplyRedactions(msg.source, msg.pngs, msg.redactedPageNumbers);
        self.postMessage({ id: msg.id, type: 'success', data } satisfies OpsResponse);
        break;
      }
      case 'embed-stamps': {
        const data = await handleEmbedStamps(msg.source, msg.stamps);
        self.postMessage({ id: msg.id, type: 'success', data } satisfies OpsResponse);
        break;
      }
      default:
        throw new Error(`Unknown operation: ${(msg as OpsMessage).type}`);
    }
  } catch (err) {
    self.postMessage({
      id: msg.id,
      type: 'error',
      message: err instanceof Error ? err.message : 'Unknown error',
    } satisfies OpsResponse);
  }
};
