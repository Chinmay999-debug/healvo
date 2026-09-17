import { useMemo } from "react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { Card } from "../components/ui/Card";
import { LoadingState } from "../components/ui/LoadingState";
import { KpiCard, type Kpi } from "../components/overview/KpiCard";
import { TodaySnapshot } from "../components/overview/TodaySnapshot";
import { RevenueChart } from "../components/overview/RevenueChart";
import { ActivityItem } from "../components/overview/ActivityItem";
import { QuickActionMenu } from "../components/overview/QuickActionMenu";
import { useClinicData } from "../state/clinicData";
import type { ActivityEntry, Bill, Patient, Visit } from "../data/mockData";
import { formatINR, parseTimeOnDate, relativeTimeLabel, todayISO, todayLabel } from "../lib/utils";

const RECENT_ACTIVITY_LIMIT = 6;

/** Recent Activity used to be a hardcoded mock array shown verbatim on
 * every clinic's dashboard, including brand-new empty ones (QA finding —
 * see mockData.ts). Built here instead from the same real patients/visits/
 * bills state the rest of Overview reads: a payment entry per recorded
 * payment, a "new patient" entry per patient (using patients.created_at,
 * P4.2+), a "treatment complete" entry per completed visit (using the
 * visit's own date/time — the schema has no separate completed-at moment
 * to read instead). Sorted by real timestamp, newest first. */
function buildRecentActivity(patients: Patient[], visits: Visit[], bills: Bill[]): ActivityEntry[] {
  const patientsById = new Map(patients.map((p) => [p.id, p]));
  const entries: { at: Date; entry: ActivityEntry }[] = [];

  for (const bill of bills) {
    const patient = patientsById.get(bill.patientId);
    if (!patient) continue;
    bill.payments.forEach((payment, i) => {
      const at = parseTimeOnDate(payment.date, payment.time);
      entries.push({
        at,
        entry: {
          id: `payment-${bill.id}-${i}`,
          icon: "check",
          tone: "mint",
          title: `Payment received from ${patient.name}`,
          subtitle: `${formatINR(payment.amount)} · ${bill.treatment}`,
          time: relativeTimeLabel(at),
        },
      });
    });
  }

  for (const patient of patients) {
    if (!patient.createdAt) continue;
    const at = new Date(patient.createdAt);
    entries.push({
      at,
      entry: {
        id: `patient-${patient.id}`,
        icon: "file",
        tone: "blue",
        title: "New patient profile added",
        subtitle: patient.name,
        time: relativeTimeLabel(at),
      },
    });
  }

  for (const visit of visits) {
    if (visit.status !== "completed") continue;
    const at = parseTimeOnDate(visit.date ?? todayISO(), visit.time);
    entries.push({
      at,
      entry: {
        id: `visit-${visit.id}`,
        icon: "activity",
        tone: "amber",
        title: "Treatment marked complete",
        subtitle: `${visit.patientName} · ${visit.reason}`,
        time: relativeTimeLabel(at),
      },
    });
  }

  return entries
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, RECENT_ACTIVITY_LIMIT)
    .map((e) => e.entry);
}

// Strips a leading courtesy title ("Dr.", "Dr") so "Dr. Ananya Sharma" greets
// as "Ananya" — the same first-name-only feel the old hardcoded greeting
// had, but working for whatever name onboarding actually collected.
function firstNameFrom(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "there";
  const [first, second] = words;
  if (/^dr\.?$/i.test(first) && second) return second;
  return first;
}

export default function Overview() {
  const { todaysVisits, waitingCount, bills, patients, visits, doctorProfile, dataLoading } =
    useClinicData();
  const firstName = firstNameFrom(doctorProfile.name);

  const recentActivity = useMemo(
    () => buildRecentActivity(patients, visits, bills),
    [patients, visits, bills],
  );

  // Every number below is derived from the same visit/bill/patient state the
  // rest of the app reads — nothing here is a separate "dashboard" data set.
  const kpis = useMemo<Kpi[]>(() => {
    const today = todayISO();
    let todaysCollection = 0;
    let paymentsToday = 0;
    for (const bill of bills) {
      for (const payment of bill.payments) {
        if (payment.date === today) {
          todaysCollection += payment.amount;
          paymentsToday += 1;
        }
      }
    }

    const completedToday = todaysVisits.filter((v) => v.status === "completed").length;

    // "New" reuses the same signal reception sees in the walk-in flow —
    // patients created without a prior record — filtered to who's actually
    // on today's schedule.
    const todaysPatientIds = new Set(todaysVisits.map((v) => v.patientId));
    const newPatientsToday = patients.filter(
      (p) => todaysPatientIds.has(p.id) && p.type === "new",
    ).length;

    // While the initial Supabase fetch is still in flight, every count
    // above is 0 by construction — showing "No payments collected yet" /
    // "Queue is clear" etc. right then would assert an empty clinic that
    // may just not have loaded yet. Every trend line collapses to a plain
    // loading label until dataLoading clears (see LoadingState.tsx).
    const loadingTrend = dataLoading ? "Loading…" : null;

    return [
      {
        id: "collection",
        label: "Today's Collection",
        value: formatINR(todaysCollection),
        trend:
          loadingTrend ??
          (paymentsToday > 0
            ? `${paymentsToday} payment${paymentsToday === 1 ? "" : "s"} collected today`
            : "No payments collected yet"),
        trendPositive: paymentsToday > 0 ? true : null,
        icon: "wallet",
        tone: "mint",
      },
      {
        id: "patients",
        label: "Patients Today",
        value: String(todaysVisits.length),
        trend:
          loadingTrend ??
          (todaysVisits.length === 0 ? undefined : `${completedToday} completed so far`),
        trendPositive: null,
        icon: "users-round",
        tone: "blue",
      },
      {
        id: "waiting",
        label: "Waiting",
        value: String(waitingCount),
        trend: loadingTrend ?? (waitingCount > 0 ? "Waiting to be seen" : "Queue is clear"),
        trendPositive: null,
        icon: "clock",
        tone: waitingCount > 0 ? "amber" : "slate",
      },
      {
        id: "new-patients",
        label: "New Patients Today",
        value: String(newPatientsToday),
        trend:
          loadingTrend ??
          (newPatientsToday > 0
            ? "First-time patients on today's schedule"
            : "No new patients today"),
        trendPositive: newPatientsToday > 0 ? true : null,
        icon: "user-round-plus",
        tone: "mint",
      },
    ];
  }, [todaysVisits, waitingCount, bills, patients, dataLoading]);

  return (
    <AppShell crumb="Overview">
      <PageHeader
        dateLabel={todayLabel()}
        title={`Good morning, ${firstName}`}
        subtitle="Here's what's happening at your clinic today."
        actions={<QuickActionMenu />}
      />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.id} kpi={kpi} />
        ))}
      </div>

      <div className="mt-5">
        <TodaySnapshot />
      </div>

      <div className="mt-5">
        <RevenueChart />
      </div>

      <div className="mt-5 mb-2">
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-[15px] font-bold text-[var(--color-ink)]">
                Recent Activity
              </h2>
              <p className="mt-0.5 text-[13px] text-[var(--color-muted)]">
                Latest updates from your clinic
              </p>
            </div>
          </div>
          {recentActivity.length === 0 && dataLoading ? (
            <LoadingState />
          ) : recentActivity.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-[var(--color-muted)]">
              Nothing to show yet. Activity will appear here as it happens.
            </p>
          ) : (
            <div className="mt-2">
              {recentActivity.map((entry, i) => (
                <ActivityItem
                  key={entry.id}
                  entry={entry}
                  last={i === recentActivity.length - 1}
                />
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
