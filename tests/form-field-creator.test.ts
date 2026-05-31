import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';

interface FormFieldSpec {
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

async function addFormFieldToPdf(source: ArrayBuffer, field: FormFieldSpec): Promise<Uint8Array> {
  const doc = await PDFDocument.load(source, { ignoreEncryption: true });
  const form = doc.getForm();
  const pages = doc.getPages();
  const pageIdx = field.page - 1;
  if (pageIdx < 0 || pageIdx >= pages.length) {
    throw new Error(`Page ${field.page} does not exist.`);
  }
  const page = pages[pageIdx];

  const opts = { x: field.x, y: field.y, width: field.width, height: field.height };

  switch (field.type) {
    case 'text': {
      const tf = form.createTextField(field.name);
      if (field.defaultValue) tf.setText(field.defaultValue);
      if (field.maxLength) tf.setMaxLength(field.maxLength);
      if (field.required) tf.enableRequired();
      tf.addToPage(page, opts);
      break;
    }
    case 'checkbox': {
      const cb = form.createCheckBox(field.name);
      if (field.defaultValue === 'true') cb.check();
      if (field.required) cb.enableRequired();
      cb.addToPage(page, opts);
      break;
    }
    case 'dropdown': {
      const dd = form.createDropdown(field.name);
      if (field.options && field.options.length > 0) dd.addOptions(field.options);
      if (field.defaultValue) {
        try {
          dd.select(field.defaultValue);
        } catch {
          /* ignore */
        }
      }
      if (field.required) dd.enableRequired();
      dd.addToPage(page, opts);
      break;
    }
    case 'radiogroup': {
      const rg = form.createRadioGroup(field.name);
      if (field.options && field.options.length > 0) {
        const gap = 4;
        for (let i = 0; i < field.options.length; i++) {
          const opt = field.options[i];
          rg.addOptionToPage(opt, page, {
            x: field.x,
            y: field.y - i * (field.height + gap),
            width: field.width,
            height: field.height,
          });
        }
      }
      if (field.defaultValue) {
        try {
          rg.select(field.defaultValue);
        } catch {
          /* ignore */
        }
      }
      if (field.required) rg.enableRequired();
      break;
    }
  }

  return doc.save({ useObjectStreams: true });
}

/**
 * Ported extraction logic matching handleGetFormFields in pdf-ops.worker.ts.
 */
async function extractFormFields(
  source: ArrayBuffer
): Promise<{ name: string; type: string; value: string; options: string[]; maxLength?: number }[]> {
  const doc = await PDFDocument.load(source, { ignoreEncryption: true });
  const form = doc.getForm();
  const fields = form.getFields();
  const result: {
    name: string;
    type: string;
    value: string;
    options: string[];
    maxLength?: number;
  }[] = [];

  for (const field of fields) {
    const name = field.getName();
    const rawType = field.constructor.name;
    let type: string;
    let value: string;
    let options: string[] = [];
    let maxLength: number | undefined;

    if (rawType === 'PDFTextField') {
      type = 'text';
      const tf = form.getTextField(name);
      value = tf.getText() ?? '';
      maxLength = tf.getMaxLength();
    } else if (rawType === 'PDFCheckBox') {
      type = 'checkbox';
      const cb = form.getCheckBox(name);
      value = cb.isChecked() ? 'true' : 'false';
    } else if (rawType === 'PDFDropdown') {
      type = 'dropdown';
      const dd = form.getDropdown(name);
      options = dd.getOptions();
      const sel = dd.getSelected();
      value = sel.length > 0 ? sel[0] : '';
    } else if (rawType === 'PDFRadioGroup') {
      type = 'radiogroup';
      const rg = form.getRadioGroup(name);
      options = rg.getOptions();
      value = rg.getSelected() ?? '';
    } else {
      continue;
    }

    result.push({ name, type, value, options, maxLength });
  }

  return result;
}

async function createBlankPdf(): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  doc.addPage([600, 800]);
  return (await doc.save({ useObjectStreams: true })).buffer;
}

describe('addFormFieldToPdf', () => {
  it('adds a text field with default value', async () => {
    const source = await createBlankPdf();
    const result = await addFormFieldToPdf(source, {
      name: 'customer.name',
      type: 'text',
      page: 1,
      x: 50,
      y: 750,
      width: 200,
      height: 20,
      required: false,
      defaultValue: 'John Doe',
    });

    const fields = await extractFormFields(result.buffer);
    const field = fields.find((f) => f.name === 'customer.name');
    expect(field).toBeDefined();
    expect(field!.type).toBe('text');
    expect(field!.value).toBe('John Doe');
  });

  it('adds a text field with maxLength', async () => {
    const source = await createBlankPdf();
    const result = await addFormFieldToPdf(source, {
      name: 'code',
      type: 'text',
      page: 1,
      x: 50,
      y: 700,
      width: 100,
      height: 20,
      required: false,
      maxLength: 10,
    });

    const fields = await extractFormFields(result.buffer);
    const field = fields.find((f) => f.name === 'code');
    expect(field).toBeDefined();
    expect(field!.maxLength).toBe(10);
  });

  it('adds a checkbox field (unchecked by default)', async () => {
    const source = await createBlankPdf();
    const result = await addFormFieldToPdf(source, {
      name: 'agree',
      type: 'checkbox',
      page: 1,
      x: 50,
      y: 670,
      width: 20,
      height: 20,
      required: false,
    });

    const fields = await extractFormFields(result.buffer);
    const field = fields.find((f) => f.name === 'agree');
    expect(field).toBeDefined();
    expect(field!.type).toBe('checkbox');
    expect(field!.value).toBe('false');
  });

  it('adds a checkbox field (checked by default)', async () => {
    const source = await createBlankPdf();
    const result = await addFormFieldToPdf(source, {
      name: 'accepted',
      type: 'checkbox',
      page: 1,
      x: 50,
      y: 640,
      width: 20,
      height: 20,
      required: false,
      defaultValue: 'true',
    });

    const fields = await extractFormFields(result.buffer);
    const field = fields.find((f) => f.name === 'accepted');
    expect(field).toBeDefined();
    expect(field!.value).toBe('true');
  });

  it('adds a dropdown field with options', async () => {
    const source = await createBlankPdf();
    const result = await addFormFieldToPdf(source, {
      name: 'color',
      type: 'dropdown',
      page: 1,
      x: 50,
      y: 610,
      width: 200,
      height: 20,
      required: false,
      options: ['Red', 'Green', 'Blue'],
      defaultValue: 'Green',
    });

    const fields = await extractFormFields(result.buffer);
    const field = fields.find((f) => f.name === 'color');
    expect(field).toBeDefined();
    expect(field!.type).toBe('dropdown');
    expect(field!.options).toEqual(['Red', 'Green', 'Blue']);
    expect(field!.value).toBe('Green');
  });

  it('adds a radio group with options', async () => {
    const source = await createBlankPdf();
    const result = await addFormFieldToPdf(source, {
      name: 'size',
      type: 'radiogroup',
      page: 1,
      x: 50,
      y: 580,
      width: 100,
      height: 20,
      required: false,
      options: ['S', 'M', 'L'],
      defaultValue: 'M',
    });

    const fields = await extractFormFields(result.buffer);
    const field = fields.find((f) => f.name === 'size');
    expect(field).toBeDefined();
    expect(field!.type).toBe('radiogroup');
    expect(field!.options).toEqual(['S', 'M', 'L']);
    expect(field!.value).toBe('M');
  });

  it('throws when page number is out of range', async () => {
    const source = await createBlankPdf();
    await expect(
      addFormFieldToPdf(source, {
        name: 'bad',
        type: 'text',
        page: 99,
        x: 0,
        y: 0,
        width: 100,
        height: 20,
        required: false,
      })
    ).rejects.toThrow('Page 99 does not exist.');
  });

  it('adds multiple fields to the same PDF', async () => {
    const source = await createBlankPdf();
    let result = await addFormFieldToPdf(source, {
      name: 'field1',
      type: 'text',
      page: 1,
      x: 50,
      y: 750,
      width: 200,
      height: 20,
      required: false,
    });
    result = await addFormFieldToPdf(result.buffer, {
      name: 'field2',
      type: 'checkbox',
      page: 1,
      x: 50,
      y: 720,
      width: 20,
      height: 20,
      required: false,
    });

    const fields = await extractFormFields(result.buffer);
    expect(fields.length).toBe(2);
    expect(fields.map((f) => f.name).sort()).toEqual(['field1', 'field2']);
  });
});
