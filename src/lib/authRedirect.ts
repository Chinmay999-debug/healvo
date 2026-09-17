/**
 * Reads what Supabase Auth appended to the URL when it bounced the browser
 * back from an email link.
 *
 * On the implicit flow this client uses, a working recovery link arrives as
 * `#access_token=…&type=recovery&…`, and a dead one as
 * `#error=access_denied&error_code=otp_expired&error_description=…`.
 * supabase-js consumes and strips that fragment while it initialises, so the
 * parse has to happen before `createClient()` runs — see supabaseClient.ts,
 * which captures it on the line above the client it creates.
 */

export interface AuthRedirectParams {
  /** "recovery" for a password-reset link, "signup" for a confirmation, etc. */
  type: string | null;
  /** A session was handed over, i.e. the link was still good. */
  hasSession: boolean;
  /** Machine-readable failure, e.g. "access_denied". */
  error: string | null;
  /** More specific failure, e.g. "otp_expired". */
  errorCode: string | null;
  /** Supabase's own wording, safe to show as a fallback. */
  errorDescription: string | null;
}

const EMPTY: AuthRedirectParams = {
  type: null,
  hasSession: false,
  error: null,
  errorCode: null,
  errorDescription: null,
};

/**
 * Parses a full href. Supabase puts these in the fragment, but hosting
 * layers and some mail clients rewrite a link into query parameters, so both
 * are read, with the fragment winning where they disagree.
 */
export function parseAuthRedirect(href: string): AuthRedirectParams {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return EMPTY;
  }

  const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
  const query = url.searchParams;
  const read = (key: string) => fragment.get(key) ?? query.get(key);

  return {
    type: read("type"),
    hasSession: Boolean(read("access_token")),
    error: read("error"),
    errorCode: read("error_code"),
    errorDescription: read("error_description")?.replace(/\+/g, " ") ?? null,
  };
}

/** Reads the address bar, or an empty result outside the browser. */
export function readAuthRedirect(): AuthRedirectParams {
  if (typeof window === "undefined") return EMPTY;
  return parseAuthRedirect(window.location.href);
}

/** True when this page load is a password-reset link being followed. */
export function isRecoveryRedirect(params: AuthRedirectParams): boolean {
  return params.type === "recovery" && params.hasSession;
}

/** True when the link was real but is no longer usable. */
export function isExpiredLink(params: AuthRedirectParams): boolean {
  if (!params.error && !params.errorCode) return false;
  return (
    params.errorCode === "otp_expired" ||
    params.error === "access_denied" ||
    /expired|invalid/i.test(params.errorDescription ?? "")
  );
}
