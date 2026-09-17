import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Avatar } from "../ui/Avatar";
import { PhoneInput } from "../ui/PhoneInput";
import { inputClass } from "../ui/fieldStyles";
import { SegmentedControl } from "../patient-record/SegmentedControl";
import { MediaCropModal } from "./MediaCropModal";
import { useClinicData } from "../../state/clinicData";
import { useAuth } from "../../state/authContext";
import { useTheme, type ThemePreference } from "../../state/themeContext";
import { initials as toInitials, cn, getErrorMessage } from "../../lib/utils";
import { normalizePhone, isValidIndianMobile } from "../../lib/phone";
import { useSignedMediaUrl } from "../../lib/signedMedia";
import { validateImageFile, ACCEPTED_IMAGE_ACCEPT } from "../../lib/imageCrop";

const AVATAR_BUCKET = "avatars";

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
  const { doctorProfile, updateDoctorProfile, uploadAvatarPhoto, removeAvatarPhoto } = useClinicData();
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

  const avatarPhotoUrl = useSignedMediaUrl(AVATAR_BUCKET, doctorProfile.avatarPath);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [removingAvatar, setRemovingAvatar] = useState(false);

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

  function handleAvatarFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const error = validateImageFile(file);
    if (error) {
      setAvatarError(error);
      return;
    }
    setAvatarError(null);
    setPendingAvatarFile(file);
  }

  async function handleAvatarCropSave(blob: Blob) {
    try {
      await uploadAvatarPhoto(blob);
      setPendingAvatarFile(null);
    } catch (err) {
      setAvatarError(getErrorMessage(err, "Could not save your photo. The previous one is unchanged."));
    }
  }

  async function handleRemoveAvatar() {
    setRemovingAvatar(true);
    setAvatarError(null);
    try {
      await removeAvatarPhoto();
    } catch (err) {
      setAvatarError(getErrorMessage(err, "Could not remove your photo."));
    } finally {
      setRemovingAvatar(false);
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
          <Avatar
            initials={toInitials(draft.name) || "?"}
            photoUrl={avatarPhotoUrl}
            size={64}
            className="text-[20px]"
          />
          <div>
            <div className="text-[13px] font-semibold text-[var(--color-ink)]">
              Profile photo
            </div>
            <input
              ref={avatarFileInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_ACCEPT}
              className="hidden"
              onChange={handleAvatarFileSelected}
            />
            <div className="mt-1.5 flex items-center gap-2">
              <Button variant="outline" type="button" onClick={() => avatarFileInputRef.current?.click()}>
                {doctorProfile.avatarPath ? "Replace photo" : "Add photo"}
              </Button>
              {doctorProfile.avatarPath && (
                <Button variant="ghost" type="button" onClick={() => void handleRemoveAvatar()} disabled={removingAvatar}>
                  {removingAvatar ? "Removing…" : "Remove"}
                </Button>
              )}
              {!doctorProfile.avatarPath && (
                <span className="text-[12px] text-[var(--color-muted-soft)]">JPG, PNG, or WEBP</span>
              )}
            </div>
            {avatarError && (
              <p className="mt-1.5 text-[12px] font-semibold text-[var(--color-danger-text)]">{avatarError}</p>
            )}
          </div>
        </div>

        <MediaCropModal
          open={pendingAvatarFile !== null}
          file={pendingAvatarFile}
          shape="circle"
          title="Adjust your photo"
          onCancel={() => setPendingAvatarFile(null)}
          onSave={handleAvatarCropSave}
        />

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
              Managed by your sign-in. Contact support to change it.
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
