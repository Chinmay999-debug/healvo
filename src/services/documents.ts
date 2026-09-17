import { supabase } from "../lib/supabaseClient";
import type { PatientDocument, PatientDocumentType } from "../data/mockData";

/** P4.4 data-access layer for `documents` + the private `patient-documents`
 * Storage bucket (audit §7/§18-K). Field names differ from the mock by
 * snake_case vs camelCase, plus a title-case <-> enum mapping for `type`
 * (document_type isn't a simple hyphen/underscore swap like the other
 * enums — 'x_ray' vs 'X-ray' — so this gets its own explicit map instead of
 * reusing hyphenate/underscore from services/visits.ts). */

const BUCKET = "patient-documents";

const TYPE_TO_DB: Record<PatientDocumentType, string> = {
  "X-ray": "x_ray",
  Photo: "photo",
  Prescription: "prescription",
  Report: "report",
  Other: "other",
};

const TYPE_FROM_DB: Record<string, PatientDocumentType> = {
  x_ray: "X-ray",
  photo: "Photo",
  prescription: "Prescription",
  report: "Report",
  other: "Other",
};

const SELECT_COLUMNS =
  "id, patient_id, visit_id, name, type, storage_path, mime_type, file_size_bytes, uploaded_at";

interface DocumentRow {
  id: string;
  patient_id: string;
  visit_id: string | null;
  name: string;
  type: string;
  storage_path: string | null;
  mime_type: string;
  file_size_bytes: number;
  uploaded_at: string;
}

function fromRow(row: DocumentRow): PatientDocument {
  return {
    id: row.id,
    patientId: row.patient_id,
    visitId: row.visit_id ?? undefined,
    name: row.name,
    type: TYPE_FROM_DB[row.type] ?? "Other",
    storagePath: row.storage_path ?? "",
    fileType: row.mime_type,
    fileSize: row.file_size_bytes,
    uploadedAt: row.uploaded_at.slice(0, 10),
  };
}

export async function listDocuments(clinicId: string): Promise<PatientDocument[]> {
  const { data, error } = await supabase
    .from("documents")
    .select(SELECT_COLUMNS)
    .eq("clinic_id", clinicId)
    .order("uploaded_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

// Storage-safe leaf filename: keeps the original name (for recognizability
// in dashboard/debugging contexts) but strips anything that isn't
// alnum/dot/dash/underscore, since the object path is otherwise built
// entirely from UUIDs. No PII beyond whatever the doctor typed as the
// filename itself, matching this phase's explicit path-structure instruction.
function safeFilename(originalName: string): string {
  const trimmed = originalName.trim() || "file";
  const cleaned = trimmed.replace(/[^a-zA-Z0-9.\-_]/g, "-");
  // Guards against pathological names blowing past Storage's key-length
  // limits without truncating a normal filename's extension.
  return cleaned.length > 180 ? cleaned.slice(-180) : cleaned;
}

export interface UploadDocumentInput {
  patientId: string;
  visitId?: string;
  name: string;
  type: PatientDocumentType;
  file: File;
}

/** Uploads the file to private Storage, then inserts the metadata row —
 * Storage first, since a document row with no bytes behind it would be a
 * broken reference the UI can't recover from, whereas an orphaned Storage
 * object with no DB row is invisible to every user (RLS-gated reads all go
 * through the `documents` table first — see PatientDocuments.tsx). If the
 * DB insert fails after the upload succeeds, this makes a best-effort
 * attempt to delete the just-uploaded object so a failed upload doesn't
 * silently consume Storage quota forever; that cleanup call's own failure
 * is logged but doesn't mask the original error. */
export async function uploadDocument(
  clinicId: string,
  input: UploadDocumentInput,
): Promise<PatientDocument> {
  const documentId = crypto.randomUUID();
  const storagePath = `${clinicId}/${input.patientId}/${documentId}/${safeFilename(input.file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, input.file, { contentType: input.file.type, upsert: false });
  if (uploadError) throw uploadError;

  const { data, error: insertError } = await supabase
    .from("documents")
    .insert({
      id: documentId,
      clinic_id: clinicId,
      patient_id: input.patientId,
      visit_id: input.visitId ?? null,
      name: input.name,
      type: TYPE_TO_DB[input.type],
      storage_path: storagePath,
      mime_type: input.file.type,
      file_size_bytes: input.file.size,
    })
    .select(SELECT_COLUMNS)
    .single();

  if (insertError) {
    const { error: cleanupError } = await supabase.storage.from(BUCKET).remove([storagePath]);
    if (cleanupError) {
      console.error(
        "Document row insert failed and Storage cleanup also failed. Orphaned object at",
        storagePath,
        cleanupError,
      );
    }
    throw insertError;
  }

  return fromRow(data);
}

/** Deletes the `documents` row first (RLS-gated, same as every other
 * mutation in this schema) so the document disappears from every clinic
 * member's view immediately regardless of what happens next, then removes
 * the Storage object. Deleting the row first (rather than the object first)
 * means a failure on the Storage side never leaves a dangling DB row that
 * points at a file the UI can no longer resolve — the worst case is an
 * orphaned Storage object, which costs quota but is never user-visible. */
export async function deleteDocumentAndFile(id: string, storagePath: string): Promise<void> {
  const { error: deleteRowError } = await supabase.from("documents").delete().eq("id", id);
  if (deleteRowError) throw deleteRowError;

  if (!storagePath) return;
  const { error: removeError } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (removeError) {
    console.error("Document row deleted but Storage cleanup failed for", storagePath, removeError);
  }
}

/** Generated fresh on demand — never persisted, never a permanent/public
 * URL. Default 1 hour covers a normal viewing session without regenerating
 * on every render of the document list. */
export async function getSignedDocumentUrl(
  storagePath: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}
