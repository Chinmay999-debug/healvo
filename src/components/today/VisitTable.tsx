import { useNavigate } from "react-router-dom";
import { ArrowRight, CalendarPlus, Plus, Stethoscope, Users } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { LoadingState } from "../ui/LoadingState";
import { VisitStatusBadge } from "./VisitStatusBadge";
import { formatPhoneDisplay } from "../../lib/phone";
import type { Visit, VisitStatus } from "../../data/mockData";

// What the primary action actually lets staff do next, given where the
// visit is in the scheduled → checked-in → in-treatment → completed flow.
const ACTION_LABEL: Record<VisitStatus, string> = {
  scheduled: "Open patient",
  "checked-in": "Start consultation",
  "in-treatment": "Continue",
  completed: "View visit",
  cancelled: "View visit",
};

// Checked-in and in-treatment visits go straight to the consultation
// workspace (the real screen staff use to act on them); everything else
// opens the patient's overview — both are existing, functional routes.
function actionPath(visit: Visit) {
  const id = visit.patientId ?? visit.id;
  return visit.status === "checked-in" || visit.status === "in-treatment"
    ? `/patients/${id}/consultation`
    : `/patients/${id}`;
}

export function VisitTable({
  visits,
  hasAnyVisitsToday,
  loading,
  search,
  onStatusChange,
  onAddPatient,
  onBookAppointment,
}: {
  visits: Visit[];
  hasAnyVisitsToday: boolean;
  loading?: boolean;
  search: string;
  onStatusChange: (visitId: string, status: VisitStatus) => void;
  onAddPatient: () => void;
  onBookAppointment: () => void;
}) {
  const navigate = useNavigate();

  function openPatient(visit: Visit) {
    navigate(`/patients/${visit.patientId ?? visit.id}`);
  }

  function openAction(visit: Visit) {
    navigate(actionPath(visit));
  }

  if (visits.length === 0 && loading) {
    return <LoadingState />;
  }

  if (visits.length === 0) {
    if (!hasAnyVisitsToday) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 px-8 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-mint-bg)] text-[var(--color-teal)]">
            <CalendarPlus size={22} strokeWidth={2} />
          </div>
          <h2 className="text-[15px] font-bold text-[var(--color-ink)]">
            No visits scheduled
          </h2>
          <p className="max-w-xs text-[13.5px] text-[var(--color-muted)]">
            Your clinic day is clear. Book an appointment or add a patient to
            get started.
          </p>
          <div className="mt-1 flex items-center gap-2.5">
            <Button variant="outline" onClick={onAddPatient}>
              <Plus size={15} strokeWidth={2.5} />
              Add patient
            </Button>
            <Button variant="primary" onClick={onBookAppointment}>
              <CalendarPlus size={15} strokeWidth={2.25} />
              Book appointment
            </Button>
          </div>
        </div>
      );
    }

    const isSearching = search.trim().length > 0;
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-8 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-mint-bg)] text-[var(--color-teal)]">
          <Users size={22} strokeWidth={2} />
        </div>
        <h2 className="text-[15px] font-bold text-[var(--color-ink)]">
          {isSearching ? "No patients found" : "No visits match this filter"}
        </h2>
        <p className="max-w-xs text-[13.5px] text-[var(--color-muted)]">
          {isSearching
            ? "Try a different name or phone number."
            : "Try a different filter."}
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Table — desktop/tablet. */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="w-[140px] pt-3 pb-3 pl-1 text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
                Time
              </th>
              <th className="pt-3 pb-3 text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
                Patient
              </th>
              <th className="pt-3 pb-3 text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
                Visit reason
              </th>
              <th className="w-[140px] pt-3 pb-3 text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
                Phone
              </th>
              <th className="w-[140px] pt-3 pb-3 text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
                Status
              </th>
              <th className="pt-3 pb-3 text-right text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {visits.map((visit) => {
              return (
                <tr
                  key={visit.id}
                  className="border-b border-[var(--color-border)] last:border-b-0"
                >
                  <td className="py-4 pl-1 align-top">
                    <div className="text-[13.5px] font-bold text-[var(--color-ink)]">
                      {visit.time}
                    </div>
                    <div className="text-[12px] text-[var(--color-muted)]">
                      {visit.durationMinutes} min
                    </div>
                  </td>
                  <td className="py-4 align-top">
                    <button
                      type="button"
                      onClick={() => openPatient(visit)}
                      className="flex items-center gap-3 text-left"
                    >
                      <Avatar initials={visit.patientInitials} size={34} />
                      <div className="min-w-0">
                        <div className="truncate text-[13.5px] font-bold text-[var(--color-ink)] hover:text-[var(--color-teal)] hover:underline">
                          {visit.patientName}
                        </div>
                        {visit.patientMeta && (
                          <div className="truncate text-[12px] text-[var(--color-muted)]">
                            {visit.patientMeta}
                          </div>
                        )}
                      </div>
                    </button>
                  </td>
                  <td className="py-4 align-top">
                    <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--color-ink)]">
                      <Stethoscope size={15} className="shrink-0 text-[var(--color-teal)]" />
                      {visit.reason}
                    </div>
                  </td>
                  <td className="py-4 align-top">
                    {visit.patientPhone ? (
                      <span className="text-[12.5px] text-[var(--color-muted)]">
                        {formatPhoneDisplay(visit.patientPhone)}
                      </span>
                    ) : (
                      <span className="text-[12.5px] text-[var(--color-muted-soft)]">—</span>
                    )}
                  </td>
                  <td className="py-4 align-top">
                    <VisitStatusBadge
                      status={visit.status}
                      onChange={(status) => onStatusChange(visit.id, status)}
                    />
                  </td>
                  <td className="py-4 align-top text-right">
                    <button
                      type="button"
                      onClick={() => openAction(visit)}
                      className="inline-flex items-center gap-1 text-[13px] font-semibold whitespace-nowrap text-[var(--color-teal)] hover:underline"
                    >
                      {ACTION_LABEL[visit.status]}
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
        {visits.map((visit) => {
          return (
            <div
              key={visit.id}
              className="rounded-lg border border-[var(--color-border)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[13.5px] font-bold text-[var(--color-ink)]">
                    {visit.time}
                  </div>
                  <div className="text-[11.5px] text-[var(--color-muted)]">
                    {visit.durationMinutes} min
                  </div>
                </div>
                <VisitStatusBadge
                  status={visit.status}
                  onChange={(status) => onStatusChange(visit.id, status)}
                />
              </div>

              <button
                type="button"
                onClick={() => openPatient(visit)}
                className="mt-3 flex w-full min-w-0 items-center gap-3 text-left"
              >
                <Avatar initials={visit.patientInitials} size={34} />
                <div className="min-w-0">
                  <div className="text-[13.5px] font-bold break-words text-[var(--color-ink)]">
                    {visit.patientName}
                  </div>
                  {visit.patientMeta && (
                    <div className="text-[12px] text-[var(--color-muted)]">
                      {visit.patientMeta}
                    </div>
                  )}
                </div>
              </button>

              <div className="mt-2.5 flex items-start gap-2 text-[13px] font-semibold text-[var(--color-ink)]">
                <Stethoscope size={14} className="mt-0.5 shrink-0 text-[var(--color-teal)]" />
                <span className="break-words">{visit.reason}</span>
              </div>

              {visit.patientPhone && (
                <div className="mt-1.5 text-[12px] text-[var(--color-muted)]">
                  {formatPhoneDisplay(visit.patientPhone)}
                </div>
              )}

              <div className="mt-3 flex justify-end border-t border-[var(--color-border)] pt-3">
                <button
                  type="button"
                  onClick={() => openAction(visit)}
                  className="inline-flex min-h-[36px] items-center gap-1 text-[13px] font-semibold text-[var(--color-teal)]"
                >
                  {ACTION_LABEL[visit.status]}
                  <ArrowRight size={13} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
