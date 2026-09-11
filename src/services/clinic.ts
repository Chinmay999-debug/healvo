import { supabase } from "../lib/supabaseClient";
import { getCurrentUser } from "./auth";
import type { ClinicSettings, Weekday } from "../data/mockData";
import { labelToTime24, time24ToLabel } from "../lib/utils";
import { normalizePhone } from "../lib/phone";

/** Data-access layer for the identity/tenant foundation (P4.2), extended in
 * P4.6 with clinic settings (`clinics`) and profile (`profiles`) writes —
 * both now consumed by ClinicDataProvider. patients/visits/bills/etc. have
 * their own dedicated service files; this one stays the "who is signed in,
 * which clinic do they belong to, what does their clinic/profile look like"
 * layer. */

// Locked P4.2 role mapping: Doctor -> dentist, Reception -> staff, clinic
// creator -> owner. `admin` exists in the database (clinic_role enum) but is
// reserved for future use and is never produced or consumed by frontend code
// in this phase.
export type ClinicRole = "owner" | "admin" | "dentist" | "staff";
export type MembershipStatus = "active" | "inactive";

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  title: string | null;
  avatar_path: string | null;
}

export interface ClinicSummary {
  id: string;
  name: string;
  slug: string;
  /** True only for the single permanent demo clinic (demo@healvo.in). Purely
   * UI-routing metadata — carries no RLS/isolation meaning; every table's
   * is_clinic_member(clinic_id) policies are what actually gate access. See
   * healvo-backend/supabase/migrations/20260907141045_demo_account_seed.sql. */
  is_demo: boolean;
  /** Platform tenant lifecycle status: 'active' or 'suspended'. */
  status?: "active" | "suspended";
}

export interface ClinicMembership {
  id: string;
  role: ClinicRole;
  status: MembershipStatus;
  clinic: ClinicSummary;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, phone, title, avatar_path")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Every clinic the signed-in user belongs to, active or not — callers that
 * only want usable memberships should filter status === "active"
 * themselves (kept unfiltered here so a future "reactivate/switch clinic"
 * UI has the full list to work with). */
export async function getUserClinics(): Promise<ClinicMembership[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("clinic_memberships")
    .select("id, role, status, clinic:clinics(id, name, slug, is_demo, status)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ClinicMembership[];
}

/** The clinic the rest of the app should operate against right now.
 * Today a user has exactly one clinic, so "earliest active membership" is
 * unambiguous. Kept as a single function (rather than inlined at call
 * sites) specifically so a later phase can drop in real multi-clinic
 * selection (e.g. a remembered/selected clinic id) without touching
 * anything downstream of this call. */
export async function getActiveClinic(): Promise<ClinicSummary | null> {
  const memberships = await getUserClinics();
  const active = memberships.find((m) => m.status === "active");
  return active?.clinic ?? null;
}

export interface CreateClinicInput {
  name: string;
  slug: string;
  fullName?: string;
  phone?: string;
  title?: string;
}

/** Wraps the create_clinic_with_owner RPC — the only sanctioned way to
 * create a clinic (see healvo-backend/supabase/migrations/
 * 20260829194000_clinic_bootstrap_rpc.sql). Atomic on the database side:
 * either the clinic + owner membership both exist afterward, or neither
 * does. */
export async function createClinicWithOwner(input: CreateClinicInput): Promise<ClinicSummary> {
  const { data, error } = await supabase
    .rpc("create_clinic_with_owner", {
      p_name: input.name,
      p_slug: input.slug,
      p_full_name: input.fullName ?? null,
      p_phone: input.phone ?? null,
      p_title: input.title ?? null,
    })
    .single();
  if (error) throw error;
  return data as ClinicSummary;
}

// Profile updates -------------------------------------------------------------

export interface ProfilePatchInput {
  name?: string;
  phone?: string;
  title?: string;
}

/** Writes to `profiles` only (full_name/phone/title) — there is no
 * `profiles.email` column by design (email lives solely in auth.users, see
 * 20260829190200_clinics_profiles_memberships.sql's table comment), so a
 * profile "email" field is never accepted here. Changing the real sign-in
 * email is a separate, security-sensitive Supabase Auth flow (re-
 * confirmation, etc.) explicitly out of this phase's scope. RLS allows only
 * `id = auth.uid()` — a user can only ever update their own row. */
export async function updateProfile(patch: ProfilePatchInput): Promise<Profile> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in.");

  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.full_name = patch.name.trim();
  if (patch.phone !== undefined) update.phone = normalizePhone(patch.phone) || null;
  if (patch.title !== undefined) update.title = patch.title.trim() || null;

  const { data, error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id)
    .select("id, full_name, phone, title, avatar_path")
    .single();
  if (error) throw error;
  return data;
}

// Profile photo -----------------------------------------------------------------
// Private "avatars" bucket, path {user_id}/{uuid}.jpg (see
// 20260912120000_profile_avatar_clinic_logo.sql). Immutable objects, same
// as patient-documents: a replace uploads a new path rather than
// overwriting the old one, then the profiles row is repointed to it — that
// row update is the atomic "this is now live" moment, since every renderer
// reads avatar_path from `profiles`/authContext, never Storage directly.

const AVATAR_BUCKET = "avatars";

async function removeAvatarObject(path: string): Promise<void> {
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path]);
  if (error) console.error("Avatar cleanup failed for", path, error);
}

/** Uploads `blob` (already cropped client-side) as the signed-in user's new
 * profile photo, points `profiles.avatar_path` at it, and best-effort
 * deletes whatever photo it replaced. */
export async function uploadAvatarPhoto(blob: Blob): Promise<Profile> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in.");

  const previous = await getCurrentProfile();
  const path = `${user.id}/${crypto.randomUUID()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (uploadError) throw uploadError;

  const { data, error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_path: path })
    .eq("id", user.id)
    .select("id, full_name, phone, title, avatar_path")
    .single();

  if (updateError) {
    await removeAvatarObject(path);
    throw updateError;
  }

  if (previous?.avatar_path) await removeAvatarObject(previous.avatar_path);
  return data;
}

/** Clears the signed-in user's photo — avatar_path goes null first (every
 * renderer falls back to initials immediately), then the old object is
 * best-effort deleted. */
export async function removeAvatarPhoto(): Promise<Profile> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in.");

  const previous = await getCurrentProfile();

  const { data, error } = await supabase
    .from("profiles")
    .update({ avatar_path: null })
    .eq("id", user.id)
    .select("id, full_name, phone, title, avatar_path")
    .single();
  if (error) throw error;

  if (previous?.avatar_path) await removeAvatarObject(previous.avatar_path);
  return data;
}

// Clinic settings ---------------------------------------------------------------
// `clinics` already carries every field ClinicSettings needs (P4.1 schema) —
// this is a plain authenticated read/write, gated by the existing RLS
// ("clinic members can view their clinic" for reads, "clinic owners can
// update their clinic" for writes — see 20260829190200). No RPC needed: a
// non-owner's write is simply rejected by RLS, which the caller surfaces as
// an error same as any other Supabase call.

const WEEKDAY_DB_KEYS: Weekday[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function workingDaysFromDb(value: unknown): ClinicSettings["workingDays"] {
  const record = (value ?? {}) as Record<string, boolean>;
  const result = {} as ClinicSettings["workingDays"];
  for (const day of WEEKDAY_DB_KEYS) {
    result[day] = record[day.toLowerCase()] ?? false;
  }
  return result;
}

function workingDaysToDb(value: ClinicSettings["workingDays"]): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const day of WEEKDAY_DB_KEYS) {
    result[day.toLowerCase()] = value[day];
  }
  return result;
}

interface BreakRow {
  start_time: string;
  end_time: string;
}

function breaksFromDb(value: unknown): ClinicSettings["breaks"] {
  const rows = (value ?? []) as BreakRow[];
  return rows.map((b) => ({
    startTime: time24ToLabel(b.start_time),
    endTime: time24ToLabel(b.end_time),
  }));
}

function breaksToDb(value: ClinicSettings["breaks"]): BreakRow[] {
  return value.map((b) => ({
    start_time: labelToTime24(b.startTime),
    end_time: labelToTime24(b.endTime),
  }));
}

const CLINIC_SELECT_COLUMNS =
  "id, name, phone, email, address, city, working_days, opening_time, closing_time, appointment_duration_minutes, online_booking_enabled, breaks, logo_path";

interface ClinicRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  working_days: unknown;
  opening_time: string;
  closing_time: string;
  appointment_duration_minutes: number;
  online_booking_enabled: boolean;
  breaks: unknown;
  logo_path: string | null;
}

function clinicRowToSettings(row: ClinicRow): ClinicSettings {
  return {
    clinicName: row.name,
    phone: row.phone ?? "",
    email: row.email ?? "",
    address: row.address ?? "",
    city: row.city ?? "",
    workingDays: workingDaysFromDb(row.working_days),
    openingTime: time24ToLabel(row.opening_time),
    closingTime: time24ToLabel(row.closing_time),
    appointmentDuration: row.appointment_duration_minutes,
    onlineBookingEnabled: row.online_booking_enabled,
    breaks: breaksFromDb(row.breaks),
    logoPath: row.logo_path,
  };
}

export async function getClinicSettings(clinicId: string): Promise<ClinicSettings> {
  const { data, error } = await supabase
    .from("clinics")
    .select(CLINIC_SELECT_COLUMNS)
    .eq("id", clinicId)
    .single();
  if (error) throw error;
  return clinicRowToSettings(data);
}

export async function updateClinicSettings(
  clinicId: string,
  patch: Partial<ClinicSettings>,
): Promise<ClinicSettings> {
  const update: Record<string, unknown> = {};
  if (patch.clinicName !== undefined) update.name = patch.clinicName.trim();
  if (patch.phone !== undefined) update.phone = patch.phone.trim() || null;
  if (patch.email !== undefined) update.email = patch.email.trim() || null;
  if (patch.address !== undefined) update.address = patch.address.trim() || null;
  if (patch.city !== undefined) update.city = patch.city.trim() || null;
  if (patch.workingDays !== undefined) update.working_days = workingDaysToDb(patch.workingDays);
  if (patch.openingTime !== undefined) update.opening_time = labelToTime24(patch.openingTime);
  if (patch.closingTime !== undefined) update.closing_time = labelToTime24(patch.closingTime);
  if (patch.appointmentDuration !== undefined)
    update.appointment_duration_minutes = patch.appointmentDuration;
  if (patch.onlineBookingEnabled !== undefined)
    update.online_booking_enabled = patch.onlineBookingEnabled;
  if (patch.breaks !== undefined) update.breaks = breaksToDb(patch.breaks);

  const { data, error } = await supabase
    .from("clinics")
    .update(update)
    .eq("id", clinicId)
    .select(CLINIC_SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return clinicRowToSettings(data);
}

// Clinic logo ---------------------------------------------------------------
// Private "clinic-logos" bucket, path {clinic_id}/{uuid}.jpg — same
// immutable-object/repoint-then-cleanup shape as the avatar functions above.
// RLS restricts writes to the clinic owner (is_clinic_owner), matching the
// existing "clinic owners can update their clinic" policy this logo is
// conceptually part of.

const CLINIC_LOGO_BUCKET = "clinic-logos";

async function removeClinicLogoObject(path: string): Promise<void> {
  const { error } = await supabase.storage.from(CLINIC_LOGO_BUCKET).remove([path]);
  if (error) console.error("Clinic logo cleanup failed for", path, error);
}

export async function uploadClinicLogo(clinicId: string, blob: Blob): Promise<ClinicSettings> {
  const previous = await getClinicSettings(clinicId);
  const path = `${clinicId}/${crypto.randomUUID()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(CLINIC_LOGO_BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (uploadError) throw uploadError;

  const { data, error: updateError } = await supabase
    .from("clinics")
    .update({ logo_path: path })
    .eq("id", clinicId)
    .select(CLINIC_SELECT_COLUMNS)
    .single();

  if (updateError) {
    await removeClinicLogoObject(path);
    throw updateError;
  }

  if (previous.logoPath) await removeClinicLogoObject(previous.logoPath);
  return clinicRowToSettings(data);
}

export async function removeClinicLogo(clinicId: string): Promise<ClinicSettings> {
  const previous = await getClinicSettings(clinicId);

  const { data, error } = await supabase
    .from("clinics")
    .update({ logo_path: null })
    .eq("id", clinicId)
    .select(CLINIC_SELECT_COLUMNS)
    .single();
  if (error) throw error;

  if (previous.logoPath) await removeClinicLogoObject(previous.logoPath);
  return clinicRowToSettings(data);
}
