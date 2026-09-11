import { useState } from "react";
import { cn, getErrorMessage } from "../../lib/utils";
import { useAuth } from "../../state/authContext";

/** Triggers Supabase's redirect-based Google OAuth flow (see
 * signInWithGoogle in authContext.tsx / services/auth.ts). The browser
 * navigates away to Google and back, so the only local state this owns is
 * the brief window before that redirect happens and any error Supabase
 * returns without redirecting (e.g. the Google provider isn't configured in
 * the Supabase project). */
export function GoogleButton({ className }: { className?: string }) {
  const { signInWithGoogle } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setSubmitting(true);
    setError(null);
    try {
      await signInWithGoogle();
      // No further state update on success — the browser is navigating away.
    } catch (err) {
      setError(getErrorMessage(err, "Could not start Google sign-in. Please try again."));
      setSubmitting(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={submitting}
        className={cn(
          "flex w-full items-center justify-center gap-2.5 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3.5 py-2.5 text-[13.5px] font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas)] disabled:cursor-not-allowed disabled:opacity-70",
          className,
        )}
      >
        <GoogleGlyph />
        {submitting ? "Redirecting…" : "Continue with Google"}
      </button>
      {error && (
        <p className="mt-2 text-center text-[12px] font-semibold text-[var(--color-danger-text)]">{error}</p>
      )}
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.87 2.7-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.94v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.41 5.41 0 0 1 3.67 9c0-.59.1-1.16.28-1.7V4.97H.94A9 9 0 0 0 0 9c0 1.45.35 2.83.94 4.03l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .94 4.97l3.01 2.33C4.66 5.17 6.65 3.58 9 3.58Z"
      />
    </svg>
  );
}
