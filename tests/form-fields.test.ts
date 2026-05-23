import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';

interface FormFieldInfo {
  name: string;
  type: string;
  value: string | undefined;
  defaultValue: string | undefined;
  isReadonly: boolean;
  isRequired: boolean;
  maxLength: number | undefined;
  options: string[];
}

/**
 * Ported extraction logic matching handleGetFormFields in pdf-ops.worker.ts.
 */
async function extractFormFields(source: ArrayBuffer): Promise<FormFieldInfo[]> {
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
        continue;
      }
    } catch {
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

/**
 * Build a PDF fixture with form fields and return its bytes.
 */
async function buildFormFixture(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 800]);
  const form = doc.getForm();

  // Text field with initial text
  const textField = form.createTextField('qa.name');
  textField.setText('Initial Name');
  textField.addToPage(page, { x: 50, y: 750, width: 200, height: 20 });

  // Checkbox (unchecked)
  const checkBox = form.createCheckBox('qa.accepted');
  checkBox.addToPage(page, { x: 50, y: 720, width: 20, height: 20 });

  // Checkbox (checked)
  const checkBoxOn = form.createCheckBox('qa.agreed');
  checkBoxOn.check();
  checkBoxOn.addToPage(page, { x: 50, y: 690, width: 20, height: 20 });

  // Dropdown with selected value
  const dropdown = form.createDropdown('qa.choice');
  dropdown.addOptions(['Alpha', 'Beta', 'Gamma']);
  dropdown.select('Beta');
  dropdown.addToPage(page, { x: 50, y: 660, width: 200, height: 20 });

  // OptionList with no selection
  const optionList = form.createOptionList('qa.tags');
  optionList.addOptions(['TagA', 'TagB', 'TagC']);
  optionList.addToPage(page, { x: 50, y: 630, width: 200, height: 60 });

  return doc.save({ useObjectStreams: true });
}

describe('extractFormFields (handleGetFormFields logic)', () => {
  it('extracts text field with value', async () => {
    const bytes = await buildFormFixture();
    const fields = await extractFormFields(bytes.buffer);

    const textField = fields.find((f) => f.name === 'qa.name');
    expect(textField).toBeDefined();
    expect(textField!.type).toBe('text');
    expect(textField!.value).toBe('Initial Name');
    expect(textField!.options).toEqual([]);
  });

  it('extracts checkbox fields with checked/unchecked state', async () => {
    const bytes = await buildFormFixture();
    const fields = await extractFormFields(bytes.buffer);

    const unchecked = fields.find((f) => f.name === 'qa.accepted');
    expect(unchecked).toBeDefined();
    expect(unchecked!.type).toBe('checkbox');
    expect(unchecked!.value).toBe('false');

    const checked = fields.find((f) => f.name === 'qa.agreed');
    expect(checked).toBeDefined();
    expect(checked!.type).toBe('checkbox');
    expect(checked!.value).toBe('true');
  });

  it('extracts dropdown with options and selected value', async () => {
    const bytes = await buildFormFixture();
    const fields = await extractFormFields(bytes.buffer);

    const dropdown = fields.find((f) => f.name === 'qa.choice');
    expect(dropdown).toBeDefined();
    expect(dropdown!.type).toBe('dropdown');
    expect(dropdown!.options).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(dropdown!.value).toBe('Beta');
  });

  it('extracts option list with options and empty selection', async () => {
    const bytes = await buildFormFixture();
    const fields = await extractFormFields(bytes.buffer);

    const optionList = fields.find((f) => f.name === 'qa.tags');
    expect(optionList).toBeDefined();
    expect(optionList!.type).toBe('optionlist');
    expect(optionList!.options).toEqual(['TagA', 'TagB', 'TagC']);
    expect(optionList!.value).toBe('');
  });

  it('captures isReadonly and isRequired', async () => {
    const bytes = await buildFormFixture();
    const fields = await extractFormFields(bytes.buffer);

    for (const field of fields) {
      expect(typeof field.isReadonly).toBe('boolean');
      expect(typeof field.isRequired).toBe('boolean');
    }
  });

  it('captures text field maxLength when set', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([600, 800]);
    const form = doc.getForm();
    const textField = form.createTextField('qa.limited');
    textField.setMaxLength(10);
    textField.addToPage(page, { x: 50, y: 750, width: 200, height: 20 });
    const bytes = await doc.save({ useObjectStreams: true });

    const fields = await extractFormFields(bytes.buffer);
    const extracted = fields.find((f) => f.name === 'qa.limited');
    expect(extracted).toBeDefined();
    expect(extracted!.maxLength).toBe(10);
  });

  it('returns empty array for PDF without forms', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([600, 800]);
    const bytes = await doc.save({ useObjectStreams: true });

    const fields = await extractFormFields(bytes.buffer);
    expect(fields).toEqual([]);
  });
});
