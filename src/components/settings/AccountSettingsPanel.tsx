import { useState, type ReactNode } from "react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { PhoneInput } from "../ui/PhoneInput";
import { inputClass } from "../ui/fieldStyles";
import { SegmentedControl } from "../patient-record/SegmentedControl";
import { useClinicData } from "../../state/clinicData";
import { useAuth } from "../../state/authContext";
import { useTheme, type ThemePreference } from "../../state/themeContext";
import { initials as toInitials, cn, getErrorMessage } from "../../lib/utils";
import { normalizePhone, isValidIndianMobile } from "../../lib/phone";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

function localDigits(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function AccountSettingsPanel() {
  const { doctorProfile, updateDoctorProfile } = useClinicData();
  const { signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [draft, setDraft] = useState({
    name: doctorProfile.name,
    phoneLocal: localDigits(doctorProfile.phone),
    title: doctorProfile.title,
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canSave = draft.name.trim().length > 0 && isValidIndianMobile(draft.phoneLocal);

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateDoctorProfile({
        name: draft.name.trim(),
        phone: normalizePhone(draft.phoneLocal),
        title: draft.title.trim(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveError(getErrorMessage(err, "Could not save your profile."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h2 className="text-[16px] font-bold text-[var(--color-ink)]">Profile</h2>
        <p className="mt-0.5 text-[13px] text-[var(--color-muted)]">
          Manage your Healvo account and profile.
        </p>

        <div className="mt-5 flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-mint-bg)] text-[20px] font-bold text-[var(--color-teal)]">
            {toInitials(draft.name) || "?"}
          </div>
          <div>
            <div className="text-[13px] font-semibold text-[var(--color-ink)]">
              Profile photo
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <Button variant="outline" type="button">
                Change photo
              </Button>
              <span className="text-[12px] text-[var(--color-muted-soft)]">
                PNG or JPG, up to 2MB
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Field label="Full name" required className="sm:col-span-2">
            <input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="e.g. Dr. Ananya Sharma"
              className={inputClass}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={doctorProfile.email}
              readOnly
              disabled
              className={cn(inputClass, "cursor-not-allowed opacity-70")}
            />
            <p className="mt-1.5 text-[11.5px] text-[var(--color-muted-soft)]">
              Managed by your sign-in — contact support to change it.
            </p>
          </Field>
          <Field label="Phone" required>
            <PhoneInput
              value={draft.phoneLocal}
              onChange={(phone) => setDraft((d) => ({ ...d, phoneLocal: phone }))}
            />
          </Field>
          <Field label="Professional title" className="sm:col-span-2">
            <input
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="e.g. Owner · Dentist"
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

      <Card className="p-5">
        <h2 className="text-[16px] font-bold text-[var(--color-ink)]">Security</h2>
        <p className="mt-0.5 text-[13px] text-[var(--color-muted)]">
          Keep your account secure.
        </p>
        <div className="mt-4">
          <Button variant="outline" type="button">
            Change password
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-[16px] font-bold text-[var(--color-ink)]">Appearance</h2>
        <p className="mt-0.5 text-[13px] text-[var(--color-muted)]">
          Choose how Healvo looks for you.
        </p>
        <div className="mt-4">
          <SegmentedControl
            options={THEME_OPTIONS}
            value={theme}
            onChange={setTheme}
          />
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-[16px] font-bold text-[var(--color-ink)]">Account</h2>
        <div className="mt-4">
          <Button
            variant="outline"
            type="button"
            className="text-[var(--color-amber-text)]"
            onClick={() => void signOut()}
          >
            Sign out
          </Button>
        </div>
      </Card>
    </div>
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
