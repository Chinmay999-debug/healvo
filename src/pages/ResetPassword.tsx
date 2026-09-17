import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, LinkIcon, Loader2 } from "lucide-react";
import { Button } from "../components/ui/Button";
import { PasswordField } from "../components/auth/PasswordField";
import {
  AuthHeading,
  AuthShell,
  AuthStatusIcon,
  BackToLogin,
  ErrorText,
  FieldError,
  fieldInputClass,
  fieldLabelClass,
} from "../components/auth/authLayout";
import { useAuth } from "../state/authContext";
import { authRedirect } from "../lib/supabaseClient";
import { isExpiredLink } from "../lib/authRedirect";
import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_RULE_TEXT,
  hasErrors,
  validatePasswordReset,
  type PasswordResetErrors,
} from "../lib/passwordPolicy";
import { getErrorMessage } from "../lib/utils";

/**
 * Where a Supabase password-reset email lands. Deliberately a public route
 * (see App.tsx) rather than one behind RequireAuthAndClinic: the link hands
 * over a real session, and routing it through the guard would drop a
 * half-reset user into the app or the onboarding wizard before they had set
 * a password. RequireAuthAndClinic sends them back here for the same reason.
 */
export default function ResetPassword() {
  const { passwordRecovery, completePasswordReset, signOut, loading } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [fieldErrors, setFieldErrors] = useState<PasswordResetErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // AuthProvider re-asserts `loading` on every auth event, not just the first
  // resolution (a token refresh will do it). Latching means a later event
  // cannot swap this screen back to the spinner and remount the branch below,
  // which would throw away a half-typed password or a "we've sent it"
  // confirmation.
  const [settled, setSettled] = useState(!loading);
  useEffect(() => {
    if (!loading) setSettled(true);
  }, [loading]);

  // Supabase reports a dead link in the URL it redirects to, before any
  // session exists — so this is known on the first paint.
  const linkExpired = isExpiredLink(authRedirect);

  if (done) return <ResetComplete onContinue={() => void signOut().then(() => navigate("/"))} />;
  if (linkExpired) return <ResetLinkProblem />;
  if (!settled && !passwordRecovery) return <CheckingLink />;
  if (!passwordRecovery) return <ResetLinkProblem />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errors = validatePasswordReset(password, confirmation);
    setFieldErrors(errors);
    setFormError(null);
    if (hasErrors(errors)) return;

    setSaving(true);
    try {
      await completePasswordReset(password);
      setDone(true);
    } catch (err) {
      setFormError(getErrorMessage(err, "Couldn't update your password. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthShell>
      <AuthHeading
        title="Set a new password"
        subtitle="Choose a new password for your Healvo account."
      />

      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <label className="block">
          <span className={fieldLabelClass}>New password</span>
          <PasswordField
            autoFocus
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(fieldErrors.password)}
            className="mt-1.5"
          />
          <FieldError message={fieldErrors.password} />
          {!fieldErrors.password && (
            <p className="mt-1.5 text-[12px] text-[var(--color-muted)]">{PASSWORD_RULE_TEXT}</p>
          )}
        </label>

        <label className="block">
          <span className={fieldLabelClass}>Confirm new password</span>
          <PasswordField
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            aria-invalid={Boolean(fieldErrors.confirmation)}
            className="mt-1.5"
          />
          <FieldError message={fieldErrors.confirmation} />
        </label>

        <ErrorText message={formError} />

        <Button
          type="submit"
          variant="primary"
          className="w-full justify-center py-2.5"
          disabled={saving || password.length < MIN_PASSWORD_LENGTH || !confirmation}
        >
          {saving ? "Updating password…" : "Update password"}
        </Button>
      </form>
    </AuthShell>
  );
}

function CheckingLink() {
  return (
    <AuthShell>
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2 size={22} className="animate-spin text-[var(--color-teal)]" />
        <p className="text-[13.5px] text-[var(--color-muted)]">Checking your reset link…</p>
      </div>
    </AuthShell>
  );
}

function ResetComplete({ onContinue }: { onContinue: () => void }) {
  return (
    <AuthShell>
      <div className="text-center">
        <AuthStatusIcon icon={CheckCircle2} />
        <h1 className="mt-4 text-[19px] font-extrabold text-[var(--color-ink)]">
          Password updated
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--color-muted)]">
          Your new password is saved. Log in with it to get back to your clinic.
        </p>
        <Button variant="primary" className="mt-6 w-full justify-center py-2.5" onClick={onContinue}>
          Continue to log in
        </Button>
      </div>
    </AuthShell>
  );
}

/**
 * Covers both halves of "this didn't work": a link that has expired or been
 * used, and someone opening this URL without one. Both are fixed the same
 * way, so the screen just offers another email rather than diagnosing.
 */
function ResetLinkProblem() {
  const { sendPasswordReset } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await sendPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't send the reset email. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <div className="text-center">
        <AuthStatusIcon icon={LinkIcon} tone="amber" />
        <h1 className="mt-4 text-[19px] font-extrabold text-[var(--color-ink)]">
          This reset link has expired
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--color-muted)]">
          Reset links work once and last an hour. Enter your email and we&apos;ll send a fresh one.
        </p>
      </div>

      {sent ? (
        <div className="mt-6 rounded-xl bg-[var(--color-mint-bg)] px-4 py-3.5 text-center text-[13px] font-semibold text-[var(--color-mint-text)]">
          If an account exists for {email}, a new link is on its way.
        </div>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
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

          <ErrorText message={error} />

          <Button
            type="submit"
            variant="primary"
            className="w-full justify-center py-2.5"
            disabled={submitting || !email.trim()}
          >
            {submitting ? "Sending…" : "Send a new link"}
          </Button>
        </form>
      )}

      <div className="mt-6 text-center">
        <BackToLogin onClick={() => navigate("/")} className="" />
      </div>
    </AuthShell>
  );
}
