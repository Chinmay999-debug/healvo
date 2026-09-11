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
  onAuthStateChange,
  signInWithGoogle as signInWithGoogleRequest,
  signInWithPassword,
  signOut as signOutRequest,
  signUpWithPassword,
} from "../services/auth";
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
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [clinics, setClinics] = useState<ClinicMembership[]>([]);
  const [activeClinic, setActiveClinic] = useState<ClinicSummary | null>(null);

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

    const unsubscribe = onAuthStateChange((nextSession) => {
      if (cancelled) return;
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
    }),
    [loading, session, profile, clinics, activeClinic, signIn, signUp, signInWithGoogle, signOut, refresh],
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
