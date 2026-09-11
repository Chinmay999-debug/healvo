import { useEffect, useRef, useState } from "react";
import { Bell, CheckCircle2, Clock, Megaphone, Sparkles, type LucideIcon } from "lucide-react";
import { useNotifications } from "../../state/notifications";
import type { NotificationTone } from "../../data/notifications";
import { relativeTimeLabel } from "../../lib/utils";
import { cn } from "../../lib/utils";

const toneIconMap: Record<NotificationTone, LucideIcon> = {
  mint: Sparkles,
  blue: Megaphone,
  amber: Clock,
};

const toneClassMap: Record<NotificationTone, string> = {
  mint: "bg-[var(--color-mint-bg)] text-[var(--color-mint-text)]",
  blue: "bg-[var(--color-blue-bg)] text-[var(--color-blue-text)]",
  amber: "bg-[var(--color-amber-bg)] text-[var(--color-amber-text)]",
};

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const sorted = [...notifications].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  const showEmptyState = unreadCount === 0;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-muted)] outline-none transition-colors hover:bg-[var(--color-canvas)] focus-visible:ring-2 focus-visible:ring-[var(--color-teal)]/50"
      >
        <Bell size={18} strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#e6584a] px-1 text-[9px] font-bold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-50 mt-2 w-[92vw] max-w-sm overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] shadow-lg sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
            <h2 className="text-[14px] font-bold text-[var(--color-ink)]">Notifications</h2>
            {!showEmptyState && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-[12px] font-semibold text-[var(--color-teal)] outline-none transition-colors hover:text-[var(--color-teal-bright)] focus-visible:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          {showEmptyState ? (
            <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--color-mint-bg)] text-[var(--color-mint-text)]">
                <CheckCircle2 size={20} strokeWidth={2} />
              </div>
              <div>
                <div className="text-[13.5px] font-bold text-[var(--color-ink)]">
                  You're all caught up
                </div>
                <div className="mt-0.5 text-[12.5px] text-[var(--color-muted)]">
                  No new updates from Healvo right now.
                </div>
              </div>
            </div>
          ) : (
            <div className="max-h-[360px] overflow-y-auto">
              {sorted.map((n) => {
                const Icon = toneIconMap[n.tone];
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => markAsRead(n.id)}
                    className="flex w-full items-start gap-3 border-b border-[var(--color-border)] px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[var(--color-canvas)]"
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        toneClassMap[n.tone],
                      )}
                    >
                      <Icon size={15} strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "truncate text-[13px] text-[var(--color-ink)]",
                            n.read ? "font-medium" : "font-bold",
                          )}
                        >
                          {n.title}
                        </span>
                        {!n.read && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-teal)]" />
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-[var(--color-muted)]">
                        {n.message}
                      </p>
                      <div className="mt-1 text-[11px] text-[var(--color-muted-soft)]">
                        {relativeTimeLabel(n.createdAt)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
