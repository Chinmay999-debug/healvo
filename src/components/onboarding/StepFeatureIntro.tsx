import { CalendarDays, FileText, Grid3x3, Stethoscope, Users, Wallet } from "lucide-react";
import { Button } from "../ui/Button";
import { HealvoAiMark } from "../layout/HealvoAiMark";
import { cn } from "../../lib/utils";

const features = [
  {
    icon: Users,
    title: "Patients",
    description: "Keep patient history, visits and documents together.",
  },
  {
    icon: CalendarDays,
    title: "Appointments",
    description: "Book, reschedule and track your clinic's day.",
  },
  {
    icon: Stethoscope,
    title: "Consultations",
    description: "Capture clinical notes, prescriptions and follow-ups.",
  },
  {
    icon: Grid3x3,
    title: "Dental Chart",
    description: "Maintain a visual tooth-by-tooth record over time.",
  },
  {
    icon: FileText,
    title: "Documents",
    description: "Keep X-rays, reports and files attached to the patient.",
  },
  {
    icon: Wallet,
    title: "Billing & Payments",
    description: "Create invoices and record payments without spreadsheets.",
  },
  {
    icon: HealvoAiMark,
    title: "Healvo AI",
    description: "Ask questions about your clinic in plain language.",
    accent: true,
  },
] as const;

export function StepFeatureIntro({ onContinue }: { onContinue: () => void }) {
  return (
    <div>
      <h1 className="text-[23px] font-extrabold tracking-tight text-[var(--color-ink)]">
        Meet your clinic workspace
      </h1>
      <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-[var(--color-muted)]">
        Everything you need to run your clinic, connected in one place.
      </p>

      <div className="mt-8 border-t border-[var(--color-border)]">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="flex items-start gap-4 border-b border-[var(--color-border)] py-4"
          >
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                "accent" in feature && feature.accent
                  ? "bg-[var(--color-teal)] text-white"
                  : "bg-[var(--color-canvas)] text-[var(--color-muted)]",
              )}
            >
              <feature.icon size={16} strokeWidth={1.9} />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="text-[13.5px] font-bold text-[var(--color-ink)]">{feature.title}</div>
              <p className="mt-1 max-w-md text-[13px] leading-relaxed text-[var(--color-muted)]">
                {feature.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="primary"
        className="mt-8 w-full justify-center py-2.5"
        onClick={onContinue}
      >
        Continue
      </Button>
    </div>
  );
}
