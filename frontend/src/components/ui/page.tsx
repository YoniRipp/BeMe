import type React from 'react';
import { cn } from '@/lib/utils';

/**
 * Standard app page shell: one column, centred, with the vertical rhythm every screen
 * shares. `narrow` is for single-purpose screens (Water) that read better in a column.
 */
export function Page({
  children,
  className,
  narrow = false,
}: {
  children: React.ReactNode;
  className?: string;
  narrow?: boolean;
}) {
  return (
    <div className={cn(narrow ? 'mx-auto w-full max-w-lg' : 'mx-auto w-full max-w-6xl', 'space-y-5', className)}>
      {children}
    </div>
  );
}

/** Page title block: optional kicker, the `h1`, an optional subtitle and a trailing action. */
export function PageHeader({
  kicker,
  title,
  subtitle,
  action,
  className,
}: {
  kicker?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        {kicker && <p className="text-eyebrow uppercase tracking-[0.18em] text-muted-foreground">{kicker}</p>}
        <h1 className="mt-1 font-sans text-[28px] font-extrabold leading-tight tracking-tight md:text-[34px]">
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Divides a page into labelled sections. Sits above the content it introduces. */
export function SectionHeader({
  title,
  eyebrow,
  action,
  className,
}: {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-end justify-between gap-4 px-1', className)}>
      <div>
        {eyebrow && <p className="text-eyebrow uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>}
        <h2 className="mt-1 text-base font-bold tracking-tight">{title}</h2>
      </div>
      {action}
    </div>
  );
}
