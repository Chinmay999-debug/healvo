import { useMemo, useState } from "react";
import { Plus, CalendarPlus } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { VisitFilters, type VisitFilter } from "../components/today/VisitFilters";
import { VisitTable } from "../components/today/VisitTable";
import { WalkInModal } from "../components/overview/WalkInModal";
import { useClinicData } from "../state/clinicData";
import { useAuth } from "../state/authContext";
import { buildBookingUrl, todayLabel } from "../lib/utils";

export default function Today() {
  const { todaysVisits, setVisitStatus, dataLoading } = useClinicData();
  const { activeClinic } = useAuth();
  const bookingUrl = buildBookingUrl(activeClinic?.slug ?? "");
  const [filter, setFilter] = useState<VisitFilter>("all");
  const [search, setSearch] = useState("");
  const [addPatientOpen, setAddPatientOpen] = useState(false);

  const counts = useMemo(() => {
    return {
      all: todaysVisits.length,
      scheduled: todaysVisits.filter((v) => v.status === "scheduled").length,
      "checked-in": todaysVisits.filter((v) => v.status === "checked-in").length,
      "in-treatment": todaysVisits.filter((v) => v.status === "in-treatment").length,
      completed: todaysVisits.filter((v) => v.status === "completed").length,
      cancelled: todaysVisits.filter((v) => v.status === "cancelled").length,
    };
  }, [todaysVisits]);

  // Compact, real-data summary for the header — never hardcoded. "Upcoming"
  // groups scheduled + checked-in since neither has started treatment yet.
  const summaryLabel = useMemo(() => {
    if (dataLoading) return "Loading your clinic day…";
    const total = todaysVisits.length;
    if (total === 0) return "No visits scheduled today.";
    const segments = [`${total} visit${total === 1 ? "" : "s"}`];
    if (counts.completed > 0) segments.push(`${counts.completed} completed`);
    if (counts["in-treatment"] > 0) {
      segments.push(`${counts["in-treatment"]} in treatment`);
    }
    const upcoming = counts.scheduled + counts["checked-in"];
    if (upcoming > 0) segments.push(`${upcoming} upcoming`);
    return segments.join(" · ");
  }, [todaysVisits.length, counts, dataLoading]);

  const visibleVisits = useMemo(() => {
    return todaysVisits.filter((v) => {
      const matchesFilter = filter === "all" || v.status === filter;
      const matchesSearch = v.patientName
        .toLowerCase()
        .includes(search.trim().toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [todaysVisits, filter, search]);

  function openBookingPage() {
    window.open(bookingUrl.path, "_blank", "noopener,noreferrer");
  }

  return (
    <AppShell crumb="Today">
      <PageHeader
        dateLabel={todayLabel()}
        title="Today"
        subtitle={summaryLabel}
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <Button variant="secondary" onClick={() => setAddPatientOpen(true)}>
              <Plus size={15} strokeWidth={2.5} />
              Add patient
            </Button>
            <Button variant="primary" onClick={openBookingPage}>
              <CalendarPlus size={15} strokeWidth={2.25} />
              Book appointment
            </Button>
          </div>
        }
      />

      <Card className="mt-6 p-0">
        <VisitFilters
          active={filter}
          onChange={setFilter}
          counts={counts}
          search={search}
          onSearchChange={setSearch}
        />
        <div className="px-5 pt-3 pb-5">
          <VisitTable
            visits={visibleVisits}
            hasAnyVisitsToday={todaysVisits.length > 0}
            loading={dataLoading}
            search={search}
            onStatusChange={setVisitStatus}
            onAddPatient={() => setAddPatientOpen(true)}
            onBookAppointment={openBookingPage}
          />
        </div>
      </Card>

      <WalkInModal open={addPatientOpen} onClose={() => setAddPatientOpen(false)} />
    </AppShell>
  );
}
