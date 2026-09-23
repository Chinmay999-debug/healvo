import { supabase } from "../../lib/supabaseClient";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { Logo } from "../ui/Logo";
import { useAuth } from "../../state/authContext";
import { useTheme } from "../../state/themeContext";
import { createClinicWithOwner } from "../../services/clinic";
import { getClinicSubscription } from "../../services/subscription";
import { trackStartTrial } from "../../lib/metaPixel";
import {
  clearWizardDraft,
  profileNameForPrefill,
  readWizardDraft,
  saveClinicDetailsDraft,
  saveWizardDraft,
} from "../../lib/onboardingDraft";
import { normalizePhone } from "../../lib/phone";
import { cn, getErrorMessage } from "../../lib/utils";
import { getAttribution } from "../../lib/attribution";
import { StepAboutYou } from "./StepAboutYou";
import { StepClinic } from "./StepClinic";
import { StepFeatureIntro } from "./StepFeatureIntro";
import { StepCompletion } from "./StepCompletion";

export interface AboutYouDraft {
  fullName: string;
  /** The 10-digit local number the PhoneInput works in. Turned into the
   * stored "+91XXXXXXXXXX" form once, at save time — see handleCreateClinic. */
  mobile: string;
  title: string;
}

export interface ClinicDraft {
  clinicName: string;
  /** The clinic's own number. Separate from the owner's mobile above: they
   * are different things and are stored in different rows. */
  phone: string;
  address: string;
  city: string;
  logoDataUrl: string | null;
}

/** One object for the whole wizard, so no field is ever held in two places
 * and later steps can read what earlier ones collected. */
export interface OnboardingDraft {
  aboutYou: AboutYouDraft;
  clinic: ClinicDraft;
}

export const DEFAULT_TITLE = "Owner · Dentist";

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

  // One initializer for both the resumed draft and the step it was on, so a
  // refresh puts the user back exactly where they were rather than on step 1
  // with step 2's answers.
  const [{ draft: initialDraft, step: initialStep }] = useState(() => {
    const saved = user ? readWizardDraft(user.id) : null;
    return {
      step: saved?.step ?? 1,
      draft: {
        aboutYou: {
          // A saved draft wins, then the name typed into Create account, then
          // whatever is already on the profile (Google supplies a real one).
          fullName:
            saved?.aboutYou.fullName ||
            initialName ||
            profileNameForPrefill(profile?.full_name, user?.email) ||
            "",
          mobile: saved?.aboutYou.mobile ?? "",
          title: saved?.aboutYou.title || profile?.title || DEFAULT_TITLE,
        },
        clinic: {
          clinicName: saved?.clinic.clinicName ?? "",
          phone: saved?.clinic.phone ?? "",
          address: saved?.clinic.address ?? "",
          city: saved?.clinic.city ?? "",
          logoDataUrl: null,
        },
      } satisfies OnboardingDraft,
    };
  });

  const [step, setStep] = useState(initialStep);
  const [draft, setDraft] = useState<OnboardingDraft>(initialDraft);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const { aboutYou, clinic } = draft;
  const setAboutYou = (next: AboutYouDraft) => setDraft((d) => ({ ...d, aboutYou: next }));
  const setClinic = (next: ClinicDraft) => setDraft((d) => ({ ...d, clinic: next }));

  // Mirror the draft to localStorage while it can still be lost. Stops at
  // step 3: the clinic exists by then and the real rows are the truth.
  useEffect(() => {
    if (!user || step >= 3) return;
    saveWizardDraft(user.id, {
      step,
      aboutYou,
      clinic: {
        clinicName: clinic.clinicName,
        phone: clinic.phone,
        address: clinic.address,
        city: clinic.city,
      },
    });
  }, [user, step, aboutYou, clinic]);

  // Once the clinic exists (end of step 2), re-running create_clinic_with_owner
  // would create a second one — so nothing before it is worth losing either.
  // Warn on refresh/close for as long as that risk exists.
  useEffect(() => {
    if (step >= 3) return;
    const hasEnteredSomething =
      aboutYou.fullName.trim() || clinic.clinicName.trim() || clinic.phone.trim();
    if (!hasEnteredSomething) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [step, aboutYou.fullName, clinic.clinicName, clinic.phone]);

  async function handleCreateClinic() {
    setCreating(true);
    setCreateError(null);
    try {
      const newClinic = await createClinicWithOwner({
        name: clinic.clinicName.trim(),
        slug: slugify(clinic.clinicName),
        fullName: aboutYou.fullName.trim(),
        // The OWNER's own mobile from "About you". This used to be handed
        // the clinic's phone from step 2, which meant profiles.phone and
        // clinics.phone were always the same number and the person's real
        // mobile was never collected at all.
        phone: normalizePhone(aboutYou.mobile),
        title: aboutYou.title.trim() || DEFAULT_TITLE,
        attribution: getAttribution(),
      });
      // clinicSettings (address/city/phone) stays local/mock-backed this
      // phase — see state/clinicData.tsx's file header. ClinicDataProvider
      // isn't mounted yet at this point (it only wraps the real app, not
      // the wizard), so this hands the details off via onboardingDraft.ts
      // instead of a direct updateClinicSettings() call.
      if (user) {
        saveClinicDetailsDraft(user.id, {
          clinicId: newClinic.id,
          // Normalized here for the same reason updateProfile does it: every
          // other write path stores "+91XXXXXXXXXX", and onboarding was the
          // one place putting bare local digits into the column.
          phone: normalizePhone(clinic.phone),
          address: clinic.address.trim(),
          city: clinic.city.trim(),
        });
        // The clinic exists now, so a resumable draft would only be stale.
        clearWizardDraft(user.id);
      }
      await refresh();

      // The ad campaign's conversion. Reported here rather than from the
      // "Start free trial" button because that button only opens a form —
      // nothing has happened yet when it is clicked. Even the clinic existing
      // is not quite enough, so this asks the server what the subscription
      // actually is and reports only a genuinely running trial. A clinic
      // created without one (a seat added to an existing account, a plan the
      // server declined to trial) correctly reports nothing.
      void (async () => {
        try {
          const subscription = await getClinicSubscription(newClinic.id);
          const trialLive =
            subscription?.status === "trialing" &&
            Boolean(subscription.trial_ends_at) &&
            new Date(subscription.trial_ends_at!).getTime() > Date.now();
          if (subscription && trialLive) {
            trackStartTrial({
              subscriptionId: subscription.subscription_id,
              planCode: subscription.plan_code,
              trialDays: subscription.trial_days,
            });
          }
        } catch (err) {
          // Never let ad measurement stand between someone and their clinic.
          console.error("Could not report trial start:", err);
        }
      })();

      // Trigger the welcome email securely via Edge Function
      supabase.functions.invoke("welcome-email", {
        body: { clinicId: newClinic.id }
      }).catch(err => {
        // Log but do not block the user if the welcome email fails
        console.error("Failed to send welcome email:", err);
      });
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
              email={user?.email ?? ""}
              onChange={setAboutYou}
              onContinue={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <StepClinic
              draft={clinic}
              onChange={setClinic}
              onBack={() => setStep(1)}
              onContinue={() => void handleCreateClinic()}
              submitting={creating}
              error={createError}
            />
          )}
          {step === 3 && <StepFeatureIntro onContinue={() => setStep(4)} />}
          {step === 4 && <StepCompletion clinicName={clinic.clinicName} onFinish={onFinish} />}
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
