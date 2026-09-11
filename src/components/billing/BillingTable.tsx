import { useNavigate } from "react-router-dom";
import { ArrowRight, Plus, Receipt } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { LoadingState } from "../ui/LoadingState";
import { BILL_STATUS_META } from "./billStatusMeta";
import { formatINR, shortDateLabel, dateFromISO } from "../../lib/utils";
import type { Bill, Patient } from "../../data/mockData";

export interface BillingRow {
  bill: Bill;
  patient: Patient;
}

export function BillingTable({
  rows,
  hasAnyBills,
  loading,
  onCreateBill,
}: {
  rows: BillingRow[];
  hasAnyBills: boolean;
  loading?: boolean;
  onCreateBill: () => void;
}) {
  const navigate = useNavigate();

  function openPatient(patient: Patient) {
    navigate(`/patients/${patient.id}`);
  }

  function openBill(bill: Bill) {
    navigate(`/billing/${bill.id}`);
  }

  if (rows.length === 0 && loading) {
    return <LoadingState />;
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-8 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-mint-bg)] text-[var(--color-teal)]">
          <Receipt size={22} strokeWidth={2} />
        </div>
        {hasAnyBills ? (
          <>
            <h2 className="text-[15px] font-bold text-[var(--color-ink)]">No bills found</h2>
            <p className="max-w-xs text-[13.5px] text-[var(--color-muted)]">
              Try a different patient name or invoice number.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-[15px] font-bold text-[var(--color-ink)]">No bills yet</h2>
            <p className="max-w-xs text-[13.5px] text-[var(--color-muted)]">
              Create your first bill to start tracking clinic collections.
            </p>
            <Button variant="primary" className="mt-1" onClick={onCreateBill}>
              <Plus size={15} strokeWidth={2.5} />
              Create bill
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Table — desktop/tablet. */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[880px] table-fixed border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="w-[11%] pt-3 pb-3.5 pl-1 text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
                Invoice
              </th>
              <th className="w-[19%] pt-3 pb-3.5 text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
                Patient
              </th>
              <th className="w-[10%] pt-3 pb-3.5 text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
                Date
              </th>
              <th className="w-[19%] pt-3 pb-3.5 text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
                Description
              </th>
              <th className="w-[11%] pt-3 pr-4 pb-3.5 text-right text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
                Amount
              </th>
              <th className="w-[12%] pt-3 pb-3.5 text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
                Status
              </th>
              <th className="w-[10%] pt-3 pb-3.5 text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
                Method
              </th>
              <th className="w-[8%] pt-3 pb-3.5 text-right text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ bill, patient }) => {
              const statusMeta = BILL_STATUS_META[bill.status];
              return (
                <tr key={bill.id} className="border-b border-[var(--color-border)] last:border-b-0">
                  <td className="py-4 pl-1 align-top text-[13px] font-semibold text-[var(--color-ink)]">
                    {bill.invoiceNumber}
                  </td>
                  <td className="py-4 align-top">
                    <button
                      type="button"
                      onClick={() => openPatient(patient)}
                      className="flex items-center gap-3 text-left"
                    >
                      <Avatar initials={patient.initials} size={30} />
                      <div className="min-w-0">
                        <div className="truncate text-[13.5px] font-bold text-[var(--color-ink)] hover:text-[var(--color-teal)] hover:underline">
                          {patient.name}
                        </div>
                      </div>
                    </button>
                  </td>
                  <td className="py-4 align-top text-[13px] text-[var(--color-muted)]">
                    {shortDateLabel(dateFromISO(bill.date))}
                  </td>
                  <td className="py-4 align-top">
                    <span className="block truncate text-[13px] text-[var(--color-ink)]">
                      {bill.treatment}
                    </span>
                  </td>
                  <td className="py-4 pr-4 align-top text-right text-[14px] font-bold text-[var(--color-ink)]">
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
                      onClick={() => openBill(bill)}
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
      <div className="space-y-2.5 md:hidden">
        {rows.map(({ bill, patient }) => {
          const statusMeta = BILL_STATUS_META[bill.status];
          return (
            <button
              key={bill.id}
              type="button"
              onClick={() => openBill(bill)}
              className="block w-full rounded-lg border border-[var(--color-border)] p-4 text-left"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar initials={patient.initials} size={32} />
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-bold text-[var(--color-ink)]">
                      {patient.name}
                    </div>
                    <div className="text-[12px] text-[var(--color-muted)]">
                      {bill.invoiceNumber} · {shortDateLabel(dateFromISO(bill.date))}
                    </div>
                  </div>
                </div>
                <Badge tone={statusMeta.tone} className="shrink-0">
                  {statusMeta.label}
                </Badge>
              </div>

              <div className="mt-2.5 truncate text-[12.5px] text-[var(--color-muted)]">
                {bill.treatment}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border)] pt-3">
                <span className="text-[15px] font-bold text-[var(--color-ink)]">
                  {formatINR(bill.amount)}
                </span>
                <div className="flex items-center gap-2.5">
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
  );
}
