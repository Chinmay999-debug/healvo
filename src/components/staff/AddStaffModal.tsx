import { useState, type ReactNode } from "react";
import { UserRoundPlus, CheckCircle2 } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { PhoneInput } from "../ui/PhoneInput";
import { inputClass } from "../ui/fieldStyles";
import { useClinicData } from "../../state/clinicData";
import { isValidIndianMobile } from "../../lib/phone";
import { getErrorMessage } from "../../lib/utils";
import type { StaffMember, StaffRole } from "../../data/mockData";

interface Draft {
  name: string;
  phone: string;
  role: StaffRole | "";
}

const emptyDraft: Draft = { name: "", phone: "", role: "" };

/**
 * Healvo V1 only establishes staff directory + role identity. Access is
 * role-based and automatic (Doctor vs Reception) — there is no separate
 * permission-level selector to configure here.
 */
export function AddStaffModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (member: StaffMember) => void;
}) {
  const { addStaff } = useClinicData();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [addedName, setAddedName] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canSubmit =
    draft.name.trim().length > 0 && isValidIndianMobile(draft.phone) && draft.role !== "";

  function reset() {
    setDraft(emptyDraft);
    setSuccess(false);
    setAddedName("");
    setSubmitting(false);
    setSubmitError(null);
  }

  function handleClose() {
    onClose();
    reset();
  }

  async function handleCreate() {
    if (!canSubmit || draft.role === "") return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const member = await addStaff({ name: draft.name, phone: draft.phone, role: draft.role });
      setAddedName(member.name);
      setSuccess(true);
      onCreated?.(member);
    } catch (err) {
      setSubmitError(getErrorMessage(err, "Could not add this staff member."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={success ? "Staff added" : "Add staff"}
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
            They now appear in your staff directory.
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
            Add a team member to your clinic. Access is granted automatically based on role.
          </p>

          <div className="mt-4 space-y-3">
            <Field label="Full name" required>
              <input
                autoFocus
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="e.g. Riya Mehta"
                className={inputClass}
              />
            </Field>
            <Field label="Phone number" required>
              <PhoneInput
                value={draft.phone}
                onChange={(phone) => setDraft((d) => ({ ...d, phone }))}
              />
            </Field>
            <Field label="Role" required>
              <select
                value={draft.role}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, role: e.target.value as StaffRole }))
                }
                className={inputClass}
              >
                <option value="">Select role</option>
                <option value="Doctor">Doctor</option>
                <option value="Reception">Reception</option>
              </select>
              <p className="mt-1.5 text-[11.5px] text-[var(--color-muted-soft)]">
                Access permissions are set automatically based on role.
              </p>
            </Field>
          </div>

          {submitError && (
            <p className="mt-3 text-[12.5px] font-semibold text-[var(--color-danger-text)]">
              {submitError}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleCreate()}
              disabled={!canSubmit || submitting}
            >
              <UserRoundPlus size={15} strokeWidth={2.25} />
              {submitting ? "Adding…" : "Add staff"}
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
