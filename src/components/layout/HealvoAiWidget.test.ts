import { describe, expect, it, vi } from "vitest";

// The widget module imports the app's Supabase client; nothing here uses it.
vi.mock("../../lib/supabaseClient", () => ({ supabase: {} }));

import { resolveAiAccess, type AiLookup } from "./HealvoAiWidget";

const base = { loading: false, hasAccess: true, clinicId: "clinic-a" };
const lookup = (result: AiLookup["result"], clinicId = "clinic-a"): AiLookup => ({ clinicId, result });

describe("resolveAiAccess (display only; the server enforces access)", () => {
  it("entitled -> enabled, not entitled (Core) -> locked", () => {
    expect(resolveAiAccess({ ...base, lookup: lookup(true) })).toBe("enabled");
    expect(resolveAiAccess({ ...base, lookup: lookup(false) })).toBe("locked");
  });

  it("nothing resolved yet, or lookup failed -> hidden", () => {
    expect(resolveAiAccess({ ...base, lookup: null })).toBe("hidden");
    expect(resolveAiAccess({ ...base, lookup: lookup("error") })).toBe("hidden");
  });

  it("no access (expired), subscription loading or no clinic -> hidden regardless of lookup", () => {
    expect(resolveAiAccess({ ...base, hasAccess: false, lookup: lookup(true) })).toBe("hidden");
    expect(resolveAiAccess({ ...base, loading: true, lookup: lookup(true) })).toBe("hidden");
    expect(resolveAiAccess({ ...base, clinicId: undefined, lookup: lookup(true) })).toBe("hidden");
  });

  it("never reuses another clinic's result", () => {
    expect(resolveAiAccess({ ...base, clinicId: "clinic-b", lookup: lookup(true, "clinic-a") })).toBe("hidden");
  });
});
