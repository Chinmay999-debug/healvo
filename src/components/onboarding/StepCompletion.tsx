import { CheckCircle2 } from "lucide-react";
import { Button } from "../ui/Button";

export function StepCompletion({
  clinicName,
  onFinish,
}: {
  clinicName: string;
  onFinish: () => void;
}) {
  const name = clinicName.trim() || "Your clinic";
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-mint-bg)] text-[var(--color-mint-text)]">
        <CheckCircle2 size={22} strokeWidth={2} />
      </div>
      <h1 className="mt-6 text-[24px] font-extrabold tracking-tight text-[var(--color-ink)]">
        You&apos;re ready to go.
      </h1>
      <p className="mt-2.5 text-[14.5px] font-semibold text-[var(--color-ink)]">
        {name} is set up in Healvo.
      </p>
      <p className="mt-2 max-w-sm text-[13.5px] leading-relaxed text-[var(--color-muted)]">
        Your workspace is ready. Start by adding your first patient, booking an appointment, or
        exploring your clinic.
      </p>

      <Button
        type="button"
        variant="primary"
        className="mt-8 w-full max-w-[240px] justify-center py-2.5"
        onClick={onFinish}
      >
        Go to Healvo
      </Button>
    </div>
  );
}
