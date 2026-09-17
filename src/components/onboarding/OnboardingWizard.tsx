import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { Logo } from "../ui/Logo";
import { useAuth } from "../../state/authContext";
import { useTheme } from "../../state/themeContext";
import { createClinicWithOwner } from "../../services/clinic";
import { saveClinicDetailsDraft } from "../../lib/onboardingDraft";
import { cn, getErrorMessage } from "../../lib/utils";
import { StepAboutYou } from "./StepAboutYou";
import { StepClinic } from "./StepClinic";
import { StepFeatureIntro } from "./StepFeatureIntro";
import { StepCompletion } from "./StepCompletion";

export type ClinicRoleChoice = "dentist" | "staff";

export interface AboutYouDraft {
  name: string;
  role: ClinicRoleChoice;
}

export interface ClinicDraft {
  clinicName: string;
  phone: string;
  address: string;
  city: string;
  logoDataUrl: string | null;
}

const STEP_LABELS = ["About you", "Your clinic", "Explore Healvo", "Done"];

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || `clinic-${Date.now()}`
  );
}

/** Shown by RequireAuthAndClinic in place of the app whenever a signed-in
 * user has no clinic yet — i.e. always exactly once, right after a brand
 * new signup (see the account-behavior notes there). Owns all four steps'
 * draft state itself so Back/Continue never loses anything the user typed,
 * and only calls the real create_clinic_with_owner RPC once, at the end of
 * step 2 — steps 3/4 are local-only so there's nothing left to fail. */
export function OnboardingWizard({
  initialName,
  onFinish,
}: {
  initialName: string;
  onFinish: () => void;
}) {
  const { user, profile, signOut, refresh } = useAuth();
  const { resolvedTheme } = useTheme();

  // Onboarding is always dark, independent of the user's dashboard theme
  // preference (Settings -> Account) — forced here rather than by touching
  // ThemeProvider/localStorage so the real preference is never overwritten,
  // only visually overridden while this component is on screen.
  // useLayoutEffect (not useEffect) so the override lands before the
  // browser paints this component's first frame, matching how index.html's
  // inline pre-paint script avoids a flash of the wrong theme for the rest
  // of the app. The real resolved theme is restored on unmount (onFinish,
  // sign-out, or a later account swap) via a ref so the cleanup always
  // reads the latest value rather than the one captured at mount time.
  const resolvedThemeRef = useRef(resolvedTheme);
  useEffect(() => {
    resolvedThemeRef.current = resolvedTheme;
  }, [resolvedTheme]);
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    return () => {
      document.documentElement.setAttribute("data-theme", resolvedThemeRef.current);
    };
  }, []);

  const [step, setStep] = useState(1);
  const [aboutYou, setAboutYou] = useState<AboutYouDraft>({
    name: initialName || profile?.full_name || "",
    role: "dentist",
  });
  const [clinicDraft, setClinicDraft] = useState<ClinicDraft>({
    clinicName: "",
    phone: "",
    address: "",
    city: "",
    logoDataUrl: null,
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Once the clinic exists (end of step 2), re-running create_clinic_with_owner
  // would create a second one — so nothing before it is worth losing either.
  // Warn on refresh/close for as long as that risk exists.
  useEffect(() => {
    if (step >= 3) return;
    const hasEnteredSomething =
      aboutYou.name.trim() || clinicDraft.clinicName.trim() || clinicDraft.phone.trim();
    if (!hasEnteredSomething) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [step, aboutYou.name, clinicDraft.clinicName, clinicDraft.phone]);

  async function handleCreateClinic() {
    setCreating(true);
    setCreateError(null);
    try {
      const title = aboutYou.role === "dentist" ? "Owner · Dentist" : "Owner · Staff";
      await createClinicWithOwner({
        name: clinicDraft.clinicName.trim(),
        slug: slugify(clinicDraft.clinicName),
        fullName: aboutYou.name.trim(),
        phone: clinicDraft.phone,
        title,
      });
      // clinicSettings (address/city/phone) stays local/mock-backed this
      // phase — see state/clinicData.tsx's file header. ClinicDataProvider
      // isn't mounted yet at this point (it only wraps the real app, not
      // the wizard), so this hands the details off via onboardingDraft.ts
      // instead of a direct updateClinicSettings() call.
      if (user) {
        saveClinicDetailsDraft(user.id, {
          phone: clinicDraft.phone,
          address: clinicDraft.address.trim(),
          city: clinicDraft.city.trim(),
        });
      }
      await refresh();
      setStep(3);
    } catch (err) {
      setCreateError(getErrorMessage(err, "Could not create your clinic."));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-[var(--color-canvas)] px-5 py-10 sm:px-6 sm:py-16">
      <div className={cn("w-full", step === 3 ? "max-w-[700px]" : "max-w-[640px]")}>
        <div className="mb-8 flex items-center justify-between sm:mb-10">
          <Logo />
          {step < 3 && (
            <button
              type="button"
              onClick={() => void signOut()}
              className="text-[12.5px] font-semibold text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]"
            >
              Log out
            </button>
          )}
        </div>

        <StepIndicator step={step} />

        <div
          key={step}
          className="animate-[onboarding-step-in_260ms_ease-out] border-t border-[var(--color-border)] pt-8 sm:pt-10"
        >
          {step === 1 && (
            <StepAboutYou
              draft={aboutYou}
              onChange={setAboutYou}
              onContinue={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <StepClinic
              draft={clinicDraft}
              onChange={setClinicDraft}
              onBack={() => setStep(1)}
              onContinue={() => void handleCreateClinic()}
              submitting={creating}
              error={createError}
            />
          )}
          {step === 3 && <StepFeatureIntro onContinue={() => setStep(4)} />}
          {step === 4 && <StepCompletion clinicName={clinicDraft.clinicName} onFinish={onFinish} />}
        </div>
      </div>
    </div>
  );
}

/** Quiet, numbered step indicator — deliberately not the dominant element on
 * the page. Desktop/tablet gets the full "01 About you · 02 Your clinic …"
 * row; below the sm breakpoint that would either wrap awkwardly or force
 * tiny type, so mobile gets a compact "Step 2 of 4" line plus a single slim
 * progress track instead of re-flowing the same four labels. */
function StepIndicator({ step }: { step: number }) {
  const total = STEP_LABELS.length;
  return (
    <div className="mb-8 sm:mb-10">
      <div className="flex items-center gap-3 sm:hidden">
        <span className="text-[11px] font-bold tracking-[0.08em] text-[var(--color-muted-soft)] uppercase">
          Step {step} of {total}
        </span>
        <span className="text-[11px] font-bold text-[var(--color-ink)]">{STEP_LABELS[step - 1]}</span>
      </div>
      <div className="mt-2.5 h-[3px] w-full overflow-hidden rounded-full bg-[var(--color-border)] sm:hidden">
        <div
          className="h-full rounded-full bg-[var(--color-teal)] transition-[width] duration-300 ease-out"
          style={{ width: `${(step / total) * 100}%` }}
        />
      </div>

      <div className="hidden items-center sm:flex">
        {STEP_LABELS.map((label, index) => {
          const stepNumber = index + 1;
          const done = stepNumber < step;
          const active = stepNumber === step;
          return (
            <div key={label} className="flex items-center">
              {index > 0 && <span className="mx-3 h-px w-6 bg-[var(--color-border)]" aria-hidden />}
              <div className="flex items-center gap-1.5">
                {done ? (
                  <Check size={12} strokeWidth={3} className="text-[var(--color-teal)]" />
                ) : (
                  <span
                    className={cn(
                      "text-[11px] font-bold tabular-nums",
                      active ? "text-[var(--color-teal)]" : "text-[var(--color-muted-soft)]",
                    )}
                  >
                    {String(stepNumber).padStart(2, "0")}
                  </span>
                )}
                <span
                  className={cn(
                    "text-[12.5px] font-semibold transition-colors",
                    active
                      ? "text-[var(--color-ink)]"
                      : done
                        ? "text-[var(--color-muted)]"
                        : "text-[var(--color-muted-soft)]",
                  )}
                >
                  {label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
