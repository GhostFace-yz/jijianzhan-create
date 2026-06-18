import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary:
      'bg-primary text-on-primary px-[18px] py-[10px] hover:bg-primary-pressed active:bg-primary-pressed',
    secondary:
      'bg-transparent text-ink border border-hairline-strong px-[18px] py-[10px] hover:bg-surface',
    ghost:
      'bg-transparent text-ink px-3 py-2 hover:bg-surface',
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
