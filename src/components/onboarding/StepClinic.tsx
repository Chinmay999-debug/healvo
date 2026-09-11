import { useRef } from "react";
import { ArrowLeft, Image } from "lucide-react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { PhoneInput } from "../ui/PhoneInput";
import { isValidIndianMobile } from "../../lib/phone";
import { fieldInputClass, fieldLabelClass } from "./fieldStyles";
import type { ClinicDraft } from "./OnboardingWizard";

export function StepClinic({
  draft,
  onChange,
  onBack,
  onContinue,
  submitting,
  error,
}: {
  draft: ClinicDraft;
  onChange: (draft: ClinicDraft) => void;
  onBack: () => void;
  onContinue: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canContinue =
    draft.clinicName.trim().length > 0 &&
    isValidIndianMobile(draft.phone) &&
    draft.address.trim().length > 0 &&
    draft.city.trim().length > 0;

  function handleLogoSelected(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange({ ...draft, logoDataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-1.5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]"
      >
        <ArrowLeft size={14} strokeWidth={2.5} />
        Back
      </button>

      <h1 className="text-[23px] font-extrabold tracking-tight text-[var(--color-ink)]">Set up your clinic</h1>
      <p className="mt-2 max-w-sm text-[13.5px] leading-relaxed text-[var(--color-muted)]">
        Create your clinic workspace. You can change these details later.
      </p>

      <div className="mt-6 space-y-4">
        <span className="block text-[11px] font-bold tracking-[0.08em] text-[var(--color-muted-soft)] uppercase">
          Clinic details
        </span>

        <label className="-mt-2.5 block">
          <span className={fieldLabelClass}>Clinic name</span>
          <input
            required
            autoFocus
            value={draft.clinicName}
            onChange={(e) => onChange({ ...draft, clinicName: e.target.value })}
            placeholder="e.g. Sharma Dental"
            className={fieldInputClass}
          />
        </label>

        <label className="block">
          <span className={fieldLabelClass}>Phone</span>
          <PhoneInput
            value={draft.phone}
            onChange={(phone) => onChange({ ...draft, phone })}
            size="md"
            className="mt-1.5"
          />
        </label>

        <label className="block">
          <span className={fieldLabelClass}>Address</span>
          <input
            required
            value={draft.address}
            onChange={(e) => onChange({ ...draft, address: e.target.value })}
            placeholder="Street, area"
            className={fieldInputClass}
          />
        </label>

        <label className="block">
          <span className={fieldLabelClass}>City</span>
          <input
            required
            value={draft.city}
            onChange={(e) => onChange({ ...draft, city: e.target.value })}
            placeholder="e.g. Bengaluru"
            className={fieldInputClass}
          />
        </label>

        <div className="flex items-center gap-4 rounded-lg border border-dashed border-[var(--color-border-strong)] px-3.5 py-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--color-canvas)] text-[var(--color-muted-soft)]">
            {draft.logoDataUrl ? (
              <img src={draft.logoDataUrl} alt="Clinic logo" className="h-full w-full object-cover" />
            ) : (
              <Image size={18} strokeWidth={1.75} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-[var(--color-ink)]">Clinic logo</span>
              <Badge tone="slate">Optional</Badge>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-0.5 text-[12.5px] font-semibold text-[var(--color-teal)] hover:underline"
            >
              {draft.logoDataUrl ? "Change logo" : "Upload logo"}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleLogoSelected(e.target.files?.[0])}
          />
        </div>
      </div>

      {error && <p className="mt-4 text-[12.5px] font-semibold text-[var(--color-danger-text)]">{error}</p>}

      <Button
        type="button"
        variant="primary"
        className="mt-7 w-full justify-center py-2.5"
        disabled={!canContinue || submitting}
        onClick={onContinue}
      >
        {submitting ? "Setting up your clinic…" : "Continue"}
      </Button>
    </div>
  );
}
