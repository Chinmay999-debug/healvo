/**
 * The one password rule in Healvo. Mirrors this Supabase project's
 * `minimum_password_length = 6` (supabase/config.toml) so the client never
 * accepts something the server will reject, or rejects something it would
 * have taken. Sign-up, password reset and password change all read from
 * here rather than hardcoding their own minimum.
 */
export const MIN_PASSWORD_LENGTH = 6;

/** Shown under new-password fields so the rule is stated before it's broken. */
export const PASSWORD_RULE_TEXT = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;

/** Null when the password is acceptable, otherwise the message to show. */
export function validateNewPassword(password: string): string | null {
  if (!password) return "Enter a new password.";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Your password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

export function validateConfirmation(password: string, confirmation: string): string | null {
  if (!confirmation) return "Re-enter your new password.";
  if (password !== confirmation) return "Those passwords don't match.";
  return null;
}

export interface PasswordResetErrors {
  password?: string;
  confirmation?: string;
}

/** Field errors for the "set a new password" form (reset link flow). */
export function validatePasswordReset(
  password: string,
  confirmation: string,
): PasswordResetErrors {
  const errors: PasswordResetErrors = {};
  const passwordError = validateNewPassword(password);
  if (passwordError) errors.password = passwordError;

  // Only worth checking the confirmation once the password itself is valid —
  // otherwise a half-typed password reports two errors for one mistake.
  if (!passwordError) {
    const confirmationError = validateConfirmation(password, confirmation);
    if (confirmationError) errors.confirmation = confirmationError;
  }
  return errors;
}

export interface PasswordChangeErrors extends PasswordResetErrors {
  currentPassword?: string;
}

/** Field errors for the signed-in "change password" form. */
export function validatePasswordChange(
  currentPassword: string,
  password: string,
  confirmation: string,
): PasswordChangeErrors {
  const errors: PasswordChangeErrors = validatePasswordReset(password, confirmation);
  if (!currentPassword) errors.currentPassword = "Enter your current password.";

  // Supabase rejects a no-op change server-side; catching it here keeps the
  // user from spending a round trip to be told so.
  if (!errors.password && currentPassword && currentPassword === password) {
    errors.password = "Your new password must be different from your current one.";
  }
  return errors;
}

export const hasErrors = (errors: PasswordChangeErrors): boolean =>
  Object.values(errors).some(Boolean);
