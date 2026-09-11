import { useEffect, useRef, useState } from "react";
import {
  LayoutGrid,
  CalendarDays,
  Users,
  Wallet,
  BarChart3,
  UserCircle,
  Settings,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
} from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { Logo } from "../ui/Logo";
import { ClinicSelector } from "./ClinicSelector";
import { cn, initials } from "../../lib/utils";
import { useAuth } from "../../state/authContext";
import { useClinicData } from "../../state/clinicData";

const navItems = [
  { to: "/overview", label: "Overview", icon: LayoutGrid },
  { to: "/today", label: "Today", icon: CalendarDays },
  { to: "/patients", label: "Patients", icon: Users },
  { to: "/billing", label: "Billing", icon: Wallet },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/staff", label: "Staff", icon: UserCircle },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  collapsed,
  onToggle,
  onNavigate,
  showCollapseToggle = true,
}: {
  collapsed: boolean;
  onToggle: () => void;
  /** Called when a nav item is selected — used by the mobile drawer to close
   * itself on navigation. No-op in the desktop, always-visible sidebar. */
  onNavigate?: () => void;
  /** The desktop-only manual expand/collapse control. Hidden inside the
   * mobile drawer, where closing the drawer is the only relevant action. */
  showCollapseToggle?: boolean;
}) {
  const { signOut } = useAuth();
  const { doctorProfile } = useClinicData();
  const displayName = doctorProfile.name || "Your account";
  const displayInitials = initials(displayName) || "?";
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accountMenuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAccountMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("keydown", onKey);
    };
  }, [accountMenuOpen]);

  function handleProfileClick() {
    setAccountMenuOpen(false);
    onNavigate?.();
  }

  function handleLogoutClick() {
    setAccountMenuOpen(false);
    void signOut();
  }

  return (
    <aside
      className={cn(
        "flex h-screen shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-[width] duration-200 ease-out",
        collapsed ? "w-[76px]" : "w-[264px]",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 px-5 pt-6 pb-5",
          collapsed && "justify-center px-0",
        )}
      >
        {collapsed ? (
          <span className="text-[20px] font-extrabold text-[var(--color-teal)]">
            H
          </span>
        ) : (
          <Logo />
        )}
      </div>

      <div className={cn("px-4", collapsed && "px-2.5")}>
        <ClinicSelector collapsed={collapsed} onNavigate={onNavigate} />
      </div>

      <nav className={cn("mt-2 flex-1 space-y-0.5 px-4 py-3", collapsed && "px-2.5")}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium text-[var(--color-muted)] transition-colors hover:bg-[var(--color-canvas)]",
                collapsed && "justify-center px-0",
                isActive &&
                  "bg-[var(--color-mint-bg)] font-semibold text-[var(--color-ink)] hover:bg-[var(--color-mint-bg)]",
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  size={18}
                  strokeWidth={2}
                  className={isActive ? "text-[var(--color-teal)]" : ""}
                />
                {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className={cn("border-t border-[var(--color-border)] px-4 py-4", collapsed && "px-2.5")}>
        <div
          ref={accountMenuRef}
          className={cn(
            "relative flex items-center gap-1",
            collapsed && "justify-center",
          )}
        >
          <div
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1 py-1",
              collapsed && "flex-none justify-center",
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-mint-bg)] text-[12px] font-bold text-[var(--color-teal)]">
              {displayInitials}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-bold text-[var(--color-ink)]">
                  {displayName}
                </div>
                <div className="truncate text-[11.5px] text-[var(--color-muted)]">
                  {doctorProfile.title || "Owner"}
                </div>
              </div>
            )}
          </div>
          {!collapsed && (
            <button
              type="button"
              onClick={() => setAccountMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={accountMenuOpen}
              aria-label="Account options"
              className="shrink-0 rounded-lg p-1.5 text-[var(--color-muted-soft)] outline-none transition-colors hover:bg-[var(--color-canvas)] hover:text-[var(--color-muted)] focus-visible:ring-2 focus-visible:ring-[var(--color-teal)]/50"
            >
              <MoreHorizontal size={16} />
            </button>
          )}

          {accountMenuOpen && (
            <div
              role="menu"
              className="absolute bottom-full left-0 z-40 mb-2 w-56 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-1.5 shadow-lg"
            >
              <Link
                to="/settings/account"
                role="menuitem"
                onClick={handleProfileClick}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas)]"
              >
                <UserCircle size={16} strokeWidth={2} className="text-[var(--color-muted)]" />
                Profile
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={handleLogoutClick}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-[var(--color-danger-text)] transition-colors hover:bg-[var(--color-danger-bg)]"
              >
                <LogOut size={16} strokeWidth={2} />
                Log out
              </button>
            </div>
          )}
        </div>

        {showCollapseToggle && (
          <button
            type="button"
            onClick={onToggle}
            className={cn(
              "mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[12px] font-medium text-[var(--color-muted-soft)] hover:bg-[var(--color-canvas)] hover:text-[var(--color-muted)]",
              collapsed && "justify-center",
            )}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            {!collapsed && "Collapse"}
          </button>
        )}
      </div>
    </aside>
  );
}
