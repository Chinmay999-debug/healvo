import { useState } from "react";
import { ShieldAlert, RefreshCw, LogOut, Mail } from "lucide-react";
import { Logo } from "../ui/Logo";
import { Button } from "../ui/Button";
import { useAuth } from "../../state/authContext";

export function ClinicSuspendedScreen({
  clinicName,
}: {
  clinicName: string;
}) {
  const { signOut, refresh } = useAuth();
  const [checking, setChecking] = useState(false);

  const handleRefresh = async () => {
    setChecking(true);
    try {
      await refresh();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)] px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-amber-500/20 bg-[var(--color-surface)] p-6 shadow-xl sm:p-8">
        <div className="flex flex-col items-center text-center">
          <div className="mb-6">
            <Logo />
          </div>

          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <ShieldAlert className="h-7 w-7" />
          </div>

          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            Access Suspended
          </div>

          <h1 className="text-[20px] font-bold text-[var(--color-ink)] sm:text-[22px]">
            Clinic Account Suspended
          </h1>

          <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-muted)]">
            Access to <span className="font-semibold text-[var(--color-ink)]">{clinicName}</span> has
            been temporarily suspended by Healvo platform administration.
          </p>

          <div className="my-5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] p-3.5 text-left text-[13px] text-[var(--color-muted)]">
            <p className="font-medium text-[var(--color-ink)]">What this means:</p>
            <ul className="mt-1.5 list-inside list-disc space-y-1">
              <li>Your patient records and clinical data remain safely preserved.</li>
              <li>Public online booking for this clinic is currently paused.</li>
              <li>To restore access, contact Healvo support or your clinic owner.</li>
            </ul>
          </div>

          <div className="flex items-center gap-2 text-[13px] text-[var(--color-muted)]">
            <Mail className="h-4 w-4 text-[var(--color-teal)]" />
            <span>Support: </span>
            <a
              href="mailto:support@healvo.in"
              className="font-medium text-[var(--color-teal)] hover:underline"
            >
              support@healvo.in
            </a>
          </div>

          <div className="mt-6 flex w-full flex-col gap-2.5">
            <Button
              variant="primary"
              className="w-full justify-center"
              onClick={handleRefresh}
              disabled={checking}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${checking ? "animate-spin" : ""}`} />
              {checking ? "Checking status…" : "Check status / Refresh"}
            </Button>

            <Button
              variant="secondary"
              className="w-full justify-center"
              onClick={() => signOut()}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
