import { useEffect, useState, type ReactNode } from "react";
import { Logo } from "../ui/Logo";
import { AuthScreen } from "./AuthScreen";
import { OnboardingWizard } from "../onboarding/OnboardingWizard";
import { useAuth } from "../../state/authContext";

/** P4.2: the app has real Supabase Auth + tenancy now, so every route this
 * component wraps requires a signed-in user with at least one active
 * clinic. The public booking page (/book/:slug) has no account of its own
 * (see services/publicBooking.ts) and, as of P4.7, is mounted as a fully
 * separate top-level route in App.tsx — it never renders through this
 * component at all, so there's no bypass to maintain here. This wraps
 * App.tsx's authenticated route tree unchanged — it only decides WHETHER
 * that tree renders yet, never what's inside it.
 *
 * Account-behavior contract (see the frontend onboarding task):
 *  - New normal account:      no user -> AuthScreen (signup) -> no clinic yet
 *                              -> OnboardingWizard -> clinic created -> app.
 *  - Existing normal account: no user -> AuthScreen (login) -> already has a
 *                              clinic -> app directly, wizard never mounts.
 *  - Demo account:            same as "existing" — the demo user already
 *                              belongs to the permanent demo clinic, so it
 *                              never has a null activeClinic and never sees
 *                              onboarding. */

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)] px-4">
      <div className="flex flex-col items-center gap-3">
        <Logo />
        <p className="text-[13px] text-[var(--color-muted)]">Loading your account…</p>
      </div>
    </div>
  );
}

export function RequireAuthAndClinic({ children }: { children: ReactNode }) {
  const auth = useAuth();

  const [onboarding, setOnboarding] = useState(false);
  const [pendingName, setPendingName] = useState("");

  // Reset so a later sign-in (possibly a different account) always
  // re-evaluates from scratch instead of reusing a stale wizard session.
  useEffect(() => {
    if (!auth.user) {
      setOnboarding(false);
      setPendingName("");
    }
  }, [auth.user]);

  // Latches the wizard on the first render where there's a signed-in user
  // with no clinic yet, and — this is the important part — keeps it latched
  // even after create_clinic_with_owner succeeds partway through step 2 and
  // activeClinic becomes non-null, so the feature-intro/completion steps
  // still get shown. Only onFinish() (StepCompletion's "Go to Healvo")
  // clears it.
  useEffect(() => {
    if (!auth.loading && auth.user && !auth.activeClinic) setOnboarding(true);
  }, [auth.loading, auth.user, auth.activeClinic]);

  if (auth.loading) return <LoadingScreen />;
  if (!auth.user) return <AuthScreen onAccountCreated={setPendingName} />;

  // Also checked synchronously (not just via the effect above) so a
  // brand-new, clinic-less account never flashes the real app shell for a
  // frame before the effect has a chance to run.
  const needsOnboarding = onboarding || !auth.activeClinic;
  if (needsOnboarding) {
    return <OnboardingWizard initialName={pendingName} onFinish={() => setOnboarding(false)} />;
  }
  return <>{children}</>;
}
