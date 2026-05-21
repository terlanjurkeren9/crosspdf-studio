import { useEffect, useState } from 'react';
import type { RecentDocumentResult } from '../../../shared/types/ipc.types';

interface RecentDocumentsProps {
  onOpenFile: (filePath: string) => void;
}

export function RecentDocuments({ onOpenFile }: RecentDocumentsProps) {
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

  if (loading) {
    return (
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
          Recent Documents
        </h3>
        <div className="space-y-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-surface-100 dark:bg-surface-800 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
          Recent Documents
        </h3>
        <p className="text-xs text-surface-400">Unavailable</p>
      </div>
    );
  }

  if (recentDocs.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
        Recent Documents
      </h3>
      <div className="space-y-1">
        {recentDocs.map((doc) => (
          <button
            key={doc.id}
            type="button"
            onClick={() => onOpenFile(doc.filePath)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors group"
          >
            {/* PDF icon */}
            <div className="shrink-0 w-8 h-8 rounded bg-red-100 dark:bg-red-900 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-red-500 dark:text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-surface-700 dark:text-surface-200 truncate group-hover:text-surface-900 dark:group-hover:text-surface-100">
                {doc.fileName}
              </p>
              <p className="text-[11px] text-surface-400 truncate">{doc.filePath}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
