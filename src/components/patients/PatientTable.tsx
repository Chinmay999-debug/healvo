import { useNavigate } from "react-router-dom";
import { ArrowRight, Plus, UsersRound } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { LoadingState } from "../ui/LoadingState";
import { formatPhoneDisplay } from "../../lib/phone";
import type { Patient } from "../../data/mockData";

export interface PatientRow {
  patient: Patient;
  totalVisits: number;
  lastVisitLabel: string;
}

export function PatientTable({
  rows,
  hasAnyPatients,
  loading,
  onAddPatient,
}: {
  rows: PatientRow[];
  hasAnyPatients: boolean;
  loading?: boolean;
  onAddPatient: () => void;
}) {
  const navigate = useNavigate();

  function openPatient(patient: Patient) {
    navigate(`/patients/${patient.id}`);
  }

  if (rows.length === 0 && loading) {
    return <LoadingState />;
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-8 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-mint-bg)] text-[var(--color-teal)]">
          <UsersRound size={22} strokeWidth={2} />
        </div>
        {hasAnyPatients ? (
          <>
            <h2 className="text-[15px] font-bold text-[var(--color-ink)]">
              No patients found
            </h2>
            <p className="max-w-xs text-[13.5px] text-[var(--color-muted)]">
              Try a different name or phone number.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-[15px] font-bold text-[var(--color-ink)]">
              No patients yet
            </h2>
            <p className="max-w-xs text-[13.5px] text-[var(--color-muted)]">
              Add your first patient to get started.
            </p>
            <Button variant="primary" className="mt-1" onClick={onAddPatient}>
              <Plus size={15} strokeWidth={2.5} />
              Add patient
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
      <table className="w-full min-w-[760px] table-fixed border-collapse text-left">
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            <th className="w-[33%] pt-3 pb-3 pl-1 text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
              Patient
            </th>
            <th className="w-[24%] pt-3 pb-3 text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
              Phone
            </th>
            <th className="w-[19%] pt-3 pb-3 text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
              Last visit
            </th>
            <th className="w-[13%] pt-3 pb-3 text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
              Visits
            </th>
            <th className="w-[11%] pt-3 pb-3 text-right text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
              View
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ patient, totalVisits, lastVisitLabel }) => (
            <tr
              key={patient.id}
              className="border-b border-[var(--color-border)] last:border-b-0"
            >
              <td className="py-4 pl-1 align-top">
                <button
                  type="button"
                  onClick={() => openPatient(patient)}
                  className="flex items-center gap-3 text-left"
                >
                  <Avatar initials={patient.initials} size={34} />
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-bold text-[var(--color-ink)] hover:text-[var(--color-teal)] hover:underline">
                      {patient.name}
                    </div>
                    {patient.age && (
                      <div className="truncate text-[12px] text-[var(--color-muted)]">
                        Age {patient.age}
                      </div>
                    )}
                  </div>
                </button>
              </td>
              <td className="py-4 align-top">
                <span className="text-[13px] text-[var(--color-ink)]">
                  {formatPhoneDisplay(patient.phone)}
                </span>
              </td>
              <td className="py-4 align-top">
                <span
                  className={
                    lastVisitLabel === "—"
                      ? "text-[13px] text-[var(--color-muted-soft)]"
                      : "text-[13px] text-[var(--color-ink)]"
                  }
                >
                  {lastVisitLabel}
                </span>
              </td>
              <td className="py-4 align-top">
                <span className="text-[13px] font-bold text-[var(--color-ink)]">
                  {totalVisits}
                </span>
              </td>
              <td className="py-4 align-top text-right">
                <button
                  type="button"
                  onClick={() => openPatient(patient)}
                  className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--color-teal)] hover:underline"
                >
                  View
                  <ArrowRight size={13} strokeWidth={2.5} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {/* Cards — mobile. */}
      <div className="space-y-2.5 md:hidden">
        {rows.map(({ patient, totalVisits, lastVisitLabel }) => (
          <button
            key={patient.id}
            type="button"
            onClick={() => openPatient(patient)}
            className="block w-full rounded-lg border border-[var(--color-border)] p-4 text-left"
          >
            <div className="flex items-center gap-3">
              <Avatar initials={patient.initials} size={34} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-bold text-[var(--color-ink)]">
                  {patient.name}
                </div>
                {patient.age && (
                  <div className="truncate text-[12px] text-[var(--color-muted)]">
                    Age {patient.age}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-2.5 text-[13px] text-[var(--color-ink)]">
              {formatPhoneDisplay(patient.phone)}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border)] pt-3">
              <div className="flex items-center gap-3 text-[12.5px] text-[var(--color-muted)]">
                <span>
                  Last visit{" "}
                  <span
                    className={
                      lastVisitLabel === "—"
                        ? "text-[var(--color-muted-soft)]"
                        : "font-semibold text-[var(--color-ink)]"
                    }
                  >
                    {lastVisitLabel}
                  </span>
                </span>
                <span>
                  Visits <span className="font-semibold text-[var(--color-ink)]">{totalVisits}</span>
                </span>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-[var(--color-teal)]">
                View
                <ArrowRight size={12} strokeWidth={2.5} />
              </span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
