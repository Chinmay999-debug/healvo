import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Set them in .env (see .env.example). Never put a service-role/secret key here, only the publishable/anon key.",
  );
}

// Single browser-side client for the whole app. Session persistence uses
// Supabase's default (localStorage), which is what gives us "survives a
// page refresh" and "sign-out clears it" for free — no custom token storage.
export const supabase = createClient(url, publishableKey);
