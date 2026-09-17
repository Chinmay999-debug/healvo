import type { ReactNode } from "react";
import { ArrowLeft, CalendarDays, Stethoscope, Wallet } from "lucide-react";
import { Logo } from "../ui/Logo";

/**
 * The shell and small parts every auth screen shares — log in, create
 * account, forgot password and set-a-new-password. Kept here rather than
 * inside AuthScreen so the reset-link screens, which live on their own
 * route outside RequireAuthAndClinic, are visually the same product.
 */

export const fieldLabelClass = "text-[12px] font-semibold text-[var(--color-muted)]";
export const fieldInputClass =
  "mt-1.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-[14px] text-[var(--color-ink)] outline-none focus:border-[var(--color-teal)] focus:ring-2 focus:ring-[var(--color-teal)]/15";

const brandPoints = [
  { icon: Stethoscope, label: "Consultations & dental charting in one flow" },
  { icon: CalendarDays, label: "Appointments that keep your day organized" },
  { icon: Wallet, label: "Billing and payments without the spreadsheet" },
];

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[var(--color-canvas)]">
      <div className="flex w-full flex-1 flex-col justify-center px-5 py-10 sm:px-10 lg:w-[46%] lg:flex-none lg:px-14 xl:px-20">
        <div className="mx-auto w-full max-w-[380px]">
          <Logo className="mb-8 block lg:hidden" />
          {children}
        </div>
      </div>

      <BrandPanel />
    </div>
  );
}

function BrandPanel() {
  return (
    <div
      className="relative hidden flex-1 flex-col justify-between overflow-hidden p-12 lg:flex"
      style={{
        background:
          "linear-gradient(135deg, var(--color-gradient-start), var(--color-gradient-end) 65%, var(--color-surface-dark))",
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-white/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-black/10 blur-3xl"
      />

      <Logo light className="relative" />

      <div className="relative max-w-md">
        <h2 className="text-[28px] font-extrabold leading-tight tracking-tight text-white xl:text-[32px]">
          Run your entire clinic from one calm dashboard.
        </h2>
        <p className="mt-3 text-[14.5px] leading-relaxed text-white/80">
          Patients, appointments, consultations and billing. Healvo keeps your
          front desk and chairside teams on the same page.
        </p>

        <div className="mt-8 space-y-3.5">
          {brandPoints.map((point) => (
            <div key={point.label} className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white">
                <point.icon size={16} strokeWidth={2.25} />
              </div>
              <span className="text-[13.5px] font-medium text-white/90">{point.label}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="relative text-[12.5px] text-white/60">
        Trusted by dental clinics to run their day, end to end.
      </p>
    </div>
  );
}

export function AuthHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-[22px] font-extrabold tracking-tight text-[var(--color-ink)]">{title}</h1>
      <p className="mt-1.5 text-[13.5px] text-[var(--color-muted)]">{subtitle}</p>
    </div>
  );
}

export function ErrorText({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return <p className="text-[12.5px] font-semibold text-[var(--color-danger-text)]">{message}</p>;
}

/** Inline message under a single field, so the error sits where the mistake is. */
export function FieldError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return <p className="mt-1.5 text-[12px] font-semibold text-[var(--color-danger-text)]">{message}</p>;
}

export function BackToLogin({
  onClick,
  className = "mb-4",
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)] ${className}`}
    >
      <ArrowLeft size={14} strokeWidth={2.5} />
      Back to log in
    </button>
  );
}

/** The round icon every auth confirmation state opens with. */
export function AuthStatusIcon({
  icon: Icon,
  tone = "mint",
}: {
  icon: typeof ArrowLeft;
  tone?: "mint" | "amber";
}) {
  const toneClass =
    tone === "amber"
      ? "bg-[var(--color-amber-bg)] text-[var(--color-amber-text)]"
      : "bg-[var(--color-mint-bg)] text-[var(--color-mint-text)]";
  return (
    <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${toneClass}`}>
      <Icon size={26} strokeWidth={2} />
    </div>
  );
}
