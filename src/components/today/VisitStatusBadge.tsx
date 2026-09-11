import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { Badge, type BadgeTone } from "../ui/Badge";
import { cn } from "../../lib/utils";
import type { VisitStatus } from "../../data/mockData";

const config: Record<VisitStatus, { label: string; tone: BadgeTone }> = {
  scheduled: { label: "Scheduled", tone: "slate" },
  "checked-in": { label: "Checked in", tone: "blue" },
  "in-treatment": { label: "In treatment", tone: "amber" },
  completed: { label: "Completed", tone: "mint" },
  cancelled: { label: "Cancelled", tone: "slate" },
};

const nextStep: Record<VisitStatus, { label: string; status: VisitStatus } | null> = {
  scheduled: { label: "Check in", status: "checked-in" },
  "checked-in": { label: "Start treatment", status: "in-treatment" },
  "in-treatment": { label: "Complete visit", status: "completed" },
  completed: null,
  cancelled: null,
};

// Tone of the status each row's next step would move to — used only for the
// small dot in the dropdown so the menu item previews where it leads.
const nextTone: Record<VisitStatus, BadgeTone> = {
  scheduled: "blue",
  "checked-in": "amber",
  "in-treatment": "mint",
  completed: "slate",
  cancelled: "slate",
};

const MENU_WIDTH = 160;
const MENU_GAP = 6;
const MENU_HEIGHT_ESTIMATE = 48;

interface MenuPosition {
  top?: number;
  bottom?: number;
  left: number;
}

export function VisitStatusBadge({
  status,
  onChange,
}: {
  status: VisitStatus;
  onChange: (status: VisitStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { label, tone } = config[status];
  const action = nextStep[status];

  useLayoutEffect(() => {
    if (!open || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < MENU_HEIGHT_ESTIMATE + MENU_GAP;
    const left = Math.min(rect.left, window.innerWidth - MENU_WIDTH - 8);

    setMenuPos(
      openUpward
        ? { bottom: window.innerHeight - rect.top + MENU_GAP, left }
        : { top: rect.bottom + MENU_GAP, left },
    );
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onScroll() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  if (!action) {
    return <Badge tone={tone}>{label}</Badge>;
  }

  return (
    <div className="relative inline-block" ref={containerRef}>
      <Badge
        tone={tone}
        role="button"
        tabIndex={0}
        title="Change status"
        aria-haspopup="menu"
        aria-expanded={open}
        className="cursor-pointer rounded-md py-1 pr-1.5 pl-2 ring-1 ring-inset ring-transparent transition-[box-shadow,background-color] select-none hover:ring-[var(--color-border-strong)]"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
      >
        {label}
        <ChevronDown
          size={12}
          strokeWidth={2.5}
          className={cn("transition-transform duration-150", open && "rotate-180")}
        />
      </Badge>

      {open &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: "fixed",
              top: menuPos.top,
              bottom: menuPos.bottom,
              left: menuPos.left,
              width: MENU_WIDTH,
            }}
            className="z-50 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-1 shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onChange(action.status);
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-[13px] font-semibold text-[var(--color-ink)] hover:bg-[var(--color-canvas)]"
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: `var(--color-${nextTone[status]}-text)` }}
              />
              {action.label}
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}
