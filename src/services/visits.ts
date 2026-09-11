import { supabase } from "../lib/supabaseClient";
import type { Visit, VisitStatus, VisitSource } from "../data/mockData";
import { initials, labelToTime24, time24ToLabel } from "../lib/utils";

/** P4.2 data-access layer for `visits` — real Supabase rows (joined to
 * `patients` for the mock's denormalized display fields) mapped to the
 * exact `Visit` shape ClinicDataProvider already exposes. */

const SELECT_COLUMNS =
  "id, patient_id, visit_date, start_time, duration_minutes, reason, status, source, patients(first_name, last_name, phone, age)";

// Every enum value in this schema differs from its mock counterpart only by
// hyphen-vs-underscore ("checked-in" <-> "checked_in"), so one pair of
// generic converters covers status/source/outcome/tooth-status everywhere
// they're needed across the service layer.
export const hyphenate = (s: string) => s.replace(/_/g, "-");
export const underscore = (s: string) => s.replace(/-/g, "_");

interface JoinedPatient {
  first_name: string;
  last_name: string | null;
  phone: string;
  age: number | null;
}

interface VisitRow {
  id: string;
  patient_id: string;
  visit_date: string;
  start_time: string;
  duration_minutes: number;
  reason: string;
  status: string;
  source: string;
  patients: JoinedPatient | JoinedPatient[] | null;
}

function joinedPatient(row: VisitRow): JoinedPatient | null {
  if (!row.patients) return null;
  return Array.isArray(row.patients) ? (row.patients[0] ?? null) : row.patients;
}

function fromRow(row: VisitRow): Visit {
  const p = joinedPatient(row);
  const name = p ? (p.last_name ? `${p.first_name} ${p.last_name}` : p.first_name) : "";
  return {
    id: row.id,
    time: time24ToLabel(row.start_time),
    durationMinutes: row.duration_minutes,
    patientName: name,
    patientInitials: initials(name) || "?",
    patientMeta: p?.age ? `Age ${p.age}` : "",
    patientPhone: p?.phone,
    reason: row.reason,
    status: hyphenate(row.status) as VisitStatus,
    date: row.visit_date,
    patientId: row.patient_id,
    source: hyphenate(row.source) as VisitSource,
  };
}

export async function listVisits(clinicId: string): Promise<Visit[]> {
  const { data, error } = await supabase
    .from("visits")
    .select(SELECT_COLUMNS)
    .eq("clinic_id", clinicId)
    .order("visit_date", { ascending: false })
    .order("start_time", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

export interface CreateVisitInput {
  patientId: string;
  time: string;
  durationMinutes?: number;
  reason: string;
  status: VisitStatus;
  date: string;
  source: VisitSource;
}

export async function createVisit(clinicId: string, input: CreateVisitInput): Promise<Visit> {
  const { data, error } = await supabase
    .from("visits")
    .insert({
      clinic_id: clinicId,
      patient_id: input.patientId,
      visit_date: input.date,
      start_time: labelToTime24(input.time),
      duration_minutes: input.durationMinutes ?? 30,
      reason: input.reason,
      status: underscore(input.status),
      source: underscore(input.source),
    })
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateVisitStatus(visitId: string, status: VisitStatus): Promise<Visit> {
  const { data, error } = await supabase
    .from("visits")
    .update({ status: underscore(status) })
    .eq("id", visitId)
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return fromRow(data);
}

// The `visits` table has no DELETE policy by design — a cancelled visit
// stays in the database (see 20260829190300_patients_visits.sql). This
// replaces the old mock's array-filter with a soft-cancel update.
export async function cancelVisitRecord(visitId: string): Promise<Visit> {
  return updateVisitStatus(visitId, "cancelled");
}
