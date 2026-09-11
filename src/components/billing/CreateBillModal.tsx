import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Plus, UserRoundPlus, X } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Avatar } from "../ui/Avatar";
import { Search } from "../ui/Search";
import { inputClass } from "../ui/fieldStyles";
import { AddPatientModal } from "../patients/AddPatientModal";
import { useClinicData } from "../../state/clinicData";
import { formatPhoneDisplay } from "../../lib/phone";
import {
  dateFromISO,
  formatINR,
  shortDateLabel,
  timeToMinutes,
  todayISO,
  getErrorMessage,
} from "../../lib/utils";
import type { Bill, Patient, Visit } from "../../data/mockData";

type Step = "patient" | "details" | "success";
type ItemDraft = { description: string; amount: string };

const emptyItem: ItemDraft = { description: "", amount: "" };

/** The patient's most recent visit dated today, if any — offered as the
 * default visit association so billing right after seeing a patient takes
 * one less click. Never forced; the doctor can clear or change it. */
function defaultVisitFor(patientId: string, visits: Visit[]): string {
  const today = todayISO();
  const todays = visits
    .filter((v) => v.patientId === patientId && v.date === today)
    .sort((a, b) => timeToMinutes(b.time) - timeToMinutes(a.time));
  return todays[0]?.id ?? "";
}

export function CreateBillModal({
  open,
  onClose,
  initialPatient,
}: {
  open: boolean;
  onClose: () => void;
  /** Pre-selects a patient and skips straight to the details step — used when
   * creating a bill from that patient's own record. */
  initialPatient?: Patient;
}) {
  const navigate = useNavigate();
  const { findPatients, visits, createBill } = useClinicData();

  const [step, setStep] = useState<Step>(initialPatient ? "details" : "patient");
  const [query, setQuery] = useState("");
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [patient, setPatient] = useState<Patient | null>(initialPatient ?? null);
  const [visitId, setVisitId] = useState(() =>
    initialPatient ? defaultVisitFor(initialPatient.id, visits) : "",
  );
  const [items, setItems] = useState<ItemDraft[]>([emptyItem]);
  const [createdBill, setCreatedBill] = useState<Bill | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const results = findPatients(query);
  const patientVisits = patient
    ? visits
        .filter((v) => v.patientId === patient.id && v.date)
        .sort((a, b) => (a.date! < b.date! ? 1 : -1))
    : [];

  const validItems = items
    .map((item) => ({ description: item.description.trim(), amount: Number(item.amount) }))
    .filter((item) => item.description.length > 0 && Number.isFinite(item.amount) && item.amount > 0);
  const subtotal = validItems.reduce((sum, item) => sum + item.amount, 0);
  const canSubmit = patient !== null && validItems.length > 0;

  function reset() {
    setStep(initialPatient ? "details" : "patient");
    setQuery("");
    setShowAddPatient(false);
    setPatient(initialPatient ?? null);
    setVisitId(initialPatient ? defaultVisitFor(initialPatient.id, visits) : "");
    setItems([emptyItem]);
    setCreatedBill(null);
    setSubmitting(false);
    setSubmitError(null);
  }

  function handleClose() {
    onClose();
    reset();
  }

  function pickPatient(p: Patient) {
    setPatient(p);
    setVisitId(defaultVisitFor(p.id, visits));
    setStep("details");
  }

  function updateItem(index: number, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreate() {
    if (!patient || validItems.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const bill = await createBill({
        patientId: patient.id,
        visitId: visitId || undefined,
        items: validItems,
      });
      setCreatedBill(bill);
      setStep("success");
    } catch (err) {
      setSubmitError(getErrorMessage(err, "Could not create this bill."));
    } finally {
      setSubmitting(false);
    }
  }

  const title = step === "success" ? "Bill created" : "Create bill";

  return (
    <>
      <Modal
        open={open && !showAddPatient}
        onClose={handleClose}
        title={title}
        className="max-w-lg"
      >
        {step === "patient" && (
          <div>
            <p className="text-[13px] text-[var(--color-muted)]">
              Select the patient this bill is for.
            </p>

            <div className="mt-4">
              <label className="text-[12px] font-semibold text-[var(--color-muted)]">
                Search patient
              </label>
              <Search
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or phone number"
                className="mt-1.5"
              />
            </div>

            {query.trim() && (
              <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-[var(--color-border)]">
                {results.length === 0 ? (
                  <div className="px-3 py-3 text-[12.5px] text-[var(--color-muted)]">
                    No matching patients.
                  </div>
                ) : (
                  results.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => pickPatient(p)}
                      className="flex w-full items-center gap-3 border-b border-[var(--color-border)] px-3 py-2.5 text-left last:border-b-0 hover:bg-[var(--color-canvas)]"
                    >
                      <Avatar initials={p.initials} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-semibold text-[var(--color-ink)]">
                          {p.name}
                        </div>
                        <div className="truncate text-[12px] text-[var(--color-muted)]">
                          {formatPhoneDisplay(p.phone)}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowAddPatient(true)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--color-border-strong)] px-3 py-2.5 text-[13px] font-semibold text-[var(--color-teal)] hover:bg-[var(--color-mint-bg)]/50"
            >
              <UserRoundPlus size={16} strokeWidth={2.25} />
              Add new patient
            </button>

            <div className="mt-5 flex justify-end">
              <Button variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {step === "details" && patient && (
          <div>
            <div className="flex items-center justify-between rounded-lg bg-[var(--color-canvas)] px-3 py-2.5">
              <div className="flex items-center gap-3">
                <Avatar initials={patient.initials} size={32} />
                <div>
                  <div className="text-[13.5px] font-bold text-[var(--color-ink)]">
                    {patient.name}
                  </div>
                  <div className="text-[12px] text-[var(--color-muted)]">
                    {formatPhoneDisplay(patient.phone)}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStep("patient")}
                className="text-[12px] font-semibold text-[var(--color-teal)] hover:underline"
              >
                Change
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <Field label="Visit (optional)">
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

              <div className="border-t border-[var(--color-border)] pt-4">
                <Field label="Items">
                  <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
                    <div className="divide-y divide-[var(--color-border)]">
                      {items.map((item, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 px-3 py-2.5 transition-colors focus-within:bg-[var(--color-canvas)]"
                        >
                          <input
                            autoFocus={index === 0}
                            value={item.description}
                            onChange={(e) => updateItem(index, { description: e.target.value })}
                            placeholder="e.g. Root canal consultation"
                            className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)]"
                          />
                          <div className="flex shrink-0 items-center gap-1">
                            <span className="text-[12.5px] text-[var(--color-muted)]">₹</span>
                            <input
                              value={item.amount}
                              onChange={(e) =>
                                updateItem(index, {
                                  amount: e.target.value.replace(/[^\d.]/g, ""),
                                })
                              }
                              placeholder="2,500"
                              inputMode="decimal"
                              className="w-20 bg-transparent text-right text-[13px] font-semibold text-[var(--color-ink)] outline-none placeholder:font-normal placeholder:text-[var(--color-muted)]"
                            />
                          </div>
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              aria-label="Remove item"
                              className="shrink-0 text-[var(--color-muted-soft)] hover:text-[var(--color-danger-text)]"
                            >
                              <X size={14} strokeWidth={2.25} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={addItem}
                    className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--color-teal)] hover:underline"
                  >
                    <Plus size={15} strokeWidth={2.5} />
                    Add item
                  </button>
                </Field>
              </div>

              <div className="border-t border-[var(--color-border)] pt-4">
                <div className="flex items-center justify-between text-[13px] text-[var(--color-muted)]">
                  <span>Subtotal</span>
                  <span className="font-semibold text-[var(--color-ink)]">
                    {formatINR(subtotal)}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-[14px] font-bold text-[var(--color-ink)]">Total</span>
                  <span className="text-[21px] font-extrabold tracking-tight text-[var(--color-ink)]">
                    {formatINR(subtotal)}
                  </span>
                </div>
              </div>
            </div>

            {submitError && (
              <p className="mt-3 text-[12.5px] font-semibold text-[var(--color-danger-text)]">
                {submitError}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={handleClose} disabled={submitting}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleCreate()}
                disabled={!canSubmit || submitting}
              >
                {submitting ? "Creating…" : "Create bill"}
              </Button>
            </div>
          </div>
        )}

        {step === "success" && createdBill && (
          <div className="flex flex-col items-center py-2 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-mint-bg)] text-[var(--color-mint-text)]">
              <CheckCircle2 size={24} />
            </div>
            <h3 className="mt-3 text-[16px] font-bold text-[var(--color-ink)]">Bill created</h3>
            <p className="mt-1 text-[13px] text-[var(--color-muted)]">
              {createdBill.invoiceNumber} · {formatINR(createdBill.amount)}
            </p>
            <div className="mt-5 flex w-full gap-2">
              <Button variant="outline" className="flex-1 justify-center" onClick={handleClose}>
                Close
              </Button>
              <Button
                variant="primary"
                className="flex-1 justify-center"
                onClick={() => {
                  const billId = createdBill.id;
                  handleClose();
                  navigate(`/billing/${billId}`);
                }}
              >
                View invoice
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <AddPatientModal
        open={showAddPatient}
        onClose={() => setShowAddPatient(false)}
        onCreated={(newPatient) => {
          setShowAddPatient(false);
          pickPatient(newPatient);
        }}
      />
    </>
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
