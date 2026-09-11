import { useMemo } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { ArrowRight, Receipt, Stethoscope } from "lucide-react";
import { Card } from "../ui/Card";
import { Badge, type BadgeTone } from "../ui/Badge";
import { Button } from "../ui/Button";
import { PatientVisits } from "./PatientVisits";
import { BILL_STATUS_META } from "../billing/billStatusMeta";
import { useClinicData } from "../../state/clinicData";
import { cn, dateFromISO, formatINR, shortDateLabel } from "../../lib/utils";
import type { Patient, VisitOutcome } from "../../data/mockData";

const VISIT_OUTCOME_LABEL: Record<VisitOutcome, string> = {
  "consultation-only": "Consultation only",
  "treatment-planned": "Treatment planned",
  "treatment-completed": "Treatment completed",
};

// Mirrors the tone convention used everywhere else in Healvo (VisitStatusBadge,
// PatientBilling's "Paid" badge, etc.) rather than inventing a new color.
const VISIT_OUTCOME_TONE: Record<VisitOutcome, BadgeTone> = {
  "consultation-only": "slate",
  "treatment-planned": "blue",
  "treatment-completed": "mint",
};

export function PatientOverview() {
  const { patient } = useOutletContext<{ patient: Patient }>();
  const navigate = useNavigate();
  const { visits, bills, consultations } = useClinicData();

  const patientVisits = useMemo(
    () =>
      visits
        .filter((v) => v.patientId === patient.id && v.date)
        .sort((a, b) => (a.date! < b.date! ? 1 : -1))
        .slice(0, 3),
    [visits, patient.id],
  );

  const patientBills = useMemo(
    () =>
      bills
        .filter((b) => b.patientId === patient.id)
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, 3),
    [bills, patient.id],
  );

  // Only completed consultations count as the patient's clinical record — an
  // in-progress draft isn't a finished note yet.
  const latestConsultation = useMemo(() => {
    return consultations
      .filter((c) => c.patientId === patient.id && c.status === "completed")
      .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  }, [consultations, patient.id]);

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-extrabold tracking-tight text-[var(--color-ink)]">
              Latest consultation
            </h2>
            {latestConsultation && (
              <div className="mt-1 text-[14.5px] font-bold text-[var(--color-ink)]">
                {latestConsultation.visitReason || "Consultation"}
              </div>
            )}
          </div>
          {latestConsultation && (
            <span className="shrink-0 text-[12.5px] text-[var(--color-muted)]">
              {shortDateLabel(dateFromISO(latestConsultation.date))}
            </span>
          )}
        </div>

        {latestConsultation ? (
          <>
            {(latestConsultation.patientWords || latestConsultation.clinicalNotes) && (
              <div className="mt-4 grid grid-cols-1 gap-4 border-t border-[var(--color-border)] pt-4 sm:grid-cols-2">
                {latestConsultation.patientWords && (
                  <LabeledNote
                    label="Patient's words"
                    value={latestConsultation.patientWords}
                    clamp
                  />
                )}
                {latestConsultation.clinicalNotes && (
                  <LabeledNote
                    label="Clinical notes"
                    value={latestConsultation.clinicalNotes}
                    clamp
                  />
                )}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-[var(--color-border)] pt-3">
              <div className="flex flex-wrap items-center gap-2">
                {latestConsultation.teethSelected.length > 0 && (
                  <span className="text-[12px] font-semibold text-[var(--color-ink)]">
                    Tooth {latestConsultation.teethSelected.join(", ")}
                  </span>
                )}
                {latestConsultation.visitOutcome && (
                  <Badge tone={VISIT_OUTCOME_TONE[latestConsultation.visitOutcome]}>
                    {VISIT_OUTCOME_LABEL[latestConsultation.visitOutcome]}
                  </Badge>
                )}
              </div>
              <button
                type="button"
                onClick={() => navigate(`/patients/${patient.id}/consultation`)}
                className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-[var(--color-teal)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--color-teal)]/50"
              >
                View consultation
                <ArrowRight size={12} strokeWidth={2.5} />
              </button>
            </div>
          </>
        ) : (
          <div className="mt-3 flex flex-col items-center gap-2 py-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-mint-bg)] text-[var(--color-teal)]">
              <Stethoscope size={18} strokeWidth={2} />
            </div>
            <p className="text-[13px] text-[var(--color-muted)]">No consultation recorded yet</p>
            <Button
              variant="outline"
              className="mt-1"
              onClick={() => navigate(`/patients/${patient.id}/consultation`)}
            >
              Add consultation
            </Button>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-[15px] font-bold text-[var(--color-ink)]">Recent visits</h2>
          <PatientVisits visits={patientVisits} patientId={patient.id} />
        </Card>

        <Card className="p-5">
          <h2 className="text-[15px] font-bold text-[var(--color-ink)]">Recent billing</h2>
          {patientBills.length === 0 ? (
            <div className="mt-3 flex flex-col items-center gap-2 py-8 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-mint-bg)] text-[var(--color-teal)]">
                <Receipt size={18} strokeWidth={2} />
              </div>
              <p className="text-[13px] text-[var(--color-muted)]">No billing records yet</p>
            </div>
          ) : (
            <div className="mt-3 divide-y divide-[var(--color-border)]">
              {patientBills.map((bill) => (
                <div
                  key={bill.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-[var(--color-ink)]">
                      {shortDateLabel(dateFromISO(bill.date))}
                    </div>
                    <div className="truncate text-[13px] text-[var(--color-muted)]">
                      {bill.treatment}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-[13px] font-bold text-[var(--color-ink)]">
                      {formatINR(bill.amount)}
                    </span>
                    <Badge tone={BILL_STATUS_META[bill.status].tone}>
                      {BILL_STATUS_META[bill.status].label}
                    </Badge>
                    <button
                      type="button"
                      onClick={() => navigate(`/billing/${bill.id}`)}
                      className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--color-teal)] hover:underline"
                    >
                      View
                      <ArrowRight size={12} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function LabeledNote({
  label,
  value,
  clamp,
}: {
  label: string;
  value: string;
  /** Keeps a long free-text field (e.g. clinical notes) from making this compact card tall. */
  clamp?: boolean;
}) {
  return (
    <div>
      <div className="text-[11.5px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
        {label}
      </div>
      <p
        className={cn(
          "mt-0.5 text-[13px] text-[var(--color-ink)]",
          clamp && "line-clamp-2",
        )}
      >
        {value}
      </p>
    </div>
  );
}
