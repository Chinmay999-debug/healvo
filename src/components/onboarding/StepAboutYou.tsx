import { useRef, useState } from "react";
import { Camera, Stethoscope, UserCircle2 } from "lucide-react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Avatar } from "../ui/Avatar";
import { MediaCropModal } from "../settings/MediaCropModal";
import { useAuth } from "../../state/authContext";
import { uploadAvatarPhoto } from "../../services/clinic";
import { cn, initials, getErrorMessage } from "../../lib/utils";
import { useSignedMediaUrl } from "../../lib/signedMedia";
import { validateImageFile, ACCEPTED_IMAGE_ACCEPT } from "../../lib/imageCrop";
import { PhoneInput } from "../ui/PhoneInput";
import { isValidIndianMobile } from "../../lib/phone";
import { fieldInputClass, fieldLabelClass } from "./fieldStyles";
import type { AboutYouDraft } from "./OnboardingWizard";

const AVATAR_BUCKET = "avatars";

/** Quick ways to fill the Professional title field below. They write into
 * `title` rather than into a separate `role` value, so the title is the only
 * thing this step tracks and there is nothing to keep in sync. */
const titlePresets: { label: string; title: string; icon: typeof Stethoscope }[] = [
  { label: "Dentist", title: "Owner · Dentist", icon: Stethoscope },
  { label: "Staff", title: "Owner · Staff", icon: UserCircle2 },
];

/** Uses the same production upload+crop+persist flow as Settings > Account
 * (services/clinic.ts's uploadAvatarPhoto, MediaCropModal) — the profiles
 * row this writes to already exists by the time onboarding runs (the
 * handle_new_user() trigger creates it at signup, before a clinic exists),
 * so there's nothing wizard-specific needed here. profile.avatar_path
 * (from authContext, refreshed after a successful upload) is the single
 * source of truth for whether a photo exists, not local draft state — a
 * skipped photo simply leaves it null and every renderer falls back to
 * initials, same as everywhere else in the app. */
export function StepAboutYou({
  draft,
  email,
  onChange,
  onContinue,
}: {
  draft: AboutYouDraft;
  /** From the signed-in account — shown, never typed. */
  email: string;
  onChange: (draft: AboutYouDraft) => void;
  onContinue: () => void;
}) {
  const { profile, refresh } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canContinue =
    draft.fullName.trim().length > 0 &&
    isValidIndianMobile(draft.mobile) &&
    draft.title.trim().length > 0;
  const mobileTouched = draft.mobile.trim().length > 0;
  const mobileInvalid = mobileTouched && !isValidIndianMobile(draft.mobile);

  const avatarPhotoUrl = useSignedMediaUrl(AVATAR_BUCKET, profile?.avatar_path);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  function handlePhotoSelected(file: File | undefined) {
    if (!file) return;
    const error = validateImageFile(file);
    if (error) {
      setPhotoError(error);
      return;
    }
    setPhotoError(null);
    setPendingPhotoFile(file);
  }

  async function handleCropSave(blob: Blob) {
    setUploadingPhoto(true);
    setPhotoError(null);
    try {
      await uploadAvatarPhoto(blob);
      await refresh();
      setPendingPhotoFile(null);
    } catch (err) {
      setPhotoError(getErrorMessage(err, "Could not save your photo. The previous one is unchanged."));
    } finally {
      setUploadingPhoto(false);
    }
  }

  return (
    <div>
      <h1 className="text-[23px] font-extrabold tracking-tight text-[var(--color-ink)]">
        Let&apos;s set up your profile.
      </h1>
      <p className="mt-2 max-w-sm text-[13.5px] leading-relaxed text-[var(--color-muted)]">
        Tell us a little about yourself so Healvo can personalize your workspace.
      </p>
      {email && (
        <p className="mt-1.5 text-[12.5px] text-[var(--color-muted-soft)]">
          Signed in as <span className="font-semibold text-[var(--color-muted)]">{email}</span>
        </p>
      )}

      <div className="mt-8 flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingPhoto}
          className="group relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--color-border)] outline-none disabled:cursor-not-allowed"
        >
          <Avatar initials={initials(draft.fullName || "?") || "?"} photoUrl={avatarPhotoUrl} size={56} />
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
            <Camera size={15} strokeWidth={2.25} />
          </span>
        </button>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] font-semibold text-[var(--color-ink)]">Profile photo</span>
            <Badge tone="slate">Optional</Badge>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPhoto}
            className="mt-0.5 text-[12.5px] font-semibold text-[var(--color-teal)] hover:underline disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploadingPhoto ? "Saving…" : profile?.avatar_path ? "Change photo" : "Upload photo"}
          </button>
          {photoError && (
            <p className="mt-1 text-[11.5px] font-semibold text-[var(--color-danger-text)]">{photoError}</p>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            handlePhotoSelected(file);
          }}
        />
      </div>

      <MediaCropModal
        open={pendingPhotoFile !== null}
        file={pendingPhotoFile}
        shape="circle"
        title="Adjust your photo"
        onCancel={() => setPendingPhotoFile(null)}
        onSave={handleCropSave}
      />

      <div className="mt-8 space-y-5">
        <label className="block">
          <span className={fieldLabelClass}>Full name</span>
          <input
            required
            autoFocus
            autoComplete="name"
            value={draft.fullName}
            onChange={(e) => onChange({ ...draft, fullName: e.target.value })}
            placeholder="Dr. Priya Nair"
            className={fieldInputClass}
          />
        </label>

        <label className="block">
          <span className={fieldLabelClass}>Mobile number</span>
          <PhoneInput
            value={draft.mobile}
            onChange={(mobile) => onChange({ ...draft, mobile })}
            size="md"
            autoComplete="tel-national"
            aria-invalid={mobileInvalid}
            className="mt-1.5"
          />
          {mobileInvalid ? (
            <p className="mt-1.5 text-[11.5px] font-semibold text-[var(--color-danger-text)]">
              Enter a 10-digit Indian mobile number.
            </p>
          ) : (
            <p className="mt-1.5 text-[11.5px] text-[var(--color-muted-soft)]">
              Your own number, so your team can reach you. Your clinic&apos;s number comes next.
            </p>
          )}
        </label>

        <div>
          <span className={fieldLabelClass}>Professional title</span>
          <div className="mt-2 grid grid-cols-2 gap-2.5">
            {titlePresets.map((preset) => (
              <button
                key={preset.title}
                type="button"
                onClick={() => onChange({ ...draft, title: preset.title })}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-left text-[13.5px] font-semibold transition-colors",
                  draft.title.trim() === preset.title
                    ? "border-transparent bg-[var(--color-teal)] text-white"
                    : "border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-canvas)]",
                )}
              >
                <preset.icon size={16} strokeWidth={2.25} />
                {preset.label}
              </button>
            ))}
          </div>
          <input
            required
            value={draft.title}
            onChange={(e) => onChange({ ...draft, title: e.target.value })}
            placeholder="e.g. Owner · Dentist"
            aria-label="Professional title"
            className={cn(fieldInputClass, "mt-2.5")}
          />
        </div>
      </div>

      <Button
        type="button"
        variant="primary"
        className="mt-9 w-full justify-center py-2.5"
        disabled={!canContinue}
        onClick={onContinue}
      >
        Continue
      </Button>
    </div>
  );
}
