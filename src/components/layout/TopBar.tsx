import { Menu } from "lucide-react";
import { Link } from "react-router-dom";
import { Search } from "../ui/Search";
import { Avatar } from "../ui/Avatar";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationBell } from "./NotificationBell";
import { useClinicData } from "../../state/clinicData";
import { initials } from "../../lib/utils";
import { useSignedMediaUrl } from "../../lib/signedMedia";

const AVATAR_BUCKET = "avatars";

export function TopBar({
  crumb,
  mobileNavOpen,
  onMenuClick,
}: {
  crumb: string;
  mobileNavOpen: boolean;
  onMenuClick: () => void;
}) {
  const { doctorProfile } = useClinicData();
  const displayInitials = initials(doctorProfile.name) || "?";
  const avatarPhotoUrl = useSignedMediaUrl(AVATAR_BUCKET, doctorProfile.avatarPath);

  return (
    <header className="flex shrink-0 flex-col border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex h-[64px] items-center justify-between gap-3 px-4 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open navigation menu"
            aria-expanded={mobileNavOpen}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--color-muted)] outline-none transition-colors hover:bg-[var(--color-canvas)] focus-visible:ring-2 focus-visible:ring-[var(--color-teal)]/50 lg:hidden"
          >
            <Menu size={20} strokeWidth={2} />
          </button>

          <div className="flex min-w-0 items-center gap-1.5 text-[13.5px]">
            <span className="hidden shrink-0 text-[var(--color-muted)] sm:inline">Clinic</span>
            <span className="hidden shrink-0 text-[var(--color-muted-soft)] sm:inline">/</span>
            <span className="truncate font-semibold text-[var(--color-ink)]">{crumb}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <Search
            placeholder="Search patients, invoices..."
            className="hidden md:block md:w-48 lg:w-64"
          />

          {/* Bare icon buttons (theme toggle, bell) sit closer together than
              the bordered search box or filled avatar next to them — each
              icon has its own empty inset around the glyph, so the plain
              container gap alone reads as a bigger gap between them than
              around them. This inner gap is tuned smaller to compensate,
              so all three visual gaps land the same. */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell />
          </div>

          <Link
            to="/settings/account"
            aria-label="Account settings"
            className="flex shrink-0 items-center justify-center rounded-full outline-none transition-colors hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--color-teal)]/50"
          >
            <Avatar initials={displayInitials} photoUrl={avatarPhotoUrl} size={36} className="text-[12px] hover:bg-[var(--color-mint-bg-hover)]" />
          </Link>
        </div>
      </div>

      <div className="border-t border-[var(--color-border)] px-4 py-2.5 md:hidden">
        <Search placeholder="Search patients, invoices..." className="w-full" />
      </div>
    </header>
  );
}
