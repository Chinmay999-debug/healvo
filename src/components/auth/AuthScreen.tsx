import { useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Mail,
  Stethoscope,
  Wallet,
} from "lucide-react";
import { Logo } from "../ui/Logo";
import { Button } from "../ui/Button";
import { PasswordField } from "./PasswordField";
import { GoogleButton } from "./GoogleButton";
import { useAuth } from "../../state/authContext";
import { getErrorMessage } from "../../lib/utils";

type Mode = "login" | "signup" | "forgot";

const fieldLabelClass = "text-[12px] font-semibold text-[var(--color-muted)]";
const fieldInputClass =
  "mt-1.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-[14px] text-[var(--color-ink)] outline-none focus:border-[var(--color-teal)] focus:ring-2 focus:ring-[var(--color-teal)]/15";

const brandPoints = [
  { icon: Stethoscope, label: "Consultations & dental charting in one flow" },
  { icon: CalendarDays, label: "Appointments that keep your day organized" },
  { icon: Wallet, label: "Billing and payments without the spreadsheet" },
];

/** The single entry point rendered by RequireAuthAndClinic whenever nobody is
 * signed in — owns all three auth states (log in / create account / forgot
 * password) so switching between them never remounts the outer shell. */
export function AuthScreen({
  onAccountCreated,
}: {
  /** Called with the name typed into Create Account, only when sign-up
   * returns a session immediately (no email confirmation required) — lets
   * the onboarding wizard's "About you" step prefill it. */
  onAccountCreated?: (name: string) => void;
}) {
  const [mode, setMode] = useState<Mode>("login");

  return (
    <div className="flex min-h-screen bg-[var(--color-canvas)]">
      <div className="flex w-full flex-1 flex-col justify-center px-5 py-10 sm:px-10 lg:w-[46%] lg:flex-none lg:px-14 xl:px-20">
        <div className="mx-auto w-full max-w-[380px]">
          <Logo className="mb-8 block lg:hidden" />
          {mode === "login" && <LoginForm onForgot={() => setMode("forgot")} onSignUp={() => setMode("signup")} />}
          {mode === "signup" && (
            <SignUpForm onLogin={() => setMode("login")} onAccountCreated={onAccountCreated} />
          )}
          {mode === "forgot" && <ForgotPasswordForm onBack={() => setMode("login")} />}
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
          Patients, appointments, consultations and billing — Healvo keeps your
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

function AuthHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-[22px] font-extrabold tracking-tight text-[var(--color-ink)]">{title}</h1>
      <p className="mt-1.5 text-[13.5px] text-[var(--color-muted)]">{subtitle}</p>
    </div>
  );
}

function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-[12.5px] font-semibold text-[var(--color-danger-text)]">{message}</p>;
}

function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-3">
      <div className="h-px flex-1 bg-[var(--color-border)]" />
      <span className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--color-muted-soft)]">
        or
      </span>
      <div className="h-px flex-1 bg-[var(--color-border)]" />
    </div>
  );
}

function SwitchModeFooter({ children }: { children: ReactNode }) {
  return <p className="mt-6 text-center text-[13px] text-[var(--color-muted)]">{children}</p>;
}

function LoginForm({ onForgot, onSignUp }: { onForgot: () => void; onSignUp: () => void }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(getErrorMessage(err, "Sign-in failed. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <AuthHeading title="Welcome back" subtitle="Log in to keep your clinic running." />

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className={fieldLabelClass}>Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@yourclinic.com"
            className={fieldInputClass}
          />
        </label>
        <label className="block">
          <div className="flex items-center justify-between">
            <span className={fieldLabelClass}>Password</span>
            <button
              type="button"
              onClick={onForgot}
              className="text-[12px] font-semibold text-[var(--color-teal)] hover:underline"
            >
              Forgot password?
            </button>
          </div>
          <PasswordField
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5"
          />
        </label>

        <ErrorText message={error} />

        <Button type="submit" variant="primary" className="w-full justify-center py-2.5" disabled={submitting}>
          {submitting ? "Logging in…" : "Log in"}
        </Button>
      </form>

      <OrDivider />
      <GoogleButton />

      <SwitchModeFooter>
        Don&apos;t have an account?{" "}
        <button type="button" onClick={onSignUp} className="font-semibold text-[var(--color-teal)] hover:underline">
          Create account
        </button>
      </SwitchModeFooter>
    </>
  );
}

function SignUpForm({
  onLogin,
  onAccountCreated,
}: {
  onLogin: () => void;
  onAccountCreated?: (name: string) => void;
}) {
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      // The account's display name is captured again (and can be refined)
      // in the "About you" onboarding step right after this — see
      // OnboardingWizard. Supabase Auth itself has no free-text name field.
      const { needsEmailConfirmation } = await signUp(email.trim(), password);
      if (needsEmailConfirmation) {
        setNeedsConfirmation(true);
      } else {
        onAccountCreated?.(name.trim());
      }
    } catch (err) {
      setError(getErrorMessage(err, "Could not create your account."));
    } finally {
      setSubmitting(false);
    }
  }

  if (needsConfirmation) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-mint-bg)] text-[var(--color-mint-text)]">
          <Mail size={26} strokeWidth={2} />
        </div>
        <h1 className="mt-4 text-[19px] font-extrabold text-[var(--color-ink)]">Check your inbox</h1>
        <p className="mt-1.5 text-[13.5px] text-[var(--color-muted)]">
          We&apos;ve sent a confirmation link to <span className="font-semibold text-[var(--color-ink)]">{email}</span>.
          Click it, then log in to finish setting up your clinic.
        </p>
        <Button variant="outline" className="mt-6 w-full justify-center py-2.5" onClick={onLogin}>
          Back to log in
        </Button>
      </div>
    );
  }

  return (
    <>
      <AuthHeading title="Create your account" subtitle="Set up Healvo for your clinic in a few minutes." />

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className={fieldLabelClass}>Name</span>
          <input
            required
            autoComplete="name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dr. Priya Nair"
            className={fieldInputClass}
          />
        </label>
        <label className="block">
          <span className={fieldLabelClass}>Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@yourclinic.com"
            className={fieldInputClass}
          />
        </label>
        <label className="block">
          <span className={fieldLabelClass}>Password</span>
          <PasswordField
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            className="mt-1.5"
          />
        </label>

        <ErrorText message={error} />

        <Button type="submit" variant="primary" className="w-full justify-center py-2.5" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <OrDivider />
      <GoogleButton />

      <SwitchModeFooter>
        Already have an account?{" "}
        <button type="button" onClick={onLogin} className="font-semibold text-[var(--color-teal)] hover:underline">
          Log in
        </button>
      </SwitchModeFooter>
    </>
  );
}

function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  // Frontend-only for this phase — no supabase.auth.resetPasswordForEmail()
  // call yet (see the scope note in RequireAuthAndClinic.tsx). This mimics
  // the request/success shape the real flow will have.
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setSubmitting(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-mint-bg)] text-[var(--color-mint-text)]">
          <CheckCircle2 size={28} strokeWidth={2} />
        </div>
        <h1 className="mt-4 text-[19px] font-extrabold text-[var(--color-ink)]">Check your email</h1>
        <p className="mt-1.5 text-[13.5px] text-[var(--color-muted)]">
          If an account exists for <span className="font-semibold text-[var(--color-ink)]">{email}</span>, a
          password reset link is on its way.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-teal)] hover:underline"
        >
          <ArrowLeft size={14} strokeWidth={2.5} />
          Back to log in
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        <ArrowLeft size={14} strokeWidth={2.5} />
        Back to log in
      </button>
      <AuthHeading title="Forgot your password?" subtitle="Enter your email and we'll send you a reset link." />

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className={fieldLabelClass}>Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@yourclinic.com"
            className={fieldInputClass}
          />
        </label>

        <Button type="submit" variant="primary" className="w-full justify-center py-2.5" disabled={submitting}>
          {submitting ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </>
  );
}
