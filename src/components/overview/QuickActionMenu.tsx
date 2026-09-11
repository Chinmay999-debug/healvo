import { useEffect, useRef, useState } from "react";
import {
  Plus,
  UserRoundPlus,
  Link2,
  Copy,
  Check,
  ExternalLink,
  Receipt,
} from "lucide-react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { WalkInModal } from "./WalkInModal";
import { CreateBillModal } from "../billing/CreateBillModal";
import { useAuth } from "../../state/authContext";
import { buildBookingUrl, cn } from "../../lib/utils";

type ActiveModal = "walk-in" | "booking-link" | "create-bill" | null;

export function QuickActionMenu() {
  const { activeClinic } = useAuth();
  const bookingUrl = buildBookingUrl(activeClinic?.slug ?? "");
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function openModal(modal: Exclude<ActiveModal, null>) {
    setMenuOpen(false);
    setCopied(false);
    setActiveModal(modal);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(bookingUrl.displayUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access unavailable; nothing to fall back to.
    }
  }

  function openBookingPage() {
    window.open(bookingUrl.path, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <div className="relative" ref={containerRef}>
        <Button
          variant="primary"
          onClick={() => setMenuOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <Plus size={15} strokeWidth={2.5} />
          Quick action
        </Button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 z-40 mt-2 w-72 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-1.5 shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => openModal("walk-in")}
              className="flex w-full items-start gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-[var(--color-canvas)]"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-mint-bg)] text-[var(--color-mint-text)]">
                <UserRoundPlus size={16} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold text-[var(--color-ink)]">
                  Walk-in registration
                </div>
                <div className="mt-0.5 text-[12px] leading-snug text-[var(--color-muted)]">
                  Register a patient who has arrived without an appointment.
                </div>
              </div>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => openModal("booking-link")}
              className="flex w-full items-start gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-[var(--color-canvas)]"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-blue-bg)] text-[var(--color-blue-text)]">
                <Link2 size={16} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold text-[var(--color-ink)]">
                  Appointment booking link
                </div>
                <div className="mt-0.5 text-[12px] leading-snug text-[var(--color-muted)]">
                  Get/share the clinic's patient-facing appointment booking link.
                </div>
              </div>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => openModal("create-bill")}
              className="flex w-full items-start gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-[var(--color-canvas)]"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-amber-bg)] text-[var(--color-amber-text)]">
                <Receipt size={16} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold text-[var(--color-ink)]">
                  Create bill
                </div>
                <div className="mt-0.5 text-[12px] leading-snug text-[var(--color-muted)]">
                  Bill a patient for today's visit or any other treatment.
                </div>
              </div>
            </button>
          </div>
        )}
      </div>

      <WalkInModal open={activeModal === "walk-in"} onClose={() => setActiveModal(null)} />

      <CreateBillModal
        open={activeModal === "create-bill"}
        onClose={() => setActiveModal(null)}
      />

      <Modal
        open={activeModal === "booking-link"}
        onClose={() => setActiveModal(null)}
        title="Appointment booking link"
      >
        <p className="text-[13.5px] leading-relaxed text-[var(--color-muted)]">
          Share this link with patients so they can book appointments directly.
        </p>
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] px-3 py-2.5">
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--color-ink)]">
            {bookingUrl.displayUrl}
          </span>
          <button
            type="button"
            onClick={copyLink}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors",
              copied
                ? "border-transparent bg-[var(--color-mint-bg)] text-[var(--color-mint-text)]"
                : "border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-canvas)]",
            )}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>

        <Button variant="outline" className="mt-2.5 w-full justify-center" onClick={openBookingPage}>
          <ExternalLink size={14} strokeWidth={2.25} />
          Open booking page
        </Button>
      </Modal>
    </>
  );
}
