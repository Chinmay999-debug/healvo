import { useEffect, useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { todayISO } from "../../lib/utils";
import type { CustomRange } from "../../lib/reportPeriod";

export function CustomRangeModal({
  open,
  initialRange,
  onClose,
  onApply,
}: {
  open: boolean;
  initialRange: CustomRange | null;
  onClose: () => void;
  onApply: (range: CustomRange) => void;
}) {
  const today = todayISO();
  const [from, setFrom] = useState(initialRange?.from ?? today);
  const [to, setTo] = useState(initialRange?.to ?? today);

  useEffect(() => {
    if (open) {
      setFrom(initialRange?.from ?? today);
      setTo(initialRange?.to ?? today);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const invalid = !from || !to || from > to;

  return (
    <Modal open={open} onClose={onClose} title="Custom range" className="max-w-xs">
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-[var(--color-muted)]">From</span>
          <input
            type="date"
            value={from}
            max={today}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-[var(--color-border-strong)] px-3 py-2 text-[13.5px] text-[var(--color-ink)] outline-none focus:border-[var(--color-teal)]"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-[var(--color-muted)]">To</span>
          <input
            type="date"
            value={to}
            max={today}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-[var(--color-border-strong)] px-3 py-2 text-[13.5px] text-[var(--color-ink)] outline-none focus:border-[var(--color-teal)]"
          />
        </label>

        <div className="mt-1 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={invalid}
            onClick={() => onApply({ from, to })}
          >
            Apply
          </Button>
        </div>
      </div>
    </Modal>
  );
}
