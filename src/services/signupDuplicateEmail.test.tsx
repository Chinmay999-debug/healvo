import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// The real Supabase client can't be constructed under Node 20 (no WebSocket),
// so signUp is a mock that returns whatever each test sets.
const signUp = vi.fn();
vi.mock("../lib/supabaseClient", () => ({
  supabase: { auth: { signUp: (...args: unknown[]) => signUp(...args) } },
  createVerificationClient: () => ({}),
}));

import { EmailAlreadyRegisteredError, isEmailAlreadyRegisteredError, signUpWithPassword } from "./auth";
import { DuplicateEmailNotice } from "../components/auth/AuthScreen";

const identity = { id: "i1", provider: "email", identity_id: "i1", user_id: "u1" };
const user = (identities: unknown[] | undefined) => ({ id: "u1", email: "a@b.test", identities });

beforeEach(() => signUp.mockReset());

describe("signUpWithPassword duplicate-email detection", () => {
  it("new address with confirmation ON: returns the user, no session (check inbox)", async () => {
    signUp.mockResolvedValue({ data: { user: user([identity]), session: null }, error: null });
    const res = await signUpWithPassword("new@b.test", "secret123");
    expect(res.session).toBeNull();
    expect(res.user?.identities).toHaveLength(1);
  });

  it("new address with confirmation OFF: returns the session", async () => {
    const session = { access_token: "t" };
    signUp.mockResolvedValue({ data: { user: user([identity]), session }, error: null });
    await expect(signUpWithPassword("new@b.test", "secret123")).resolves.toMatchObject({ session });
  });

  it("existing confirmed address (confirmation ON, obfuscated: empty identities) throws EmailAlreadyRegisteredError", async () => {
    signUp.mockResolvedValue({ data: { user: user([]), session: null }, error: null });
    const err = await signUpWithPassword("old@b.test", "secret123").catch((e: unknown) => e);
    expect(isEmailAlreadyRegisteredError(err)).toBe(true);
    expect((err as Error).message).toBe("An account with this email already exists. Please log in instead.");
  });

  it("existing address with confirmation OFF (422 user_already_exists) throws EmailAlreadyRegisteredError", async () => {
    signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "user_already_exists", message: "User already registered", status: 422 },
    });
    await expect(signUpWithPassword("old@b.test", "secret123")).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
  });

  it("existing but unconfirmed address (real user returned, identities present) stays a normal check-inbox success", async () => {
    signUp.mockResolvedValue({ data: { user: user([identity]), session: null }, error: null });
    await expect(signUpWithPassword("pending@b.test", "secret123")).resolves.toMatchObject({ session: null });
  });

  it("a response without an identities field is not treated as a duplicate", async () => {
    signUp.mockResolvedValue({ data: { user: user(undefined), session: null }, error: null });
    await expect(signUpWithPassword("x@b.test", "secret123")).resolves.toMatchObject({ session: null });
  });

  it("other errors (invalid email, weak password, rate limit) pass through unchanged", async () => {
    const invalid = { code: "validation_failed", message: "Unable to validate email address: invalid format", status: 400 };
    signUp.mockResolvedValue({ data: { user: null, session: null }, error: invalid });
    const err = await signUpWithPassword("not-an-email", "secret123").catch((e: unknown) => e);
    expect(err).toBe(invalid);
    expect(isEmailAlreadyRegisteredError(err)).toBe(false);
  });
});

describe("DuplicateEmailNotice", () => {
  const html = renderToStaticMarkup(<DuplicateEmailNotice onLogin={() => {}} />);
  it("shows the exact message with a log in button, in field-error styling", () => {
    const text = html.replace(/<[^>]+>/g, "");
    expect(text).toBe("An account with this email already exists. Please log in instead.");
    expect(html).toMatch(/<button type="button"[^>]*>log in<\/button>/);
    expect(html).toContain("text-[var(--color-danger-text)]");
    expect(html).toContain('id="signup-email-error"');
    expect(html).toContain('role="alert"');
  });
});
