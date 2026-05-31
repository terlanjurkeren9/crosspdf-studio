import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';

type FieldType = 'text' | 'checkbox' | 'dropdown' | 'radiogroup';

interface FormFieldSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (settings: {
    fieldName: string;
    fieldType: FieldType;
    required: boolean;
    defaultValue?: string;
    options?: string[];
    maxLength?: number;
  }) => void;
  initialFieldName: string;
  initialFieldType: FieldType;
  initialRequired: boolean;
  initialDefaultValue?: string;
  initialOptions?: string[];
  initialMaxLength?: number;
}

export function FormFieldSettingsDialog({
  open,
  onClose,
  onSave,
  initialFieldName,
  initialFieldType,
  initialRequired,
  initialDefaultValue,
  initialOptions,
  initialMaxLength,
}: FormFieldSettingsDialogProps) {
  const { t } = useTranslation();

  const [fieldName, setFieldName] = useState(initialFieldName);
  const [fieldType, setFieldType] = useState<FieldType>(initialFieldType);
  const [required, setRequired] = useState(initialRequired);
  const [defaultValue, setDefaultValue] = useState(initialDefaultValue ?? '');
  const [optionsText, setOptionsText] = useState(initialOptions?.join('\n') ?? '');
  const [maxLength, setMaxLength] = useState<number | ''>(initialMaxLength ?? '');

  const handleSave = useCallback(() => {
    if (!fieldName.trim()) return;

    const settings: {
      fieldName: string;
      fieldType: FieldType;
      required: boolean;
      defaultValue?: string;
      options?: string[];
      maxLength?: number;
    } = {
      fieldName: fieldName.trim(),
      fieldType,
      required,
    };

    if (defaultValue) settings.defaultValue = defaultValue;
    if (maxLength !== '' && fieldType === 'text') settings.maxLength = maxLength;

    if (fieldType === 'dropdown' || fieldType === 'radiogroup') {
      const opts = optionsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      if (opts.length > 0) settings.options = opts;
    }

    onSave(settings);
    onClose();
  }, [fieldName, fieldType, required, defaultValue, optionsText, maxLength, onSave, onClose]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const needsOptions = fieldType === 'dropdown' || fieldType === 'radiogroup';

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={t('formField.settingsTitle')}
      footer={
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={!fieldName.trim()}>
            {t('common.save')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Field name */}
        <div>
          <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
            {t('formCreator.fieldName')} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={fieldName}
            onChange={(e) => setFieldName(e.target.value)}
            placeholder={t('formCreator.fieldNamePlaceholder')}
            className="h-8 w-full px-2 text-sm rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
          />
        </div>

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
            }}
            className="h-8 w-full px-2 text-sm rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
          >
            <option value="text">{t('formCreator.typeText')}</option>
            <option value="checkbox">{t('formCreator.typeCheckbox')}</option>
            <option value="dropdown">{t('formCreator.typeDropdown')}</option>
            <option value="radiogroup">{t('formCreator.typeRadioGroup')}</option>
          </select>
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
      </div>
    </Dialog>
  );
}
