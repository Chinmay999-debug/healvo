import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { ArrowRight, FileText, Paperclip, Plus, Trash2 } from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { AddDocumentModal } from "./AddDocumentModal";
import { useClinicData } from "../../state/clinicData";
import { getSignedDocumentUrl } from "../../services/documents";
import { dateFromISO, formatFileSize, shortDateLabel, getErrorMessage } from "../../lib/utils";
import type { Patient, PatientDocument, Visit } from "../../data/mockData";

// Short, scannable format tag shown next to a document's size — derived from
// the same fileType already stored on the record, not a new data field.
function fileFormatLabel(fileType: string): string {
  if (fileType === "application/pdf") return "PDF";
  if (fileType === "image/jpeg") return "JPG";
  if (fileType === "image/png") return "PNG";
  if (fileType === "image/webp") return "WEBP";
  return "FILE";
}

/** Patient-level document attachments — X-rays, photos, prescriptions,
 * reports. One shared list per patient (Documents belongs to the patient
 * record, not a separate global section), filtered from clinic-wide state
 * the same way PatientBilling filters bills. */
export function PatientDocuments() {
  const { patient } = useOutletContext<{ patient: Patient }>();
  const { documents, visits, deleteDocument } = useClinicData();
  const [addOpen, setAddOpen] = useState(false);
  const [viewing, setViewing] = useState<PatientDocument | null>(null);
  const [deleting, setDeleting] = useState<PatientDocument | null>(null);
  const [viewingUrl, setViewingUrl] = useState<string | null>(null);
  const [viewError, setViewError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const patientDocuments = useMemo(
    () =>
      documents
        .filter((d) => d.patientId === patient.id)
        .sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1)),
    [documents, patient.id],
  );

  // Looked up per row rather than stored on the document — the visit's own
  // reason/date stays the single source of truth if it's ever edited.
  const visitById = useMemo(() => new Map(visits.map((v) => [v.id, v])), [visits]);

  // Signed thumbnail URLs — private Storage means there's no fileUrl to read
  // directly (see mockData.ts's PatientDocument comment). Fetched once per
  // document actually rendered in this list (never persisted, never a
  // permanent/public URL) and cached here for the life of this component.
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const fetchingThumbs = useRef(new Set<string>());

  useEffect(() => {
    const imageDocs = patientDocuments.filter((d) => d.fileType.startsWith("image/"));
    for (const doc of imageDocs) {
      if (thumbUrls[doc.id] || fetchingThumbs.current.has(doc.id)) continue;
      fetchingThumbs.current.add(doc.id);
      getSignedDocumentUrl(doc.storagePath)
        .then((url) => setThumbUrls((prev) => ({ ...prev, [doc.id]: url })))
        .catch((err: unknown) => console.error("Failed to sign document thumbnail:", err))
        .finally(() => fetchingThumbs.current.delete(doc.id));
    }
  }, [patientDocuments, thumbUrls]);

  async function handleView(doc: PatientDocument) {
    setViewError(null);
    try {
      const url = await getSignedDocumentUrl(doc.storagePath);
      if (doc.fileType === "application/pdf") {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        setViewingUrl(url);
        setViewing(doc);
      }
    } catch (err) {
      setViewError(getErrorMessage(err, "Could not open this document."));
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteError(null);
    try {
      await deleteDocument(deleting.id);
      setDeleting(null);
    } catch (err) {
      setDeleteError(getErrorMessage(err, "Could not delete this document."));
    }
  }

  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
        <div>
          <h2 className="text-[15px] font-bold text-[var(--color-ink)]">Documents</h2>
          <p className="mt-0.5 text-[12.5px] text-[var(--color-muted)]">
            X-rays, photos, reports, prescriptions, and other patient documents.
          </p>
        </div>
        <Button variant="primary" className="shrink-0" onClick={() => setAddOpen(true)}>
          <Plus size={15} strokeWidth={2.5} />
          Upload / attach
        </Button>
      </div>

      {patientDocuments.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-8 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-mint-bg)] text-[var(--color-teal)]">
            <Paperclip size={22} strokeWidth={2} />
          </div>
          <h2 className="text-[15px] font-bold text-[var(--color-ink)]">No documents yet</h2>
          <p className="max-w-xs text-[13.5px] text-[var(--color-muted)]">
            Upload an X-ray, photo, report, prescription, or any other patient document.
          </p>
          <Button variant="primary" className="mt-1" onClick={() => setAddOpen(true)}>
            <Plus size={15} strokeWidth={2.5} />
            Upload / attach
          </Button>
        </div>
      ) : (
        <div className="divide-y divide-[var(--color-border)] px-5">
          {patientDocuments.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              visit={doc.visitId ? visitById.get(doc.visitId) : undefined}
              thumbUrl={thumbUrls[doc.id]}
              onView={() => void handleView(doc)}
              onDelete={() => setDeleting(doc)}
            />
          ))}
        </div>
      )}

      {viewError && (
        <p className="px-5 pb-3 text-[12.5px] font-semibold text-[var(--color-danger-text)]">
          {viewError}
        </p>
      )}

      <AddDocumentModal open={addOpen} onClose={() => setAddOpen(false)} patient={patient} />

      <Modal
        open={viewing !== null}
        onClose={() => {
          setViewing(null);
          setViewingUrl(null);
        }}
        title={viewing?.name ?? "Document"}
        className="max-w-lg"
      >
        {viewing && viewingUrl && (
          <img
            src={viewingUrl}
            alt={viewing.name}
            className="max-h-[70vh] w-full rounded-lg object-contain"
          />
        )}
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => {
          setDeleting(null);
          setDeleteError(null);
        }}
        title="Delete document?"
        className="max-w-sm"
      >
        <p className="text-[13px] text-[var(--color-muted)]">
          {deleting && (
            <>
              &ldquo;{deleting.name}&rdquo; will be removed from this patient&apos;s documents.
              This can&apos;t be undone.
            </>
          )}
        </p>
        {deleteError && (
          <p className="mt-2 text-[12.5px] font-semibold text-[var(--color-danger-text)]">
            {deleteError}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setDeleting(null);
              setDeleteError(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            className="!bg-[var(--color-danger-text)] hover:!bg-[var(--color-danger-text)]/90"
            onClick={() => void confirmDelete()}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </Card>
  );
}

function DocumentRow({
  doc,
  visit,
  thumbUrl,
  onView,
  onDelete,
}: {
  doc: PatientDocument;
  visit?: Visit;
  thumbUrl?: string;
  onView: () => void;
  onDelete: () => void;
}) {
  const isImage = doc.fileType.startsWith("image/");
  const secondaryLine = visit
    ? `${shortDateLabel(dateFromISO(doc.uploadedAt))} · ${visit.reason}`
    : shortDateLabel(dateFromISO(doc.uploadedAt));

  return (
    <div className="flex items-center gap-3 py-3">
      <button
        type="button"
        onClick={onView}
        className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--color-mint-bg)] text-[var(--color-teal)]"
      >
        {isImage && thumbUrl ? (
          <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <FileText size={20} strokeWidth={2} />
        )}
      </button>

      <button type="button" onClick={onView} className="min-w-0 flex-1 text-left">
        <div className="truncate text-[13.5px] font-semibold text-[var(--color-ink)]">
          {doc.name}
        </div>
        <div className="mt-0.5 truncate text-[12px] text-[var(--color-muted)]">
          {doc.type} · {fileFormatLabel(doc.fileType)} · {formatFileSize(doc.fileSize)}
        </div>
      </button>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <span className="hidden max-w-[180px] truncate text-[12px] text-[var(--color-muted)] sm:inline">
          {secondaryLine}
        </span>
        <button
          type="button"
          onClick={onView}
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--color-teal)] hover:underline"
        >
          View
          <ArrowRight size={12} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete document"
          className="rounded-lg p-1.5 text-[var(--color-muted-soft)] transition-colors hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-text)]"
        >
          <Trash2 size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
