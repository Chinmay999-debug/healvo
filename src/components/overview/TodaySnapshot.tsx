import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays } from "lucide-react";
import { Card } from "../ui/Card";
import { Badge, type BadgeTone } from "../ui/Badge";
import { LoadingState } from "../ui/LoadingState";
import { useClinicData } from "../../state/clinicData";
import type { VisitStatus } from "../../data/mockData";

// A compact, read-only echo of what Today shows in full — status here is
// just a label, never an editable control. Changing a visit's status stays
// exclusively Today's job.
const STATUS_META: Record<VisitStatus, { label: string; tone: BadgeTone }> = {
  scheduled: { label: "Scheduled", tone: "slate" },
  "checked-in": { label: "Checked in", tone: "blue" },
  "in-treatment": { label: "In treatment", tone: "amber" },
  completed: { label: "Completed", tone: "mint" },
  cancelled: { label: "Cancelled", tone: "slate" },
};

const MAX_ROWS = 4;

export function TodaySnapshot() {
  const { todaysVisits, dataLoading } = useClinicData();

  const total = todaysVisits.length;
  const completed = todaysVisits.filter((v) => v.status === "completed").length;
  const inTreatment = todaysVisits.filter((v) => v.status === "in-treatment").length;
  const upcoming = todaysVisits.filter(
    (v) => v.status === "scheduled" || v.status === "checked-in",
  ).length;

  // What still needs attention today, in schedule order; once everything is
  // done, fall back to a short recap so the section never looks broken.
  const active = todaysVisits.filter((v) => v.status !== "completed").slice(0, MAX_ROWS);
  const displayVisits = active.length > 0 ? active : todaysVisits.slice(-3).reverse();

  if (dataLoading && total === 0) {
    return (
      <Card className="p-5">
        <h2 className="text-[15px] font-bold text-[var(--color-ink)]">Today's schedule</h2>
        <LoadingState />
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-bold text-[var(--color-ink)]">
            Today's schedule
          </h2>
          {total === 0 ? (
            <p className="mt-0.5 text-[13px] text-[var(--color-muted)]">
              No visits scheduled for today.
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <ScheduleStat value={total} label={`Visit${total === 1 ? "" : "s"}`} />
              <StatDivider />
              <ScheduleStat value={completed} label="Completed" />
              <StatDivider />
              <ScheduleStat value={inTreatment} label="In treatment" />
              <StatDivider />
              <ScheduleStat value={upcoming} label="Upcoming" />
            </div>
          )}
        </div>
      </div>

      {displayVisits.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-mint-bg)] text-[var(--color-teal)]">
            <CalendarDays size={18} strokeWidth={2} />
          </div>
          <p className="text-[13px] text-[var(--color-muted)]">
            Your clinic day is clear.
          </p>
        </div>
      ) : (
        <div className="mt-2.5">
          {active.length === 0 && (
            <p className="mb-1 text-[11.5px] font-semibold tracking-[0.02em] text-[var(--color-muted)] uppercase">
              All visits completed · today's recap
            </p>
          )}
          {displayVisits.map((visit, i) => {
            const meta = STATUS_META[visit.status];
            return (
              <div
                key={visit.id}
                className={
                  i === displayVisits.length - 1
                    ? "flex items-center gap-3 py-2.5"
                    : "flex items-center gap-3 border-b border-[var(--color-border)] py-2.5"
                }
              >
                <div className="w-[68px] shrink-0 text-[12.5px] font-bold text-[var(--color-ink)]">
                  {visit.time}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-[var(--color-ink)]">
                    {visit.patientName}
                  </div>
                  <div className="truncate text-[12px] text-[var(--color-muted)]">
                    {visit.reason}
                  </div>
                </div>
                <Badge tone={meta.tone} className="shrink-0">
                  {meta.label}
                </Badge>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 border-t border-[var(--color-border)] pt-3 text-right">
        <Link
          to="/today"
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--color-teal)] hover:underline"
        >
          View today's schedule
          <ArrowRight size={13} strokeWidth={2.5} />
        </Link>
      </div>
    </Card>
  );
}

function ScheduleStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[19px] font-extrabold tracking-tight text-[var(--color-ink)]">
        {value}
      </span>
      <span className="text-[12px] font-medium text-[var(--color-muted)]">{label}</span>
    </div>
  );
}

function StatDivider() {
  return (
    <span
      aria-hidden="true"
      className="hidden h-6 w-px bg-[var(--color-border)] sm:block"
    />
  );
}
