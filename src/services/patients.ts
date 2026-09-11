import { supabase } from "../lib/supabaseClient";
import type { Patient } from "../data/mockData";
import { normalizePhone } from "../lib/phone";
import { initials } from "../lib/utils";

/** P4.2 data-access layer for `patients` — real Supabase rows mapped to the
 * exact `Patient` shape ClinicDataProvider/components already consume, so
 * nothing downstream of useClinicData() needs to change. */

const SELECT_COLUMNS =
  "id, first_name, last_name, phone, email, age, gender, patient_type, created_at";

type DbGender = "male" | "female" | "other";

interface PatientRow {
  id: string;
  first_name: string;
  last_name: string | null;
  phone: string;
  email: string | null;
  age: number | null;
  gender: DbGender | null;
  patient_type: "new" | "returning";
  created_at: string;
}

function genderFromDb(g: DbGender | null): Patient["gender"] {
  if (!g) return undefined;
  return (g.charAt(0).toUpperCase() + g.slice(1)) as Patient["gender"];
}

function genderToDb(g: string | undefined): DbGender | null {
  if (!g) return null;
  const lower = g.toLowerCase();
  return lower === "male" || lower === "female" || lower === "other" ? lower : null;
}

function splitName(name: string): { first_name: string; last_name: string | null } {
  const trimmed = name.trim();
  const spaceIdx = trimmed.indexOf(" ");
  if (spaceIdx === -1) return { first_name: trimmed, last_name: null };
  return { first_name: trimmed.slice(0, spaceIdx), last_name: trimmed.slice(spaceIdx + 1) || null };
}

function fromRow(row: PatientRow): Patient {
  const name = row.last_name ? `${row.first_name} ${row.last_name}` : row.first_name;
  return {
    id: row.id,
    name,
    initials: initials(name) || "?",
    phone: row.phone,
    email: row.email ?? undefined,
    age: row.age ?? undefined,
    gender: genderFromDb(row.gender),
    type: row.patient_type,
    createdAt: row.created_at,
  };
}

export interface PatientDraftInput {
  name: string;
  phone: string;
  email?: string;
  age?: string;
  gender?: string;
}

export interface PatientPatchInput {
  name?: string;
  phone?: string;
  email?: string;
  age?: string;
  gender?: string;
}

export async function listPatients(clinicId: string): Promise<Patient[]> {
  const { data, error } = await supabase
    .from("patients")
    .select(SELECT_COLUMNS)
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

// Phone numbers are normalized here — the single point where a patient
// record is created — matching addPatient's prior mock behavior exactly.
export async function createPatient(clinicId: string, draft: PatientDraftInput): Promise<Patient> {
  const { first_name, last_name } = splitName(draft.name);
  const { data, error } = await supabase
    .from("patients")
    .insert({
      clinic_id: clinicId,
      first_name,
      last_name,
      phone: normalizePhone(draft.phone),
      email: draft.email?.trim() || null,
      age: draft.age ? Number(draft.age) : null,
      gender: genderToDb(draft.gender),
      patient_type: "new",
    })
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function updatePatientRecord(patientId: string, patch: PatientPatchInput): Promise<Patient> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const { first_name, last_name } = splitName(patch.name);
    update.first_name = first_name;
    update.last_name = last_name;
  }
  if (patch.phone !== undefined) update.phone = normalizePhone(patch.phone);
  if (patch.email !== undefined) update.email = patch.email.trim() || null;
  if (patch.age !== undefined) update.age = patch.age ? Number(patch.age) : null;
  if (patch.gender !== undefined) update.gender = genderToDb(patch.gender);

  const { data, error } = await supabase
    .from("patients")
    .update(update)
    .eq("id", patientId)
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return fromRow(data);
}

/** Finds a patient by exact normalized phone within a clinic — matches
 * bookAppointment's find-or-create-by-phone behavior (P4.3). */
export async function findPatientByPhone(clinicId: string, phone: string): Promise<Patient | null> {
  const { data, error } = await supabase
    .from("patients")
    .select(SELECT_COLUMNS)
    .eq("clinic_id", clinicId)
    .eq("phone", normalizePhone(phone))
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data) : null;
}
