import { SegmentedControl } from "./SegmentedControl";
import type { VisitOutcome as VisitOutcomeValue } from "../../data/mockData";

// Deliberately just 3 options — no "Referred" and no other hospital-style
// outcomes. Healvo is for private dental clinics, not hospitals.
const OUTCOMES: { value: VisitOutcomeValue; label: string }[] = [
  { value: "consultation-only", label: "Consultation only" },
  { value: "treatment-planned", label: "Treatment planned" },
  { value: "treatment-completed", label: "Treatment completed" },
];

export function VisitOutcome({
  value,
  onChange,
}: {
  value: VisitOutcomeValue | "";
  onChange: (value: VisitOutcomeValue) => void;
}) {
  return (
    <div>
      <div className="text-[13.5px] font-bold text-[var(--color-ink)]">Visit outcome</div>

      <div className="mt-2">
        <SegmentedControl options={OUTCOMES} value={value} onChange={onChange} />
      </div>
    </div>
  );
}
