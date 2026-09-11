import { supabase } from "../lib/supabaseClient";
import { labelToTime24, time24ToLabel } from "../lib/utils";
import { normalizePhone } from "../lib/phone";

/** P4.7 data-access layer for the public (anonymous) booking page. Every
 * call here goes through one of the `public_booking_*` SECURITY DEFINER
 * RPCs (healvo-backend/supabase/migrations/20260911100000_public_booking.sql)
 * — this file never touches `clinics`/`patients`/`visits` directly, since
 * anon has no grants on any of them. Keyed entirely by clinic *slug*, never
 * an internal clinic id, matching this phase's "don't expose internal
 * identifiers unnecessarily" instruction. */

export interface PublicClinicInfo {
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  doctorName: string | null;
  onlineBookingEnabled: boolean;
}

interface PublicInfoRow {
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  doctor_name: string | null;
  online_booking_enabled: boolean;
}

/** Returns null when the slug doesn't match any clinic — the page shows a
 * clean "clinic not found" state rather than an error. */
export async function getPublicBookingInfo(slug: string): Promise<PublicClinicInfo | null> {
  const { data, error } = await supabase.rpc("public_booking_get_info", { p_slug: slug });
  if (error) throw error;
  const row = (data as PublicInfoRow[] | null)?.[0];
  if (!row) return null;
  return {
    name: row.name,
    address: row.address,
    city: row.city,
    phone: row.phone,
    doctorName: row.doctor_name,
    onlineBookingEnabled: row.online_booking_enabled,
  };
}

/** ISO dates (YYYY-MM-DD), earliest first, that have at least one real
 * bookable slot — mirrors the shape of the existing authenticated
 * getAvailableDates(count) in state/clinicData.tsx, just server-computed. */
export async function getPublicAvailableDates(slug: string, limit = 6): Promise<string[]> {
  const { data, error } = await supabase.rpc("public_booking_get_dates", {
    p_slug: slug,
    p_limit: limit,
  });
  if (error) throw error;
  return ((data as { visit_date: string }[] | null) ?? []).map((r) => r.visit_date);
}

export interface PublicSlot {
  time: string;
  available: boolean;
}

export async function getPublicAvailability(slug: string, dateIso: string): Promise<PublicSlot[]> {
  const { data, error } = await supabase.rpc("public_booking_get_slots", {
    p_slug: slug,
    p_date: dateIso,
  });
  if (error) throw error;
  return ((data as { start_time: string; available: boolean }[] | null) ?? []).map((r) => ({
    time: time24ToLabel(r.start_time),
    available: r.available,
  }));
}

export interface SubmitPublicBookingInput {
  slug: string;
  date: string;
  time: string;
  reason: string;
  name: string;
  phone: string;
  email?: string;
}

export interface PublicBookingConfirmation {
  date: string;
  time: string;
}

/** The one anonymous write path in the app. Errors thrown here carry the
 * server's own validation message (invalid slot, clinic not found, online
 * booking disabled, etc.) — see public_booking_submit()'s `raise
 * exception` messages, which are safe to show directly to the visitor. */
export async function submitPublicBooking(
  input: SubmitPublicBookingInput,
): Promise<PublicBookingConfirmation> {
  const { data, error } = await supabase
    .rpc("public_booking_submit", {
      p_slug: input.slug,
      p_date: input.date,
      p_start_time: labelToTime24(input.time),
      p_reason: input.reason,
      p_name: input.name,
      p_phone: normalizePhone(input.phone),
      p_email: input.email || null,
    })
    .single();
  if (error) throw error;
  const row = data as { visit_date: string; start_time: string };
  return { date: row.visit_date, time: time24ToLabel(row.start_time) };
}
