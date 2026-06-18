interface BadgeProps {
  children: React.ReactNode;
  variant?: 'purple' | 'orange' | 'green' | 'tag-purple' | 'tag-orange' | 'tag-green';
}

export function Badge({ children, variant = 'purple' }: BadgeProps) {
  const styles: Record<NonNullable<BadgeProps['variant']>, string> = {
    purple: 'bg-primary text-on-primary',
    orange: 'bg-brand-orange text-on-primary',
    green: 'bg-brand-green text-on-primary',
    'tag-purple': 'bg-card-tint-lavender text-brand-purple-800',
    'tag-orange': 'bg-card-tint-peach text-brand-orange-deep',
    'tag-green': 'bg-card-tint-mint text-brand-green',
  };

  return (
    <span
      className={`
        inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold
        ${styles[variant]}
      `}
    >
      {children}
    </span>
  );
}
