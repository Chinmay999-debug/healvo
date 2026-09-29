import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { TrialBanner } from "./TrialBanner";
import { MobileNavDrawer } from "./MobileNavDrawer";
import { HealvoAiWidget } from "./HealvoAiWidget";

export function AppShell({
  crumb,
  children,
}: {
  crumb: string;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-screen w-full bg-[var(--color-canvas)]">
      <div className="hidden print:hidden lg:block">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </div>
      <MobileNavDrawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="print:hidden">
          <TrialBanner />
          <TopBar
            crumb={crumb}
            mobileNavOpen={mobileNavOpen}
            onMenuClick={() => setMobileNavOpen(true)}
          />
        </div>
        {/* Bottom padding keeps the last content scrollable clear of the floating Healvo AI button. */}
        <main className="flex-1 overflow-y-auto px-4 pt-6 pb-24 sm:px-6 lg:px-8 lg:pt-8 lg:pb-28 print:overflow-visible print:p-0">
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>
      </div>
      <HealvoAiWidget />
    </div>
  );
}
