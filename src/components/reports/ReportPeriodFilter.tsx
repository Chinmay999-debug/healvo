import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";
import {
  REPORT_PERIOD_OPTIONS,
  formatPeriodRangeLabel,
  getPeriodRange,
  type CustomRange,
  type ReportPeriodKey,
} from "../../lib/reportPeriod";
import { CustomRangeModal } from "./CustomRangeModal";

export function ReportPeriodFilter({
  period,
  customRange,
  onChange,
}: {
  period: ReportPeriodKey;
  customRange: CustomRange | null;
  onChange: (period: ReportPeriodKey, customRange: CustomRange | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [customModalOpen, setCustomModalOpen] = useState(false);
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

  const activeOption =
    REPORT_PERIOD_OPTIONS.find((o) => o.key === period) ?? REPORT_PERIOD_OPTIONS[2];

  const buttonLabel =
    period === "custom" && customRange
      ? formatPeriodRangeLabel(getPeriodRange("custom", customRange))
      : activeOption.label;

  return (
    <div className="relative" ref={containerRef}>
      <Button
        variant="outline"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {buttonLabel}
        <ChevronDown size={14} strokeWidth={2.5} />
      </Button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-30 mt-1.5 w-48 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-1 shadow-lg"
        >
          {REPORT_PERIOD_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              role="option"
              aria-selected={period === option.key}
              onClick={() => {
                setOpen(false);
                if (option.key === "custom") {
                  setCustomModalOpen(true);
                } else {
                  onChange(option.key, null);
                }
              }}
              className={cn(
                "flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-[13px] font-semibold transition-colors hover:bg-[var(--color-canvas)]",
                period === option.key ? "text-[var(--color-teal)]" : "text-[var(--color-ink)]",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      <CustomRangeModal
        open={customModalOpen}
        initialRange={customRange}
        onClose={() => setCustomModalOpen(false)}
        onApply={(range) => {
          onChange("custom", range);
          setCustomModalOpen(false);
        }}
      />
    </div>
  );
}
