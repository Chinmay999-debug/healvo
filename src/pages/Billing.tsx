import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { BillingFilters, type BillingFilter } from "../components/billing/BillingFilters";
import { BillingTable, type BillingRow } from "../components/billing/BillingTable";
import { CreateBillModal } from "../components/billing/CreateBillModal";
import { KpiCard, type Kpi } from "../components/overview/KpiCard";
import { useClinicData } from "../state/clinicData";
import { phoneMatches } from "../lib/phone";
import { formatINR, todayISO } from "../lib/utils";

export default function Billing() {
  const { patients, bills, dataLoading } = useClinicData();
  const [filter, setFilter] = useState<BillingFilter>("all");
  const [search, setSearch] = useState("");
  const [createBillOpen, setCreateBillOpen] = useState(false);

  const rows = useMemo<BillingRow[]>(() => {
    return bills
      .map((bill) => {
        const patient = patients.find((p) => p.id === bill.patientId);
        return patient ? { bill, patient } : null;
      })
      .filter((row): row is BillingRow => row !== null)
      .sort((a, b) => (a.bill.date < b.bill.date ? 1 : -1));
  }, [bills, patients]);

  // Same page-level KPI shape Overview uses (see overview/KpiCard) — every
  // figure below is derived from the same bills/payments state the table
  // underneath reads, nothing here is a separate "dashboard" data set.
  const kpis = useMemo<Kpi[]>(() => {
    const today = todayISO();
    let todaysCollection = 0;
    let paymentsToday = 0;
    let totalBilled = 0;
    let paidBills = 0;
    let pendingPayments = 0;

    for (const bill of bills) {
      totalBilled += bill.amount;
      if (bill.status === "paid") paidBills += 1;
      else pendingPayments += 1;
      for (const payment of bill.payments) {
        if (payment.date === today) {
          todaysCollection += payment.amount;
          paymentsToday += 1;
        }
      }
    }

    return [
      {
        id: "collection",
        label: "Today's Collection",
        value: formatINR(todaysCollection),
        trend:
          paymentsToday > 0
            ? `${paymentsToday} payment${paymentsToday === 1 ? "" : "s"} collected today`
            : "No payments collected yet",
        trendPositive: paymentsToday > 0 ? true : null,
        icon: "wallet",
        tone: "mint",
      },
      {
        id: "total-billed",
        label: "Total Billed",
        value: formatINR(totalBilled),
        trend: `${bills.length} bill${bills.length === 1 ? "" : "s"} total`,
        trendPositive: null,
        icon: "receipt",
        tone: "blue",
      },
      {
        id: "paid",
        label: "Paid Bills",
        value: String(paidBills),
        trend: bills.length > 0 ? `${paidBills} of ${bills.length} bills` : undefined,
        trendPositive: null,
        icon: "check-circle",
        tone: "mint",
      },
      {
        id: "pending",
        label: "Pending Payments",
        value: String(pendingPayments),
        trend: pendingPayments > 0 ? "Needs follow-up" : "All caught up",
        trendPositive: null,
        icon: "clock",
        tone: pendingPayments > 0 ? "amber" : "slate",
        attention: pendingPayments > 0,
      },
    ];
  }, [bills]);

  const counts = useMemo(() => {
    const totals: Record<BillingFilter, number> = {
      all: rows.length,
      paid: 0,
      "partially-paid": 0,
      unpaid: 0,
    };
    for (const { bill } of rows) {
      totals[bill.status] += 1;
    }
    return totals;
  }, [rows]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesFilter = filter === "all" || row.bill.status === filter;
      const matchesSearch =
        !query ||
        row.patient.name.toLowerCase().includes(query) ||
        row.bill.invoiceNumber.toLowerCase().includes(query) ||
        phoneMatches(row.patient.phone, search.trim());
      return matchesFilter && matchesSearch;
    });
  }, [rows, filter, search]);

  return (
    <AppShell crumb="Billing">
      <PageHeader
        title={
          <>
            Billing
            <Badge tone="mint">{bills.length}</Badge>
          </>
        }
        subtitle="Create bills, record payments, and keep track of clinic collections."
        actions={
          <Button variant="primary" onClick={() => setCreateBillOpen(true)}>
            <Plus size={15} strokeWidth={2.5} />
            Create bill
          </Button>
        }
      />

      {bills.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi) => (
            <KpiCard key={kpi.id} kpi={kpi} />
          ))}
        </div>
      )}

      <Card className="mt-6 p-0">
        <BillingFilters
          active={filter}
          onChange={setFilter}
          counts={counts}
          search={search}
          onSearchChange={setSearch}
        />
        <div className={visibleRows.length > 0 ? "px-5 pt-3 pb-5" : ""}>
          <BillingTable
            rows={visibleRows}
            hasAnyBills={bills.length > 0}
            loading={dataLoading}
            onCreateBill={() => setCreateBillOpen(true)}
          />
        </div>
      </Card>

      <CreateBillModal open={createBillOpen} onClose={() => setCreateBillOpen(false)} />
    </AppShell>
  );
}
