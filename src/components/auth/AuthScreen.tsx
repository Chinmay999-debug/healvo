import { useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, Mail } from "lucide-react";
import { Button } from "../ui/Button";
import { PasswordField } from "./PasswordField";
import { GoogleButton } from "./GoogleButton";
import {
  AuthHeading,
  AuthShell,
  AuthStatusIcon,
  BackToLogin,
  ErrorText,
  fieldInputClass,
  fieldLabelClass,
} from "./authLayout";
import { useAuth } from "../../state/authContext";
import { getErrorMessage } from "../../lib/utils";
import { MIN_PASSWORD_LENGTH } from "../../lib/passwordPolicy";

type Mode = "login" | "signup" | "forgot";

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
    <AuthShell>
      {mode === "login" && <LoginForm onForgot={() => setMode("forgot")} onSignUp={() => setMode("signup")} />}
      {mode === "signup" && (
        <SignUpForm onLogin={() => setMode("login")} onAccountCreated={onAccountCreated} />
      )}
      {mode === "forgot" && <ForgotPasswordForm onBack={() => setMode("login")} />}
    </AuthShell>
  );
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
        <AuthStatusIcon icon={Mail} />
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
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
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
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [resent, setResent] = useState(false);

  async function send(): Promise<boolean> {
    setError(null);
    setSubmitting(true);
    try {
      await sendPasswordReset(email.trim());
      return true;
    } catch (err) {
      // Supabase answers the same way for a registered and an unregistered
      // address, so nothing reaching here reveals whether an account exists —
      // it is a transport or rate-limit problem, which is worth showing.
      setError(getErrorMessage(err, "Couldn't send the reset email. Please try again."));
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (await send()) setSent(true);
  }

  async function handleResend() {
    setResent(false);
    if (await send()) setResent(true);
  }

  if (sent) {
    return (
      <div className="text-center">
        <AuthStatusIcon icon={CheckCircle2} />
        <h1 className="mt-4 text-[19px] font-extrabold text-[var(--color-ink)]">Check your email</h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--color-muted)]">
          If an account exists for{" "}
          <span className="font-semibold text-[var(--color-ink)]">{email}</span>, a password reset
          link is on its way. The link works once and expires in an hour.
        </p>

        <div className="mt-6 space-y-3">
          <Button
            variant="outline"
            className="w-full justify-center py-2.5"
            disabled={submitting}
            onClick={() => void handleResend()}
          >
            {submitting ? "Sending…" : "Resend the email"}
          </Button>
          {resent && (
            <p className="text-[12.5px] font-semibold text-[var(--color-mint-text)]">
              Sent again. It can take a minute to arrive.
            </p>
          )}
          <ErrorText message={error} />
          <p className="text-[12.5px] text-[var(--color-muted)]">
            Nothing in your inbox? Check your spam folder.
          </p>
        </div>

        <BackToLogin onClick={onBack} className="mt-6" />
      </div>
    );
  }

  return (
    <>
      <BackToLogin onClick={onBack} />
      <AuthHeading
        title="Forgot your password?"
        subtitle="Enter your email and we'll send you a reset link."
      />

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

        <ErrorText message={error} />

        <Button
          type="submit"
          variant="primary"
          className="w-full justify-center py-2.5"
          disabled={submitting || !email.trim()}
        >
          {submitting ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </>
  );
}
