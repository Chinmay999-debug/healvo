import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { BadgeCheck, CheckCircle2, Mail } from "lucide-react";
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
import { isEmailAlreadyRegisteredError } from "../../services/auth";
import { getErrorMessage } from "../../lib/utils";
import { MIN_PASSWORD_LENGTH } from "../../lib/passwordPolicy";
import {
  captureSalesReferral,
  getStoredReferral,
  markReferralSignupStarted,
  referralSignupMetadata,
} from "../../lib/salesReferral";

/** A referral link (/signup?ref=CODE) or a plain /signup opens on Create account. */
function initialMode(): Mode {
  if (typeof window === "undefined") return "login";
  const params = new URLSearchParams(window.location.search);
  return window.location.pathname === "/signup" || params.has("ref") ? "signup" : "login";
}

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
  const [mode, setMode] = useState<Mode>(initialMode);
  // Carries the address from "already exists → Log in" into the login form.
  const [loginEmail, setLoginEmail] = useState("");

  return (
    <AuthShell>
      {mode === "login" && (
        <LoginForm
          initialEmail={loginEmail}
          onForgot={() => setMode("forgot")}
          onSignUp={() => setMode("signup")}
        />
      )}
      {mode === "signup" && (
        <SignUpForm
          onLogin={(email) => {
            setLoginEmail(email ?? "");
            setMode("login");
          }}
          onAccountCreated={onAccountCreated}
        />
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

function LoginForm({
  initialEmail = "",
  onForgot,
  onSignUp,
}: {
  initialEmail?: string;
  onForgot: () => void;
  onSignUp: () => void;
}) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState(initialEmail);
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

/** Shown under the sign-up email field when that address already has an
 * account. Same styling as authLayout's FieldError, plus a way to log in. */
export function DuplicateEmailNotice({ onLogin }: { onLogin: () => void }) {
  return (
    <p
      id="signup-email-error"
      role="alert"
      className="mt-1.5 text-[12px] font-semibold text-[var(--color-danger-text)]"
    >
      An account with this email already exists. Please{" "}
      <button type="button" onClick={onLogin} className="font-semibold text-[var(--color-teal)] underline">
        log in
      </button>{" "}
      instead.
    </p>
  );
}

function SignUpForm({
  onLogin,
  onAccountCreated,
}: {
  onLogin: (email?: string) => void;
  onAccountCreated?: (name: string) => void;
}) {
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(() => getStoredReferral()?.code ?? null);

  useEffect(() => {
    let active = true;
    void captureSalesReferral().then((ref) => {
      if (active) setReferralCode(ref?.code ?? null);
    });
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setEmailTaken(false);
    try {
      void markReferralSignupStarted();
      // The display name goes into Auth user metadata so the profile starts
      // with it; it is captured again (and can be refined) in the "About
      // you" onboarding step. healvo_ref_* is re-validated server-side.
      const metadata: Record<string, string> = { ...referralSignupMetadata() };
      if (name.trim()) metadata.full_name = name.trim();
      const { needsEmailConfirmation } = await signUp(email.trim(), password, metadata);
      if (needsEmailConfirmation) {
        setNeedsConfirmation(true);
      } else {
        onAccountCreated?.(name.trim());
      }
    } catch (err) {
      if (isEmailAlreadyRegisteredError(err)) setEmailTaken(true);
      else setError(getErrorMessage(err, "Could not create your account."));
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
        <Button variant="outline" className="mt-6 w-full justify-center py-2.5" onClick={() => onLogin()}>
          Back to log in
        </Button>
      </div>
    );
  }

  return (
    <>
      <AuthHeading title="Create your account" subtitle="Set up Healvo for your clinic in a few minutes." />

      {referralCode && (
        <div className="-mt-2 mb-5 flex items-center gap-2 rounded-lg bg-[var(--color-mint-bg)] px-3 py-2 text-[12.5px] font-semibold text-[var(--color-mint-text)]">
          <BadgeCheck size={15} strokeWidth={2.25} />
          <span>
            Referral code <span className="tracking-wide">{referralCode}</span> applied
          </span>
        </div>
      )}

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
        <div>
          <label className="block">
            <span className={fieldLabelClass}>Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailTaken(false);
              }}
              placeholder="you@yourclinic.com"
              aria-invalid={emailTaken || undefined}
              aria-describedby={emailTaken ? "signup-email-error" : undefined}
              className={fieldInputClass}
            />
          </label>
          {emailTaken && <DuplicateEmailNotice onLogin={() => onLogin(email.trim())} />}
        </div>
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
        <button type="button" onClick={() => onLogin()} className="font-semibold text-[var(--color-teal)] hover:underline">
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
