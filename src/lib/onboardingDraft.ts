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

export function consumeClinicDetailsDraft(userId: string): ClinicDetailsDraft | null {
  try {
    const key = storageKey(userId);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    localStorage.removeItem(key);
    return JSON.parse(raw) as ClinicDetailsDraft;
  } catch {
    return null;
  }
}
