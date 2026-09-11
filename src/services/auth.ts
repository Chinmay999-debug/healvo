import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

/** Thin wrapper over supabase-js auth — the one place session/auth calls
 * live, so components and the future clinic/auth context never import
 * supabaseClient directly. */

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  return session?.user ?? null;
}

export async function signInWithPassword(email: string, password: string): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.session) throw new Error("Sign-in did not return a session.");
  return data.session;
}

/** Creates the auth.users row via Supabase Auth's existing signUp flow — the
 * same sanctioned entry point signInWithPassword above uses, just the
 * account-creation half of it. Returns session: null when the project has
 * email confirmation enabled (no session until the link is clicked); callers
 * should treat that as success and prompt the user to check their inbox
 * rather than assuming they're signed in. */
export async function signUpWithPassword(
  email: string,
  password: string,
): Promise<{ session: Session | null; user: User | null }> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return { session: data.session, user: data.user };
}

/** Kicks off Supabase's redirect-based Google OAuth flow. Supabase navigates
 * the browser away to Google and back — there's no session to return here.
 * On return, supabase-js's default detectSessionInUrl picks the session up
 * from the callback URL and onAuthStateChange fires, so the existing
 * AuthProvider flow (loadIdentity, RequireAuthAndClinic's onboarding check)
 * handles a Google sign-in identically to email/password. */
export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Fires immediately with the current state, then again on every sign-in/
 * sign-out/token-refresh. Returns the unsubscribe function. */
export function onAuthStateChange(callback: (session: Session | null) => void): () => void {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => subscription.unsubscribe();
}
