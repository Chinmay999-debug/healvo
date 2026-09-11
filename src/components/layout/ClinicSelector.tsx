import { ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar } from "../ui/Avatar";
import { useAuth } from "../../state/authContext";
import { useClinicData } from "../../state/clinicData";
import { cn, initials } from "../../lib/utils";
import { useSignedMediaUrl } from "../../lib/signedMedia";

const CLINIC_LOGO_BUCKET = "clinic-logos";

export function ClinicSelector({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  /** Called after navigating — used by the mobile drawer to close itself. */
  onNavigate?: () => void;
}) {
  const { activeClinic } = useAuth();
  const { clinicSettings } = useClinicData();
  const clinicName = activeClinic?.name || "Your clinic";
  const location = [clinicSettings.address, clinicSettings.city].filter(Boolean).join(", ");
  const clinicInitial = initials(clinicName)[0] || "?";
  const logoUrl = useSignedMediaUrl(CLINIC_LOGO_BUCKET, clinicSettings.logoPath);

  return (
    <Link
      to="/settings/clinic"
      onClick={onNavigate}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-left outline-none transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-canvas)] focus-visible:ring-2 focus-visible:ring-[var(--color-teal)]/50",
        collapsed && "justify-center px-2",
      )}
    >
      <Avatar initials={clinicInitial} photoUrl={logoUrl} shape="rounded" size={32} className="text-[13px]" />
      {!collapsed && (
        <>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-bold text-[var(--color-ink)]">
              {clinicName}
            </div>
            <div className="truncate text-[12px] text-[var(--color-muted)]">
              {location || "Set up your clinic details"}
            </div>
          </div>
          <ChevronDown size={16} className="shrink-0 text-[var(--color-muted-soft)]" />
        </>
      )}
    </Link>
  );
}
