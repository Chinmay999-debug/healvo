import { useNavigate } from "react-router-dom";
import { ArrowRight, FileText } from "lucide-react";
import { Badge } from "../ui/Badge";
import { dateFromISO, shortDateLabel } from "../../lib/utils";
import { VISIT_STATUS_META } from "./visitStatusMeta";
import type { Visit } from "../../data/mockData";

// Renders the compact "recent visits" row list on Patient Overview. There is
// no dedicated per-visit detail screen yet, so each row's View action opens
// this patient's Consultation tab — the closest Phase 1 equivalent.
export function PatientVisits({ visits, patientId }: { visits: Visit[]; patientId: string }) {
  const navigate = useNavigate();

  if (visits.length === 0) {
    return (
      <div className="mt-3 flex flex-col items-center gap-2 py-8 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-mint-bg)] text-[var(--color-teal)]">
          <FileText size={18} strokeWidth={2} />
        </div>
        <p className="text-[13px] text-[var(--color-muted)]">No visits yet</p>
      </div>
    );
  }

  return (
    <div className="mt-3 divide-y divide-[var(--color-border)]">
      {visits.map((visit) => (
        <div
          key={visit.id}
          className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
        >
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-[var(--color-ink)]">
              {shortDateLabel(dateFromISO(visit.date!))}
            </div>
            <div className="truncate text-[13px] text-[var(--color-muted)]">{visit.reason}</div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Badge tone={VISIT_STATUS_META[visit.status].tone}>
              {VISIT_STATUS_META[visit.status].label}
            </Badge>
            <button
              type="button"
              onClick={() => navigate(`/patients/${patientId}/consultation`)}
              className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--color-teal)] hover:underline"
            >
              View
              <ArrowRight size={12} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
