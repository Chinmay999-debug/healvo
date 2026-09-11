import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarPlus, ChevronLeft, Pencil, Receipt } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { CreateBillModal } from "../billing/CreateBillModal";
import { EditPatientModal } from "./EditPatientModal";
import { useClinicData } from "../../state/clinicData";
import { useAuth } from "../../state/authContext";
import { formatPhoneDisplay } from "../../lib/phone";
import { buildBookingUrl, dateFromISO, formatINR, shortDateLabel } from "../../lib/utils";
import type { Patient } from "../../data/mockData";

export function PatientRecordHeader({ patient }: { patient: Patient }) {
  const navigate = useNavigate();
  const { visits, bills } = useClinicData();
  const { activeClinic } = useAuth();
  const bookingUrl = buildBookingUrl(activeClinic?.slug ?? "");
  const [createBillOpen, setCreateBillOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const patientVisits = useMemo(
    () => visits.filter((v) => v.patientId === patient.id),
    [visits, patient.id],
  );
  const patientBills = useMemo(
    () => bills.filter((b) => b.patientId === patient.id),
    [bills, patient.id],
  );

  const visitDates = useMemo(
    () =>
      patientVisits
        .map((v) => v.date)
        .filter((d): d is string => Boolean(d))
        .sort(),
    [patientVisits],
  );
  const firstVisitLabel = useMemo(() => {
    const first = visitDates.at(0);
    return first ? shortDateLabel(dateFromISO(first)) : "—";
  }, [visitDates]);
  const lastVisitLabel = useMemo(() => {
    const last = visitDates.at(-1);
    return last ? shortDateLabel(dateFromISO(last)) : "—";
  }, [visitDates]);

  // Sums what was actually collected (amountPaid), not what was billed —
  // an unpaid or partially-paid bill shouldn't inflate this figure.
  const totalCollected = useMemo(
    () => patientBills.reduce((sum, b) => sum + b.amountPaid, 0),
    [patientBills],
  );

  const metaLine = [patient.age ? `Age ${patient.age}` : null, patient.gender]
    .filter(Boolean)
    .join(" · ");

  function openBookingPage() {
    window.open(bookingUrl.path, "_blank", "noopener,noreferrer");
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate("/patients")}
        className="flex items-center gap-1 text-[13px] font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        <ChevronLeft size={15} strokeWidth={2.5} />
        Patients
      </button>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar initials={patient.initials} size={52} />
          <div>
            <h1 className="text-[22px] font-extrabold tracking-tight text-[var(--color-ink)]">
              {patient.name}
            </h1>
            <div className="mt-0.5 text-[13.5px] text-[var(--color-muted)]">
              {metaLine || "—"}
            </div>
            <div className="text-[13px] text-[var(--color-muted)]">
              {formatPhoneDisplay(patient.phone)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 pt-1">
          <Button variant="outline" onClick={openBookingPage}>
            <CalendarPlus size={15} strokeWidth={2.25} />
            Book appointment
          </Button>
          <Button variant="secondary" onClick={() => setCreateBillOpen(true)}>
            <Receipt size={15} strokeWidth={2.25} />
            Create bill
          </Button>
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil size={14} strokeWidth={2.25} />
            Edit patient
          </Button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-border)] lg:grid-cols-4">
        <Stat label="Visits" value={String(patientVisits.length)} />
        <Stat label="First visit" value={firstVisitLabel} />
        <Stat label="Last visit" value={lastVisitLabel} />
        <Stat label="Total collected" value={formatINR(totalCollected)} />
      </div>

      <CreateBillModal
        open={createBillOpen}
        onClose={() => setCreateBillOpen(false)}
        initialPatient={patient}
      />
      <EditPatientModal open={editOpen} onClose={() => setEditOpen(false)} patient={patient} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--color-surface)] px-5 py-4">
      <div className="text-[11px] font-bold tracking-[0.07em] text-[var(--color-muted)] uppercase">
        {label}
      </div>
      <div className="mt-1 text-[21px] font-extrabold tracking-tight whitespace-nowrap text-[var(--color-ink)]">
        {value}
      </div>
    </div>
  );
}
