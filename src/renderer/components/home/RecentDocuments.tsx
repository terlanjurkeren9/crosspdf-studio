import { useEffect, useState } from 'react';
import { FileText, FolderOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { RecentDocumentResult } from '../../../shared/types/ipc.types';

interface RecentDocumentsProps {
  onOpenFile: (filePath: string) => void;
}

export function RecentDocuments({ onOpenFile }: RecentDocumentsProps) {
  const { t } = useTranslation();
  const [recentDocs, setRecentDocs] = useState<RecentDocumentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const docs = await window.crosspdf.getRecentDocuments();
        if (!cancelled) {
          setRecentDocs(docs);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load recent documents');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-surface-500">
          {t('home.recentDocumentsTitle')}
        </h3>
        <span className="text-xs text-surface-400">{recentDocs.length || ''}</span>
      </div>

      {loading && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-md bg-surface-100 dark:bg-surface-800"
            />
          ))}
        </div>
      )}

      {!loading && error && (
        <p className="text-sm text-surface-500">{t('home.recentDocumentsUnavailable')}</p>
      )}

      {!loading && !error && recentDocs.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-surface-500">
          <div className="flex h-12 w-12 items-center justify-center rounded-md border border-dashed border-surface-300 dark:border-surface-700">
            <FolderOpen className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-surface-700 dark:text-surface-200">
              {t('home.noRecentFiles')}
            </p>
            <p className="mt-1 text-xs">{t('home.startWorkspace')}</p>
          </div>
        </div>
      )}

      {!loading && !error && recentDocs.length > 0 && (
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="divide-y divide-surface-100 dark:divide-surface-800">
            {recentDocs.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => onOpenFile(doc.filePath)}
                className="group flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left hover:bg-surface-100 dark:hover:bg-surface-800"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700 ring-1 ring-brand-100 dark:bg-brand-950/50 dark:text-brand-300 dark:ring-brand-900">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-surface-800 group-hover:text-surface-950 dark:text-surface-100">
                    {doc.fileName}
                  </p>
                  <p className="truncate text-[11px] text-surface-400">{doc.filePath}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
