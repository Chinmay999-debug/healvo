import { NavLink } from "react-router-dom";
import { Building2, CalendarClock, Link2, UserCog } from "lucide-react";
import { cn } from "../../lib/utils";

const sections = [
  { key: "clinic", label: "Clinic", icon: Building2 },
  { key: "appointments", label: "Appointments", icon: CalendarClock },
  { key: "booking", label: "Booking", icon: Link2 },
  { key: "account", label: "Account", icon: UserCog },
] as const;

export type SettingsSectionKey = (typeof sections)[number]["key"];
export const SETTINGS_SECTION_KEYS = sections.map((s) => s.key);

export function SettingsNav() {
  return (
    <nav className="space-y-0.5 p-2">
      {sections.map((section) => (
        <NavLink
          key={section.key}
          to={`/settings/${section.key}`}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13.5px] font-medium text-[var(--color-muted)] outline-none transition-colors hover:bg-[var(--color-canvas)] focus-visible:ring-2 focus-visible:ring-[var(--color-teal)]/50",
              isActive &&
                "bg-[var(--color-mint-bg)] font-semibold text-[var(--color-ink)] hover:bg-[var(--color-mint-bg)]",
            )
          }
        >
          {({ isActive }) => (
            <>
              <section.icon
                size={17}
                strokeWidth={2}
                className={isActive ? "text-[var(--color-teal)]" : ""}
              />
              {section.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
