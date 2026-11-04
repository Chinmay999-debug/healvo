import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2, MailCheck, MailWarning } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { PasswordField } from "../../components/auth/PasswordField";
import {
  AuthHeading,
  AuthShell,
  AuthStatusIcon,
  ErrorText,
  FieldError,
  fieldLabelClass,
} from "../../components/auth/authLayout";
import { useAuth } from "../../state/authContext";
import { authRedirect } from "../../lib/supabaseClient";
import { isExpiredLink } from "../../lib/authRedirect";
import { updatePassword, verifyEmailToken } from "../../services/auth";
import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_RULE_TEXT,
  hasErrors,
  validatePasswordReset,
  type PasswordResetErrors,
} from "../../lib/passwordPolicy";
import { getErrorMessage } from "../../lib/utils";
import { usePageIdentity } from "../../lib/usePageIdentity";

/**
 * Where a salesperson's invitation email lands (admin-invite-salesperson sets
 * redirectTo here). Supabase hands over a one-time session for the invited
 * account; the salesperson chooses their own password, then goes to their
 * dashboard. Healvo never creates or shares a password.
 *
 * Scanner-safe invite links (?token_hash=…&type=invite) are only redeemed when
 * the person clicks "Accept invitation", so a mail scanner that opens links
 * cannot use the one-time token up first.
 */
const INVITE_FLAG = "healvo.sales-invite";

function readInviteFlag(): boolean {
  if (authRedirect.type === "invite" && authRedirect.hasSession) {
    try {
      sessionStorage.setItem(INVITE_FLAG, "1");
    } catch {
      // ignore
    }
    return true;
  }
  try {
    return sessionStorage.getItem(INVITE_FLAG) === "1";
  } catch {
    return false;
  }
}

export default function SalesWelcome() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  usePageIdentity("Healvo Sales", "/favicon-sales.svg");
  const [inviteSession, setInviteSession] = useState(readInviteFlag);
  const pendingToken =
    authRedirect.type === "invite" && authRedirect.tokenHash ? authRedirect.tokenHash : null;
  const [accepting, setAccepting] = useState(false);
  const [acceptFailed, setAcceptFailed] = useState(false);

  async function accept() {
    if (!pendingToken) return;
    setAccepting(true);
    try {
      await verifyEmailToken(pendingToken, "invite");
      try {
        sessionStorage.setItem(INVITE_FLAG, "1");
      } catch {
        // ignore
      }
      setInviteSession(true);
      window.history.replaceState(null, "", "/sales/welcome");
    } catch {
      setAcceptFailed(true);
    } finally {
      setAccepting(false);
    }
  }
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [fieldErrors, setFieldErrors] = useState<PasswordResetErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [settled, setSettled] = useState(!loading);

  useEffect(() => {
    if (!loading) setSettled(true);
  }, [loading]);

  if (pendingToken && !inviteSession && !acceptFailed) {
    return (
      <AuthShell>
        <div className="text-center">
          <AuthStatusIcon icon={MailCheck} />
          <h1 className="mt-4 text-[19px] font-extrabold text-[var(--color-ink)]">Join the Healvo sales team</h1>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--color-muted)]">
            Accept your invitation, then choose a password for your sales dashboard.
          </p>
          <Button className="mt-6 w-full justify-center py-2.5" onClick={() => void accept()} disabled={accepting}>
            {accepting ? "Checking your invitation…" : "Accept invitation"}
          </Button>
        </div>
      </AuthShell>
    );
  }

  if (isExpiredLink(authRedirect) || acceptFailed) {
    return (
      <AuthShell>
        <div className="text-center">
          <AuthStatusIcon icon={MailWarning} tone="amber" />
          <h1 className="mt-4 text-[19px] font-extrabold text-[var(--color-ink)]">This invitation link has expired</h1>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--color-muted)]">
            Invitation links work once and expire after a day. Ask your Healvo admin to resend it, or to set a password for you.
          </p>
          <Button variant="outline" className="mt-6 w-full justify-center py-2.5" onClick={() => navigate("/sales/dashboard")}>
            I already set my password — log in
          </Button>
        </div>
      </AuthShell>
    );
  }

  if (!settled) {
    return (
      <AuthShell>
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 size={22} className="animate-spin text-[var(--color-teal)]" />
          <p className="text-[13.5px] text-[var(--color-muted)]">Opening your invitation…</p>
        </div>
      </AuthShell>
    );
  }

  // Opened without an invitation session (or already finished): just log in.
  if (!user || !inviteSession) return <Navigate to="/sales/dashboard" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errors = validatePasswordReset(password, confirmation);
    setFieldErrors(errors);
    setFormError(null);
    if (hasErrors(errors)) return;
    setSaving(true);
    try {
      await updatePassword(password);
      try {
        sessionStorage.removeItem(INVITE_FLAG);
      } catch {
        // ignore
      }
      navigate("/sales/dashboard", { replace: true });
    } catch (err) {
      setFormError(getErrorMessage(err, "Couldn't save your password. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthShell>
      <AuthHeading
        title="Welcome to the Healvo sales team"
        subtitle={`Choose a password for ${user.email ?? "your account"}. You'll use it to log in to your sales dashboard.`}
      />
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <label className="block">
          <span className={fieldLabelClass}>Password</span>
          <PasswordField
            autoFocus
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(fieldErrors.password)}
            className="mt-1.5"
          />
          <FieldError message={fieldErrors.password} />
          {!fieldErrors.password && <p className="mt-1.5 text-[12px] text-[var(--color-muted)]">{PASSWORD_RULE_TEXT}</p>}
        </label>
        <label className="block">
          <span className={fieldLabelClass}>Confirm password</span>
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
          className="w-full justify-center py-2.5"
          disabled={saving || password.length < MIN_PASSWORD_LENGTH || !confirmation}
        >
          {saving ? "Saving…" : "Save password and continue"}
        </Button>
      </form>
    </AuthShell>
  );
}
