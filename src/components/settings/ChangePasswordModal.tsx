import { useState, type FormEvent } from "react";
import { CheckCircle2, Mail } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { PasswordField } from "../auth/PasswordField";
import { ErrorText, FieldError, fieldLabelClass } from "../auth/authLayout";
import { useAuth } from "../../state/authContext";
import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_RULE_TEXT,
  hasErrors,
  validatePasswordChange,
  type PasswordChangeErrors,
} from "../../lib/passwordPolicy";
import { getErrorMessage } from "../../lib/utils";

/**
 * Changing the password of a signed-in account.
 *
 * Google-only accounts get a different screen entirely: they have no password
 * to type into a "current password" box, so asking for one would be a form
 * nobody can fill in. They are offered the emailed set-a-password link
 * instead, which is the flow Supabase actually supports for them.
 */
export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { hasPassword } = useAuth();

  return (
    <Modal open={open} onClose={onClose} title={hasPassword ? "Change password" : "Password"}>
      {hasPassword ? <ChangePasswordForm onClose={onClose} /> : <OAuthAccountNotice />}
    </Modal>
  );
}

function ChangePasswordForm({ onClose }: { onClose: () => void }) {
  const { changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [errors, setErrors] = useState<PasswordChangeErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const validation = validatePasswordChange(currentPassword, password, confirmation);
    setErrors(validation);
    setFormError(null);
    if (hasErrors(validation)) return;

    setSaving(true);
    try {
      const correct = await changePassword(currentPassword, password);
      if (!correct) {
        // Reported on the field rather than as a form error, so it reads as
        // "that one is wrong" instead of "the save failed".
        setErrors({ currentPassword: "That isn't your current password." });
        return;
      }
      setSaved(true);
    } catch (err) {
      setFormError(getErrorMessage(err, "Couldn't change your password. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-mint-bg)] text-[var(--color-mint-text)]">
          <CheckCircle2 size={24} strokeWidth={2} />
        </div>
        <p className="mt-3 text-[14px] font-bold text-[var(--color-ink)]">Password changed</p>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-muted)]">
          Use your new password the next time you log in. You&apos;re still signed in here.
        </p>
        <Button variant="primary" className="mt-5 w-full justify-center py-2.5" onClick={onClose}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      <label className="block">
        <span className={fieldLabelClass}>Current password</span>
        <PasswordField
          autoFocus
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          aria-invalid={Boolean(errors.currentPassword)}
          className="mt-1.5"
        />
        <FieldError message={errors.currentPassword} />
      </label>

      <label className="block">
        <span className={fieldLabelClass}>New password</span>
        <PasswordField
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={Boolean(errors.password)}
          className="mt-1.5"
        />
        <FieldError message={errors.password} />
        {!errors.password && (
          <p className="mt-1.5 text-[12px] text-[var(--color-muted)]">{PASSWORD_RULE_TEXT}</p>
        )}
      </label>

      <label className="block">
        <span className={fieldLabelClass}>Confirm new password</span>
        <PasswordField
          autoComplete="new-password"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          aria-invalid={Boolean(errors.confirmation)}
          className="mt-1.5"
        />
        <FieldError message={errors.confirmation} />
      </label>

      <ErrorText message={formError} />

      <div className="flex gap-2.5 pt-1">
        <Button
          type="button"
          variant="outline"
          className="flex-1 justify-center py-2.5"
          onClick={onClose}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          className="flex-1 justify-center py-2.5"
          disabled={
            saving ||
            !currentPassword ||
            password.length < MIN_PASSWORD_LENGTH ||
            !confirmation
          }
        >
          {saving ? "Saving…" : "Save password"}
        </Button>
      </div>
    </form>
  );
}

function OAuthAccountNotice() {
  const { user, sendPasswordReset } = useAuth();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const email = user?.email ?? "";

  async function handleSend() {
    setError(null);
    setSending(true);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't send the email. Please try again."));
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-mint-bg)] text-[var(--color-mint-text)]">
          <Mail size={22} strokeWidth={2} />
        </div>
        <p className="mt-3 text-[14px] font-bold text-[var(--color-ink)]">Check your email</p>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-muted)]">
          We&apos;ve sent a link to <span className="font-semibold text-[var(--color-ink)]">{email}</span>.
          Open it to set a password for your account.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[13px] leading-relaxed text-[var(--color-muted)]">
        You sign in to Healvo with Google, so there&apos;s no Healvo password to change. Your
        password is managed by Google.
      </p>
      <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-muted)]">
        If you&apos;d rather also log in with an email and password, we can email you a link to set
        one. You&apos;ll still be able to use Google.
      </p>

      {error && (
        <div className="mt-3">
          <ErrorText message={error} />
        </div>
      )}

      <Button
        variant="outline"
        className="mt-4 w-full justify-center py-2.5"
        disabled={sending || !email}
        onClick={() => void handleSend()}
      >
        <Mail size={14} strokeWidth={2} />
        {sending ? "Sending…" : "Email me a link to set a password"}
      </Button>
    </div>
  );
}
