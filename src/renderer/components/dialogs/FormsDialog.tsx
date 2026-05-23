import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { getFormFields, fillFormFields } from '../../services/pdf-ops.service';
import type { FormFieldInfo } from '../../services/pdf-ops.service';

interface FormsDialogProps {
  open: boolean;
  onClose: () => void;
  filePath: string;
  fileName: string;
}

type Status = 'loading' | 'ready' | 'saving' | 'error' | 'saved';

export function FormsDialog({ open, onClose, filePath, fileName }: FormsDialogProps) {
  const [status, setStatus] = useState<Status>('loading');
  const [fields, setFields] = useState<FormFieldInfo[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function load() {
      setStatus('loading');
      setErrorMessage('');
      try {
        const readResult = await window.crosspdf.readFile(filePath);
        if (cancelled) return;
        if (!readResult.success || !readResult.data) {
          setErrorMessage('Failed to read PDF file.');
          setStatus('error');
          return;
        }

        const formFields = await getFormFields(readResult.data);
        if (cancelled) return;

        const values: Record<string, string> = {};
        for (const field of formFields) {
          values[field.name] = field.value ?? '';
        }

        setFields(formFields);
        setFieldValues(values);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load form fields.');
        setStatus('error');
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [open, filePath]);

  const editableFields = useMemo(() => fields.filter((f) => !f.isReadonly), [fields]);

  const hasChanges = useMemo(() => {
    for (const field of fields) {
      const current = fieldValues[field.name] ?? '';
      const original = field.value ?? '';
      if (current !== original) return true;
    }
    return false;
  }, [fields, fieldValues]);

  const handleFieldChange = useCallback((name: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (editableFields.length === 0) return;

    setStatus('saving');
    setErrorMessage('');

    try {
      const readResult = await window.crosspdf.readFile(filePath);
      if (!readResult.success || !readResult.data) {
        throw new Error('Failed to read PDF file.');
      }

      const changedValues: Record<string, string> = {};
      for (const field of editableFields) {
        const newValue = fieldValues[field.name] ?? '';
        const originalValue = field.value ?? '';
        if (newValue !== originalValue) {
          changedValues[field.name] = newValue;
        }
      }

      if (Object.keys(changedValues).length === 0) {
        setStatus('ready');
        return;
      }

      const result = await fillFormFields(readResult.data, changedValues);
      const baseName = fileName.replace(/\.pdf$/i, '');
      const saveResult = await window.crosspdf.saveFileDialog({
        defaultPath: `${baseName}-filled.pdf`,
        filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
      });

      if (saveResult.canceled || !saveResult.filePath) {
        setStatus('ready');
        return;
      }

      await window.crosspdf.writeFile(saveResult.filePath, result.buffer as ArrayBuffer);
      setStatus('saved');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save form.');
      setStatus('error');
    }
  }, [editableFields, fieldValues, filePath, fileName]);

  const handleClose = useCallback(() => {
    if (status === 'saving') return;
    onClose();
  }, [onClose, status]);

  const fieldTypeLabel = (type: string): string => {
    switch (type) {
      case 'text':
        return 'Text';
      case 'checkbox':
        return 'Checkbox';
      case 'dropdown':
        return 'Dropdown';
      case 'radiogroup':
        return 'Radio Group';
      case 'optionlist':
        return 'List';
      case 'signature':
        return 'Signature';
      default:
        return type;
    }
  };

  const renderFieldInput = (field: FormFieldInfo) => {
    const value = fieldValues[field.name] ?? '';

    if (field.type === 'checkbox') {
      return (
        <input
          type="checkbox"
          checked={value === 'true' || value === 'yes' || value === 'on'}
          onChange={(e) => handleFieldChange(field.name, e.target.checked ? 'true' : 'false')}
          disabled={field.isReadonly}
          className="h-4 w-4 rounded border-surface-300 dark:border-surface-600"
        />
      );
    }

    if (field.type === 'dropdown' || field.type === 'optionlist' || field.type === 'radiogroup') {
      return field.options.length > 0 ? (
        <select
          value={value}
          onChange={(e) => handleFieldChange(field.name, e.target.value)}
          disabled={field.isReadonly}
          className="h-8 px-2 text-sm rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 disabled:opacity-50 flex-1 min-w-0"
        >
          <option value="">-- None --</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => handleFieldChange(field.name, e.target.value)}
          disabled={field.isReadonly}
          maxLength={field.maxLength}
          className="h-8 px-2 text-sm rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 disabled:opacity-50 flex-1 min-w-0"
          placeholder={field.defaultValue ?? 'Enter value'}
        />
      );
    }

    return (
      <input
        type="text"
        value={value}
        onChange={(e) => handleFieldChange(field.name, e.target.value)}
        disabled={field.isReadonly}
        maxLength={field.maxLength}
        className="h-8 px-2 text-sm rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 disabled:opacity-50 flex-1 min-w-0"
        placeholder={field.defaultValue ?? 'Enter value'}
      />
    );
  };

  const isLoading = status === 'loading' || status === 'saving';

  return (
    <Dialog
      open={open}
      onClose={isLoading ? () => {} : handleClose}
      title="Form Fields"
      footer={
        <div className="flex items-center gap-2">
          {status === 'saved' ? (
            <span className="text-xs text-green-600 dark:text-green-400 mr-2">
              Saved successfully.
            </span>
          ) : null}
          <Button variant="secondary" onClick={handleClose} disabled={isLoading}>
            {status === 'saved' ? 'Close' : 'Cancel'}
          </Button>
          {status === 'ready' && editableFields.length > 0 && (
            <Button variant="primary" onClick={handleSave} disabled={!hasChanges}>
              Save Filled PDF
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-3">
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Spinner />
            <span className="text-sm text-surface-500">Loading form fields...</span>
          </div>
        )}

        {status === 'saving' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Spinner />
            <span className="text-sm text-surface-500">Saving filled form...</span>
          </div>
        )}

        {status === 'error' && (
          <div className="p-3 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
            {errorMessage}
          </div>
        )}

        {(status === 'ready' || status === 'saved') && fields.length === 0 && (
          <div className="py-6 text-center">
            <p className="text-sm text-surface-500 dark:text-surface-400">
              This PDF does not contain any AcroForm fields.
            </p>
            <p className="text-xs text-surface-400 mt-1">
              PDFs with fillable forms created by Adobe Acrobat or similar tools will show their
              fields here.
            </p>
          </div>
        )}

        {(status === 'ready' || status === 'saved') && fields.length > 0 && (
          <>
            <div className="flex items-center justify-between text-xs text-surface-500">
              <span>
                {fields.length} field{fields.length !== 1 ? 's' : ''} detected
                {editableFields.length !== fields.length
                  ? ` (${editableFields.length} editable)`
                  : ''}
              </span>
              <span className="text-surface-400">{fileName}</span>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2">
              {fields.map((field) => (
                <div
                  key={field.name}
                  className="flex items-center gap-3 p-2 rounded border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">
                        {field.name}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-surface-200 dark:bg-surface-700 text-surface-500 shrink-0">
                        {fieldTypeLabel(field.type)}
                      </span>
                      {field.isReadonly && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 shrink-0">
                          Read-only
                        </span>
                      )}
                      {field.isRequired && <span className="text-xs text-red-500 shrink-0">*</span>}
                    </div>
                    {field.defaultValue && field.defaultValue !== field.value && (
                      <p className="text-xs text-surface-400 mt-0.5 truncate">
                        Default: {field.defaultValue}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0" style={{ minWidth: 160 }}>
                    {renderFieldInput(field)}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
