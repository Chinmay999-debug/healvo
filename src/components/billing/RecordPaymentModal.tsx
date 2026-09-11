import { useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { SegmentedControl } from "../patient-record/SegmentedControl";
import { useClinicData } from "../../state/clinicData";
import { formatINR, getErrorMessage } from "../../lib/utils";
import type { Bill, PaymentMethod } from "../../data/mockData";

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "Cash", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "Card", label: "Card" },
  { value: "Other", label: "Other" },
];

/** Records money collected against an existing bill — kept deliberately
 * separate from bill creation (see CreateBillModal): the clinic often
 * creates the bill first and collects payment moments (or visits) later. */
export function RecordPaymentModal({
  open,
  onClose,
  bill,
}: {
  open: boolean;
  onClose: () => void;
  bill: Bill;
}) {
  const { recordPayment } = useClinicData();
  const remaining = Math.max(0, bill.amount - bill.amountPaid);

  const [amount, setAmount] = useState(() => String(remaining));
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Re-sync the default amount every time the modal opens (adjusted during
  // render, React's recommended pattern) — otherwise a second payment on the
  // same bill would keep showing the stale amount from before the first one.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setAmount(String(remaining));
      setMethod(null);
      setSubmitError(null);
    }
  }

  const amountValue = Number(amount);
  const amountValid =
    amount.trim() !== "" && Number.isFinite(amountValue) && amountValue > 0 && amountValue <= remaining;
  const canSubmit = amountValid && method !== null;

  function reset() {
    setAmount(String(remaining));
    setMethod(null);
    setSubmitting(false);
    setSubmitError(null);
  }

  function handleClose() {
    onClose();
    reset();
  }

  async function handleSubmit() {
    if (!canSubmit || !method) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await recordPayment({ billId: bill.id, amount: amountValue, method });
      handleClose();
    } catch (err) {
      setSubmitError(getErrorMessage(err, "Could not record this payment."));
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Record payment" className="max-w-sm">
      <div className="flex items-center justify-between rounded-lg bg-[var(--color-canvas)] px-4 py-3">
        <div>
          <div className="text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
            Remaining
          </div>
          <div className="mt-0.5 text-[21px] font-extrabold tracking-tight text-[var(--color-ink)]">
            {formatINR(remaining)}
          </div>
        </div>
        <div className="text-[12px] font-semibold text-[var(--color-muted)]">
          {bill.invoiceNumber}
        </div>
      </div>

      <div className="mt-4 space-y-3.5">
        <label className="block">
          <span className="text-[12px] font-semibold text-[var(--color-muted)]">
            Payment amount
          </span>
          <div className="mt-1 flex items-stretch overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] focus-within:border-[var(--color-teal)] focus-within:ring-2 focus-within:ring-[var(--color-teal)]/15">
            <span className="flex shrink-0 items-center border-r border-[var(--color-border)] bg-[var(--color-canvas)] px-3 text-[13px] font-semibold text-[var(--color-muted)]">
              ₹
            </span>
            <input
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              inputMode="decimal"
              className="min-w-0 flex-1 bg-transparent px-3 py-2 text-[14px] font-semibold text-[var(--color-ink)] outline-none"
            />
          </div>
        </label>

        <div>
          <span className="text-[12px] font-semibold text-[var(--color-muted)]">
            Payment method
          </span>
          <div className="mt-1.5">
            <SegmentedControl
              options={PAYMENT_METHOD_OPTIONS}
              value={method ?? ""}
              onChange={setMethod}
            />
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
        <Button variant="primary" onClick={() => void handleSubmit()} disabled={!canSubmit || submitting}>
          {submitting ? "Recording…" : "Record payment"}
        </Button>
      </div>
    </Modal>
  );
}
