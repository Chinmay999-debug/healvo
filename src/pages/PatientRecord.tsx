import { Outlet, useNavigate, useParams } from "react-router-dom";
import { Users } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { PatientRecordHeader } from "../components/patient-record/PatientRecordHeader";
import { PatientRecordNav } from "../components/patient-record/PatientRecordNav";
import { useClinicData } from "../state/clinicData";

export default function PatientRecord() {
  const { patientId } = useParams<{ patientId: string }>();
  const { patients, dataLoading } = useClinicData();
  const navigate = useNavigate();
  const patient = patients.find((p) => p.id === patientId);

  if (!patient && dataLoading) {
    return (
      <AppShell crumb="Loading…">
        <p className="px-2 py-10 text-center text-[13.5px] text-[var(--color-muted)]">
          Loading patient record…
        </p>
      </AppShell>
    );
  }

  if (!patient) {
    return (
      <AppShell crumb="Patient not found">
        <Card className="flex flex-col items-center justify-center gap-3 px-8 py-24 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-mint-bg)] text-[var(--color-teal)]">
            <Users size={22} strokeWidth={2} />
          </div>
          <h1 className="text-[18px] font-bold text-[var(--color-ink)]">Patient not found</h1>
          <p className="max-w-sm text-[13.5px] text-[var(--color-muted)]">
            We couldn&apos;t find a patient with this ID. They may have been removed.
          </p>
          <Button variant="primary" className="mt-1" onClick={() => navigate("/patients")}>
            Back to patients
          </Button>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell crumb={patient.name}>
      <PatientRecordHeader patient={patient} />
      <div className="mt-4">
        <PatientRecordNav patientId={patient.id} />
      </div>
      <div className="mt-6">
        <Outlet context={{ patient }} />
      </div>
    </AppShell>
  );
}
