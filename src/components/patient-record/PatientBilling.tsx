import { useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { ArrowRight, Plus, Receipt, Stethoscope } from "lucide-react";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { CreateBillModal } from "../billing/CreateBillModal";
import { BILL_STATUS_META } from "../billing/billStatusMeta";
import { useClinicData } from "../../state/clinicData";
import { dateFromISO, formatINR, shortDateLabel } from "../../lib/utils";
import type { Patient } from "../../data/mockData";

/** Filters the shared Billing data down to this patient — no separate
 * billing state, and bill creation reuses the existing CreateBillModal. */
export function PatientBilling() {
  const { patient } = useOutletContext<{ patient: Patient }>();
  const navigate = useNavigate();
  const { bills } = useClinicData();
  const [createBillOpen, setCreateBillOpen] = useState(false);

  const patientBills = useMemo(
    () =>
      bills
        .filter((b) => b.patientId === patient.id)
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [bills, patient.id],
  );

  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
        <h2 className="text-[15px] font-bold text-[var(--color-ink)]">Billing</h2>
        <Button variant="primary" onClick={() => setCreateBillOpen(true)}>
          <Plus size={15} strokeWidth={2.5} />
          Create bill
        </Button>
      </div>

      {patientBills.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-8 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-mint-bg)] text-[var(--color-teal)]">
            <Receipt size={22} strokeWidth={2} />
          </div>
          <h2 className="text-[15px] font-bold text-[var(--color-ink)]">
            No billing records yet
          </h2>
          <p className="max-w-xs text-[13.5px] text-[var(--color-muted)]">
            Create the first bill for this patient.
          </p>
          <Button variant="primary" className="mt-1" onClick={() => setCreateBillOpen(true)}>
            <Plus size={15} strokeWidth={2.5} />
            Create bill
          </Button>
        </div>
      ) : (
        <>
          {/* Table — desktop/tablet. */}
          <div className="hidden overflow-x-auto px-5 pt-3 pb-5 md:block">
            <table className="w-full min-w-[760px] table-fixed border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="w-[16%] pt-3 pb-3 pl-1 text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
                    Invoice
                  </th>
                  <th className="w-[13%] pt-3 pb-3 text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
                    Date
                  </th>
                  <th className="w-[24%] pt-3 pb-3 text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
                    Description
                  </th>
                  <th className="w-[14%] pt-3 pb-3 text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
                    Amount
                  </th>
                  <th className="w-[13%] pt-3 pb-3 text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
                    Status
                  </th>
                  <th className="w-[10%] pt-3 pb-3 text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
                    Method
                  </th>
                  <th className="w-[10%] pt-3 pb-3 text-right text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
                    View
                  </th>
                </tr>
              </thead>
              <tbody>
                {patientBills.map((bill) => {
                  const statusMeta = BILL_STATUS_META[bill.status];
                  return (
                    <tr key={bill.id} className="border-b border-[var(--color-border)] last:border-b-0">
                      <td className="py-4 pl-1 align-top text-[13px] font-semibold text-[var(--color-ink)]">
                        {bill.invoiceNumber}
                      </td>
                      <td className="py-4 align-top text-[13px] text-[var(--color-ink)]">
                        {shortDateLabel(dateFromISO(bill.date))}
                      </td>
                      <td className="py-4 align-top">
                        <div className="flex items-center gap-2 text-[13px] text-[var(--color-ink)]">
                          <Stethoscope size={15} className="shrink-0 text-[var(--color-teal)]" />
                          <span className="truncate">{bill.treatment}</span>
                        </div>
                      </td>
                      <td className="py-4 align-top text-[13.5px] font-bold text-[var(--color-ink)]">
                        {formatINR(bill.amount)}
                      </td>
                      <td className="py-4 align-top">
                        <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                      </td>
                      <td className="py-4 align-top">
                        {bill.paymentMethod ? (
                          <Badge tone="slate">{bill.paymentMethod}</Badge>
                        ) : (
                          <span className="text-[12.5px] text-[var(--color-muted-soft)]">—</span>
                        )}
                      </td>
                      <td className="py-4 align-top text-right">
                        <button
                          type="button"
                          onClick={() => navigate(`/billing/${bill.id}`)}
                          className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--color-teal)] hover:underline"
                        >
                          View
                          <ArrowRight size={13} strokeWidth={2.5} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Cards — narrow/mobile. */}
          <div className="space-y-2.5 px-5 pt-3 pb-5 md:hidden">
            {patientBills.map((bill) => {
              const statusMeta = BILL_STATUS_META[bill.status];
              return (
                <button
                  key={bill.id}
                  type="button"
                  onClick={() => navigate(`/billing/${bill.id}`)}
                  className="block w-full rounded-lg border border-[var(--color-border)] p-3.5 text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-bold text-[var(--color-ink)]">
                        {bill.invoiceNumber}
                      </div>
                      <div className="text-[12px] text-[var(--color-muted)]">
                        {shortDateLabel(dateFromISO(bill.date))}
                      </div>
                    </div>
                    <Badge tone={statusMeta.tone} className="shrink-0">
                      {statusMeta.label}
                    </Badge>
                  </div>

                  <div className="mt-2.5 flex items-center gap-2 text-[13px] text-[var(--color-ink)]">
                    <Stethoscope size={14} className="shrink-0 text-[var(--color-teal)]" />
                    <span className="truncate">{bill.treatment}</span>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between border-t border-[var(--color-border)] pt-2.5">
                    <span className="text-[14px] font-bold text-[var(--color-ink)]">
                      {formatINR(bill.amount)}
                    </span>
                    <div className="flex items-center gap-2">
                      {bill.paymentMethod && <Badge tone="slate">{bill.paymentMethod}</Badge>}
                      <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--color-teal)]">
                        View
                        <ArrowRight size={12} strokeWidth={2.5} />
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      <CreateBillModal
        open={createBillOpen}
        onClose={() => setCreateBillOpen(false)}
        initialPatient={patient}
      />
    </Card>
  );
}
