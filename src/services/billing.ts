import { supabase } from "../lib/supabaseClient";
import type { Bill, BillItem, BillStatus, Payment, PaymentMethod } from "../data/mockData";
import { hyphenate } from "./visits";
import { time24ToLabel } from "../lib/utils";

/** P4.5 data-access layer for `bills` + `bill_items` + `payments`. Bill
 * creation and payment recording go through the create_bill()/
 * record_payment() SECURITY DEFINER RPCs (see
 * 20260910120000_billing_payment_rpcs.sql) rather than plain inserts — both
 * need atomicity a bare sequence of client calls can't give: create_bill()
 * claims the next invoice number and inserts the bill + items as one unit,
 * record_payment() locks the bill row so concurrent payments against it
 * can't race on recomputing amount_paid/status.
 *
 * The returned `Bill` shape keeps `items`/`payments` nested exactly like the
 * old mock did — every revenue chart (lib/revenue.ts), the AI context
 * builder (lib/aiContext.ts), and every billing UI component reads
 * `bill.payments`/`bill.amountPaid`/`bill.status` directly, so this is the
 * one place that has to reshape Supabase's relational rows back into that
 * flat-per-bill contract. */

const METHOD_FROM_DB: Record<string, PaymentMethod> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  other: "Other",
};
const METHOD_TO_DB: Record<PaymentMethod, string> = {
  Cash: "cash",
  UPI: "upi",
  Card: "card",
  Other: "other",
};

const SELECT_COLUMNS =
  "id, patient_id, visit_id, invoice_number, treatment, amount, amount_paid, status, bill_date, bill_time, " +
  "bill_items(description, amount, sort_order), payments(id, amount, method, paid_date, paid_time, created_at)";

interface BillItemRow {
  description: string;
  amount: number;
  sort_order: number;
}

interface PaymentRow {
  id: string;
  amount: number;
  method: string;
  paid_date: string;
  paid_time: string | null;
  created_at: string;
}

interface BillRow {
  id: string;
  patient_id: string;
  visit_id: string | null;
  invoice_number: string;
  treatment: string;
  amount: number;
  amount_paid: number;
  status: string;
  bill_date: string;
  bill_time: string | null;
  bill_items: BillItemRow[];
  payments: PaymentRow[];
}

function fromRow(row: BillRow): Bill {
  const items: BillItem[] = [...row.bill_items]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i) => ({ description: i.description, amount: Number(i.amount) }));

  // Ordered oldest-first so the last entry is the most recently recorded
  // payment — same "latest payment's method wins" rule the old mock's
  // recordPayment() applied on every call.
  const payments: Payment[] = [...row.payments]
    .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0))
    .map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      method: METHOD_FROM_DB[p.method] ?? "Other",
      date: p.paid_date,
      time: p.paid_time ? time24ToLabel(p.paid_time) : "",
    }));
  const latestPayment = payments[payments.length - 1];

  return {
    id: row.id,
    patientId: row.patient_id,
    visitId: row.visit_id ?? undefined,
    invoiceNumber: row.invoice_number,
    treatment: row.treatment,
    items,
    amount: Number(row.amount),
    amountPaid: Number(row.amount_paid),
    payments,
    paymentMethod: latestPayment?.method,
    date: row.bill_date,
    time: row.bill_time ? time24ToLabel(row.bill_time) : undefined,
    status: hyphenate(row.status) as BillStatus,
  };
}

export async function listBills(clinicId: string): Promise<Bill[]> {
  const { data, error } = await supabase
    .from("bills")
    .select(SELECT_COLUMNS)
    .eq("clinic_id", clinicId)
    .order("bill_date", { ascending: false })
    .order("sort_order", { foreignTable: "bill_items", ascending: true })
    .order("created_at", { foreignTable: "payments", ascending: true })
    .returns<BillRow[]>();
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

async function fetchBillById(billId: string): Promise<Bill> {
  const { data, error } = await supabase
    .from("bills")
    .select(SELECT_COLUMNS)
    .eq("id", billId)
    .order("sort_order", { foreignTable: "bill_items", ascending: true })
    .order("created_at", { foreignTable: "payments", ascending: true })
    .single<BillRow>();
  if (error) throw error;
  return fromRow(data);
}

export interface CreateBillItemInput {
  description: string;
  amount: number;
}

export interface CreateBillInput {
  patientId: string;
  visitId?: string;
  items: CreateBillItemInput[];
}

export async function createBill(clinicId: string, input: CreateBillInput): Promise<Bill> {
  const { data, error } = await supabase
    .rpc("create_bill", {
      p_clinic_id: clinicId,
      p_patient_id: input.patientId,
      p_visit_id: input.visitId ?? null,
      p_items: input.items.map((item) => ({ description: item.description, amount: item.amount })),
    })
    .single<{ id: string }>();
  if (error) throw error;
  // The RPC returns the bare bills row (no nested items/payments yet) —
  // re-fetch through the same shape every other read uses rather than
  // hand-assembling a Bill from the RPC's echo, so there's one source of
  // truth for "what a Bill looks like on the wire".
  return fetchBillById(data.id);
}

export interface RecordPaymentInput {
  billId: string;
  amount: number;
  method: PaymentMethod;
}

export async function recordPayment(input: RecordPaymentInput): Promise<Bill> {
  const { error } = await supabase
    .rpc("record_payment", {
      p_bill_id: input.billId,
      p_amount: input.amount,
      p_method: METHOD_TO_DB[input.method],
    })
    .single();
  if (error) throw error;
  return fetchBillById(input.billId);
}
