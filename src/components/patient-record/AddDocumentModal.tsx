import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Camera as CameraIcon, FileText, Upload } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { inputClass } from "../ui/fieldStyles";
import { CameraCapture } from "./CameraCapture";
import { SegmentedControl } from "./SegmentedControl";
import { useClinicData } from "../../state/clinicData";
import { dateFromISO, formatFileSize, shortDateLabel, getErrorMessage } from "../../lib/utils";
import type { Patient, PatientDocumentType } from "../../data/mockData";

type Step = "choose" | "camera" | "details";
type Source = "camera" | "file";

const DOCUMENT_TYPE_OPTIONS: { value: PatientDocumentType; label: string }[] = [
  { value: "X-ray", label: "X-ray" },
  { value: "Photo", label: "Photo" },
  { value: "Prescription", label: "Prescription" },
  { value: "Report", label: "Report" },
  { value: "Other", label: "Other" },
];
const ACCEPT = ".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf";
// Generous cap for a mock/local implementation holding files as blob URLs in memory.
const MAX_FILE_BYTES = 20 * 1024 * 1024;

function defaultTypeFor(file: File): PatientDocumentType {
  if (file.type === "application/pdf") return "Report";
  if (file.type.startsWith("image/")) return "Photo";
  return "Other";
}

function defaultNameFor(file: File, source: Source) {
  if (source === "camera") return `Photo - ${shortDateLabel(new Date())}`;
  const dot = file.name.lastIndexOf(".");
  return (dot > 0 ? file.name.slice(0, dot) : file.name) || file.name;
}

function fileKindLabel(file: File): string {
  if (file.type === "application/pdf") return "PDF";
  if (file.type.startsWith("image/")) return "Image";
  return "File";
}

/** Add-document flow, kept entirely inside a modal so the doctor never
 * leaves Patient Record → Documents: choose Camera or Upload from files,
 * capture/select, confirm a few metadata fields, upload. */
export function AddDocumentModal({
  open,
  onClose,
  patient,
}: {
  open: boolean;
  onClose: () => void;
  patient: Patient;
}) {
  const { visits, addDocument } = useClinicData();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("choose");
  const [source, setSource] = useState<Source>("file");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<PatientDocumentType>("Photo");
  const [visitId, setVisitId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const patientVisits = useMemo(
    () =>
      visits
        .filter((v) => v.patientId === patient.id && v.date)
        .sort((a, b) => (a.date! < b.date! ? 1 : -1)),
    [visits, patient.id],
  );

  function reset() {
    setStep("choose");
    setSource("file");
    setFile(null);
    setPreviewUrl(null);
    setFileError(null);
    setName("");
    setType("Photo");
    setVisitId("");
    setUploading(false);
    setUploadError(null);
  }

  function handleClose() {
    // previewUrl is only revoked here when the doctor abandons the flow —
    // once uploaded, addDocument's record owns the blob URL.
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    onClose();
    reset();
  }

  function acceptFile(selected: File, src: Source) {
    if (selected.size > MAX_FILE_BYTES) {
      setFileError("That file is too large. Choose a file under 20 MB.");
      setStep("choose");
      return;
    }
    setSource(src);
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setName(defaultNameFor(selected, src));
    setType(defaultTypeFor(selected));
    setFileError(null);
    setStep("details");
  }

  function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    e.target.value = "";
    if (!selected) return;
    acceptFile(selected, "file");
  }

  function chooseAnother() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    if (source === "camera") {
      setStep("camera");
    } else {
      setStep("choose");
      fileInputRef.current?.click();
    }
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      await addDocument({
        patientId: patient.id,
        visitId: visitId || undefined,
        name: name.trim() || defaultNameFor(file, source),
        type,
        file,
      });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      onClose();
      reset();
    } catch (err) {
      setUploadError(getErrorMessage(err, "Could not upload this document."));
      setUploading(false);
    }
  }

  const isImage = file?.type.startsWith("image/") ?? false;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={handleFileInputChange}
      />

      <Modal open={open} onClose={handleClose} title="Add document" className="max-w-lg">
        {step === "choose" && (
          <div>
            <p className="text-[13px] text-[var(--color-muted)]">How would you like to add it?</p>

            {fileError && (
              <p className="mt-2 text-[12.5px] font-medium text-[var(--color-amber-text)]">
                {fileError}
              </p>
            )}

            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <ChoiceButton
                icon={<CameraIcon size={18} strokeWidth={2} />}
                label="Camera"
                description="Take a photo using your device camera."
                onClick={() => setStep("camera")}
              />
              <ChoiceButton
                icon={<Upload size={18} strokeWidth={2} />}
                label="Upload from files"
                description="Choose a photo, PDF, or other file."
                onClick={() => fileInputRef.current?.click()}
              />
            </div>

            <div className="mt-5 flex justify-end">
              <Button variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {step === "camera" && (
          <CameraCapture
            onCapture={(captured) => acceptFile(captured, "camera")}
            onCancel={() => setStep("choose")}
            onUseFileInstead={() => fileInputRef.current?.click()}
          />
        )}

        {step === "details" && file && previewUrl && (
          <div>
            <div className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] p-3">
              {isImage ? (
                <img
                  src={previewUrl}
                  alt={name || file.name}
                  className="h-14 w-14 shrink-0 rounded-md object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-[var(--color-mint-bg)] text-[var(--color-teal)]">
                  <FileText size={22} strokeWidth={2} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-[var(--color-ink)]">
                  {file.name}
                </div>
                <div className="mt-0.5 text-[12px] text-[var(--color-muted)]">
                  {fileKindLabel(file)} · {formatFileSize(file.size)}
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-3.5">
              <Field label="Name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="Type">
                <SegmentedControl options={DOCUMENT_TYPE_OPTIONS} value={type} onChange={setType} />
              </Field>

              <Field label="Attach to visit (optional)">
                <select
                  value={visitId}
                  onChange={(e) => setVisitId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">No visit</option>
                  {patientVisits.map((v) => (
                    <option key={v.id} value={v.id}>
                      {shortDateLabel(dateFromISO(v.date!))} · {v.reason}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {uploadError && (
              <p className="mt-3 text-[12.5px] font-semibold text-[var(--color-danger-text)]">
                {uploadError}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={chooseAnother} disabled={uploading}>
                Choose another
              </Button>
              <Button variant="primary" onClick={() => void handleUpload()} disabled={!file || uploading}>
                {uploading ? "Uploading…" : "Upload"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function ChoiceButton({
  icon,
  label,
  description,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-2 rounded-lg border border-[var(--color-border-strong)] p-4 text-left outline-none transition-colors hover:border-[var(--color-teal)] hover:bg-[var(--color-mint-bg)]/40 focus-visible:ring-2 focus-visible:ring-[var(--color-teal)]/50"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-mint-bg)] text-[var(--color-teal)]">
        {icon}
      </div>
      <div>
        <div className="text-[13.5px] font-bold text-[var(--color-ink)]">{label}</div>
        <div className="mt-0.5 text-[12px] text-[var(--color-muted)]">{description}</div>
      </div>
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[12px] font-semibold text-[var(--color-muted)]">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
