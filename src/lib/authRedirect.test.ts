import { describe, expect, it } from "vitest";
import {
  isExpiredLink,
  isRecoveryRedirect,
  parseAuthRedirect,
} from "./authRedirect";

const APP = "https://app.healvo.in/reset-password";

// The exact shapes Supabase Auth redirects with on the implicit flow this
// client uses (flowType defaults to "implicit" in supabase-js v2).
const WORKING_LINK = `${APP}#access_token=eyJhbGc.fake.token&expires_in=3600&refresh_token=abc123&token_type=bearer&type=recovery`;
const EXPIRED_LINK = `${APP}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`;

describe("parseAuthRedirect", () => {
  it("reads a working recovery link", () => {
    const params = parseAuthRedirect(WORKING_LINK);
    expect(params.type).toBe("recovery");
    expect(params.hasSession).toBe(true);
    expect(params.error).toBeNull();
  });

  it("reads an expired link, decoding the description", () => {
    const params = parseAuthRedirect(EXPIRED_LINK);
    expect(params.error).toBe("access_denied");
    expect(params.errorCode).toBe("otp_expired");
    expect(params.errorDescription).toBe("Email link is invalid or has expired");
    expect(params.hasSession).toBe(false);
  });

  it("also reads params rewritten into the query string", () => {
    const params = parseAuthRedirect(`${APP}?error=access_denied&error_code=otp_expired`);
    expect(params.errorCode).toBe("otp_expired");
  });

  it("returns an empty result for a plain URL", () => {
    const params = parseAuthRedirect(APP);
    expect(params.type).toBeNull();
    expect(params.hasSession).toBe(false);
    expect(params.error).toBeNull();
  });

  it("does not throw on a malformed href", () => {
    expect(() => parseAuthRedirect("not a url")).not.toThrow();
    expect(parseAuthRedirect("not a url").type).toBeNull();
  });
});

describe("isRecoveryRedirect", () => {
  it("is true only when a recovery link actually carried a session", () => {
    expect(isRecoveryRedirect(parseAuthRedirect(WORKING_LINK))).toBe(true);
    expect(isRecoveryRedirect(parseAuthRedirect(EXPIRED_LINK))).toBe(false);
    expect(isRecoveryRedirect(parseAuthRedirect(APP))).toBe(false);
  });

  it("is false for a signup confirmation, which is not a password reset", () => {
    const signup = `${APP}#access_token=tok&type=signup`;
    expect(isRecoveryRedirect(parseAuthRedirect(signup))).toBe(false);
  });
});

describe("isExpiredLink", () => {
  it("recognises Supabase's expired-link redirect", () => {
    expect(isExpiredLink(parseAuthRedirect(EXPIRED_LINK))).toBe(true);
  });

  it("is false for a working link and for a plain visit", () => {
    expect(isExpiredLink(parseAuthRedirect(WORKING_LINK))).toBe(false);
    expect(isExpiredLink(parseAuthRedirect(APP))).toBe(false);
  });
});
