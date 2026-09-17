import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { createVerificationClient, supabase } from "../lib/supabaseClient";

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
export function onAuthStateChange(
  callback: (session: Session | null, event: AuthChangeEvent) => void,
): () => void {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => callback(session, event));
  return () => subscription.unsubscribe();
}

// Password management ---------------------------------------------------------

/** Where Supabase sends the browser after a reset link is clicked. */
export const PASSWORD_RESET_PATH = "/reset-password";

/**
 * Built from the running origin rather than a baked-in constant, so the same
 * bundle works on localhost, a Vercel preview and app.healvo.in. Every origin
 * used must also be listed in the Supabase dashboard's redirect allow-list —
 * Supabase silently falls back to Site URL for anything not on it.
 */
export function passwordResetRedirectUrl(): string {
  return `${window.location.origin}${PASSWORD_RESET_PATH}`;
}

/**
 * Asks Supabase to email a reset link. Supabase deliberately answers the same
 * way whether or not the address has an account, so callers must show the
 * same "check your email" state either way and never branch on the result.
 */
export async function sendPasswordResetEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: passwordResetRedirectUrl(),
  });
  if (error) throw error;
}

/** Sets a new password for whoever the current session belongs to. */
export async function updatePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

/**
 * Confirms the person at the keyboard knows the account's current password.
 *
 * This project has `secure_password_change = false`, so Supabase would happily
 * change the password on session alone — that would let anyone who walked up
 * to an unlocked machine take the account over. The check runs on a throwaway
 * client (see createVerificationClient) so neither a wrong guess nor a correct
 * one touches the signed-in session.
 *
 * Returns false for a wrong password; throws for anything else (offline,
 * rate-limited) so those are not reported to the user as "wrong password".
 */
export async function verifyPassword(email: string, password: string): Promise<boolean> {
  const client = createVerificationClient();
  const { error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    const invalid =
      error.status === 400 ||
      /invalid login credentials|invalid_credentials/i.test(error.message);
    if (invalid) return false;
    throw error;
  }

  // Drop the token this check just minted. Local scope only: a global sign-out
  // here would revoke the user's real session as well.
  await client.auth.signOut({ scope: "local" }).catch(() => {});
  return true;
}

/**
 * Which providers this account can sign in with, from the identities Supabase
 * attaches to the user ("email", "google", …).
 */
export function signInProviders(user: User | null): string[] {
  if (!user) return [];
  const identities = user.identities ?? [];
  if (identities.length > 0) return identities.map((identity) => identity.provider);
  // Older sessions predate `identities` being populated; app_metadata carries
  // the same information.
  const metadata = user.app_metadata ?? {};
  if (Array.isArray(metadata.providers)) return metadata.providers as string[];
  return metadata.provider ? [metadata.provider as string] : [];
}

/**
 * True when the account has an email/password identity. A Google-only account
 * has no password to ask for, so the change-password form must not pretend
 * otherwise.
 */
export function hasPasswordIdentity(user: User | null): boolean {
  return signInProviders(user).includes("email");
}
