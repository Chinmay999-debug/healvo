/** Frontend-only bridge between the onboarding wizard and ClinicDataProvider's
 * mock-backed clinicSettings (see state/clinicData.tsx's file header — bills/
 * staff/documents/settings/doctor profile aren't Supabase-backed yet).
 *
 * The wizard runs *before* ClinicDataProvider mounts — RequireAuthAndClinic
 * renders it in place of the app, and ClinicDataProvider only wraps the app
 * — so it has no useClinicData() to write into directly. It stashes the
 * address/phone/city it collected here instead, keyed per user id so it
 * never leaks across accounts sharing a browser; ClinicDataProvider's
 * clinicSettings initializer reads and clears it the one time it needs to
 * (right when the real app first mounts for that account). */

interface ClinicDetailsDraft {
  clinicId: string;
  phone: string;
  address: string;
  city: string;
}

function storageKey(userId: string) {
  return `healvo-onboarding-clinic-draft-${userId}`;
}

export function saveClinicDetailsDraft(userId: string, draft: ClinicDetailsDraft) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(draft));
  } catch {
    // Best-effort only — worst case Settings just starts blank, same as
    // before onboarding collected these fields at all.
  }
}

export function consumeClinicDetailsDraft(userId: string, expectedClinicId: string): ClinicDetailsDraft | null {
  try {
    const key = storageKey(userId);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    localStorage.removeItem(key);
    const parsed = JSON.parse(raw) as ClinicDetailsDraft;
    if (parsed.clinicId !== expectedClinicId) return null;
    return parsed;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------
 * In-progress wizard draft
 *
 * The hand-off above runs once, after the clinic exists. This second draft
 * is the opposite: it holds what the user has typed but not yet submitted,
 * so a refresh (or an accidental close) on step 1 or 2 doesn't cost them the
 * form. Same mechanism, same per-user keying, same best-effort try/catch —
 * deliberately not a new persistence layer.
 *
 * Cleared the moment the clinic is created, because from then on the real
 * `profiles`/`clinics` rows are the source of truth.
 * ---------------------------------------------------------------------- */

/** Everything the wizard collects, minus anything too big to keep in
 * localStorage — the clinic logo is a base64 data URL that could be several
 * megabytes and blow the quota, so it is deliberately not persisted. */
export interface WizardDraft {
  step: number;
  aboutYou: { fullName: string; mobile: string; title: string };
  clinic: { clinicName: string; phone: string; address: string; city: string };
}

function wizardKey(userId: string) {
  return `healvo-onboarding-wizard-${userId}`;
}

export function saveWizardDraft(userId: string, draft: WizardDraft) {
  try {
    localStorage.setItem(wizardKey(userId), JSON.stringify(draft));
  } catch {
    // Quota or private mode: the wizard still works, it just won't survive a
    // refresh — which is exactly the behavior before this existed.
  }
}

/** Reads a saved draft, or null when there isn't a usable one. */
export function readWizardDraft(userId: string): WizardDraft | null {
  try {
    const raw = localStorage.getItem(wizardKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WizardDraft>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      // Only steps 1 and 2 are resumable: step 3 onwards means the clinic
      // already exists, and RequireAuthAndClinic won't render the wizard then.
      step: parsed.step === 2 ? 2 : 1,
      aboutYou: {
        fullName: parsed.aboutYou?.fullName ?? "",
        mobile: parsed.aboutYou?.mobile ?? "",
        title: parsed.aboutYou?.title ?? "",
      },
      clinic: {
        clinicName: parsed.clinic?.clinicName ?? "",
        phone: parsed.clinic?.phone ?? "",
        address: parsed.clinic?.address ?? "",
        city: parsed.clinic?.city ?? "",
      },
    };
  } catch {
    return null;
  }
}

export function clearWizardDraft(userId: string) {
  try {
    localStorage.removeItem(wizardKey(userId));
  } catch {
    // Nothing to do — a stale draft is only ever read while the user still
    // has no clinic, and it is overwritten on the next keystroke anyway.
  }
}

/**
 * The name to prefill "Full name" with, given whatever is already on the
 * profile.
 *
 * handle_new_user() seeds profiles.full_name with the signup email whenever
 * the account arrives without a name — which is every email/password signup,
 * since signUpWithPassword sends no options.data.full_name (see
 * 20260912110000_fix_create_clinic_with_owner_profile_name.sql). Prefilling
 * from it unchanged would put the user's own email address in a box labelled
 * "Full name", so that case is treated as blank. A Google account does carry
 * a real name, and it is used as-is.
 */
export function profileNameForPrefill(
  fullName: string | null | undefined,
  email: string | null | undefined,
): string {
  const name = (fullName ?? "").trim();
  if (!name) return "";
  if (name.includes("@")) return "";
  if (name.toLowerCase() === (email ?? "").trim().toLowerCase()) return "";
  return name;
}
