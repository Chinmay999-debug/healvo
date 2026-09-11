import { useEffect } from "react";
import { X } from "lucide-react";
import { Sidebar } from "./Sidebar";

/**
 * Below the `lg` breakpoint the always-visible desktop Sidebar is replaced
 * by this drawer — the exact same Sidebar component, temporarily brought
 * into view, rather than a second navigation implementation. Mirrors the
 * shared Modal's conventions (dark overlay backdrop, Escape to close, no
 * enter/exit animation) so it feels native to the rest of Healvo.
 */
export function MobileNavDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
      <div className="relative flex h-full w-[264px] max-w-[80vw] shrink-0 flex-col bg-[var(--color-surface-raised)] shadow-xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close navigation menu"
          className="absolute right-3 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-muted)] outline-none transition-colors hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-teal)]/50"
        >
          <X size={18} />
        </button>
        <Sidebar
          collapsed={false}
          onToggle={onClose}
          onNavigate={onClose}
          showCollapseToggle={false}
        />
      </div>
      <div
        className="flex-1 bg-[var(--color-overlay)]"
        onClick={onClose}
        aria-hidden="true"
      />
    </div>
  );
}
