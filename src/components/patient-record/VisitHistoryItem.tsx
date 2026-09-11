import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Badge, type BadgeTone } from "../ui/Badge";
import { Card } from "../ui/Card";
import { cn, dateFromISO, formatINR, shortDateLabel } from "../../lib/utils";
import { TOOTH_STATUS_LABEL } from "./toothStatusMeta";
import { VISIT_STATUS_META } from "./visitStatusMeta";
import { formatDentalLine, formatFollowUpLine, type VisitHistoryEntry } from "./historyTimeline";
import type { Bill, VisitOutcome } from "../../data/mockData";

// Kept local — VisitOutcome.tsx and PatientOverview.tsx each keep their own
// copy of this exact small label/tone map too, an established pattern in
// this codebase rather than a shared constant for a 3-entry lookup.
const VISIT_OUTCOME_LABEL: Record<VisitOutcome, string> = {
  "consultation-only": "Consultation only",
  "treatment-planned": "Treatment planned",
  "treatment-completed": "Treatment completed",
};
const VISIT_OUTCOME_TONE: Record<VisitOutcome, BadgeTone> = {
  "consultation-only": "slate",
  "treatment-planned": "blue",
  "treatment-completed": "mint",
};

export function VisitHistoryItem({
  entry,
  patientId,
  defaultExpanded,
}: {
  entry: VisitHistoryEntry;
  patientId: string;
  defaultExpanded: boolean;
}) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { visit, consultation, bills, teeth } = entry;
  // A bill with nothing collected yet has no "activity" to show here.
  const paidBills = bills.filter((b) => b.amountPaid > 0);
  const statusMeta = VISIT_STATUS_META[visit.status];
  const followUpLine = consultation ? formatFollowUpLine(consultation) : null;
  const dentalLine = teeth.length > 0 ? formatDentalLine(teeth, TOOTH_STATUS_LABEL) : null;

  const hasNotes = Boolean(consultation?.patientWords || consultation?.clinicalNotes);
  const hasVisitDetails = Boolean(
    dentalLine || consultation?.prescription || followUpLine || consultation?.visitOutcome,
  );

  return (
    <Card className="p-5">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="flex w-full items-start justify-between gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-teal)]/50"
      >
        <div className="min-w-0">
          <div className="text-[12px] text-[var(--color-muted)]">
            {shortDateLabel(dateFromISO(visit.date!))}
            {visit.time && <span className="text-[var(--color-muted)]"> · {visit.time}</span>}
          </div>
          <div className="mt-1 text-[14px] font-bold text-[var(--color-ink)]">{visit.reason}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
          <ChevronDown
            size={14}
            className={cn(
              "text-[var(--color-muted-soft)] transition-transform",
              expanded && "rotate-180",
            )}
          />
        </div>
      </button>

      {expanded && (
        <div className="mt-3.5 space-y-4 border-t border-[var(--color-border)] pt-3.5">
          {consultation ? (
            <>
              {hasNotes && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {consultation.patientWords && (
                    <NotesField label="Patient's words" value={consultation.patientWords} />
                  )}
                  {consultation.clinicalNotes && (
                    <NotesField label="Clinical notes" value={consultation.clinicalNotes} />
                  )}
                </div>
              )}

              {hasVisitDetails && (
                <div className={cn(hasNotes && "border-t border-[var(--color-border)] pt-4")}>
                  <SectionLabel>Visit details</SectionLabel>
                  <div className="mt-2.5 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                    {dentalLine && <DetailField label="Dental" value={dentalLine} />}
                    {consultation.prescription && (
                      <DetailField label="Prescription" value={consultation.prescription} />
                    )}
                    {followUpLine && <DetailField label="Follow-up" value={followUpLine} />}
                    {consultation.visitOutcome && (
                      <div>
                        <DetailLabel>Outcome</DetailLabel>
                        <Badge tone={VISIT_OUTCOME_TONE[consultation.visitOutcome]} className="mt-1.5">
                          {VISIT_OUTCOME_LABEL[consultation.visitOutcome]}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className={cn((hasNotes || hasVisitDetails) && "border-t border-[var(--color-border)] pt-3.5")}>
                <button
                  type="button"
                  onClick={() => navigate(`/patients/${patientId}/consultation`)}
                  className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--color-teal)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--color-teal)]/50"
                >
                  View consultation
                  <ArrowRight size={12} strokeWidth={2.5} />
                </button>

                {paidBills.length > 0 && <RelatedActivity bills={paidBills} className="mt-3" />}
              </div>
            </>
          ) : (
            <div>
              <p className="text-[12.5px] text-[var(--color-muted)]">
                No consultation recorded for this visit.
              </p>
              {paidBills.length > 0 && <RelatedActivity bills={paidBills} className="mt-3" />}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function RelatedActivity({ bills, className }: { bills: Bill[]; className?: string }) {
  return (
    <div className={className}>
      <SectionLabel>Related activity</SectionLabel>
      <div className="mt-1.5 space-y-1">
        {bills.map((bill) => (
          <div key={bill.id} className="flex items-center justify-between gap-3">
            <span className="text-[12px] text-[var(--color-muted)]">
              {bill.status === "partially-paid" ? "Partial payment" : "Payment collected"}
            </span>
            <span className="shrink-0 text-[12px] font-medium text-[var(--color-muted)]">
              {formatINR(bill.amountPaid)} · {bill.paymentMethod}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10.5px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
      {children}
    </div>
  );
}

function DetailLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
      {children}
    </div>
  );
}

/** A compact "label above value" metadata row — Dental, Prescription,
 * Follow-up — independently scannable rather than one inline string. */
function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <DetailLabel>{label}</DetailLabel>
      <p className="mt-1 text-[12.5px] whitespace-pre-line text-[var(--color-ink)]">{value}</p>
    </div>
  );
}

/** Patient's words / Clinical notes — the primary clinical content, given
 * more visual weight than the compact metadata rows below it. */
function NotesField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
        {label}
      </div>
      <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-[var(--color-ink)]">
        {value}
      </p>
    </div>
  );
}
