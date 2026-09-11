import type { LucideIcon } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { Card } from "../components/ui/Card";

export function Placeholder({
  crumb,
  title,
  description,
  icon: Icon,
}: {
  crumb: string;
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <AppShell crumb={crumb}>
      <Card className="flex flex-col items-center justify-center gap-3 px-8 py-24 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-mint-bg)] text-[var(--color-teal)]">
          <Icon size={22} strokeWidth={2} />
        </div>
        <h1 className="text-[18px] font-bold text-[var(--color-ink)]">{title}</h1>
        <p className="max-w-sm text-[13.5px] text-[var(--color-muted)]">
          {description}
        </p>
      </Card>
    </AppShell>
  );
}
