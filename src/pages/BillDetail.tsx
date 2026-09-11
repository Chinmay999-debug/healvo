import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Printer, Receipt } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { RecordPaymentModal } from "../components/billing/RecordPaymentModal";
import { BILL_STATUS_META } from "../components/billing/billStatusMeta";
import { useClinicData } from "../state/clinicData";
import { dateFromISO, formatINR, shortDateLabel } from "../lib/utils";

export default function BillDetail() {
  const { billId } = useParams<{ billId: string }>();
  const { bills, patients, clinicSettings, dataLoading } = useClinicData();
  const navigate = useNavigate();
  const [paymentOpen, setPaymentOpen] = useState(false);

  const bill = bills.find((b) => b.id === billId);
  // patients/bills are both real Supabase data (P4.2/P4.5), loaded together
  // by the same ClinicDataProvider effect.
  const patient = bill ? patients.find((p) => p.id === bill.patientId) : undefined;

  // A direct navigation/reload on this URL lands here before
  // ClinicDataProvider's initial Supabase fetch resolves — bills starts
  // empty for every account now (not just non-demo), so without this check
  // a real, existing bill would flash "Bill not found" on every hard
  // reload. Same guard PatientRecord.tsx already uses for the same reason.
  if (!bill && dataLoading) {
    return (
      <AppShell crumb="Loading…">
        <p className="px-2 py-10 text-center text-[13.5px] text-[var(--color-muted)]">
          Loading invoice…
        </p>
      </AppShell>
    );
  }

  if (!bill || !patient) {
    return (
      <AppShell crumb="Invoice">
        <Card className="flex flex-col items-center justify-center gap-3 px-8 py-24 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-mint-bg)] text-[var(--color-teal)]">
            <Receipt size={22} strokeWidth={2} />
          </div>
          <h1 className="text-[18px] font-bold text-[var(--color-ink)]">Bill not found</h1>
          <p className="max-w-sm text-[13.5px] text-[var(--color-muted)]">
            This invoice may have been removed.
          </p>
          <Button variant="primary" className="mt-1" onClick={() => navigate("/billing")}>
            Back to billing
          </Button>
        </Card>
      </AppShell>
    );
  }

  const statusMeta = BILL_STATUS_META[bill.status];
  const remaining = Math.max(0, bill.amount - bill.amountPaid);

  return (
    <AppShell crumb="Invoice">
      <button
        type="button"
        onClick={() => navigate("/billing")}
        className="flex items-center gap-1 text-[13px] font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)] print:hidden"
      >
        <ChevronLeft size={15} strokeWidth={2.5} />
        Billing
      </button>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-[var(--color-ink)]">
            {bill.invoiceNumber}
          </h1>
          <p className="mt-0.5 text-[13.5px] text-[var(--color-muted)]">
            Created {shortDateLabel(dateFromISO(bill.date))}
          </p>
        </div>
        <div className="flex items-center gap-2.5 pt-1">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer size={15} strokeWidth={2.25} />
            Print / Download
          </Button>
          {bill.status !== "paid" && (
            <Button variant="primary" onClick={() => setPaymentOpen(true)}>
              Record payment
            </Button>
          )}
        </div>
      </div>

      <Card className="mt-5 max-w-2xl p-7 print:max-w-none print:border-none print:p-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[16px] font-extrabold text-[var(--color-ink)]">
              {clinicSettings.clinicName}
            </div>
            <div className="mt-0.5 text-[12.5px] text-[var(--color-muted)]">
              {[clinicSettings.address, clinicSettings.city].filter(Boolean).join(", ")}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
              Invoice
            </div>
            <div className="text-[15px] font-extrabold text-[var(--color-ink)]">
              {bill.invoiceNumber}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[var(--color-border)] pt-5">
          <div>
            <div className="text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
              Patient
            </div>
            <button
              type="button"
              onClick={() => navigate(`/patients/${patient.id}`)}
              className="mt-1 text-[14px] font-semibold text-[var(--color-ink)] hover:text-[var(--color-teal)] hover:underline print:pointer-events-none"
            >
              {patient.name}
            </button>
          </div>
          <div>
            <div className="text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
              Date
            </div>
            <div className="mt-1 text-[14px] font-semibold text-[var(--color-ink)]">
              {shortDateLabel(dateFromISO(bill.date))}
            </div>
          </div>
        </div>

        <div className="mt-6 divide-y divide-[var(--color-border)] border-t border-b border-[var(--color-border)]">
          {bill.items.map((item, index) => (
            <div key={index} className="flex items-center justify-between gap-4 py-3">
              <span className="text-[13.5px] text-[var(--color-ink)]">{item.description}</span>
              <span className="shrink-0 text-[13.5px] font-semibold text-[var(--color-ink)]">
                {formatINR(item.amount)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-[15px] font-bold text-[var(--color-ink)]">Total</span>
          <span className="text-[21px] font-extrabold tracking-tight text-[var(--color-ink)]">
            {formatINR(bill.amount)}
          </span>
        </div>

        <div className="mt-6 rounded-lg bg-[var(--color-canvas)] p-5 print:bg-transparent print:px-0">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
              Payment
            </span>
            <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
          </div>

          {bill.amountPaid > 0 ? (
            <div className="mt-2.5 flex items-center justify-between">
              <span className="text-[13px] text-[var(--color-muted)]">
                {bill.paymentMethod}
                {bill.status === "partially-paid" && ` · ${formatINR(remaining)} remaining`}
              </span>
              <span className="text-[16px] font-bold text-[var(--color-ink)]">
                {formatINR(bill.amountPaid)}
              </span>
            </div>
          ) : (
            <p className="mt-2.5 text-[13px] text-[var(--color-muted)]">Not yet collected.</p>
          )}
        </div>
      </Card>

      <RecordPaymentModal open={paymentOpen} onClose={() => setPaymentOpen(false)} bill={bill} />
    </AppShell>
  );
}
