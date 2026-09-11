import { useMemo, useState } from "react";
import { UserRoundPlus } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { StaffFilters, type StaffFilter } from "../components/staff/StaffFilters";
import { StaffTable } from "../components/staff/StaffTable";
import { AddStaffModal } from "../components/staff/AddStaffModal";
import { useClinicData } from "../state/clinicData";
import { phoneMatches } from "../lib/phone";

export default function Staff() {
  const { staff, dataLoading } = useClinicData();
  const [filter, setFilter] = useState<StaffFilter>("all");
  const [search, setSearch] = useState("");
  const [addStaffOpen, setAddStaffOpen] = useState(false);

  const counts = useMemo(() => {
    return {
      all: staff.length,
      doctor: staff.filter((m) => m.role === "Doctor").length,
      reception: staff.filter((m) => m.role === "Reception").length,
    };
  }, [staff]);

  const visibleMembers = useMemo(() => {
    const query = search.trim();
    return staff.filter((member) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "doctor" && member.role === "Doctor") ||
        (filter === "reception" && member.role === "Reception");
      const matchesSearch =
        !query ||
        member.name.toLowerCase().includes(query.toLowerCase()) ||
        phoneMatches(member.phone, query);
      return matchesFilter && matchesSearch;
    });
  }, [staff, filter, search]);

  return (
    <AppShell crumb="Staff">
      <PageHeader
        title={
          <>
            Staff
            <Badge tone="mint">{staff.length}</Badge>
          </>
        }
        subtitle="Manage your clinic's team and access."
        actions={
          <Button variant="primary" onClick={() => setAddStaffOpen(true)}>
            <UserRoundPlus size={15} strokeWidth={2.5} />
            Add staff
          </Button>
        }
      />

      <Card className="mt-6 p-0">
        <StaffFilters
          active={filter}
          onChange={setFilter}
          counts={counts}
          search={search}
          onSearchChange={setSearch}
        />
        <div className={visibleMembers.length > 0 ? "px-5 pt-3 pb-5" : ""}>
          <StaffTable
            members={visibleMembers}
            hasAnyStaff={staff.length > 0}
            loading={dataLoading}
            onAddStaff={() => setAddStaffOpen(true)}
          />
        </div>
      </Card>

      <AddStaffModal open={addStaffOpen} onClose={() => setAddStaffOpen(false)} />
    </AppShell>
  );
}
