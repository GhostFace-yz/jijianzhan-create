import type { SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
  options: { value: string; label: string }[];
}

export function Select({ className = '', error, options, ...props }: SelectProps) {
  return (
    <div className="w-full">
      <select
        className={`
          w-full h-11 px-4 rounded-md border bg-canvas text-ink text-base
          focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary
          disabled:bg-surface-soft disabled:cursor-not-allowed
          ${error ? 'border-semantic-error' : 'border-hairline-strong'}
          ${className}
        `}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1.5 text-sm text-semantic-error">{error}</p> : null}
    </div>
  );
}
