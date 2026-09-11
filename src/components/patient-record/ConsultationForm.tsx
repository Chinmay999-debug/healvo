import type { ReactNode } from "react";
import { ArrowRight, Grid3x3 } from "lucide-react";
import { cn } from "../../lib/utils";

const textareaClass =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-[13.5px] text-[var(--color-ink)] outline-none focus:border-[var(--color-teal)] focus:ring-2 focus:ring-[var(--color-teal)]/15 min-h-[84px] resize-y";

export interface ConsultationFormValues {
  patientWords: string;
  clinicalNotes: string;
  prescription: string;
}

/** The free-text sections of a consultation, plus the Dental Chart entry
 * point. Deliberately just one clinical-notes field — no separate
 * diagnosis/treatment-planned/procedure-performed inputs — and no typed
 * tooth-number input, since the Dental Chart tab is the source of truth
 * for teeth involved. Follow-up and visit outcome are separate sections
 * (see FollowUpSection / VisitOutcome). */
export function ConsultationForm({
  values,
  onChange,
  teethSelected,
  onOpenDentalChart,
}: {
  values: ConsultationFormValues;
  onChange: <K extends keyof ConsultationFormValues>(key: K, value: ConsultationFormValues[K]) => void;
  teethSelected: string[];
  /** Saves a draft (if there's anything to lose) before navigating to the
   * Dental Chart tab — see ConsultationWorkspace.handleOpenDentalChart. */
  onOpenDentalChart: () => void;
}) {
  return (
    <div className="space-y-6">
      <Section label="Patient's words" supporting="What is the patient experiencing?">
        <textarea
          value={values.patientWords}
          onChange={(e) => onChange("patientWords", e.target.value)}
          placeholder={'e.g. "My tooth hurts when I chew" or "Sensitivity to cold"'}
          className={textareaClass}
        />
      </Section>

      <Section
        label="Clinical notes"
        supporting="Record your findings, diagnosis, treatment and advice."
      >
        <textarea
          value={values.clinicalNotes}
          onChange={(e) => onChange("clinicalNotes", e.target.value)}
          placeholder="e.g. Tooth 46 has deep caries. Root canal treatment planned. Discussed treatment and approximate duration with patient."
          className={cn(textareaClass, "min-h-[140px]")}
        />
      </Section>

      <Section label="Dental chart" supporting="Select teeth involved in this consultation.">
        <button
          type="button"
          onClick={onOpenDentalChart}
          className="flex w-full items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] px-4 py-2.5 text-left outline-none transition-colors hover:bg-[var(--color-mint-bg)]/50 focus-visible:ring-2 focus-visible:ring-[var(--color-teal)]/50"
        >
          <span className="flex items-center gap-2.5 text-[13.5px] font-semibold text-[var(--color-ink)]">
            <Grid3x3 size={16} strokeWidth={2} className="text-[var(--color-teal)]" />
            Open dental chart
          </span>
          <ArrowRight size={14} strokeWidth={2.5} className="text-[var(--color-teal)]" />
        </button>
        {teethSelected.length > 0 && (
          <p className="mt-2 text-[12.5px] font-semibold text-[var(--color-teal)]">
            {teethSelected.join(" · ")} selected
          </p>
        )}
      </Section>

      <Section label="Prescription">
        <textarea
          value={values.prescription}
          onChange={(e) => onChange("prescription", e.target.value)}
          placeholder="Medicines and dosage"
          className={cn(textareaClass, "min-h-[72px]")}
        />
      </Section>
    </div>
  );
}

function Section({
  label,
  supporting,
  children,
}: {
  label: string;
  supporting?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="text-[13.5px] font-bold text-[var(--color-ink)]">{label}</div>
      {supporting && <p className="mt-0.5 text-[12.5px] text-[var(--color-muted)]">{supporting}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}
