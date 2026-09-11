import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Avatar } from "../ui/Avatar";
import { PhoneInput } from "../ui/PhoneInput";
import { inputClass } from "../ui/fieldStyles";
import { MediaCropModal } from "./MediaCropModal";
import { useClinicData } from "../../state/clinicData";
import { initials as toInitials, cn, getErrorMessage } from "../../lib/utils";
import { normalizePhone, isValidIndianMobile } from "../../lib/phone";
import { useSignedMediaUrl } from "../../lib/signedMedia";
import { validateImageFile, ACCEPTED_IMAGE_ACCEPT } from "../../lib/imageCrop";

const CLINIC_LOGO_BUCKET = "clinic-logos";

function localDigits(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function ClinicSettingsPanel() {
  const { clinicSettings, updateClinicSettings, uploadClinicLogo, removeClinicLogo } = useClinicData();
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

  const logoUrl = useSignedMediaUrl(CLINIC_LOGO_BUCKET, clinicSettings.logoPath);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [removingLogo, setRemovingLogo] = useState(false);

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

  function handleLogoFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const error = validateImageFile(file);
    if (error) {
      setLogoError(error);
      return;
    }
    setLogoError(null);
    setPendingLogoFile(file);
  }

  async function handleLogoCropSave(blob: Blob) {
    try {
      await uploadClinicLogo(blob);
      setPendingLogoFile(null);
    } catch (err) {
      setLogoError(getErrorMessage(err, "Could not save the logo. The previous one is unchanged."));
    }
  }

  async function handleRemoveLogo() {
    setRemovingLogo(true);
    setLogoError(null);
    try {
      await removeClinicLogo();
    } catch (err) {
      setLogoError(getErrorMessage(err, "Could not remove the logo."));
    } finally {
      setRemovingLogo(false);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="text-[16px] font-bold text-[var(--color-ink)]">Clinic</h2>
      <p className="mt-0.5 text-[13px] text-[var(--color-muted)]">
        Your clinic information and public details.
      </p>

      <div className="mt-5 flex items-center gap-4">
        <Avatar
          initials={toInitials(draft.clinicName) || "?"}
          photoUrl={logoUrl}
          shape="rounded"
          size={64}
          className="text-[20px]"
        />
        <div>
          <div className="text-[13px] font-semibold text-[var(--color-ink)]">Clinic logo</div>
          <input
            ref={logoFileInputRef}
            type="file"
            accept={ACCEPTED_IMAGE_ACCEPT}
            className="hidden"
            onChange={handleLogoFileSelected}
          />
          <div className="mt-1.5 flex items-center gap-2">
            <Button variant="outline" type="button" onClick={() => logoFileInputRef.current?.click()}>
              {clinicSettings.logoPath ? "Replace logo" : "Add logo"}
            </Button>
            {clinicSettings.logoPath && (
              <Button variant="ghost" type="button" onClick={() => void handleRemoveLogo()} disabled={removingLogo}>
                {removingLogo ? "Removing…" : "Remove"}
              </Button>
            )}
            {!clinicSettings.logoPath && (
              <span className="text-[12px] text-[var(--color-muted-soft)]">JPG, PNG, or WEBP</span>
            )}
          </div>
          {logoError && (
            <p className="mt-1.5 text-[12px] font-semibold text-[var(--color-danger-text)]">{logoError}</p>
          )}
        </div>
      </div>

      <MediaCropModal
        open={pendingLogoFile !== null}
        file={pendingLogoFile}
        shape="rounded"
        title="Adjust your logo"
        onCancel={() => setPendingLogoFile(null)}
        onSave={handleLogoCropSave}
      />

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
