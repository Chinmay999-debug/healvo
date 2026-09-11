import { supabase } from "../lib/supabaseClient";
import type { Consultation, ConsultationStatus, VisitOutcome } from "../data/mockData";
import { hyphenate, underscore } from "./visits";

/** P4.2 data-access layer for `consultations` — field names differ from the
 * mock only by snake_case vs camelCase (plus the usual hyphen/underscore
 * enum spelling for visit_outcome), so this is close to a 1:1 mapping. */

const SELECT_COLUMNS =
  "id, patient_id, visit_id, consultation_date, visit_reason, patient_words, clinical_notes, teeth_selected, prescription, follow_up_required, follow_up_when, follow_up_recommendation, visit_outcome, status";

interface ConsultationRow {
  id: string;
  patient_id: string;
  visit_id: string | null;
  consultation_date: string;
  visit_reason: string | null;
  patient_words: string | null;
  clinical_notes: string | null;
  teeth_selected: string[];
  prescription: string | null;
  follow_up_required: boolean;
  follow_up_when: string | null;
  follow_up_recommendation: string | null;
  visit_outcome: string | null;
  status: ConsultationStatus;
}

function fromRow(row: ConsultationRow): Consultation {
  return {
    id: row.id,
    patientId: row.patient_id,
    visitId: row.visit_id ?? undefined,
    date: row.consultation_date,
    visitReason: row.visit_reason ?? undefined,
    patientWords: row.patient_words ?? undefined,
    clinicalNotes: row.clinical_notes ?? undefined,
    teethSelected: row.teeth_selected ?? [],
    prescription: row.prescription ?? undefined,
    followUpRequired: row.follow_up_required,
    followUpWhen: row.follow_up_when ?? undefined,
    followUpRecommendation: row.follow_up_recommendation ?? undefined,
    visitOutcome: row.visit_outcome ? (hyphenate(row.visit_outcome) as VisitOutcome) : undefined,
    status: row.status,
  };
}

export async function listConsultations(clinicId: string): Promise<Consultation[]> {
  const { data, error } = await supabase
    .from("consultations")
    .select(SELECT_COLUMNS)
    .eq("clinic_id", clinicId)
    .order("consultation_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

export interface CreateConsultationInput {
  patientId: string;
  visitId?: string;
  visitReason?: string;
  patientWords?: string;
  clinicalNotes?: string;
  teethSelected?: string[];
  prescription?: string;
  followUpRequired?: boolean;
  followUpWhen?: string;
  followUpRecommendation?: string;
  visitOutcome?: VisitOutcome;
  status: ConsultationStatus;
}

export async function createConsultation(
  clinicId: string,
  input: CreateConsultationInput,
): Promise<Consultation> {
  const { data, error } = await supabase
    .from("consultations")
    .insert({
      clinic_id: clinicId,
      patient_id: input.patientId,
      visit_id: input.visitId ?? null,
      visit_reason: input.visitReason ?? null,
      patient_words: input.patientWords ?? null,
      clinical_notes: input.clinicalNotes ?? null,
      teeth_selected: input.teethSelected ?? [],
      prescription: input.prescription ?? null,
      follow_up_required: input.followUpRequired ?? false,
      follow_up_when: input.followUpWhen ?? null,
      follow_up_recommendation: input.followUpRecommendation ?? null,
      visit_outcome: input.visitOutcome ? underscore(input.visitOutcome) : null,
      status: input.status,
    })
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return fromRow(data);
}

export type ConsultationPatchInput = Partial<Omit<CreateConsultationInput, "patientId">>;

export async function updateConsultationRecord(
  id: string,
  patch: ConsultationPatchInput,
): Promise<Consultation> {
  const update: Record<string, unknown> = {};
  if (patch.visitId !== undefined) update.visit_id = patch.visitId ?? null;
  if (patch.visitReason !== undefined) update.visit_reason = patch.visitReason ?? null;
  if (patch.patientWords !== undefined) update.patient_words = patch.patientWords ?? null;
  if (patch.clinicalNotes !== undefined) update.clinical_notes = patch.clinicalNotes ?? null;
  if (patch.teethSelected !== undefined) update.teeth_selected = patch.teethSelected;
  if (patch.prescription !== undefined) update.prescription = patch.prescription ?? null;
  if (patch.followUpRequired !== undefined) update.follow_up_required = patch.followUpRequired;
  if (patch.followUpWhen !== undefined) update.follow_up_when = patch.followUpWhen ?? null;
  if (patch.followUpRecommendation !== undefined) {
    update.follow_up_recommendation = patch.followUpRecommendation ?? null;
  }
  if (patch.visitOutcome !== undefined) {
    update.visit_outcome = patch.visitOutcome ? underscore(patch.visitOutcome) : null;
  }
  if (patch.status !== undefined) update.status = patch.status;

  const { data, error } = await supabase
    .from("consultations")
    .update(update)
    .eq("id", id)
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return fromRow(data);
}
