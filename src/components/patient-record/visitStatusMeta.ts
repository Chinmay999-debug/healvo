import type { BadgeTone } from "../ui/Badge";
import type { VisitStatus } from "../../data/mockData";

// Mirrors the status → label/tone mapping in components/today/VisitStatusBadge —
// duplicated (not imported) since that component's map isn't exported and this
// usage is read-only (no status-change dropdown here).
export const VISIT_STATUS_META: Record<VisitStatus, { label: string; tone: BadgeTone }> = {
  scheduled: { label: "Scheduled", tone: "slate" },
  "checked-in": { label: "Checked in", tone: "blue" },
  "in-treatment": { label: "In treatment", tone: "amber" },
  completed: { label: "Completed", tone: "mint" },
  cancelled: { label: "Cancelled", tone: "slate" },
};
