import type { ReactNode } from "react";

export function PageHeader({
  dateLabel,
  title,
  subtitle,
  actions,
}: {
  dateLabel?: string;
  title: ReactNode;
  subtitle: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        {dateLabel && (
          <div className="text-[11.5px] font-bold tracking-[0.08em] text-[var(--color-muted)] uppercase">
            {dateLabel}
          </div>
        )}
        <div className="mt-1.5 flex items-center gap-3 text-[28px] font-extrabold tracking-tight text-[var(--color-ink)]">
          {title}
        </div>
        <p className="mt-1.5 text-[14px] text-[var(--color-muted)]">{subtitle}</p>
      </div>
      {actions && <div className="flex items-center gap-2.5 pt-1">{actions}</div>}
    </div>
  );
}
