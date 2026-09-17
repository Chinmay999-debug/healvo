import { describe, expect, it } from "vitest";
import {
  MIN_PASSWORD_LENGTH,
  hasErrors,
  validateConfirmation,
  validateNewPassword,
  validatePasswordChange,
  validatePasswordReset,
} from "./passwordPolicy";

const short = "a".repeat(MIN_PASSWORD_LENGTH - 1);
const ok = "a".repeat(MIN_PASSWORD_LENGTH);

describe("validateNewPassword", () => {
  it("rejects an empty password", () => {
    expect(validateNewPassword("")).toBe("Enter a new password.");
  });

  it("rejects a password below the project minimum", () => {
    expect(validateNewPassword(short)).toContain(String(MIN_PASSWORD_LENGTH));
  });

  it("accepts a password exactly at the minimum", () => {
    expect(validateNewPassword(ok)).toBeNull();
  });
});

describe("validateConfirmation", () => {
  it("rejects an empty confirmation", () => {
    expect(validateConfirmation(ok, "")).toBe("Re-enter your new password.");
  });

  it("rejects a mismatch", () => {
    expect(validateConfirmation(ok, `${ok}x`)).toBe("Those passwords don't match.");
  });

  it("accepts a match", () => {
    expect(validateConfirmation(ok, ok)).toBeNull();
  });
});

describe("validatePasswordReset", () => {
  it("reports one error, not two, while the password is still too short", () => {
    const errors = validatePasswordReset(short, "");
    expect(errors.password).toBeTruthy();
    expect(errors.confirmation).toBeUndefined();
  });

  it("reports the mismatch once the password itself is valid", () => {
    expect(validatePasswordReset(ok, "different").confirmation).toBe(
      "Those passwords don't match.",
    );
  });

  it("passes a valid, matching pair", () => {
    expect(hasErrors(validatePasswordReset(ok, ok))).toBe(false);
  });
});

describe("validatePasswordChange", () => {
  it("requires the current password", () => {
    expect(validatePasswordChange("", ok, ok).currentPassword).toBe(
      "Enter your current password.",
    );
  });

  it("rejects reusing the current password", () => {
    const errors = validatePasswordChange(ok, ok, ok);
    expect(errors.password).toBe("Your new password must be different from your current one.");
  });

  it("does not mask a too-short password with the reuse message", () => {
    const errors = validatePasswordChange(short, short, short);
    expect(errors.password).toContain(String(MIN_PASSWORD_LENGTH));
  });

  it("carries the confirmation mismatch through", () => {
    const errors = validatePasswordChange("current-one", ok, `${ok}x`);
    expect(errors.confirmation).toBe("Those passwords don't match.");
  });

  it("passes a well-formed change", () => {
    expect(hasErrors(validatePasswordChange("current-one", ok, ok))).toBe(false);
  });
});
