import { describe, expect, it } from "vitest";
import { isTrackablePath } from "./metaPixel";

/**
 * The allowlist is what keeps patient identifiers out of Meta's hands: every
 * pixel event carries the current URL, so a route becoming trackable is a route
 * whose path is handed to an ad network. These cases are the reason the list is
 * an allowlist, and they should fail loudly if someone widens it.
 */
describe("isTrackablePath", () => {
  it("tracks the routes a prospective customer sees", () => {
    expect(isTrackablePath("/")).toBe(true);
    expect(isTrackablePath("/overview")).toBe(true);
    expect(isTrackablePath("/settings")).toBe(true);
    expect(isTrackablePath("/settings/subscription")).toBe(true);
    expect(isTrackablePath("/settings/clinic")).toBe(true);
  });

  it("never tracks a route carrying a patient or record identifier", () => {
    expect(isTrackablePath("/patients")).toBe(false);
    expect(isTrackablePath("/patients/8f14e45f-ceea-467a-9c1f-4b1f2d3c5a77")).toBe(false);
    expect(isTrackablePath("/patients/8f14e45f-ceea-467a-9c1f-4b1f2d3c5a77/consultation")).toBe(false);
    expect(isTrackablePath("/patients/8f14e45f-ceea-467a-9c1f-4b1f2d3c5a77/dental-chart")).toBe(false);
    expect(isTrackablePath("/patients/8f14e45f-ceea-467a-9c1f-4b1f2d3c5a77/documents")).toBe(false);
    expect(isTrackablePath("/billing/INV-2026-0001")).toBe(false);
    expect(isTrackablePath("/staff/3c1f2d3c-5a77-4b1f-9c1f-ceea467a8f14")).toBe(false);
  });

  it("does not track a clinic's own patients on the public booking page", () => {
    expect(isTrackablePath("/book/smile-dental-jaipur")).toBe(false);
  });

  it("does not track the clinical routes that happen to have no id in the path", () => {
    expect(isTrackablePath("/today")).toBe(false);
    expect(isTrackablePath("/billing")).toBe(false);
    expect(isTrackablePath("/reports")).toBe(false);
    expect(isTrackablePath("/staff")).toBe(false);
  });

  it("does not let a patient route pass by looking like a settings route", () => {
    expect(isTrackablePath("/settings/../patients/8f14e45f")).toBe(false);
    expect(isTrackablePath("/overview/patients/8f14e45f")).toBe(false);
    expect(isTrackablePath("/settings/subscription/8f14e45f")).toBe(false);
  });
});

import { vi, beforeEach, afterEach } from "vitest";
import { trackStartTrial, trackPurchase } from "./metaPixel";

describe("Meta Pixel Tracking", () => {
  let fbqMock: any;
  let store: Record<string, string>;

  beforeEach(() => {
    fbqMock = vi.fn();
    store = {};

    vi.stubGlobal("window", {
      fbq: fbqMock,
      localStorage: {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          store[key] = value;
        }),
      } as any,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe("trackStartTrial", () => {
    it("sends value: 0 and currency: INR without PII", () => {
      trackStartTrial({ subscriptionId: "sub_123", planCode: "pro_annual", trialDays: 7 });

      expect(fbqMock).toHaveBeenCalledTimes(1);
      expect(fbqMock).toHaveBeenCalledWith(
        "track",
        "StartTrial",
        {
          content_name: "pro_annual",
          content_category: "subscription",
          value: 0,
          currency: "INR",
          predicted_ltv: 0,
          trial_days: 7,
        },
        { eventID: "StartTrial:sub_123" }
      );
    });

    it("does not fire twice for the same subscriptionId", () => {
      trackStartTrial({ subscriptionId: "sub_123", planCode: "pro_annual", trialDays: 7 });
      trackStartTrial({ subscriptionId: "sub_123", planCode: "pro_annual", trialDays: 7 });
      expect(fbqMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("trackPurchase", () => {
    it("sends matching value and currency when amount is known", () => {
      trackPurchase({ transactionId: "txn_123", planCode: "pro_monthly", valueInPaise: 49900 });

      expect(fbqMock).toHaveBeenCalledTimes(1);
      expect(fbqMock).toHaveBeenCalledWith(
        "track",
        "Purchase",
        {
          content_name: "pro_monthly",
          content_type: "product",
          content_ids: ["pro_monthly"],
          value: 499,
          currency: "INR",
        },
        { eventID: "Purchase:txn_123" }
      );
    });

    it("does not fire when amount is missing", () => {
      trackPurchase({ transactionId: "txn_999", planCode: "pro_monthly", valueInPaise: null });
      expect(fbqMock).not.toHaveBeenCalled();
    });

    it("does not fire twice for the same transactionId", () => {
      trackPurchase({ transactionId: "txn_123", planCode: "pro_monthly", valueInPaise: 49900 });
      trackPurchase({ transactionId: "txn_123", planCode: "pro_monthly", valueInPaise: 49900 });
      expect(fbqMock).toHaveBeenCalledTimes(1);
    });
  });
});
