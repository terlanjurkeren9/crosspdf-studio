import { useEffect, useRef, useState, useCallback } from 'react';

interface AnnotationEditorProps {
  initialContent: string;
  label: string;
  onSave: (content: string) => void;
  onCancel: () => void;
  anchorRect?: DOMRect | null;
}

export function AnnotationEditor({
  initialContent,
  label,
  onSave,
  onCancel,
  anchorRect,
}: AnnotationEditorProps) {
  const [value, setValue] = useState(initialContent);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (value.trim()) {
          onSave(value.trim());
        }
      }
    },
    [value, onSave, onCancel]
  );

  // Position near the anchor element if provided
  const style: React.CSSProperties = {
    position: 'fixed',
    zIndex: 100,
  };

  if (anchorRect) {
    style.left = Math.max(8, Math.min(anchorRect.right - 260, window.innerWidth - 268));
    style.top = Math.max(8, Math.min(anchorRect.bottom + 6, window.innerHeight - 160));
  } else {
    style.left = '50%';
    style.top = '50%';
    style.transform = 'translate(-50%, -50%)';
  }

  return (
    <div
      className="fixed inset-0 z-[99]"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={style}
        className="w-[260px] bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg shadow-lg p-3"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1.5">
          {label}
        </label>
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full h-16 text-xs rounded border border-surface-300 dark:border-surface-600 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-surface-100 p-2 resize-none outline-none focus:border-brand-400"
          rows={3}
        />
        <div className="flex items-center justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-2.5 py-1 text-xs rounded text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (value.trim()) onSave(value.trim());
            }}
            className="px-3 py-1 text-xs rounded bg-brand-500 text-white hover:bg-brand-600 font-medium"
          >
            Save
          </button>
        </div>
        <span className="block mt-1 text-[10px] text-surface-400 text-right">
          Esc to cancel &middot; Cmd+Enter to save
        </span>
      </div>
    </div>
  );
}
