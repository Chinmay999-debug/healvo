import { supabase } from "./supabaseClient";

/**
 * Carries a sales referral (https://app.healvo.in/signup?ref=RAHUL01) from the
 * link to the server. The browser never decides attribution: it only
 * remembers the code + an opaque visit token long enough to hand them to
 *   - supabase.auth.signUp (options.data) -> auth.users trigger, or
 *   - sales_claim_referral()              -> after a Google sign-in, or
 *   - create_clinic_with_owner()          -> during onboarding.
 * The server re-validates the code every time and applies first-touch rules
 * (migrations/20261104120000_sales_referrals.sql). Once a signup exists the
 * attribution lives in Postgres, so verifying email on another device,
 * clearing storage or logging out cannot lose it.
 *
 * The local copy is kept in localStorage AND a first-party cookie, so a
 * cleared localStorage alone does not drop the code between the link and
 * signup. The first valid code wins in this browser too.
 */

const STORE_KEY = "healvo_sales_ref";
const VISITOR_KEY = "healvo_visitor_id";
const COOKIE_DAYS = 60;
const CODE_PATTERN = /^[A-Z0-9]{3,20}$/;

export interface StoredReferral {
  code: string;
  token: string | null;
  capturedAt: string;
}

export function normalizeReferralCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function writeCookie(name: string, value: string | null) {
  if (typeof document === "undefined") return;
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  if (value === null) {
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${secure}`;
  } else {
    document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${COOKIE_DAYS * 86400}; Path=/; SameSite=Lax${secure}`;
  }
}

function parseStored(raw: string | null): StoredReferral | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredReferral>;
    const code = normalizeReferralCode(value.code);
    if (!code) return null;
    const token = typeof value.token === "string" && /^[0-9a-f]{8,64}$/.test(value.token) ? value.token : null;
    return { code, token, capturedAt: typeof value.capturedAt === "string" ? value.capturedAt : new Date().toISOString() };
  } catch {
    return null;
  }
}

export function getStoredReferral(): StoredReferral | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORE_KEY);
  } catch {
    raw = null;
  }
  return parseStored(raw) ?? parseStored(readCookie(STORE_KEY));
}

function storeReferral(value: StoredReferral) {
  const raw = JSON.stringify(value);
  try {
    localStorage.setItem(STORE_KEY, raw);
  } catch {
    // Storage refused (private mode): the cookie below still carries it.
  }
  writeCookie(STORE_KEY, raw);
}

export function clearStoredReferral() {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    // ignore
  }
  writeCookie(STORE_KEY, null);
}

/** Anonymous per-browser id, only used to de-duplicate repeat link visits. */
function visitorId(): string | null {
  const isUuid = (v: string | null) => !!v && /^[0-9a-f-]{36}$/i.test(v);
  let id: string | null = null;
  try {
    id = localStorage.getItem(VISITOR_KEY);
  } catch {
    id = null;
  }
  if (!isUuid(id)) id = readCookie(VISITOR_KEY);
  if (!isUuid(id)) {
    id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : null;
  }
  if (!id) return null;
  try {
    localStorage.setItem(VISITOR_KEY, id);
  } catch {
    // ignore
  }
  writeCookie(VISITOR_KEY, id);
  return id;
}

let captureInFlight: Promise<StoredReferral | null> | null = null;

/**
 * Call on page load. When the URL has ?ref=CODE it records the visit
 * server-side and, if the code is valid and this browser has no earlier
 * referral, remembers it. Returns the referral now in effect for this
 * browser (which may be an earlier one: first touch wins).
 */
export function captureSalesReferral(search: string = typeof window !== "undefined" ? window.location.search : "") {
  const code = normalizeReferralCode(new URLSearchParams(search).get("ref"));
  if (!code) return Promise.resolve(getStoredReferral());
  if (captureInFlight) return captureInFlight;

  captureInFlight = (async () => {
    try {
      const { data, error } = await supabase.rpc("sales_record_referral_visit", {
        p_code: code,
        p_visitor_id: visitorId(),
        p_landing_path: typeof window !== "undefined" ? window.location.pathname : null,
      });
      if (error) throw error;
      const result = (data ?? {}) as { valid?: boolean; token?: string };
      const existing = getStoredReferral();
      if (result.valid && !existing) {
        storeReferral({ code, token: result.token ?? null, capturedAt: new Date().toISOString() });
      }
      return getStoredReferral();
    } catch (err) {
      // Tracking must never break the signup page.
      console.error("Could not record referral visit:", err);
      return getStoredReferral();
    } finally {
      captureInFlight = null;
    }
  })();
  return captureInFlight;
}

/** The signup form was submitted (best effort; never blocks signup). */
export async function markReferralSignupStarted(): Promise<void> {
  const stored = getStoredReferral();
  if (!stored?.token) return;
  try {
    await supabase.rpc("sales_mark_signup_started", { p_visit_token: stored.token });
  } catch {
    // ignore
  }
}

/** user_metadata for supabase.auth.signUp, read by the auth.users trigger. */
export function referralSignupMetadata(): Record<string, string> {
  const stored = getStoredReferral();
  if (!stored) return {};
  return stored.token
    ? { healvo_ref_code: stored.code, healvo_ref_token: stored.token }
    : { healvo_ref_code: stored.code };
}

/** Extra keys for create_clinic_with_owner's p_attribution. */
export function referralOnboardingAttribution(): Record<string, string> {
  const stored = getStoredReferral();
  if (!stored) return {};
  return stored.token
    ? { sales_ref_code: stored.code, sales_ref_token: stored.token }
    : { sales_ref_code: stored.code };
}

const claimedFor = new Set<string>();

/**
 * For a signed-in user with no clinic yet (typically a Google signup, which
 * cannot carry signup metadata): asks the server to attribute them. Safe to
 * call repeatedly; the server ignores it for anyone already attributed or
 * with an existing clinic.
 */
export async function claimStoredReferral(userId: string): Promise<void> {
  const stored = getStoredReferral();
  if (!stored || claimedFor.has(userId)) return;
  claimedFor.add(userId);
  try {
    const { error } = await supabase.rpc("sales_claim_referral", {
      p_code: stored.code,
      p_visit_token: stored.token,
    });
    if (error) throw error;
  } catch (err) {
    claimedFor.delete(userId);
    console.error("Could not claim referral:", err);
  }
}

/** Origin-based (like buildBookingUrl), so it is app.healvo.in in production. */
export function referralLink(
  code: string,
  origin = typeof window !== "undefined" ? window.location.origin : "https://app.healvo.in",
): string {
  return `${origin}/signup?ref=${encodeURIComponent(code)}`;
}

export function whatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
