import { useState, type ReactNode } from "react";
import { UserRoundPlus, CheckCircle2 } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { PhoneInput } from "../ui/PhoneInput";
import { inputClass } from "../ui/fieldStyles";
import { useClinicData } from "../../state/clinicData";
import { isValidIndianMobile } from "../../lib/phone";
import { getErrorMessage } from "../../lib/utils";
import type { Patient } from "../../data/mockData";

interface Draft {
  name: string;
  phone: string;
  age: string;
  gender: string;
}

const emptyDraft: Draft = { name: "", phone: "", age: "", gender: "" };

/**
 * Creates a patient in the clinic directory only — no visit is created.
 * Contrast with Today's walk-in registration, which creates/finds a patient
 * AND immediately checks them in for a visit.
 */
export function AddPatientModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  /** Called right after a patient is created, before the success screen shows. */
  onCreated?: (patient: Patient) => void;
}) {
  const { addPatient } = useClinicData();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [addedName, setAddedName] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = draft.name.trim().length > 0 && isValidIndianMobile(draft.phone);

  function reset() {
    setDraft(emptyDraft);
    setSuccess(false);
    setAddedName("");
    setError(null);
  }

  function handleClose() {
    onClose();
    reset();
  }

  async function handleCreate() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const patient = await addPatient(draft);
      setAddedName(patient.name);
      setSuccess(true);
      onCreated?.(patient);
    } catch (err) {
      setError(getErrorMessage(err, "Could not add this patient."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={success ? "Patient added" : "Add patient"}
      className="max-w-md"
    >
      {success ? (
        <div className="flex flex-col items-center py-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-mint-bg)] text-[var(--color-mint-text)]">
            <CheckCircle2 size={24} />
          </div>
          <h3 className="mt-3 text-[16px] font-bold text-[var(--color-ink)]">
            {addedName} added
          </h3>
          <p className="mt-1 text-[13px] text-[var(--color-muted)]">
            They now appear in your patient directory.
          </p>
          <Button
            variant="primary"
            className="mt-5 w-full justify-center"
            onClick={handleClose}
          >
            Done
          </Button>
        </div>
      ) : (
        <div>
          <p className="text-[13px] text-[var(--color-muted)]">
            Add a patient to your clinic directory. This does not create a visit.
          </p>

          <div className="mt-4 space-y-3">
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

          {error && (
            <p className="mt-3 text-[12.5px] font-semibold text-[var(--color-danger-text)]">{error}</p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleCreate()}
              disabled={!canSubmit || submitting}
            >
              <UserRoundPlus size={15} strokeWidth={2.25} />
              {submitting ? "Adding…" : "Add patient"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
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
