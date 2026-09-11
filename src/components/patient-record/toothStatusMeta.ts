import type { ToothStatus } from "../../data/mockData";

export const TOOTH_STATUS_OPTIONS: { value: ToothStatus; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "needs-attention", label: "Needs attention" },
  { value: "treatment-planned", label: "Treatment planned" },
  { value: "treatment-completed", label: "Treatment completed" },
  { value: "missing", label: "Missing" },
];

export const TOOTH_STATUS_LABEL: Record<ToothStatus, string> = {
  normal: "Normal",
  "needs-attention": "Needs attention",
  "treatment-planned": "Treatment planned",
  "treatment-completed": "Treatment completed",
  missing: "Missing",
};

/** Short phrase used only in the compact chart summary line, e.g.
 * "2 need attention · 1 treatment planned". */
export const TOOTH_STATUS_SUMMARY_PHRASE: Record<Exclude<ToothStatus, "normal">, string> = {
  "needs-attention": "need attention",
  "treatment-planned": "treatment planned",
  "treatment-completed": "treatment completed",
  missing: "missing",
};

/**
 * Every enamel fill is a very subtle two-stop gradient (cervical → incisal)
 * rather than a flat tint — enough to read as a clinical illustration, never
 * enough to look glossy. Gradient defs live once in DentalChart.tsx's <svg>
 * under these ids; Tooth.tsx just references `url(#...)`.
 */
export function toothFillGradientId(status: ToothStatus): string {
  return `tooth-fill-${status}`;
}

export const TOOTH_STATUS_GRADIENT_STOPS: Record<ToothStatus, [string, string]> = {
  normal: ["#f6f1e7", "#fefdfb"],
  "needs-attention": ["#fbe9d2", "#fefaf4"],
  "treatment-planned": ["#f6f1e7", "#fefdfb"],
  "treatment-completed": ["#dcf1e6", "#fbfdfc"],
  missing: ["#fbfaf7", "#fbfaf7"],
};

/** Stroke (and dash/fade) per status — teal for "planned", mint for
 * "completed", restrained on purpose so the crown anatomy always stays
 * legible regardless of status. */
export const TOOTH_STATUS_STYLE: Record<
  ToothStatus,
  { stroke: string; strokeWidth?: number; dashed?: boolean; faded?: boolean }
> = {
  normal: { stroke: "#c7c2b6" },
  "needs-attention": { stroke: "var(--color-amber-text)" },
  "treatment-planned": { stroke: "var(--color-teal)", strokeWidth: 2.1 },
  "treatment-completed": { stroke: "var(--color-mint-text)" },
  missing: { stroke: "var(--color-border-strong)", dashed: true, faded: true },
};
