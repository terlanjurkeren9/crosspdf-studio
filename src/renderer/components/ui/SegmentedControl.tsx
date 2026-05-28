interface SegmentedControlProps<T extends string> {
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
  className = '',
}: SegmentedControlProps<T>) {
  return (
    <div
      className={`inline-flex h-8 items-center rounded-lg border border-surface-200 bg-surface-100 p-0.5 dark:border-surface-700 dark:bg-surface-800 ${className}`}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.value)}
            title={option.title ?? option.label}
            className={`h-[26px] rounded-md px-2.5 text-xs font-medium transition-all duration-150 disabled:opacity-40 ${
              active
                ? 'bg-white text-brand-600 shadow-sm shadow-surface-900/5 dark:bg-surface-700 dark:text-brand-400'
                : 'text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
