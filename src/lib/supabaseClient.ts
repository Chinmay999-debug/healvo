import { createClient } from "@supabase/supabase-js";
import { readAuthRedirect } from "./authRedirect";

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Set them in .env (see .env.example). Never put a service-role/secret key here, only the publishable/anon key.",
  );
}

/**
 * What Supabase Auth put in the URL for this page load, captured BEFORE the
 * client below is created. Order matters: createClient() starts consuming and
 * clearing the auth fragment as it initialises, so reading it afterwards
 * loses the "your reset link has expired" case. Keep this line above the
 * client. See lib/authRedirect.ts.
 */
export const authRedirect = readAuthRedirect();

// Single browser-side client for the whole app. Session persistence uses
// Supabase's default (localStorage), which is what gives us "survives a
// page refresh" and "sign-out clears it" for free — no custom token storage.
export const supabase = createClient(url, publishableKey);

/**
 * A throwaway client used only to check that someone typing into a
 * "current password" box really knows it. It shares no storage with the
 * client above and persists nothing, so a wrong guess never disturbs the
 * live session and a correct one never silently swaps it out underneath the
 * app. Never use it for data access.
 */
export function createVerificationClient() {
  return createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
