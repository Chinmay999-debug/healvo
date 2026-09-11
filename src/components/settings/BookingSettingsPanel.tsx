import { useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Toggle } from "../ui/Toggle";
import { useClinicData } from "../../state/clinicData";
import { useAuth } from "../../state/authContext";
import { buildBookingUrl, getErrorMessage } from "../../lib/utils";

// Reuses the clinic's existing public booking route/link — there is only
// ever one booking system (see QuickActionMenu for the identical pattern).
// The link is built from the active clinic's real slug (P4.7) — every
// clinic gets its own correct public URL, not a shared hardcoded one.
export function BookingSettingsPanel() {
  const { clinicSettings, updateClinicSettings } = useClinicData();
  const { activeClinic } = useAuth();
  const bookingUrl = buildBookingUrl(activeClinic?.slug ?? "");
  const [copied, setCopied] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  async function handleToggleOnlineBooking(checked: boolean) {
    setToggleError(null);
    try {
      await updateClinicSettings({ onlineBookingEnabled: checked });
    } catch (err) {
      setToggleError(getErrorMessage(err, "Could not update online booking."));
    }
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
    <Card className="p-5">
      <h2 className="text-[16px] font-bold text-[var(--color-ink)]">Booking</h2>
      <p className="mt-0.5 text-[13px] text-[var(--color-muted)]">
        Manage how patients book appointments online.
      </p>

      <div className="mt-5 flex items-center justify-between gap-4 rounded-lg border border-[var(--color-border)] p-4">
        <div>
          <div className="text-[13.5px] font-bold text-[var(--color-ink)]">Online booking</div>
          <div className="mt-0.5 text-[13px] text-[var(--color-muted)]">
            Allow patients to request appointments online.
          </div>
        </div>
        <Toggle
          checked={clinicSettings.onlineBookingEnabled}
          onChange={(checked) => void handleToggleOnlineBooking(checked)}
          ariaLabel="Online booking"
        />
      </div>
      {toggleError && (
        <p className="mt-2 text-[12.5px] font-semibold text-[var(--color-danger-text)]">
          {toggleError}
        </p>
      )}

      <div className="mt-5">
        <div className="text-[12px] font-semibold text-[var(--color-muted)]">
          Your booking link
        </div>
        <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] px-3 py-2.5">
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--color-ink)]">
            {bookingUrl.displayUrl}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" onClick={copyLink}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy link"}
          </Button>
          <Button variant="outline" onClick={openBookingPage}>
            <ExternalLink size={14} strokeWidth={2.25} />
            Open booking page
          </Button>
        </div>
      </div>
    </Card>
  );
}
