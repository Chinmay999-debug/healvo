import { describe, it, expect, vi } from "vitest";

// subscription.ts imports the Supabase client, which can't be constructed
// under Node 20 (no WebSocket). The helpers under test never use it.
vi.mock("../lib/supabaseClient", () => ({ supabase: {} }));

import { hasComplimentaryAccess, hasSubscriptionAccess } from "./subscription";
import type { ClinicComplimentaryAccess, ClinicSubscription } from "../types/subscription";

const NOW = new Date("2026-10-23T09:00:00Z");

const grant = (overrides: Partial<ClinicComplimentaryAccess> = {}): ClinicComplimentaryAccess => ({
  plan_code: "premium",
  plan_name: "Premium Monthly",
  starts_at: "2026-10-23T08:00:00Z",
  expires_at: null,
  ...overrides,
});

describe("hasComplimentaryAccess", () => {
  it("is false without a grant", () => {
    expect(hasComplimentaryAccess(null, NOW)).toBe(false);
  });

  it("is true for a started grant with no end date", () => {
    expect(hasComplimentaryAccess(grant(), NOW)).toBe(true);
  });

  it("is true before a set end date and false from it", () => {
    expect(hasComplimentaryAccess(grant({ expires_at: "2026-10-24T00:00:00Z" }), NOW)).toBe(true);
    expect(hasComplimentaryAccess(grant({ expires_at: NOW.toISOString() }), NOW)).toBe(false);
  });

  it("is false before the grant starts", () => {
    expect(hasComplimentaryAccess(grant({ starts_at: "2026-10-24T00:00:00Z" }), NOW)).toBe(false);
  });

  it("covers a lapsed paid subscription (the founder's case)", () => {
    const lapsed = {
      status: "active",
      current_period_ends_at: "2026-10-16T20:09:08Z",
    } as ClinicSubscription;
    expect(hasSubscriptionAccess(lapsed, NOW)).toBe(false);
    expect(hasSubscriptionAccess(lapsed, NOW) || hasComplimentaryAccess(grant(), NOW)).toBe(true);
  });
});
