import { useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { ConsultationForm, type ConsultationFormValues } from "./ConsultationForm";
import { FollowUpSection, type FollowUpValues } from "./FollowUpSection";
import { VisitOutcome } from "./VisitOutcome";
import { useClinicData } from "../../state/clinicData";
import { dateFromISO, shortDateLabel, getErrorMessage } from "../../lib/utils";
import type {
  Consultation,
  ConsultationStatus,
  Patient,
  VisitOutcome as VisitOutcomeValue,
} from "../../data/mockData";

const FOLLOW_UP_PRESETS = ["7 days", "14 days", "30 days"];

function formValuesFrom(consultation: Consultation | undefined): ConsultationFormValues {
  return {
    patientWords: consultation?.patientWords ?? "",
    clinicalNotes: consultation?.clinicalNotes ?? "",
    prescription: consultation?.prescription ?? "",
  };
}

function followUpValuesFrom(consultation: Consultation | undefined): FollowUpValues {
  const when = consultation?.followUpWhen;
  const isPreset = when !== undefined && FOLLOW_UP_PRESETS.includes(when);
  return {
    required: consultation?.followUpRequired ?? false,
    when: isPreset ? when! : when ? "custom" : "7 days",
    customDate: when && !isPreset ? when : "",
    recommendation: consultation?.followUpRecommendation ?? "",
  };
}

/** A fast, single-visit consultation workspace — not a full EMR. Resumes an
 * in-progress draft tied to today's visit (if any) on mount; a completed
 * consultation is never reopened for editing here, only shown on Overview. */
export function ConsultationWorkspace() {
  const navigate = useNavigate();
  const { patient } = useOutletContext<{ patient: Patient }>();
  const {
    todaysVisits,
    consultations,
    toothRecords,
    addConsultation,
    updateConsultation,
    setVisitStatus,
  } = useClinicData();

  const currentVisit = useMemo(
    () => todaysVisits.find((v) => v.patientId === patient.id),
    [todaysVisits, patient.id],
  );

  const existingDraft = useMemo(
    () =>
      consultations
        .filter(
          (c) => c.patientId === patient.id && c.status === "draft" && c.visitId === currentVisit?.id,
        )
        .sort((a, b) => (a.date < b.date ? 1 : -1))[0],
    [consultations, patient.id, currentVisit],
  );

  const [consultationId, setConsultationId] = useState<string | undefined>(existingDraft?.id);
  const [form, setForm] = useState<ConsultationFormValues>(() => formValuesFrom(existingDraft));
  const [followUp, setFollowUp] = useState<FollowUpValues>(() => followUpValuesFrom(existingDraft));
  const [visitOutcome, setVisitOutcome] = useState<VisitOutcomeValue | "">(
    existingDraft?.visitOutcome ?? "",
  );
  const [saveState, setSaveState] = useState<"idle" | "draft-saved" | "completed">("idle");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // The Dental Chart is the source of truth for teeth involved — derived
  // live from shared toothRecords (any tooth not "normal"), not local state,
  // so it survives navigating to the Dental Chart tab and back.
  const teethSelected = useMemo(
    () =>
      toothRecords
        .filter((r) => r.patientId === patient.id && r.status !== "normal")
        .map((r) => r.tooth)
        .sort(),
    [toothRecords, patient.id],
  );

  // Adjusted during render (React's recommended pattern) rather than in an
  // effect, so switching patients never costs an extra render pass.
  const [syncedPatientId, setSyncedPatientId] = useState(patient.id);
  if (patient.id !== syncedPatientId) {
    setSyncedPatientId(patient.id);
    setConsultationId(existingDraft?.id);
    setForm(formValuesFrom(existingDraft));
    setFollowUp(followUpValuesFrom(existingDraft));
    setVisitOutcome(existingDraft?.visitOutcome ?? "");
    setSaveState("idle");
  }

  function setFormField<K extends keyof ConsultationFormValues>(
    key: K,
    value: ConsultationFormValues[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
    if (saveState !== "idle") setSaveState("idle");
  }

  function setFollowUpField<K extends keyof FollowUpValues>(key: K, value: FollowUpValues[K]) {
    setFollowUp({ ...followUp, [key]: value });
    if (saveState !== "idle") setSaveState("idle");
  }

  function handleOutcomeChange(next: VisitOutcomeValue) {
    setVisitOutcome(next);
    if (saveState !== "idle") setSaveState("idle");
  }

  async function save(status: ConsultationStatus) {
    const followUpWhenValue = followUp.required
      ? followUp.when === "custom"
        ? followUp.customDate || undefined
        : followUp.when
      : undefined;

    const payload = {
      patientId: patient.id,
      visitId: currentVisit?.id,
      visitReason: currentVisit?.reason,
      patientWords: form.patientWords.trim() || undefined,
      clinicalNotes: form.clinicalNotes.trim() || undefined,
      teethSelected,
      prescription: form.prescription.trim() || undefined,
      followUpRequired: followUp.required,
      followUpWhen: followUpWhenValue,
      followUpRecommendation: followUp.required
        ? followUp.recommendation.trim() || undefined
        : undefined,
      visitOutcome: visitOutcome || undefined,
      status,
    };

    setSaving(true);
    setSaveError(null);
    try {
      if (consultationId) {
        await updateConsultation(consultationId, payload);
      } else {
        const created = await addConsultation(payload);
        setConsultationId(created.id);
      }

      if (status === "completed" && currentVisit) {
        await setVisitStatus(currentVisit.id, "completed");
      }

      setSaveState(status === "completed" ? "completed" : "draft-saved");
    } catch (err) {
      setSaveError(getErrorMessage(err, "Could not save this consultation."));
    } finally {
      setSaving(false);
    }
  }

  // QA finding, fixed here: ConsultationForm's "Open dental chart" link
  // navigates to a different route (/dental-chart), which unmounts this
  // component and discards form/followUp/visitOutcome — plain useState, no
  // autosave, no unsaved-changes warning for in-app navigation (unlike the
  // browser-close/refresh case, which nothing here guards either, but that's
  // a separate risk). Reproduced live: typing a full consultation, clicking
  // "Open dental chart" (the one link this exact form offers mid-entry), and
  // returning showed a completely blank form — the entire write-up silently
  // gone. Fix: save a draft first, same as the "Save draft" button, only
  // when there is anything to lose — an empty form still navigates straight
  // through with no extra network call.
  async function handleOpenDentalChart() {
    const hasContent =
      form.patientWords.trim() || form.clinicalNotes.trim() || form.prescription.trim();
    if (hasContent) {
      await save("draft");
    }
    navigate(`/patients/${patient.id}/dental-chart`);
  }

  return (
    <div>
      <div className="mb-5">
        {currentVisit ? (
          <div className="text-[12.5px] font-semibold text-[var(--color-muted)]">
            Current visit: {shortDateLabel(dateFromISO(currentVisit.date ?? ""))} ·{" "}
            {currentVisit.reason}
          </div>
        ) : (
          <div className="text-[12.5px] font-semibold text-[var(--color-muted)]">
            No active visit today, so this consultation will be linked to the patient only.
          </div>
        )}
      </div>

      <Card className="space-y-6 p-5">
        <ConsultationForm
          values={form}
          onChange={setFormField}
          teethSelected={teethSelected}
          onOpenDentalChart={() => void handleOpenDentalChart()}
        />
        <FollowUpSection values={followUp} onChange={setFollowUpField} />
        <VisitOutcome value={visitOutcome} onChange={handleOutcomeChange} />
      </Card>

      <div className="mt-5 flex items-center justify-between">
        <div>
          {saveError && (
            <span className="text-[12.5px] font-semibold text-[var(--color-danger-text)]">
              {saveError}
            </span>
          )}
          {!saveError && saveState === "draft-saved" && (
            <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--color-mint-text)]">
              <CheckCircle2 size={14} />
              Draft saved
            </span>
          )}
          {!saveError && saveState === "completed" && (
            <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--color-mint-text)]">
              <CheckCircle2 size={14} />
              Visit completed and saved to the patient record
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="outline" onClick={() => void save("draft")} disabled={saving}>
            Save draft
          </Button>
          <Button variant="primary" onClick={() => void save("completed")} disabled={saving}>
            Complete visit
          </Button>
        </div>
      </div>
    </div>
  );
}
