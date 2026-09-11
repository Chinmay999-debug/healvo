import { type ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, CheckCircle2, UserRoundPlus } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Avatar } from "../ui/Avatar";
import { Search } from "../ui/Search";
import { PhoneInput } from "../ui/PhoneInput";
import { inputClass } from "../ui/fieldStyles";
import { useClinicData } from "../../state/clinicData";
import { VISIT_REASONS, type Patient } from "../../data/mockData";
import { cn, fullDateLabel, initials, getErrorMessage } from "../../lib/utils";
import { formatPhoneDisplay, isValidIndianMobile } from "../../lib/phone";

type Step = "search" | "new-patient" | "visit" | "confirm" | "success";

interface NewPatientDraft {
  name: string;
  phone: string;
  age: string;
  gender: string;
}

const emptyDraft: NewPatientDraft = { name: "", phone: "", age: "", gender: "" };

export function WalkInModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { findPatients, registerWalkIn } = useClinicData();

  const [step, setStep] = useState<Step>("search");
  const [query, setQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [draft, setDraft] = useState<NewPatientDraft>(emptyDraft);
  const [reason, setReason] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState("");
  const [registeredName, setRegisteredName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const results = findPatients(query);

  function reset() {
    setStep("search");
    setQuery("");
    setSelectedPatient(null);
    setDraft(emptyDraft);
    setReason(null);
    setCustomReason("");
    setRegisteredName("");
    setError(null);
  }

  function handleClose() {
    onClose();
    reset();
  }

  function pickExisting(patient: Patient) {
    setSelectedPatient(patient);
    setStep("visit");
  }

  function continueNewPatient() {
    if (!draft.name.trim() || !isValidIndianMobile(draft.phone)) return;
    setSelectedPatient(null);
    setStep("visit");
  }

  async function confirmWalkIn() {
    const finalReason = reason === "Other" ? customReason.trim() : (reason ?? "");
    setSubmitting(true);
    setError(null);
    try {
      const { patient } = await registerWalkIn(
        selectedPatient
          ? { patientId: selectedPatient.id, reason: finalReason }
          : { newPatient: draft, reason: finalReason },
      );
      setRegisteredName(patient.name);
      setStep("success");
    } catch (err) {
      setError(getErrorMessage(err, "Could not register this walk-in."));
    } finally {
      setSubmitting(false);
    }
  }

  const patientName = selectedPatient?.name ?? draft.name;
  const patientAvatarInitials =
    selectedPatient?.initials ?? (draft.name ? initials(draft.name) : "?");
  const patientMetaLine = selectedPatient
    ? [
        selectedPatient.age ? `Age ${selectedPatient.age}` : null,
        selectedPatient.type === "new" ? "New patient" : "Returning patient",
      ]
        .filter(Boolean)
        .join(" · ")
    : [draft.age ? `Age ${draft.age}` : null, draft.gender || null, "New patient"]
        .filter(Boolean)
        .join(" · ");

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Register walk-in"
      className="max-w-md"
    >
      {step === "search" && (
        <div>
          <p className="text-[13px] text-[var(--color-muted)]">
            Add a patient who has arrived without an appointment.
          </p>

          <div className="mt-4">
            <label className="text-[12px] font-semibold text-[var(--color-muted)]">
              Search patient
            </label>
            <Search
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or phone number"
              className="mt-1.5"
            />
          </div>

          {query.trim() && (
            <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-[var(--color-border)]">
              {results.length === 0 ? (
                <div className="px-3 py-3 text-[12.5px] text-[var(--color-muted)]">
                  No matching patients.
                </div>
              ) : (
                results.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => pickExisting(p)}
                    className="flex w-full items-center gap-3 border-b border-[var(--color-border)] px-3 py-2.5 text-left last:border-b-0 hover:bg-[var(--color-canvas)]"
                  >
                    <Avatar initials={p.initials} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-semibold text-[var(--color-ink)]">
                        {p.name}
                      </div>
                      <div className="truncate text-[12px] text-[var(--color-muted)]">
                        {formatPhoneDisplay(p.phone)}
                      </div>
                    </div>
                    <span className="shrink-0 text-[11.5px] font-medium text-[var(--color-muted)]">
                      {p.type === "new" ? "New patient" : "Returning patient"}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setStep("new-patient")}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--color-border-strong)] px-3 py-2.5 text-[13px] font-semibold text-[var(--color-teal)] hover:bg-[var(--color-mint-bg)]/50"
          >
            <UserRoundPlus size={16} strokeWidth={2.25} />
            Register new patient
          </button>
        </div>
      )}

      {step === "new-patient" && (
        <div>
          <BackLink onClick={() => setStep("search")} label="Back to search" />

          <h3 className="mt-3 text-[14px] font-bold text-[var(--color-ink)]">
            New patient
          </h3>

          <div className="mt-3 space-y-3">
            <Field label="Full name" required>
              <input
                autoFocus
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="e.g. Priya Sharma"
                className={inputClass}
              />
            </Field>
            <Field label="Phone number" required>
              <PhoneInput
                value={draft.phone}
                onChange={(phone) => setDraft((d) => ({ ...d, phone }))}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Age">
                <input
                  value={draft.age}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      age: e.target.value.replace(/\D/g, ""),
                    }))
                  }
                  placeholder="e.g. 32"
                  inputMode="numeric"
                  className={inputClass}
                />
              </Field>
              <Field label="Gender">
                <select
                  value={draft.gender}
                  onChange={(e) => setDraft((d) => ({ ...d, gender: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </Field>
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={continueNewPatient}
              disabled={!draft.name.trim() || !isValidIndianMobile(draft.phone)}
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === "visit" && (
        <div>
          <div className="flex items-center justify-between rounded-lg bg-[var(--color-canvas)] px-3 py-2.5">
            <div className="flex items-center gap-3">
              <Avatar initials={patientAvatarInitials} size={32} />
              <div>
                <div className="text-[13.5px] font-bold text-[var(--color-ink)]">
                  {patientName}
                </div>
                <div className="text-[12px] text-[var(--color-muted)]">
                  {patientMetaLine}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setStep(selectedPatient ? "search" : "new-patient")}
              className="text-[12px] font-semibold text-[var(--color-teal)] hover:underline"
            >
              Change
            </button>
          </div>

          <h3 className="mt-4 text-[14px] font-bold text-[var(--color-ink)]">
            Reason for visit
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {VISIT_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                  reason === r
                    ? "border-transparent bg-[var(--color-ink-solid)] text-[var(--color-ink-solid-text)]"
                    : "border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-canvas)]",
                )}
              >
                {r}
              </button>
            ))}
          </div>

          {reason === "Other" && (
            <input
              autoFocus
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Describe the reason"
              className={cn(inputClass, "mt-3")}
            />
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => setStep("confirm")}
              disabled={!reason || (reason === "Other" && !customReason.trim())}
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === "confirm" && (
        <div>
          <BackLink onClick={() => setStep("visit")} label="Back" />

          <div className="mt-3 divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
            <SummaryRow label="Patient" value={patientName} />
            <SummaryRow
              label="Visit"
              value={reason === "Other" ? customReason.trim() : (reason ?? "")}
            />
            <SummaryRow label="Type" value="Walk-in" />
            <SummaryRow label="Today" value={fullDateLabel(new Date())} />
          </div>

          {error && (
            <p className="mt-3 text-[12.5px] font-semibold text-[var(--color-danger-text)]">{error}</p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void confirmWalkIn()} disabled={submitting}>
              {submitting ? "Registering…" : "Register walk-in"}
            </Button>
          </div>
        </div>
      )}

      {step === "success" && (
        <div className="flex flex-col items-center py-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-mint-bg)] text-[var(--color-mint-text)]">
            <CheckCircle2 size={24} />
          </div>
          <h3 className="mt-3 text-[16px] font-bold text-[var(--color-ink)]">
            Walk-in registered
          </h3>
          <p className="mt-1 text-[13px] text-[var(--color-muted)]">
            {registeredName} has been added to today&apos;s visits.
          </p>
          <div className="mt-5 flex w-full gap-2">
            <Button
              variant="outline"
              className="flex-1 justify-center"
              onClick={handleClose}
            >
              Close
            </Button>
            <Button
              variant="primary"
              className="flex-1 justify-center"
              onClick={() => {
                handleClose();
                navigate("/today");
              }}
            >
              View today
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function BackLink({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 text-[12.5px] font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)]"
    >
      <ChevronLeft size={15} /> {label}
    </button>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[12px] font-semibold text-[var(--color-muted)]">
        {label} {required && <span className="text-[var(--color-amber-text)]">*</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3.5 py-2.5">
      <span className="text-[12px] font-semibold text-[var(--color-muted)]">
        {label}
      </span>
      <span className="text-[13.5px] font-semibold text-[var(--color-ink)]">
        {value}
      </span>
    </div>
  );
}
