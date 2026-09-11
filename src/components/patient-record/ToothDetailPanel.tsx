import { MousePointerClick, X } from "lucide-react";
import { Card } from "../ui/Card";
import { SegmentedControl } from "./SegmentedControl";
import { TOOTH_STATUS_GRADIENT_STOPS, TOOTH_STATUS_OPTIONS, TOOTH_STATUS_STYLE } from "./toothStatusMeta";
import { TOOTH_TYPE_LABEL, type ToothMeta } from "./dentalChartData";
import type { ToothStatus } from "../../data/mockData";

const inputClass =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-[13.5px] text-[var(--color-ink)] outline-none focus:border-[var(--color-teal)] focus:ring-2 focus:ring-[var(--color-teal)]/15";

// Mirrors how each status renders on the tooth itself (outline emphasis for
// "planned", filled mint for "completed", etc.) so the active status pill
// reads as a restrained clinical control rather than a uniform bold teal.
const STATUS_ACTIVE_CLASS: Record<ToothStatus, string> = {
  normal: "border-[var(--color-border-strong)] bg-[var(--color-canvas)] text-[var(--color-ink)]",
  "needs-attention":
    "border-[var(--color-amber-text)] bg-[var(--color-amber-bg)] text-[var(--color-amber-text)]",
  "treatment-planned": "border-[var(--color-teal)] bg-[var(--color-surface)] text-[var(--color-teal)]",
  "treatment-completed":
    "border-[var(--color-mint-text)] bg-[var(--color-mint-bg)] text-[var(--color-mint-text)]",
  missing: "border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-muted-soft)]",
};

/** Compact — status and note commit immediately, no separate save step, so
 * the doctor can find a tooth, set its status, jot a note, and move on. */
export function ToothDetailPanel({
  tooth,
  status,
  note,
  onStatusChange,
  onNoteChange,
  onNoteBlur,
  onClose,
}: {
  tooth: ToothMeta | null;
  status: ToothStatus;
  note: string;
  onStatusChange: (status: ToothStatus) => void;
  onNoteChange: (note: string) => void;
  onNoteBlur: () => void;
  onClose: () => void;
}) {
  if (!tooth) {
    return (
      <Card className="flex h-full flex-col items-center justify-center gap-2.5 px-6 py-14 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-mint-bg)] text-[var(--color-teal)]">
          <MousePointerClick size={18} strokeWidth={2} />
        </div>
        <h2 className="text-[14.5px] font-bold text-[var(--color-ink)]">Select a tooth</h2>
        <p className="max-w-[220px] text-[12.5px] text-[var(--color-muted)]">
          Choose any tooth on the chart to view or update its status.
        </p>
      </Card>
    );
  }

  const statusStyle = TOOTH_STATUS_STYLE[status];
  const [statusFillStart] = TOOTH_STATUS_GRADIENT_STOPS[status];

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] font-bold tracking-[0.08em] text-[var(--color-muted)] uppercase">
            Tooth
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-full border-[1.5px]"
              style={{
                backgroundColor: status === "missing" ? "transparent" : statusFillStart,
                borderColor: statusStyle.stroke,
                borderStyle: statusStyle.dashed ? "dashed" : "solid",
              }}
            />
            <span className="text-[28px] leading-none font-extrabold tracking-tight text-[var(--color-ink)]">
              {tooth.fdi}
            </span>
          </div>
          <div className="mt-1 text-[12.5px] text-[var(--color-muted)]">
            {TOOTH_TYPE_LABEL[tooth.type]}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close tooth details"
          className="shrink-0 rounded-lg p-1 text-[var(--color-muted)] outline-none transition-colors hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-teal)]/50"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mt-5">
        <div className="text-[12px] font-semibold text-[var(--color-muted)]">Status</div>
        <div className="mt-1.5">
          <SegmentedControl
            options={TOOTH_STATUS_OPTIONS}
            value={status}
            onChange={onStatusChange}
            activeClassName={(v) => STATUS_ACTIVE_CLASS[v]}
          />
        </div>
      </div>

      <label className="mt-4 block">
        <span className="text-[12px] font-semibold text-[var(--color-muted)]">Note (optional)</span>
        <textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          onBlur={onNoteBlur}
          placeholder="e.g. Sensitivity to cold, filling needed..."
          rows={3}
          className={`${inputClass} mt-1.5 resize-none`}
        />
      </label>
    </Card>
  );
}
