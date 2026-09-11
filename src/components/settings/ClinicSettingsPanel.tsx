import { useState, type ReactNode } from "react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { PhoneInput } from "../ui/PhoneInput";
import { inputClass } from "../ui/fieldStyles";
import { useClinicData } from "../../state/clinicData";
import { initials as toInitials, cn, getErrorMessage } from "../../lib/utils";
import { normalizePhone, isValidIndianMobile } from "../../lib/phone";

function localDigits(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function ClinicSettingsPanel() {
  const { clinicSettings, updateClinicSettings } = useClinicData();
  const [draft, setDraft] = useState({
    clinicName: clinicSettings.clinicName,
    phoneLocal: localDigits(clinicSettings.phone),
    email: clinicSettings.email,
    address: clinicSettings.address,
    city: clinicSettings.city,
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canSave = draft.clinicName.trim().length > 0 && isValidIndianMobile(draft.phoneLocal);

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateClinicSettings({
        clinicName: draft.clinicName.trim(),
        phone: normalizePhone(draft.phoneLocal),
        email: draft.email.trim(),
        address: draft.address.trim(),
        city: draft.city.trim(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveError(getErrorMessage(err, "Could not save clinic settings."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="text-[16px] font-bold text-[var(--color-ink)]">Clinic</h2>
      <p className="mt-0.5 text-[13px] text-[var(--color-muted)]">
        Your clinic information and public details.
      </p>

      <div className="mt-5 flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-mint-bg)] text-[20px] font-bold text-[var(--color-teal)]">
          {toInitials(draft.clinicName) || "?"}
        </div>
        <div>
          <div className="text-[13px] font-semibold text-[var(--color-ink)]">Clinic logo</div>
          <div className="mt-1.5 flex items-center gap-2">
            <Button variant="outline" type="button">
              Change logo
            </Button>
            <span className="text-[12px] text-[var(--color-muted-soft)]">
              PNG or JPG, up to 2MB
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Field label="Clinic name" required className="sm:col-span-2">
          <input
            value={draft.clinicName}
            onChange={(e) => setDraft((d) => ({ ...d, clinicName: e.target.value }))}
            placeholder="e.g. Sharma Dental"
            className={inputClass}
          />
        </Field>
        <Field label="Phone" required>
          <PhoneInput
            value={draft.phoneLocal}
            onChange={(phone) => setDraft((d) => ({ ...d, phoneLocal: phone }))}
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            value={draft.email}
            onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
            placeholder="e.g. hello@clinic.in"
            className={inputClass}
          />
        </Field>
        <Field label="Address">
          <input
            value={draft.address}
            onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
            placeholder="e.g. Indiranagar"
            className={inputClass}
          />
        </Field>
        <Field label="City">
          <input
            value={draft.city}
            onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))}
            placeholder="e.g. Bengaluru"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Button variant="primary" onClick={() => void handleSave()} disabled={!canSave || saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        {saved && (
          <span className="text-[12.5px] font-semibold text-[var(--color-mint-text)]">
            Saved
          </span>
        )}
        {saveError && (
          <span className="text-[12.5px] font-semibold text-[var(--color-danger-text)]">
            {saveError}
          </span>
        )}
      </div>
    </Card>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="text-[12px] font-semibold text-[var(--color-muted)]">
        {label} {required && <span className="text-[var(--color-amber-text)]">*</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
