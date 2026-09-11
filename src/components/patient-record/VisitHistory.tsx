import { useMemo } from "react";
import { Clock3 } from "lucide-react";
import { Card } from "../ui/Card";
import { useClinicData } from "../../state/clinicData";
import { dateFromISO, shortDateLabel } from "../../lib/utils";
import { buildVisitHistory } from "./historyTimeline";
import { VisitHistoryItem } from "./VisitHistoryItem";

/**
 * The patient's chronological clinical timeline — a VIEW composed from the
 * existing visits/consultations/bills/toothRecords already in
 * ClinicDataProvider (see historyTimeline.ts). No separate history model is
 * created; this only reads and re-shapes what already exists.
 */
export function VisitHistory({ patientId }: { patientId: string }) {
  const { visits, consultations, bills, toothRecords } = useClinicData();

  const entries = useMemo(
    () => buildVisitHistory(patientId, visits, consultations, bills, toothRecords),
    [patientId, visits, consultations, bills, toothRecords],
  );

  const sinceLabel = useMemo(() => {
    const earliest = entries.at(-1)?.visit.date;
    return earliest ? shortDateLabel(dateFromISO(earliest)) : null;
  }, [entries]);

  return (
    <div>
      {/* Header treatment matches the Documents/Billing tabs' card header
       * bar — History reads as another Patient Record tab, not a
       * differently-constructed page, even though its content below stays
       * a timeline of independently expandable cards, not a table. */}
      <Card className="mb-4 p-0">
        <div className="border-b border-[var(--color-border)] px-5 py-3">
          <h2 className="text-[15px] font-bold text-[var(--color-ink)]">Patient history</h2>
          <p className="mt-0.5 text-[12.5px] text-[var(--color-muted)]">
            {entries.length > 0
              ? `${entries.length} visit${entries.length === 1 ? "" : "s"} · First visit ${sinceLabel}`
              : "No visits recorded yet"}
          </p>
        </div>
      </Card>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-10 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-mint-bg)] text-[var(--color-teal)]">
            <Clock3 size={18} strokeWidth={2} />
          </div>
          <h3 className="text-[14px] font-bold text-[var(--color-ink)]">No visits recorded yet</h3>
          <p className="max-w-xs text-[12.5px] text-[var(--color-muted)]">
            Once this patient has their first visit, their consultation and payment history will
            appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {entries.map((entry, index) => (
            <VisitHistoryItem
              key={entry.visit.id}
              entry={entry}
              patientId={patientId}
              defaultExpanded={index === 0 && Boolean(entry.consultation)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
