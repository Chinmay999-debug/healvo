import { describe, it, expect, vi, beforeEach } from "vitest";

// Records every Supabase call the services make. The real client can't be
// constructed under Node 20 (no WebSocket), and these tests only care about
// the payloads sent to the database.
const calls: { op: string; payload: unknown }[] = [];

const patientRow = (consent: boolean) => ({
  id: "p1",
  first_name: "Asha",
  last_name: "Rao",
  phone: "+919999900099",
  email: null,
  age: 30,
  gender: "female",
  patient_type: "new",
  created_at: "2026-09-30T00:00:00Z",
  whatsapp_consent: consent,
});

let nextRow = patientRow(false);

function builder() {
  const b: Record<string, unknown> = {};
  const self = () => b;
  b.insert = (payload: unknown) => (calls.push({ op: "insert", payload }), b);
  b.update = (payload: unknown) => (calls.push({ op: "update", payload }), b);
  b.select = (cols: unknown) => (calls.push({ op: "select", payload: cols }), b);
  b.eq = self;
  b.single = async () => ({ data: nextRow, error: null });
  return b;
}

vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    from: () => builder(),
    rpc: (fn: string, args: unknown) => {
      calls.push({ op: `rpc:${fn}`, payload: args });
      return { single: async () => ({ data: { visit_date: "2026-10-02", start_time: "14:30:00" }, error: null }) };
    },
  },
}));

import { submitPublicBooking } from "./publicBooking";
import { createPatient, updatePatientRecord } from "./patients";

beforeEach(() => {
  calls.length = 0;
  nextRow = patientRow(false);
});

const booking = {
  slug: "startup-setup",
  date: "2026-10-02",
  time: "2:30 PM",
  reason: "Checkup",
  name: "Asha Rao",
  phone: "9999900099",
};

describe("public booking WhatsApp consent", () => {
  it("sends p_whatsapp_consent=true only when the box was ticked", async () => {
    await submitPublicBooking({ ...booking, whatsappConsent: true });
    const rpc = calls.find((c) => c.op === "rpc:public_booking_submit")!;
    expect((rpc.payload as Record<string, unknown>).p_whatsapp_consent).toBe(true);
  });

  it("sends p_whatsapp_consent=false when unticked or not provided", async () => {
    await submitPublicBooking({ ...booking, whatsappConsent: false });
    await submitPublicBooking(booking);
    const rpcs = calls.filter((c) => c.op === "rpc:public_booking_submit");
    expect(rpcs.map((c) => (c.payload as Record<string, unknown>).p_whatsapp_consent)).toEqual([false, false]);
  });

  it("keeps every existing booking argument unchanged", async () => {
    await submitPublicBooking({ ...booking, email: "a@b.in", whatsappConsent: true });
    expect(calls.find((c) => c.op === "rpc:public_booking_submit")!.payload).toEqual({
      p_slug: "startup-setup",
      p_date: "2026-10-02",
      p_start_time: "14:30:00",
      p_reason: "Checkup",
      p_name: "Asha Rao",
      p_phone: "+919999900099",
      p_email: "a@b.in",
      p_whatsapp_consent: true,
    });
  });
});

describe("staff patient WhatsApp consent", () => {
  it("creates patients without consent unless staff ticked it", async () => {
    await createPatient("c1", { name: "Asha Rao", phone: "9999900099" });
    await createPatient("c1", { name: "Asha Rao", phone: "9999900099", whatsappConsent: true });
    const inserts = calls.filter((c) => c.op === "insert").map((c) => c.payload as Record<string, unknown>);
    expect(inserts.map((p) => p.whatsapp_consent)).toEqual([false, true]);
    // Timestamp/source are owned by the database trigger, never sent by the client.
    for (const p of inserts) {
      expect(p).not.toHaveProperty("whatsapp_consent_at");
      expect(p).not.toHaveProperty("whatsapp_consent_source");
    }
  });

  it("lets staff withdraw consent", async () => {
    await updatePatientRecord("p1", { whatsappConsent: false });
    expect(calls.find((c) => c.op === "update")!.payload).toEqual({ whatsapp_consent: false });
  });

  it("does not touch consent on unrelated edits", async () => {
    await updatePatientRecord("p1", { name: "Asha R" });
    expect(calls.find((c) => c.op === "update")!.payload).not.toHaveProperty("whatsapp_consent");
  });

  it("reads consent back onto the Patient", async () => {
    nextRow = patientRow(true);
    const p = await updatePatientRecord("p1", { whatsappConsent: true });
    expect(p.whatsappConsent).toBe(true);
    expect(calls.find((c) => c.op === "select")!.payload).toContain("whatsapp_consent");
  });
});
