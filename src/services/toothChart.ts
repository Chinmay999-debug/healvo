import { supabase } from "../lib/supabaseClient";
import type { ToothRecord, ToothStatus } from "../data/mockData";
import { hyphenate, underscore } from "./visits";

/** P4.2 data-access layer for the dental chart. `dental_chart_entries` is
 * append-only in the real schema (audit §9) — every "change a tooth" action
 * is an INSERT, never an UPDATE. Reads go through the `current_tooth_status`
 * view (latest row per patient+tooth), which is exactly the flat,
 * one-row-per-tooth shape the mock's `toothRecords` array already was, so
 * ClinicDataProvider's public shape doesn't change at all. */

interface ToothStatusRow {
  patient_id: string;
  tooth: string;
  status: string;
  note: string | null;
}

function fromRow(row: ToothStatusRow): ToothRecord {
  return {
    patientId: row.patient_id,
    tooth: row.tooth,
    status: hyphenate(row.status) as ToothStatus,
    note: row.note ?? undefined,
  };
}

export async function listToothStatus(clinicId: string): Promise<ToothRecord[]> {
  const { data, error } = await supabase
    .from("current_tooth_status")
    .select("patient_id, tooth, status, note")
    .eq("clinic_id", clinicId);
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

export interface ToothStatusPatch {
  status?: ToothStatus;
  note?: string;
}

// Appends a new history row. Callers pass the FULL desired state (existing
// status/note merged with the patch) since a partial patch would otherwise
// silently drop whichever field wasn't included, unlike the old mock's
// in-place upsert.
export async function recordToothStatus(
  clinicId: string,
  patientId: string,
  tooth: string,
  next: { status: ToothStatus; note?: string },
): Promise<ToothRecord> {
  const { data, error } = await supabase
    .from("dental_chart_entries")
    .insert({
      clinic_id: clinicId,
      patient_id: patientId,
      tooth,
      status: underscore(next.status),
      note: next.note ?? null,
    })
    .select("patient_id, tooth, status, note")
    .single();
  if (error) throw error;
  return fromRow(data);
}
