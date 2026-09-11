import type { Bill, Consultation, ToothRecord, ToothStatus, Visit } from "../../data/mockData";

export interface VisitHistoryTooth {
  tooth: string;
  status: ToothStatus;
}

export interface VisitHistoryEntry {
  visit: Visit;
  /** Only a completed consultation counts as finalized clinical history — a
   * draft attached to this visit is intentionally excluded (see
   * ConsultationWorkspace: a visit's draft only becomes real history once
   * "Complete visit" flips its status to "completed"). */
  consultation?: Consultation;
  /** Bills tied to this specific visit — Billing itself remains the full
   * ledger; this is just enough to show as a small related-activity line. */
  bills: Bill[];
  /** Teeth named in the consultation, each resolved against the live
   * dental-chart record — the Dental Chart tab stays the single source of
   * truth for tooth status, this just reads it. */
  teeth: VisitHistoryTooth[];
}

/**
 * A pure VIEW over existing shared state — no new persisted model. Joins a
 * patient's visits with whichever completed consultation, bills and tooth
 * statuses belong to each one, newest first.
 */
export function buildVisitHistory(
  patientId: string,
  visits: Visit[],
  consultations: Consultation[],
  bills: Bill[],
  toothRecords: ToothRecord[],
): VisitHistoryEntry[] {
  const patientVisits = visits.filter((v) => v.patientId === patientId && v.date);
  const patientBills = bills.filter((b) => b.patientId === patientId);
  const completedConsultations = consultations.filter(
    (c) => c.patientId === patientId && c.status === "completed",
  );
  const toothStatusByNumber = new Map(
    toothRecords.filter((r) => r.patientId === patientId).map((r) => [r.tooth, r.status]),
  );

  return patientVisits
    .map((visit): VisitHistoryEntry => {
      const consultation = completedConsultations.find((c) => c.visitId === visit.id);
      const teeth: VisitHistoryTooth[] = (consultation?.teethSelected ?? []).map((tooth) => ({
        tooth,
        status: toothStatusByNumber.get(tooth) ?? "normal",
      }));
      return {
        visit,
        consultation,
        bills: patientBills.filter((b) => b.visitId === visit.id),
        teeth,
      };
    })
    .sort((a, b) => (a.visit.date! < b.visit.date! ? 1 : -1));
}

/** "Tooth 46 · Treatment planned" or, for several teeth sharing one status,
 * "Teeth 16, 26 · Treatment planned" — falls back to per-tooth pairs if
 * statuses differ, which is rare in practice. */
export function formatDentalLine(
  teeth: VisitHistoryTooth[],
  statusLabel: Record<ToothStatus, string>,
): string {
  if (teeth.length === 0) return "";
  const uniqueStatuses = new Set(teeth.map((t) => t.status));
  if (uniqueStatuses.size === 1) {
    const label = teeth.length === 1 ? "Tooth" : "Teeth";
    return `${label} ${teeth.map((t) => t.tooth).join(", ")} · ${statusLabel[teeth[0].status]}`;
  }
  return teeth.map((t) => `Tooth ${t.tooth} · ${statusLabel[t.status]}`).join(", ");
}

/** Combines followUpWhen + followUpRecommendation into one readable line —
 * there's no single stored "Review in 7 days" string in the data model. */
export function formatFollowUpLine(consultation: Consultation): string | null {
  if (!consultation.followUpRequired) return null;
  const parts = [consultation.followUpWhen, consultation.followUpRecommendation].filter(Boolean);
  return parts.length > 0 ? parts.join(" — ") : "Follow-up recommended";
}
