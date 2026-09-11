import type { Bill, Patient, Visit } from "../data/mockData";
import { formatINR, todayISO } from "./utils";

/** The minimum slice of useClinicData() the assistant needs — kept narrow
 * so it's obvious at a glance what does and doesn't reach the AI. */
export interface HealvoAiContextSource {
  clinicName: string;
  todaysVisits: Visit[];
  waitingCount: number;
  patients: Patient[];
  bills: Bill[];
}

export interface HealvoAiVisitSummary {
  time: string;
  patientName: string;
  reason: string;
  status: Visit["status"];
}

export interface HealvoAiContext {
  today: string;
  clinicName: string;
  todaysVisitCount: number;
  waitingCount: number;
  completedToday: number;
  newPatientsToday: number;
  totalPatients: number;
  todaysVisits: HealvoAiVisitSummary[];
  nextScheduledVisit: HealvoAiVisitSummary | null;
  currency: "INR";
  todaysCollection: number;
  todaysCollectionFormatted: string;
  paymentsCollectedToday: number;
  recentBillsToday: Array<{
    invoiceNumber: string;
    treatment: string;
    amount: number;
    amountFormatted: string;
    status: Bill["status"];
  }>;
}

/** Builds the small, non-sensitive operational snapshot sent alongside a
 * chat request. Mirrors the same derivations Overview's KPIs use (see
 * src/pages/Overview.tsx) so the assistant's numbers always agree with what
 * the UI shows — this reads the existing clinic state, it never invents or
 * duplicates it. Deliberately excludes phone numbers and any other
 * patient-identifying fields beyond name. */
export function buildHealvoAiContext(source: HealvoAiContextSource): HealvoAiContext {
  const today = todayISO();

  let todaysCollection = 0;
  let paymentsCollectedToday = 0;
  for (const bill of source.bills) {
    for (const payment of bill.payments) {
      if (payment.date === today) {
        todaysCollection += payment.amount;
        paymentsCollectedToday += 1;
      }
    }
  }

  const recentBillsToday = source.bills
    .filter((bill) => bill.date === today)
    .slice(-10)
    .map((bill) => ({
      invoiceNumber: bill.invoiceNumber,
      treatment: bill.treatment,
      amount: bill.amount,
      amountFormatted: formatINR(bill.amount),
      status: bill.status,
    }));

  const todaysPatientIds = new Set(source.todaysVisits.map((v) => v.patientId));
  const newPatientsToday = source.patients.filter(
    (p) => todaysPatientIds.has(p.id) && p.type === "new",
  ).length;

  const toSummary = (visit: Visit): HealvoAiVisitSummary => ({
    time: visit.time,
    patientName: visit.patientName,
    reason: visit.reason,
    status: visit.status,
  });

  const nextScheduledVisit =
    source.todaysVisits.find((v) => v.status === "scheduled" || v.status === "checked-in") ?? null;

  return {
    today,
    clinicName: source.clinicName,
    todaysVisitCount: source.todaysVisits.length,
    waitingCount: source.waitingCount,
    completedToday: source.todaysVisits.filter((v) => v.status === "completed").length,
    newPatientsToday,
    totalPatients: source.patients.length,
    todaysVisits: source.todaysVisits.slice(0, 20).map(toSummary),
    nextScheduledVisit: nextScheduledVisit ? toSummary(nextScheduledVisit) : null,
    currency: "INR",
    todaysCollection,
    todaysCollectionFormatted: formatINR(todaysCollection),
    paymentsCollectedToday,
    recentBillsToday,
  };
}
