import { useAnnotationStore } from '../../stores/annotation.store';
import type { Annotation } from '../../types/annotation.types';

const EMPTY_ANNOTATIONS: Annotation[] = [];

interface CommentPanelProps {
  tabId: string | null;
  onNavigateToPage: (pageNumber: number) => void;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - ts;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;

  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function annotationLabel(a: Annotation): string {
  switch (a.type) {
    case 'highlight':
      return 'Highlight';
    case 'underline':
      return 'Underline';
    case 'strikeout':
      return 'Strikeout';
    case 'sticky-note':
      return 'Sticky Note';
    case 'free-text':
      return 'Text';
    case 'freehand':
      return 'Drawing';
    case 'rectangle':
      return 'Rectangle';
    case 'ellipse':
      return 'Ellipse';
    case 'line':
      return 'Line';
    case 'arrow':
      return 'Arrow';
  }
}

function annotationColor(a: Annotation): string {
  if (a.type === 'free-text') return '#6B7280';
  if (a.type === 'sticky-note') return '#FBBF24';
  if (a.type === 'highlight') return a.color;
  return a.color;
}

export function CommentPanel({ tabId, onNavigateToPage }: CommentPanelProps) {
  const annotations = useAnnotationStore((s) =>
    tabId ? (s.annotationsByTab[tabId] ?? EMPTY_ANNOTATIONS) : EMPTY_ANNOTATIONS
  );
  const selectedIds = useAnnotationStore((s) => s.selectedIds);
  const selectAnnotation = useAnnotationStore((s) => s.selectAnnotation);
  const deselectAll = useAnnotationStore((s) => s.deselectAll);

  if (!tabId) {
    return (
      <div className="p-3 text-xs text-surface-400">
        Open a document to view annotations
      </div>
    );
  }

  if (annotations.length === 0) {
    return (
      <div className="p-3 text-xs text-surface-400">
        No annotations yet. Select an annotation tool from the toolbar to get started.
      </div>
    );
  }

  const sorted = [...annotations].sort((a, b) => {
    if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
    return b.createdAt - a.createdAt;
  });

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 text-xs text-surface-500 border-b border-surface-200 dark:border-surface-800">
        {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
      </div>
      <div className="flex-1 overflow-y-auto">
        {sorted.map((a) => {
          const isSelected = selectedIds.has(a.id);

          return (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                deselectAll();
                selectAnnotation(a.id);
                onNavigateToPage(a.pageNumber);
              }}
              className={`w-full text-left px-3 py-2 border-b border-surface-100 dark:border-surface-800 transition-colors ${
                isSelected
                  ? 'bg-brand-50 dark:bg-brand-900/30'
                  : 'hover:bg-surface-50 dark:hover:bg-surface-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: annotationColor(a) }}
                />
                <span className="text-xs font-medium text-surface-700 dark:text-surface-200 truncate">
                  {annotationLabel(a)}
                </span>
                <span className="text-[10px] text-surface-400 ml-auto shrink-0">
                  p.{a.pageNumber}
                </span>
              </div>

              {'content' in a && a.content && (
                <p className="text-xs text-surface-500 dark:text-surface-400 mt-1 line-clamp-2 ml-4.5">
                  {a.content}
                </p>
              )}

              {a.type === 'highlight' && (
                <p className="text-xs text-surface-400 mt-0.5 ml-4.5">
                  {a.quadPoints.length / 8} segment{a.quadPoints.length / 8 !== 1 ? 's' : ''}
                </p>
              )}

              <div className="flex items-center gap-2 mt-1 ml-4.5">
                <span className="text-[10px] text-surface-400">
                  {formatTime(a.createdAt)}
                </span>
                {a.modifiedAt !== a.createdAt && (
                  <span className="text-[10px] text-surface-400">
                    edited {formatTime(a.modifiedAt)}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
