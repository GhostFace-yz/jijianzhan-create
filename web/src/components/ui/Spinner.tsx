interface SpinnerProps {
  /** Tailwind size class, e.g. 'h-6 w-6', 'h-10 w-10' */
  size?: string;
  /** Additional class names */
  className?: string;
}

/**
 * Reusable loading spinner.
 * Uses the primary brand color for the visible arc.
 */
export function Spinner({ size = 'h-6 w-6', className = '' }: SpinnerProps) {
  return (
    <div
      className={`${size} animate-spin rounded-full border-2 border-hairline-strong border-t-primary ${className}`}
      role="status"
      aria-label="加载中"
    />
  );
}
