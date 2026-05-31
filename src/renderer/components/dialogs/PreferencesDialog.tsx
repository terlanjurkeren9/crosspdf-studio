import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { useUIStore } from '../../stores/ui.store';

type PrefsTab = 'general' | 'appearance' | 'performance' | 'ocr';

interface PreferenceValues {
  theme: string;
  defaultZoomMode: string;
  defaultViewMode: string;
  renderAheadPages: number;
  maxCanvasMemoryMb: number;
  ocrDefaultDpi: number;
  ocrDefaultLanguage: string;
  restoreLastSession: boolean;
  maxRecentDocuments: number;
}

const DEFAULTS: PreferenceValues = {
  theme: 'system',
  defaultZoomMode: 'fit-width',
  defaultViewMode: 'continuous',
  renderAheadPages: 3,
  maxCanvasMemoryMb: 256,
  ocrDefaultDpi: 300,
  ocrDefaultLanguage: 'eng',
  restoreLastSession: true,
  maxRecentDocuments: 20,
};

const TABS: { key: PrefsTab; labelKey: string }[] = [
  { key: 'general', labelKey: 'preferences.general' },
  { key: 'appearance', labelKey: 'preferences.appearance' },
  { key: 'performance', labelKey: 'preferences.performance' },
  { key: 'ocr', labelKey: 'preferences.ocr' },
];

interface PreferencesDialogProps {
  open: boolean;
  onClose: () => void;
}

function validatePreference<K extends keyof PreferenceValues>(
  key: K,
  val: unknown
): val is PreferenceValues[K] {
  switch (key) {
    case 'theme':
      return typeof val === 'string' && ['system', 'light', 'dark'].includes(val);
    case 'defaultZoomMode':
      return typeof val === 'string' && ['fit-width', 'fit-page', 'actual'].includes(val);
    case 'defaultViewMode':
      return typeof val === 'string' && ['continuous', 'single'].includes(val);
    case 'renderAheadPages':
      return typeof val === 'number' && val >= 1 && val <= 10;
    case 'maxCanvasMemoryMb':
      return typeof val === 'number' && val >= 64 && val <= 1024;
    case 'ocrDefaultDpi':
      return typeof val === 'number' && val >= 150 && val <= 600;
    case 'ocrDefaultLanguage':
      return typeof val === 'string';
    case 'restoreLastSession':
      return typeof val === 'boolean';
    case 'maxRecentDocuments':
      return typeof val === 'number' && val >= 5 && val <= 50;
  }
}

export function PreferencesDialog({ open, onClose }: PreferencesDialogProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<PrefsTab>('general');
  const [values, setValues] = useState<PreferenceValues>({ ...DEFAULTS });
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const setTheme = useUIStore((s) => s.setTheme);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Load current preferences from DB on open
  useEffect(() => {
    if (!open) return;

    async function load() {
      const prefs: Partial<PreferenceValues> = {};
      const keys = Object.keys(DEFAULTS) as (keyof PreferenceValues)[];

      for (const key of keys) {
        try {
          const val = await window.crosspdf.getPreference(key);
          if (val !== null && val !== undefined && validatePreference(key, val)) {
            (prefs as Record<string, unknown>)[key] = val;
          }
        } catch {
          // Use default
        }
      }

      if (!mountedRef.current) return;
      setValues({ ...DEFAULTS, ...prefs });
      setLoaded(true);
    }

    load();
  }, [open]);

  const handleSave = useCallback(async () => {
    setSaveError(null);
    const keys = Object.keys(values) as (keyof PreferenceValues)[];
    let failed = false;

    for (const key of keys) {
      try {
        await window.crosspdf.setPreference(key, values[key]);
      } catch {
        failed = true;
      }
    }

    if (failed) {
      setSaveError(t('preferences.saveError'));
      return;
    }

    // Apply theme immediately
    setTheme(values.theme as 'light' | 'dark' | 'system');

    onClose();
  }, [values, setTheme, onClose, t]);

  const update = useCallback(
    <K extends keyof PreferenceValues>(key: K, value: PreferenceValues[K]) => {
      setValues((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  if (!loaded) {
    return (
      <Dialog open={open} onClose={onClose} title={t('preferences.title')}>
        <div className="p-4 text-center text-surface-500">{t('preferences.loading')}</div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('preferences.title')}
      footer={
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={handleSave}>
            {t('common.save')}
          </Button>
        </div>
      }
    >
      {saveError && (
        <div className="mb-3 p-2 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
          {saveError}
        </div>
      )}
      <div className="flex gap-4">
        {/* Tabs */}
        <div
          role="tablist"
          aria-label={t('preferences.preferenceCategories')}
          className="w-28 shrink-0"
        >
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`w-full text-left px-3 py-1.5 text-sm rounded mb-0.5 ${
                activeTab === tab.key
                  ? 'bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300 font-medium'
                  : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
              }`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 max-h-80 overflow-y-auto">
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                  {t('preferences.defaultZoomMode')}
                </label>
                <select
                  value={values.defaultZoomMode}
                  onChange={(e) => update('defaultZoomMode', e.target.value)}
                  className="w-full h-8 px-2 text-sm rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
                >
                  <option value="fit-width">{t('preferences.fitWidth')}</option>
                  <option value="fit-page">{t('preferences.fitPage')}</option>
                  <option value="actual">{t('preferences.actualSize')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                  {t('preferences.defaultPageLayout')}
                </label>
                <select
                  value={values.defaultViewMode}
                  onChange={(e) => update('defaultViewMode', e.target.value)}
                  className="w-full h-8 px-2 text-sm rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
                >
                  <option value="continuous">{t('preferences.continuousScroll')}</option>
                  <option value="single">{t('preferences.singlePage')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                  {t('preferences.maxRecentDocuments', { value: values.maxRecentDocuments })}
                </label>
                <input
                  type="range"
                  min={5}
                  max={50}
                  step={5}
                  value={values.maxRecentDocuments}
                  onChange={(e) => update('maxRecentDocuments', parseInt(e.target.value, 10))}
                  className="w-full accent-brand-500"
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={values.restoreLastSession}
                  onChange={(e) => update('restoreLastSession', e.target.checked)}
                  className="rounded"
                />
                {t('preferences.restoreLastSession')}
              </label>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                  {t('preferences.theme')}
                </label>
                <select
                  value={values.theme}
                  onChange={(e) => update('theme', e.target.value)}
                  className="w-full h-8 px-2 text-sm rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
                >
                  <option value="system">{t('preferences.system')}</option>
                  <option value="light">{t('preferences.light')}</option>
                  <option value="dark">{t('preferences.dark')}</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                  {t('preferences.renderAheadPages', { value: values.renderAheadPages })}
                </label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={values.renderAheadPages}
                  onChange={(e) => update('renderAheadPages', parseInt(e.target.value, 10))}
                  className="w-full accent-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                  {t('preferences.maxCanvasMemory', { value: values.maxCanvasMemoryMb })}
                </label>
                <input
                  type="range"
                  min={64}
                  max={1024}
                  step={64}
                  value={values.maxCanvasMemoryMb}
                  onChange={(e) => update('maxCanvasMemoryMb', parseInt(e.target.value, 10))}
                  className="w-full accent-brand-500"
                />
              </div>
            </div>
          )}

          {activeTab === 'ocr' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                  {t('preferences.defaultLanguage')}
                </label>
                <select
                  value={values.ocrDefaultLanguage}
                  onChange={(e) => update('ocrDefaultLanguage', e.target.value)}
                  className="w-full h-8 px-2 text-sm rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
                >
                  <option value="eng">English</option>
                  <option value="deu">German</option>
                  <option value="fra">French</option>
                  <option value="spa">Spanish</option>
                  <option value="ita">Italian</option>
                  <option value="por">Portuguese</option>
                  <option value="rus">Russian</option>
                  <option value="chi_sim">Chinese (Simplified)</option>
                  <option value="jpn">Japanese</option>
                  <option value="kor">Korean</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                  {t('preferences.defaultDpi', { value: values.ocrDefaultDpi })}
                </label>
                <input
                  type="range"
                  min={150}
                  max={600}
                  step={50}
                  value={values.ocrDefaultDpi}
                  onChange={(e) => update('ocrDefaultDpi', parseInt(e.target.value, 10))}
                  className="w-full accent-brand-500"
                />
                <p className="text-xs text-surface-400 mt-1">{t('preferences.higherDpiHint')}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
