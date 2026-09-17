import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Logo } from "../ui/Logo";
import { AuthScreen } from "./AuthScreen";
import { OnboardingWizard } from "../onboarding/OnboardingWizard";
import { ClinicSuspendedScreen } from "./ClinicSuspendedScreen";
import { SubscriptionExpiredScreen } from "./SubscriptionExpiredScreen";
import { useAuth } from "../../state/authContext";
import { useSubscription } from "../../state/subscriptionContext";
import { PASSWORD_RESET_PATH } from "../../services/auth";

function LoadingScreen({ message = "Loading your account…" }: { message?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)] px-4">
      <div className="flex flex-col items-center gap-3">
        <Logo />
        <p className="text-[13px] text-[var(--color-muted)]">{message}</p>
      </div>
    </div>
  );
}

export function RequireAuthAndClinic({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const sub = useSubscription();

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
  // with no clinic yet, and keeps it latched until onFinish().
  // Never latches during a password reset: that session is only here to set
  // a password, and latching would strand the user in the wizard afterwards.
  useEffect(() => {
    if (!auth.loading && !auth.passwordRecovery && auth.user && !auth.activeClinic) {
      setOnboarding(true);
    }
  }, [auth.loading, auth.passwordRecovery, auth.user, auth.activeClinic]);

  if (auth.loading) return <LoadingScreen message="Loading your account…" />;

  // A password-reset link signs the user in for real, so without this they
  // would land in the app (or onboarding) with the reset unfinished. Holds
  // until the new password is saved or they sign out.
  if (auth.passwordRecovery) return <Navigate to={PASSWORD_RESET_PATH} replace />;

  if (!auth.user) return <AuthScreen onAccountCreated={setPendingName} />;

  if (onboarding || !auth.activeClinic) {
    return <OnboardingWizard initialName={pendingName} onFinish={() => setOnboarding(false)} />;
  }

  // Clinic suspended by platform administration: pause SaaS access with clear guidance
  if (auth.activeClinic?.status === "suspended") {
    return <ClinicSuspendedScreen clinicName={auth.activeClinic.name} />;
  }

  // While subscription state is resolving, never flash the protected clinic app
  if (sub.loading) {
    return <LoadingScreen message="Verifying subscription access…" />;
  }

  // Safe failure state if subscription resolution errored
  if (sub.error && !sub.subscription) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)] px-4">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <Logo />
          <p className="text-[14px] font-medium text-[var(--color-ink)]">
            Could not verify subscription status for {auth.activeClinic.name}.
          </p>
          <p className="text-[12px] text-[var(--color-muted)]">{sub.error}</p>
          <button
            type="button"
            onClick={() => sub.refreshSubscription()}
            className="rounded-lg bg-[var(--color-teal)] px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
          >
            Retry Verification
          </button>
        </div>
      </div>
    );
  }

  // Clinic subscription / trial expired: render non-destructive paywall
  if (!sub.hasAccess) {
    return (
      <SubscriptionExpiredScreen
        clinicName={auth.activeClinic.name}
        clinicId={auth.activeClinic.id}
      />
    );
  }

  return <>{children}</>;
}
