import { cn } from "../../lib/utils";
import { TOOTH_STATUS_GRADIENT_STOPS, TOOTH_STATUS_OPTIONS, TOOTH_STATUS_STYLE } from "./toothStatusMeta";

/** Deliberately quiet — the teeth are the hero, this is just a footnote
 * explaining the status colors, not a competing UI element. */
export function DentalChartLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {TOOTH_STATUS_OPTIONS.map((option) => {
        const style = TOOTH_STATUS_STYLE[option.value];
        const [fillStart] = TOOTH_STATUS_GRADIENT_STOPS[option.value];
        return (
          <div key={option.value} className="flex items-center gap-1.5">
            <span
              className={cn("h-2.5 w-2.5 shrink-0 rounded-full border-[1.5px]", style.dashed && "border-dashed")}
              style={{
                backgroundColor: option.value === "missing" ? "transparent" : fillStart,
                borderColor: style.stroke,
                opacity: style.faded ? 0.65 : 1,
              }}
            />
            <span className="text-[11.5px] text-[var(--color-muted)]">{option.label}</span>
          </div>
        );
      })}
    </div>
  );
}
