import type { BadgeTone } from "../ui/Badge";
import type { BillStatus } from "../../data/mockData";

// Mirrors the status → label/tone convention used across the app (visits,
// consultations, visit outcomes) rather than inventing a new color scheme.
export const BILL_STATUS_META: Record<BillStatus, { label: string; tone: BadgeTone }> = {
  paid: { label: "Paid", tone: "mint" },
  "partially-paid": { label: "Partially paid", tone: "blue" },
  unpaid: { label: "Unpaid", tone: "amber" },
};
