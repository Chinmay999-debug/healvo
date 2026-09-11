import { Check, FileText, Activity, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import type { ActivityEntry } from "../../data/mockData";

const iconMap: Record<ActivityEntry["icon"], LucideIcon> = {
  check: Check,
  file: FileText,
  activity: Activity,
};

const toneMap: Record<ActivityEntry["tone"], string> = {
  mint: "bg-[var(--color-mint-bg)] text-[var(--color-mint-text)]",
  blue: "bg-[var(--color-blue-bg)] text-[var(--color-blue-text)]",
  amber: "bg-[var(--color-amber-bg)] text-[var(--color-amber-text)]",
};

export function ActivityItem({
  entry,
  last,
}: {
  entry: ActivityEntry;
  last?: boolean;
}) {
  const Icon = iconMap[entry.icon];

  return (
    <div
      className={cn(
        "flex items-center gap-3.5 py-3.5",
        !last && "border-b border-[var(--color-border)]",
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          toneMap[entry.tone],
        )}
      >
        <Icon size={16} strokeWidth={2.25} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-semibold text-[var(--color-ink)]">
          {entry.title}
        </div>
        <div className="truncate text-[12.5px] text-[var(--color-muted)]">
          {entry.subtitle}
        </div>
      </div>
      <div className="shrink-0 text-[12px] text-[var(--color-muted)]">
        {entry.time}
      </div>
    </div>
  );
}
