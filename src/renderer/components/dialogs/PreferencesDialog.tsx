import { useCallback, useEffect, useState } from 'react';
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

const TABS: { key: PrefsTab; label: string }[] = [
  { key: 'general', label: 'General' },
  { key: 'appearance', label: 'Appearance' },
  { key: 'performance', label: 'Performance' },
  { key: 'ocr', label: 'OCR' },
];

interface PreferencesDialogProps {
  open: boolean;
  onClose: () => void;
}

export function PreferencesDialog({ open, onClose }: PreferencesDialogProps) {
  const [activeTab, setActiveTab] = useState<PrefsTab>('general');
  const [values, setValues] = useState<PreferenceValues>({ ...DEFAULTS });
  const [loaded, setLoaded] = useState(false);

  const setTheme = useUIStore((s) => s.setTheme);

  // Load current preferences from DB on open
  useEffect(() => {
    if (!open) return;

    async function load() {
      const prefs: Partial<PreferenceValues> = {};
      const keys = Object.keys(DEFAULTS) as (keyof PreferenceValues)[];

      for (const key of keys) {
        try {
          const val = await window.crosspdf.getPreference(key);
          if (val !== null && val !== undefined) {
            prefs[key] = val as never;
          }
        } catch {
          // Use default
        }
      }

      setValues({ ...DEFAULTS, ...prefs });
      setLoaded(true);
    }

    load();
  }, [open]);

  const handleSave = useCallback(async () => {
    const keys = Object.keys(values) as (keyof PreferenceValues)[];

    for (const key of keys) {
      try {
        await window.crosspdf.setPreference(key, values[key]);
      } catch {
        // Best effort
      }
    }

    // Apply theme immediately
    setTheme(values.theme as 'light' | 'dark' | 'system');

    onClose();
  }, [values, setTheme, onClose]);

  const update = useCallback(
    <K extends keyof PreferenceValues>(key: K, value: PreferenceValues[K]) => {
      setValues((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  if (!loaded) {
    return (
      <Dialog open={open} onClose={onClose} title="Preferences">
        <div className="p-4 text-center text-surface-500">Loading preferences...</div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Preferences"
      footer={
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save
          </Button>
        </div>
      }
    >
      <div className="flex gap-4">
        {/* Tabs */}
        <div className="w-28 shrink-0">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`w-full text-left px-3 py-1.5 text-sm rounded mb-0.5 ${
                activeTab === t.key
                  ? 'bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300 font-medium'
                  : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 max-h-80 overflow-y-auto">
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                  Default zoom mode
                </label>
                <select
                  value={values.defaultZoomMode}
                  onChange={(e) => update('defaultZoomMode', e.target.value)}
                  className="w-full h-8 px-2 text-sm rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
                >
                  <option value="fit-width">Fit Width</option>
                  <option value="fit-page">Fit Page</option>
                  <option value="actual">Actual Size</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                  Default page layout
                </label>
                <select
                  value={values.defaultViewMode}
                  onChange={(e) => update('defaultViewMode', e.target.value)}
                  className="w-full h-8 px-2 text-sm rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
                >
                  <option value="continuous">Continuous scroll</option>
                  <option value="single">Single page</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                  Max recent documents ({values.maxRecentDocuments})
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
                Restore last session on startup
              </label>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                  Theme
                </label>
                <select
                  value={values.theme}
                  onChange={(e) => update('theme', e.target.value)}
                  className="w-full h-8 px-2 text-sm rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                  Render ahead pages ({values.renderAheadPages})
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
                  Max canvas memory ({values.maxCanvasMemoryMb} MB)
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
                  Default language
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
                  Default DPI ({values.ocrDefaultDpi})
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
                <p className="text-xs text-surface-400 mt-1">
                  Higher DPI gives better accuracy but takes longer.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
