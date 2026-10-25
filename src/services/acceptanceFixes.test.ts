import { describe, it, expect, vi } from "vitest";

// Regression tests for the 2026-10-25 fresh-doctor acceptance run. The real
// Supabase client can't be constructed under Node 20 (no WebSocket); listBills
// only needs a chain that resolves to one bill row.
const billRow = {
  id: "b1",
  patient_id: "p1",
  visit_id: null,
  invoice_number: "INV-1001",
  treatment: "Consultation",
  amount: 2000,
  amount_paid: 500,
  status: "partially_paid",
  bill_date: "2026-10-25",
  bill_time: "16:53:55",
  bill_items: [{ description: "Consultation", amount: 2000, sort_order: 0 }],
  payments: [
    { id: "pay1", amount: 500, method: "cash", paid_date: "2026-10-25", paid_time: null, created_at: "2026-10-25T16:55:01Z" },
    { id: "pay2", amount: 100, method: "upi", paid_date: "2026-10-25", paid_time: "09:05:00", created_at: "2026-10-25T16:56:00Z" },
  ],
};

vi.mock("../lib/supabaseClient", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order"]) chain[m] = () => chain;
  chain.returns = async () => ({ data: [billRow], error: null });
  return { supabase: { from: () => chain } };
});

import { listBills } from "./billing";
import { friendlyPatientError } from "./patients";
import { documentFileProblem, MAX_DOCUMENT_BYTES } from "./documents";
import { buildBookingUrl, greetingFor } from "../lib/utils";

describe("booking link", () => {
  it("points at the app origin, not the marketing site", () => {
    const url = buildBookingUrl("e2e-dental", "https://app.healvo.in");
    expect(url.url).toBe("https://app.healvo.in/book/e2e-dental");
    expect(url.displayUrl).toBe("app.healvo.in/book/e2e-dental");
    expect(url.path).toBe("/book/e2e-dental");
  });
});

describe("dashboard greeting", () => {
  it("follows the hour of day", () => {
    expect(greetingFor(8)).toBe("Good morning");
    expect(greetingFor(13)).toBe("Good afternoon");
    expect(greetingFor(22)).toBe("Good evening");
  });
});

describe("patient form errors", () => {
  it("explains a duplicate phone instead of showing the constraint name", () => {
    const err = friendlyPatientError({
      code: "23505",
      message: 'duplicate key value violates unique constraint "patients_clinic_phone_unique"',
    });
    expect(err.message).toMatch(/already exists/);
    expect(err.message).not.toMatch(/constraint/);
  });

  it("explains an age of 0", () => {
    expect(friendlyPatientError({ code: "23514", message: 'violates check constraint "patients_age_check"' }).message).toBe(
      "Age must be greater than 0.",
    );
  });

  it("passes any other error through", () => {
    expect(friendlyPatientError({ code: "42501", message: "permission denied" }).message).toBe("permission denied");
  });
});

describe("document upload checks", () => {
  it("rejects types the storage bucket refuses", () => {
    expect(documentFileProblem({ type: "text/plain", size: 10 })).toMatch(/isn't supported/);
  });

  it("rejects files over 20 MB", () => {
    expect(documentFileProblem({ type: "application/pdf", size: MAX_DOCUMENT_BYTES + 1 })).toMatch(/20 MB/);
  });

  it("accepts images and PDFs within the limit", () => {
    expect(documentFileProblem({ type: "image/png", size: 179 })).toBeNull();
    expect(documentFileProblem({ type: "application/pdf", size: MAX_DOCUMENT_BYTES })).toBeNull();
  });
});

describe("payment time", () => {
  it("falls back to when the payment was recorded if paid_time is missing", async () => {
    const [bill] = await listBills("c1");
    const d = new Date("2026-10-25T16:55:01Z");
    const h = d.getHours();
    const expected = `${String(h % 12 || 12).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
    expect(bill.payments[0].time).toBe(expected);
    expect(bill.payments[0].time).not.toBe("");
  });

  it("keeps an explicit paid_time", async () => {
    const [bill] = await listBills("c1");
    expect(bill.payments[1].time).toBe("09:05 AM");
  });
});
