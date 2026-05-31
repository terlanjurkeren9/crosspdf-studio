import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { addFormField } from '../../services/pdf-ops.service';
import type { FormFieldSpec } from '../../services/pdf-ops.service';

interface FormFieldCreatorDialogProps {
  open: boolean;
  onClose: () => void;
  filePath: string;
  fileName: string;
  numPages: number;
}

type FieldType = FormFieldSpec['type'];

type Status = 'editing' | 'saving' | 'saved' | 'error';

const DEFAULT_WIDTH = 200;
const DEFAULT_HEIGHT = 20;

export function FormFieldCreatorDialog({
  open,
  onClose,
  filePath,
  fileName,
  numPages,
}: FormFieldCreatorDialogProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>('editing');
  const [errorMessage, setErrorMessage] = useState('');

  const [fieldType, setFieldType] = useState<FieldType>('text');
  const [fieldName, setFieldName] = useState('');
  const [page, setPage] = useState(1);
  const [posX, setPosX] = useState(50);
  const [posY, setPosY] = useState(750);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [required, setRequired] = useState(false);
  const [defaultValue, setDefaultValue] = useState('');
  const [optionsText, setOptionsText] = useState('');
  const [maxLength, setMaxLength] = useState<number | ''>('');

  const resetForm = useCallback(() => {
    setFieldType('text');
    setFieldName('');
    setPage(1);
    setPosX(50);
    setPosY(750);
    setWidth(DEFAULT_WIDTH);
    setHeight(DEFAULT_HEIGHT);
    setRequired(false);
    setDefaultValue('');
    setOptionsText('');
    setMaxLength('');
    setErrorMessage('');
  }, []);

  const handleAdd = useCallback(async () => {
    if (!fieldName.trim()) {
      setErrorMessage(t('formCreator.nameRequired'));
      setStatus('error');
      return;
    }

    setStatus('saving');
    setErrorMessage('');

    try {
      const readResult = await window.crosspdf.readFile(filePath);
      if (!readResult.success || !readResult.data) {
        throw new Error(t('formCreator.readFailed'));
      }

      const spec: FormFieldSpec = {
        name: fieldName.trim(),
        type: fieldType,
        page,
        x: posX,
        y: posY,
        width,
        height,
        required,
      };

      if (defaultValue) spec.defaultValue = defaultValue;
      if (maxLength !== '' && fieldType === 'text') spec.maxLength = maxLength;

      if (fieldType === 'dropdown' || fieldType === 'radiogroup') {
        const opts = optionsText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);
        if (opts.length > 0) spec.options = opts;
      }

      const result = await addFormField(readResult.data, spec);

      const baseName = fileName.replace(/\.pdf$/i, '');
      const saveResult = await window.crosspdf.saveFileDialog({
        defaultPath: `${baseName}-fields.pdf`,
        filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
      });

      if (saveResult.canceled || !saveResult.filePath) {
        setStatus('editing');
        return;
      }

      await window.crosspdf.writeFile(saveResult.filePath, result.buffer as ArrayBuffer);
      setStatus('saved');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t('formCreator.addFailed'));
      setStatus('error');
    }
  }, [
    fieldName,
    fieldType,
    page,
    posX,
    posY,
    width,
    height,
    required,
    defaultValue,
    optionsText,
    maxLength,
    filePath,
    fileName,
    t,
  ]);

  const handleClose = useCallback(() => {
    if (status === 'saving') return;
    if (status === 'saved') resetForm();
    onClose();
  }, [onClose, status, resetForm]);

  const isSaving = status === 'saving';

  const needsOptions = fieldType === 'dropdown' || fieldType === 'radiogroup';

  return (
    <Dialog
      open={open}
      onClose={isSaving ? () => {} : handleClose}
      title={t('formCreator.title')}
      footer={
        <div className="flex items-center gap-2">
          {status === 'saved' ? (
            <span className="text-xs text-green-600 dark:text-green-400 mr-2">
              {t('formCreator.fieldAdded')}
            </span>
          ) : null}
          <Button variant="secondary" onClick={handleClose} disabled={isSaving}>
            {status === 'saved' ? t('common.close') : t('common.cancel')}
          </Button>
          {(status === 'editing' || status === 'error') && (
            <Button variant="primary" onClick={handleAdd} disabled={!fieldName.trim()}>
              {t('formCreator.addField')}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {isSaving && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Spinner />
            <span className="text-sm text-surface-500">{t('formCreator.adding')}</span>
          </div>
        )}

        {status === 'error' && (
          <div className="p-3 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
            {errorMessage}
          </div>
        )}

        {status !== 'saving' && (
          <>
            {/* Field type */}
            <div>
              <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                {t('formCreator.fieldType')}
              </label>
              <select
                value={fieldType}
                onChange={(e) => {
                  const t = e.target.value as FieldType;
                  setFieldType(t);
                  if (t === 'checkbox') setHeight(DEFAULT_HEIGHT);
                  else setHeight(DEFAULT_HEIGHT);
                  if (status === 'error') setStatus('editing');
                }}
                className="h-8 w-full px-2 text-sm rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
              >
                <option value="text">{t('formCreator.typeText')}</option>
                <option value="checkbox">{t('formCreator.typeCheckbox')}</option>
                <option value="dropdown">{t('formCreator.typeDropdown')}</option>
                <option value="radiogroup">{t('formCreator.typeRadioGroup')}</option>
              </select>
            </div>

            {/* Field name */}
            <div>
              <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                {t('formCreator.fieldName')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={fieldName}
                onChange={(e) => {
                  setFieldName(e.target.value);
                  if (status === 'error') setStatus('editing');
                }}
                placeholder={t('formCreator.fieldNamePlaceholder')}
                className="h-8 w-full px-2 text-sm rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
              />
            </div>

            {/* Page */}
            <div>
              <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                {t('formCreator.page')} (1&ndash;{numPages})
              </label>
              <input
                type="number"
                min={1}
                max={numPages}
                value={page}
                onChange={(e) =>
                  setPage(Math.max(1, Math.min(numPages, parseInt(e.target.value) || 1)))
                }
                className="h-8 w-24 px-2 text-sm rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
              />
            </div>

            {/* Position */}
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                  X
                </label>
                <input
                  type="number"
                  value={posX}
                  onChange={(e) => setPosX(parseFloat(e.target.value) || 0)}
                  className="h-8 w-full px-2 text-sm rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                  Y
                </label>
                <input
                  type="number"
                  value={posY}
                  onChange={(e) => setPosY(parseFloat(e.target.value) || 0)}
                  className="h-8 w-full px-2 text-sm rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                  {t('formCreator.width')}
                </label>
                <input
                  type="number"
                  min={10}
                  value={width}
                  onChange={(e) =>
                    setWidth(Math.max(10, parseFloat(e.target.value) || DEFAULT_WIDTH))
                  }
                  className="h-8 w-full px-2 text-sm rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                  {t('formCreator.height')}
                </label>
                <input
                  type="number"
                  min={10}
                  value={height}
                  onChange={(e) =>
                    setHeight(Math.max(10, parseFloat(e.target.value) || DEFAULT_HEIGHT))
                  }
                  className="h-8 w-full px-2 text-sm rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
                />
              </div>
            </div>

            {/* Default value */}
            {fieldType === 'checkbox' ? (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={defaultValue === 'true'}
                  onChange={(e) => setDefaultValue(e.target.checked ? 'true' : '')}
                  className="h-4 w-4 rounded border-surface-300 dark:border-surface-600"
                />
                <span className="text-xs text-surface-600 dark:text-surface-400">
                  {t('formCreator.defaultChecked')}
                </span>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                  {t('formCreator.defaultValue')}
                </label>
                <input
                  type="text"
                  value={defaultValue}
                  onChange={(e) => setDefaultValue(e.target.value)}
                  className="h-8 w-full px-2 text-sm rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
                  placeholder={t('formCreator.defaultValuePlaceholder')}
                />
              </div>
            )}

            {/* Options (dropdown/radio) */}
            {needsOptions && (
              <div>
                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                  {t('formCreator.options')}
                </label>
                <textarea
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                  rows={3}
                  className="w-full px-2 py-1.5 text-sm rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 resize-none"
                  placeholder={t('formCreator.optionsPlaceholder')}
                />
              </div>
            )}

            {/* Max length (text only) */}
            {fieldType === 'text' && (
              <div>
                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                  {t('formCreator.maxLength')}
                </label>
                <input
                  type="number"
                  min={0}
                  value={maxLength}
                  onChange={(e) => {
                    const v = e.target.value;
                    setMaxLength(v === '' ? '' : Math.max(0, parseInt(v) || 0));
                  }}
                  placeholder={t('formCreator.unlimited')}
                  className="h-8 w-36 px-2 text-sm rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
                />
              </div>
            )}

            {/* Required */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
                className="h-4 w-4 rounded border-surface-300 dark:border-surface-600"
              />
              <span className="text-xs text-surface-600 dark:text-surface-400">
                {t('formCreator.required')}
              </span>
            </div>

            <p className="text-xs text-surface-400 dark:text-surface-500">
              {t('formCreator.hint')}
            </p>
          </>
        )}
      </div>
    </Dialog>
  );
}
