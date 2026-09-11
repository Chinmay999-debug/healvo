import { useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { ReportPeriodFilter } from "../components/reports/ReportPeriodFilter";
import { RevenueTrendCard } from "../components/reports/RevenueTrendCard";
import { PatientTrendCard } from "../components/reports/PatientTrendCard";
import { getPeriodRange, type CustomRange, type ReportPeriodKey } from "../lib/reportPeriod";

export default function Reports() {
  const [period, setPeriod] = useState<ReportPeriodKey>("month");
  const [customRange, setCustomRange] = useState<CustomRange | null>(null);

  const range = useMemo(() => getPeriodRange(period, customRange), [period, customRange]);

  return (
    <AppShell crumb="Reports">
      <PageHeader
        title="Reports"
        subtitle="Understand your clinic's performance."
        actions={
          <ReportPeriodFilter
            period={period}
            customRange={customRange}
            onChange={(key, custom) => {
              setPeriod(key);
              setCustomRange(custom);
            }}
          />
        }
      />

      <div className="mt-6 flex flex-col gap-6">
        <RevenueTrendCard range={range} periodKey={period} />
        <PatientTrendCard range={range} periodKey={period} />
      </div>
    </AppShell>
  );
}
