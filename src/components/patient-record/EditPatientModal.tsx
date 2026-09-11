import { useState, type ReactNode } from "react";
import { CheckCircle2, Pencil } from "lucide-react";
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

function draftFromPatient(patient: Patient): Draft {
  const digits = patient.phone.replace(/\D/g, "");
  return {
    name: patient.name,
    phone: digits.length > 10 ? digits.slice(-10) : digits,
    age: patient.age ? String(patient.age) : "",
    gender: patient.gender ?? "",
  };
}

/** Edits an existing patient's identity fields — created records elsewhere
 * (visits, bills) keep their own denormalized snapshot and are not rewritten. */
export function EditPatientModal({
  open,
  onClose,
  patient,
}: {
  open: boolean;
  onClose: () => void;
  patient: Patient;
}) {
  const { updatePatient } = useClinicData();
  const [draft, setDraft] = useState<Draft>(() => draftFromPatient(patient));
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-sync the draft to the current patient each time the modal opens —
  // adjusted during render (React's recommended pattern) rather than in an
  // effect, so opening never costs an extra render pass.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDraft(draftFromPatient(patient));
      setSuccess(false);
      setError(null);
    }
  }

  const canSubmit = draft.name.trim().length > 0 && isValidIndianMobile(draft.phone);

  function handleClose() {
    onClose();
  }

  async function handleSave() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await updatePatient(patient.id, {
        name: draft.name,
        phone: draft.phone,
        age: draft.age,
        gender: draft.gender,
      });
      setSuccess(true);
    } catch (err) {
      setError(getErrorMessage(err, "Could not save these changes."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={success ? "Patient updated" : "Edit patient"}
      className="max-w-md"
    >
      {success ? (
        <div className="flex flex-col items-center py-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-mint-bg)] text-[var(--color-mint-text)]">
            <CheckCircle2 size={24} />
          </div>
          <h3 className="mt-3 text-[16px] font-bold text-[var(--color-ink)]">Changes saved</h3>
          <p className="mt-1 text-[13px] text-[var(--color-muted)]">
            {draft.name}&apos;s record has been updated.
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
          <div className="space-y-3">
            <Field label="Full name" required>
              <input
                autoFocus
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
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
                    setDraft((d) => ({ ...d, age: e.target.value.replace(/\D/g, "") }))
                  }
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
              onClick={() => void handleSave()}
              disabled={!canSubmit || submitting}
            >
              <Pencil size={14} strokeWidth={2.25} />
              {submitting ? "Saving…" : "Save changes"}
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
