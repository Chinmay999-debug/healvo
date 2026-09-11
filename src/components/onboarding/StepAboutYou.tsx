import { useRef } from "react";
import { Camera, Stethoscope, UserCircle2 } from "lucide-react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { cn, initials } from "../../lib/utils";
import { fieldInputClass, fieldLabelClass } from "./fieldStyles";
import type { AboutYouDraft, ClinicRoleChoice } from "./OnboardingWizard";

const roleOptions: { value: ClinicRoleChoice; label: string; icon: typeof Stethoscope }[] = [
  { value: "dentist", label: "Dentist", icon: Stethoscope },
  { value: "staff", label: "Staff", icon: UserCircle2 },
];

export function StepAboutYou({
  draft,
  onChange,
  onContinue,
}: {
  draft: AboutYouDraft;
  onChange: (draft: AboutYouDraft) => void;
  onContinue: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canContinue = draft.name.trim().length > 0;

  function handlePhotoSelected(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange({ ...draft, photoDataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <h1 className="text-[23px] font-extrabold tracking-tight text-[var(--color-ink)]">
        Let&apos;s set up your profile.
      </h1>
      <p className="mt-2 max-w-sm text-[13.5px] leading-relaxed text-[var(--color-muted)]">
        Tell us a little about yourself so Healvo can personalize your workspace.
      </p>

      <div className="mt-8 flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="group relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--color-border)] bg-[var(--color-mint-bg)] text-[16px] font-bold text-[var(--color-teal)]"
        >
          {draft.photoDataUrl ? (
            <img src={draft.photoDataUrl} alt="Your photo" className="h-full w-full object-cover" />
          ) : (
            initials(draft.name || "?") || "?"
          )}
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
            className="mt-0.5 text-[12.5px] font-semibold text-[var(--color-teal)] hover:underline"
          >
            {draft.photoDataUrl ? "Change photo" : "Upload photo"}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handlePhotoSelected(e.target.files?.[0])}
        />
      </div>

      <div className="mt-8 space-y-5">
        <label className="block">
          <span className={fieldLabelClass}>Name</span>
          <input
            required
            autoFocus
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
            placeholder="Dr. Priya Nair"
            className={fieldInputClass}
          />
        </label>

        <div>
          <span className={fieldLabelClass}>Role</span>
          <div className="mt-2 grid grid-cols-2 gap-2.5">
            {roleOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange({ ...draft, role: option.value })}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-left text-[13.5px] font-semibold transition-colors",
                  draft.role === option.value
                    ? "border-transparent bg-[var(--color-teal)] text-white"
                    : "border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-canvas)]",
                )}
              >
                <option.icon size={16} strokeWidth={2.25} />
                {option.label}
              </button>
            ))}
          </div>
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
