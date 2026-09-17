import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  getSession,
  hasPasswordIdentity,
  onAuthStateChange,
  sendPasswordResetEmail,
  signInWithGoogle as signInWithGoogleRequest,
  signInWithPassword,
  signOut as signOutRequest,
  signUpWithPassword,
  updatePassword,
  verifyPassword,
} from "../services/auth";
import { authRedirect } from "../lib/supabaseClient";
import { isRecoveryRedirect } from "../lib/authRedirect";
import {
  getActiveClinic,
  getCurrentProfile,
  getUserClinics,
  type ClinicMembership,
  type ClinicSummary,
  type Profile,
} from "../services/clinic";

/** The identity/tenant foundation this phase (P4.2) establishes. Deliberately
 * NOT consumed by any existing page yet — Overview/Today/Patients/Billing/etc.
 * keep reading from ClinicDataProvider's mock data exactly as before. This
 * context exists so that foundation is in place, in the same
 * Supabase -> data-access -> context -> app shape the rest of the app will
 * eventually plug into (see docs/backend-architecture-audit.md §15). */

interface AuthContextValue {
  /** True until the initial session check + profile/clinic lookup finishes.
   * Never blocks rendering of the existing app — callers that need this
   * (future auth-gated screens) can read it explicitly. */
  loading: boolean;
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  clinics: ClinicMembership[];
  activeClinic: ClinicSummary | null;
  /** True only when the active clinic is the single permanent demo clinic
   * (owned exclusively by demo@healvo.in) — see ClinicSummary.is_demo. Used
   * by ClinicDataProvider to decide whether the still-mock-backed areas
   * (billing/staff/documents/settings/doctor profile) show the seeded demo
   * content or start empty. Never affects Supabase-backed data access —
   * that's governed entirely by RLS. */
  isDemoAccount: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  /** Returns needsEmailConfirmation: true when the project requires clicking
   * an emailed link before a session exists yet — callers should show a
   * "check your inbox" state rather than assuming sign-up = signed-in. */
  signUp: (email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>;
  /** Redirects the browser to Google and back — never resolves with a
   * session itself. The returning redirect is picked up by
   * onAuthStateChange like any other sign-in (see services/auth.ts). */
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-runs profile/clinic resolution for the current session — e.g. after
   * createClinicWithOwner() succeeds. */
  refresh: () => Promise<void>;

  /** True from the moment a password-reset link is opened until the new
   * password is saved (or the user signs out). RequireAuthAndClinic reads
   * this to keep a recovery session out of the app and onboarding. */
  passwordRecovery: boolean;
  /** False for Google-only accounts, which have no password to change. */
  hasPassword: boolean;
  /** Emails a reset link. Resolves identically whether or not the address has
   * an account — never branch on it, or you leak who is registered. */
  sendPasswordReset: (email: string) => Promise<void>;
  /** Saves the new password for a recovery session and ends the reset state. */
  completePasswordReset: (password: string) => Promise<void>;
  /** Signed-in change. Resolves false when the current password is wrong, so
   * callers can show that inline instead of as a thrown error. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * A recovery session is an ordinary Supabase session, so nothing about the
 * session itself says "this person is halfway through resetting a password".
 * The flag is kept in sessionStorage so a refresh on the set-password screen
 * does not drop the user into the app with the reset unfinished, and so it
 * dies with the tab rather than lingering.
 */
const RECOVERY_FLAG = "healvo.password-recovery";

function readRecoveryFlag(): boolean {
  // The URL check covers the very first paint, before onAuthStateChange has
  // had a chance to fire PASSWORD_RECOVERY.
  if (isRecoveryRedirect(authRedirect)) return true;
  try {
    return sessionStorage.getItem(RECOVERY_FLAG) === "1";
  } catch {
    return false;
  }
}

function writeRecoveryFlag(active: boolean) {
  try {
    if (active) sessionStorage.setItem(RECOVERY_FLAG, "1");
    else sessionStorage.removeItem(RECOVERY_FLAG);
  } catch {
    // Private-mode storage refusal: the in-memory flag still gates this tab.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [clinics, setClinics] = useState<ClinicMembership[]>([]);
  const [activeClinic, setActiveClinic] = useState<ClinicSummary | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(readRecoveryFlag);

  const loadIdentity = useCallback(async (currentSession: Session | null) => {
    if (!currentSession) {
      setProfile(null);
      setClinics([]);
      setActiveClinic(null);
      return;
    }
    const [profileResult, clinicsResult, activeClinicResult] = await Promise.all([
      getCurrentProfile(),
      getUserClinics(),
      getActiveClinic(),
    ]);
    setProfile(profileResult);
    setClinics(clinicsResult);
    setActiveClinic(activeClinicResult);
  }, []);

  useEffect(() => {
    let cancelled = false;

    getSession().then((initialSession) => {
      if (cancelled) return;
      setSession(initialSession);
      loadIdentity(initialSession).finally(() => {
        if (!cancelled) setLoading(false);
      });
    });

    const unsubscribe = onAuthStateChange((nextSession, event) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY") {
        writeRecoveryFlag(true);
        setPasswordRecovery(true);
      } else if (event === "SIGNED_OUT") {
        writeRecoveryFlag(false);
        setPasswordRecovery(false);
      }
      setSession(nextSession);
      // Re-asserts loading for every post-mount identity resolution, not
      // just the very first one — a sign-in flips `session`/`user` truthy
      // synchronously here, but profile/clinics/activeClinic are still the
      // previous (usually empty) values until loadIdentity's network calls
      // resolve. Without this, `loading` stays false through that gap and
      // RequireAuthAndClinic's "no activeClinic yet" onboarding check reads
      // a stale null — wrongly latching every sign-in (including the demo
      // account, which does have a clinic) into onboarding for a frame.
      setLoading(true);
      loadIdentity(nextSession).finally(() => {
        if (!cancelled) setLoading(false);
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [loadIdentity]);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithPassword(email, password);
    // No manual state update needed here — onAuthStateChange fires and
    // loadIdentity runs from that single path, so sign-in-via-context and a
    // session restored on page load behave identically.
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { session: newSession } = await signUpWithPassword(email, password);
    // Same rationale as signIn — when a session comes back immediately,
    // onAuthStateChange fires and loadIdentity runs from that one path.
    return { needsEmailConfirmation: !newSession };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    await signInWithGoogleRequest();
  }, []);

  const signOut = useCallback(async () => {
    await signOutRequest();
  }, []);

  const refresh = useCallback(async () => {
    await loadIdentity(session);
  }, [loadIdentity, session]);

  const sendPasswordReset = useCallback(async (email: string) => {
    await sendPasswordResetEmail(email);
  }, []);

  const completePasswordReset = useCallback(async (password: string) => {
    await updatePassword(password);
    // Only cleared once Supabase has accepted the password. Clearing first
    // would release the guard while the reset could still fail.
    writeRecoveryFlag(false);
    setPasswordRecovery(false);
  }, []);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const email = session?.user?.email;
      if (!email) throw new Error("You need to be signed in to change your password.");
      const correct = await verifyPassword(email, currentPassword);
      if (!correct) return false;
      await updatePassword(newPassword);
      return true;
    },
    [session],
  );

  const value = useMemo(
    () => ({
      loading,
      user: session?.user ?? null,
      session,
      profile,
      clinics,
      activeClinic,
      isDemoAccount: activeClinic?.is_demo ?? false,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      refresh,
      passwordRecovery,
      hasPassword: hasPasswordIdentity(session?.user ?? null),
      sendPasswordReset,
      completePasswordReset,
      changePassword,
    }),
    [
      loading,
      session,
      profile,
      clinics,
      activeClinic,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      refresh,
      passwordRecovery,
      sendPasswordReset,
      completePasswordReset,
      changePassword,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
