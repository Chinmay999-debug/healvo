import { describe, expect, it, vi } from "vitest";
import {
  RATE_LIMIT_MAX_REQUESTS,
  RateLimiter,
  createHealvoAiDeps,
  runHealvoAiChat,
  type HealvoAiDeps,
} from "./aiChatHandler";

// Clinic states mirror what public.has_entitlement() returns for them after
// migration 20260930120000 (verified separately against the real SQL).
const ENTITLED: Record<string, boolean> = {
  "clinic-trial": true,
  "clinic-core": false,
  "clinic-premium": true,
  "clinic-expired-trial": false,
  "clinic-expired-premium": false,
};
const SESSIONS: Record<string, { userId: string; clinics: string[] }> = {
  "tok-trial": { userId: "u-trial", clinics: ["clinic-trial"] },
  "tok-core": { userId: "u-core", clinics: ["clinic-core"] },
  "tok-premium": { userId: "u-premium", clinics: ["clinic-premium"] },
  "tok-expired-trial": { userId: "u-expired-trial", clinics: ["clinic-expired-trial"] },
  "tok-expired-premium": { userId: "u-expired-premium", clinics: ["clinic-expired-premium"] },
  "tok-two-clinics": { userId: "u-two", clinics: ["clinic-core", "clinic-premium"] },
  "tok-no-clinic": { userId: "u-none", clinics: [] },
};

function makeDeps() {
  const deps = {
    verifyUser: vi.fn(async (token: string) => SESSIONS[token]?.userId ?? null),
    activeClinicIds: vi.fn(async (userId: string) =>
      Object.values(SESSIONS).find((s) => s.userId === userId)?.clinics ?? []),
    hasAiEntitlement: vi.fn(async (clinicId: string) => ENTITLED[clinicId] === true),
    complete: vi.fn(async () => "Here is today's summary."),
    now: () => 1_000_000,
  } satisfies HealvoAiDeps;
  return deps;
}

const body = (extra: Record<string, unknown> = {}) => ({
  messages: [{ role: "user", content: "How did today go?" }],
  ...extra,
});

async function call(authHeader: string | undefined, payload = body(), deps = makeDeps()) {
  const result = await runHealvoAiChat({}, payload, authHeader, { deps, limiter: new RateLimiter() });
  return { result, deps };
}

describe("Healvo AI endpoint authorization", () => {
  it("no Authorization header -> 401, nothing else runs", async () => {
    const { result, deps } = await call(undefined);
    expect(result.status).toBe(401);
    expect(deps.verifyUser).not.toHaveBeenCalled();
    expect(deps.complete).not.toHaveBeenCalled();
  });

  it("malformed / non-bearer Authorization -> 401", async () => {
    for (const header of ["", "Bearer", "Bearer   ", "Basic abc", "tok-premium"]) {
      const { result, deps } = await call(header);
      expect(result.status, header).toBe(401);
      expect(deps.complete).not.toHaveBeenCalled();
    }
  });

  it("invalid or expired token (Supabase Auth rejects it) -> 401", async () => {
    const { result, deps } = await call("Bearer not-a-real-session");
    expect(result.status).toBe(401);
    expect(deps.verifyUser).toHaveBeenCalledWith("not-a-real-session");
    expect(deps.hasAiEntitlement).not.toHaveBeenCalled();
  });

  it("the anon/publishable key is not an identity -> 401", async () => {
    const { result } = await call("Bearer sb_publishable_or_anon_jwt");
    expect(result.status).toBe(401);
  });

  it("Core clinic -> 403 with Premium upgrade message", async () => {
    const { result, deps } = await call("Bearer tok-core");
    expect(result.status).toBe(403);
    expect(JSON.stringify(result.body)).toContain("Premium");
    expect(deps.complete).not.toHaveBeenCalled();
  });

  it("valid trial -> allowed", async () => {
    const { result, deps } = await call("Bearer tok-trial");
    expect(result).toEqual({ status: 200, body: { reply: "Here is today's summary." } });
    expect(deps.hasAiEntitlement).toHaveBeenCalledWith("clinic-trial");
  });

  it("Premium -> allowed", async () => {
    const { result } = await call("Bearer tok-premium");
    expect(result.status).toBe(200);
  });

  it("expired trial -> 403", async () => {
    const { result, deps } = await call("Bearer tok-expired-trial");
    expect(result.status).toBe(403);
    expect(deps.complete).not.toHaveBeenCalled();
  });

  it("expired Premium -> 403", async () => {
    const { result } = await call("Bearer tok-expired-premium");
    expect(result.status).toBe(403);
  });

  it("cross-clinic: a client-supplied clinic_id the user doesn't belong to -> 403, entitlement never checked for it", async () => {
    const { result, deps } = await call("Bearer tok-core", body({ clinic_id: "clinic-premium" }));
    expect(result.status).toBe(403);
    expect(deps.hasAiEntitlement).not.toHaveBeenCalled();
    expect(deps.complete).not.toHaveBeenCalled();
  });

  it("client-supplied clinic_id is honoured only when it is one of the user's memberships", async () => {
    const ok = await call("Bearer tok-two-clinics", body({ clinic_id: "clinic-premium" }));
    expect(ok.result.status).toBe(200);
    expect(ok.deps.hasAiEntitlement).toHaveBeenCalledWith("clinic-premium");
    const core = await call("Bearer tok-two-clinics", body({ clinic_id: "clinic-core" }));
    expect(core.result.status).toBe(403);
  });

  it("without clinic_id the server uses the user's first active membership (same as the app)", async () => {
    const { result, deps } = await call("Bearer tok-two-clinics");
    expect(deps.hasAiEntitlement).toHaveBeenCalledWith("clinic-core");
    expect(result.status).toBe(403);
  });

  it("user with no active clinic -> 403", async () => {
    const { result } = await call("Bearer tok-no-clinic");
    expect(result.status).toBe(403);
  });

  it("entitlement lookup failure fails closed -> 403", async () => {
    const deps = makeDeps();
    deps.hasAiEntitlement.mockRejectedValueOnce(new Error("network"));
    const { result } = await call("Bearer tok-premium", body(), deps);
    expect(result.status).toBe(403);
  });

  it("auth provider failure fails closed -> 401", async () => {
    const deps = makeDeps();
    deps.verifyUser.mockRejectedValueOnce(new Error("auth down"));
    const { result } = await call("Bearer tok-premium", body(), deps);
    expect(result.status).toBe(401);
  });

  it("entitled user still needs a message -> 400", async () => {
    const { result } = await call("Bearer tok-premium", { messages: [] });
    expect(result.status).toBe(400);
  });

  it("server without Supabase config and no injected deps -> 500, not open", async () => {
    const result = await runHealvoAiChat({}, body(), "Bearer tok-premium");
    expect(result.status).toBe(500);
  });
});

describe("rate limit", () => {
  it(`allows ${RATE_LIMIT_MAX_REQUESTS} requests per user per minute, then 429`, async () => {
    const deps = makeDeps();
    const limiter = new RateLimiter();
    const statuses: number[] = [];
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS + 1; i++) {
      statuses.push((await runHealvoAiChat({}, body(), "Bearer tok-premium", { deps, limiter })).status);
    }
    expect(statuses.slice(0, RATE_LIMIT_MAX_REQUESTS).every((s) => s === 200)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
    // Another user is unaffected.
    expect((await runHealvoAiChat({}, body(), "Bearer tok-trial", { deps, limiter })).status).toBe(200);
  });

  it("window slides", () => {
    const limiter = new RateLimiter(2, 1000);
    expect(limiter.allow("u", 0)).toBe(true);
    expect(limiter.allow("u", 10)).toBe(true);
    expect(limiter.allow("u", 20)).toBe(false);
    expect(limiter.allow("u", 1001)).toBe(true);
  });
});

describe("production Supabase wiring (createHealvoAiDeps)", () => {
  // supabase-js builds a realtime client at construction and needs a WebSocket
  // class; Node 20 (local) has none, Vercel's Node 24 does. Never used here.
  if (typeof globalThis.WebSocket === "undefined") vi.stubGlobal("WebSocket", class {});

  const env ={ VITE_SUPABASE_URL: "https://proj.supabase.co", VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test" };

  function fakeFetch() {
    const calls: { url: string; method: string; auth: string | null; body: string | null }[] = [];
    const impl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      calls.push({ url, method: init?.method ?? "GET", auth: headers.get("Authorization"), body: (init?.body as string) ?? null });
      if (url.includes("/auth/v1/user")) {
        return headers.get("Authorization") === "Bearer user-jwt"
          ? Response.json({ id: "user-1", aud: "authenticated", role: "authenticated" })
          : Response.json({ message: "invalid JWT" }, { status: 401 });
      }
      if (url.includes("/rest/v1/clinic_memberships")) return Response.json([{ clinic_id: "clinic-a", created_at: "2026-01-01" }]);
      if (url.includes("/rest/v1/rpc/has_entitlement")) return Response.json(true);
      return Response.json({}, { status: 404 });
    });
    return { impl: impl as unknown as typeof fetch, calls };
  }

  it("verifies the user with Supabase Auth using the caller's own token", async () => {
    const { impl, calls } = fakeFetch();
    const deps = createHealvoAiDeps(env, "user-jwt", impl)!;
    expect(await deps.verifyUser("user-jwt")).toBe("user-1");
    const authCall = calls.find((c) => c.url.includes("/auth/v1/user"))!;
    expect(authCall.auth).toBe("Bearer user-jwt");

    const bad = fakeFetch();
    const badDeps = createHealvoAiDeps(env, "forged", bad.impl)!;
    expect(await badDeps.verifyUser("forged")).toBeNull();
  });

  it("reads memberships and entitlement as the user (not a service key)", async () => {
    const { impl, calls } = fakeFetch();
    const deps = createHealvoAiDeps(env, "user-jwt", impl)!;
    expect(await deps.activeClinicIds("user-1")).toEqual(["clinic-a"]);
    expect(await deps.hasAiEntitlement("clinic-a")).toBe(true);

    const membership = calls.find((c) => c.url.includes("/rest/v1/clinic_memberships"))!;
    expect(membership.url).toContain("user_id=eq.user-1");
    expect(membership.url).toContain("status=eq.active");
    expect(membership.auth).toBe("Bearer user-jwt");

    const rpc = calls.find((c) => c.url.includes("/rest/v1/rpc/has_entitlement"))!;
    expect(rpc.method).toBe("POST");
    expect(JSON.parse(rpc.body!)).toEqual({ p_clinic_id: "clinic-a", p_feature: "ai_assistant" });
    expect(rpc.auth).toBe("Bearer user-jwt");
  });

  it("returns null (-> 500) when Supabase env is missing", () => {
    expect(createHealvoAiDeps({}, "user-jwt")).toBeNull();
  });
});
