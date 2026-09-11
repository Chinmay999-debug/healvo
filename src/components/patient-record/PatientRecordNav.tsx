import { NavLink } from "react-router-dom";
import { cn } from "../../lib/utils";

const tabs: { to: string; label: string; end?: boolean }[] = [
  { to: "", label: "Overview", end: true },
  { to: "consultation", label: "Consultation" },
  { to: "dental-chart", label: "Dental chart" },
  { to: "documents", label: "Documents" },
  { to: "history", label: "History" },
  { to: "billing", label: "Billing" },
];

export function PatientRecordNav({ patientId }: { patientId: string }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-[var(--color-border)]">
      {tabs.map((tab) => (
        <NavLink
          key={tab.label}
          to={tab.to ? `/patients/${patientId}/${tab.to}` : `/patients/${patientId}`}
          end={tab.end}
          className={({ isActive }) =>
            cn(
              "shrink-0 border-b-2 px-4 py-3 text-[13.5px] font-semibold whitespace-nowrap transition-colors",
              isActive
                ? "border-[var(--color-teal)] text-[var(--color-ink)]"
                : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]",
            )
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  );
}
