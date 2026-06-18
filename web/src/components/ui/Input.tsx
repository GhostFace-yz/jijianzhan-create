import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export function Input({ className = '', error, ...props }: InputProps) {
  return (
    <div className="w-full">
      <input
        className={`
          w-full h-11 px-4 rounded-md border bg-canvas text-ink text-base
          placeholder:text-muted
          focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary
          disabled:bg-surface-soft disabled:cursor-not-allowed
          ${error ? 'border-semantic-error' : 'border-hairline-strong'}
          ${className}
        `}
        {...props}
      />
      {error ? <p className="mt-1.5 text-sm text-semantic-error">{error}</p> : null}
    </div>
  );
}
