import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { PatientFilters, type PatientFilter } from "../components/patients/PatientFilters";
import { PatientTable } from "../components/patients/PatientTable";
import { AddPatientModal } from "../components/patients/AddPatientModal";
import { useClinicData } from "../state/clinicData";
import { phoneMatches } from "../lib/phone";
import { dateFromISO, shortDateLabel } from "../lib/utils";
import type { VisitStatus } from "../data/mockData";

// A visit counts toward "last visit" / new-vs-returning once the patient has
// actually shown up — a purely future "scheduled" appointment doesn't.
const HAPPENED_STATUSES: VisitStatus[] = ["checked-in", "in-treatment", "completed"];

export default function Patients() {
  const { patients, visits, dataLoading } = useClinicData();
  const [filter, setFilter] = useState<PatientFilter>("all");
  const [search, setSearch] = useState("");
  const [addPatientOpen, setAddPatientOpen] = useState(false);

  const rows = useMemo(() => {
    return patients.map((patient) => {
      const patientVisits = visits.filter((v) => v.patientId === patient.id);

      // Last Visit reflects every visit record — it must always show a date
      // when the patient has any visits at all, so it never disagrees with
      // the Visits count.
      const allDates = patientVisits
        .map((v) => v.date)
        .filter((d): d is string => Boolean(d))
        .sort();
      const lastVisitIso = allDates.at(-1) ?? null;

      // New-vs-returning classification stays based on visits that actually
      // happened (a purely future "scheduled" appointment doesn't make a
      // patient "returning") — unaffected by the Last Visit fix above.
      const hasHappenedVisit = patientVisits.some(
        (v) => HAPPENED_STATUSES.includes(v.status) && v.date,
      );

      return {
        patient,
        totalVisits: patientVisits.length,
        lastVisitLabel: lastVisitIso
          ? shortDateLabel(dateFromISO(lastVisitIso))
          : "—",
        isReturning: hasHappenedVisit,
      };
    });
  }, [patients, visits]);

  const counts = useMemo(() => {
    return {
      all: rows.length,
      new: rows.filter((r) => !r.isReturning).length,
      returning: rows.filter((r) => r.isReturning).length,
    };
  }, [rows]);

  const visibleRows = useMemo(() => {
    const query = search.trim();
    return rows.filter((r) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "new" && !r.isReturning) ||
        (filter === "returning" && r.isReturning);
      const matchesSearch =
        !query ||
        r.patient.name.toLowerCase().includes(query.toLowerCase()) ||
        phoneMatches(r.patient.phone, query);
      return matchesFilter && matchesSearch;
    });
  }, [rows, filter, search]);

  return (
    <AppShell crumb="Patients">
      <PageHeader
        title={
          <>
            Patients
            <Badge tone="mint">{patients.length}</Badge>
          </>
        }
        subtitle="Manage your clinic's patients."
        actions={
          <Button variant="primary" onClick={() => setAddPatientOpen(true)}>
            <Plus size={15} strokeWidth={2.5} />
            Add patient
          </Button>
        }
      />

      <Card className="mt-6 p-0">
        <PatientFilters
          active={filter}
          onChange={setFilter}
          counts={counts}
          search={search}
          onSearchChange={setSearch}
        />
        <div className={visibleRows.length > 0 ? "px-5 pt-3 pb-5" : ""}>
          <PatientTable
            rows={visibleRows}
            hasAnyPatients={patients.length > 0}
            loading={dataLoading}
            onAddPatient={() => setAddPatientOpen(true)}
          />
        </div>
      </Card>

      <AddPatientModal open={addPatientOpen} onClose={() => setAddPatientOpen(false)} />
    </AppShell>
  );
}
