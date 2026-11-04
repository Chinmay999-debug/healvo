import { beforeEach, describe, expect, it, vi } from "vitest";

// supabaseClient throws without env; the RPC is the only thing used here.
const rpc = vi.fn();
vi.mock("./supabaseClient", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));

import {
  captureSalesReferral,
  claimStoredReferral,
  clearStoredReferral,
  getStoredReferral,
  normalizeReferralCode,
  referralLink,
  referralOnboardingAttribution,
  referralSignupMetadata,
} from "./salesReferral";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
}

let cookieJar = "";
beforeEach(() => {
  rpc.mockReset();
  vi.stubGlobal("localStorage", memoryStorage());
  cookieJar = "";
  vi.stubGlobal("document", {
    get cookie() {
      return cookieJar;
    },
    set cookie(v: string) {
      const [pair] = v.split("; ");
      const name = pair.slice(0, pair.indexOf("="));
      const parts = cookieJar ? cookieJar.split("; ").filter((p) => !p.startsWith(`${name}=`)) : [];
      if (!/Max-Age=0/.test(v)) parts.push(pair);
      cookieJar = parts.join("; ");
    },
  });
  vi.stubGlobal("window", { location: { pathname: "/signup", search: "", origin: "https://app.healvo.in" } });
  vi.stubGlobal("location", { protocol: "https:" });
});

describe("normalizeReferralCode", () => {
  it("upper-cases and trims valid codes", () => {
    expect(normalizeReferralCode(" rahul01 ")).toBe("RAHUL01");
  });
  it("rejects anything that is not 3-20 letters/digits", () => {
    for (const bad of ["", "ab", "RAHUL-01", "<script>", "A".repeat(21), null, undefined]) {
      expect(normalizeReferralCode(bad)).toBeNull();
    }
  });
});

describe("captureSalesReferral", () => {
  it("stores a valid code with its visit token", async () => {
    rpc.mockResolvedValue({ data: { valid: true, token: "a1b2c3d4e5f6" }, error: null });
    const ref = await captureSalesReferral("?ref=rahul01");
    expect(rpc).toHaveBeenCalledWith("sales_record_referral_visit", expect.objectContaining({ p_code: "RAHUL01" }));
    expect(ref).toMatchObject({ code: "RAHUL01", token: "a1b2c3d4e5f6" });
  });

  it("keeps the first code (first touch) but still records the later visit", async () => {
    rpc.mockResolvedValueOnce({ data: { valid: true, token: "aaaaaaaa" }, error: null });
    await captureSalesReferral("?ref=RAHUL01");
    rpc.mockResolvedValueOnce({ data: { valid: true, token: "bbbbbbbb" }, error: null });
    const ref = await captureSalesReferral("?ref=PRIYA01");
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(ref?.code).toBe("RAHUL01");
  });

  it("does not store invalid/inactive codes", async () => {
    rpc.mockResolvedValue({ data: { valid: false }, error: null });
    expect(await captureSalesReferral("?ref=NOPE99")).toBeNull();
    expect(getStoredReferral()).toBeNull();
  });

  it("never throws when the network fails", async () => {
    rpc.mockRejectedValue(new Error("offline"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(captureSalesReferral("?ref=RAHUL01")).resolves.toBeNull();
  });

  it("survives cleared localStorage through the cookie copy", async () => {
    rpc.mockResolvedValue({ data: { valid: true, token: "cccccccc" }, error: null });
    await captureSalesReferral("?ref=RAHUL01");
    (localStorage as unknown as { clear(): void }).clear();
    expect(getStoredReferral()?.code).toBe("RAHUL01");
  });

  it("ignores pages without ?ref", async () => {
    expect(await captureSalesReferral("?utm_source=x")).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("payloads", () => {
  it("builds signup metadata and onboarding attribution", async () => {
    rpc.mockResolvedValue({ data: { valid: true, token: "dddddddd" }, error: null });
    await captureSalesReferral("?ref=RAHUL01");
    expect(referralSignupMetadata()).toEqual({ healvo_ref_code: "RAHUL01", healvo_ref_token: "dddddddd" });
    expect(referralOnboardingAttribution()).toEqual({ sales_ref_code: "RAHUL01", sales_ref_token: "dddddddd" });
    clearStoredReferral();
    expect(referralSignupMetadata()).toEqual({});
    expect(getStoredReferral()).toBeNull();
  });

  it("claims once per user and retries after a failure", async () => {
    rpc.mockResolvedValueOnce({ data: { valid: true, token: "eeeeeeee" }, error: null });
    await captureSalesReferral("?ref=RAHUL01");
    rpc.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    await claimStoredReferral("u1");
    rpc.mockResolvedValueOnce({ data: { status: "attributed" }, error: null });
    await claimStoredReferral("u1");
    await claimStoredReferral("u1");
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenLastCalledWith("sales_claim_referral", { p_code: "RAHUL01", p_visit_token: "eeeeeeee" });
  });

  it("builds origin-based links", () => {
    expect(referralLink("RAHUL01")).toBe("https://app.healvo.in/signup?ref=RAHUL01");
  });
});
