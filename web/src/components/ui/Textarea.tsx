import type { TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export function Textarea({ className = '', error, ...props }: TextareaProps) {
  return (
    <div className="w-full">
      <textarea
        className={`
          w-full min-h-[120px] px-4 py-3 rounded-md border bg-canvas text-ink text-base
          placeholder:text-muted resize-y
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
