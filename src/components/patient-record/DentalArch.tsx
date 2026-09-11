import type { ToothStatus } from "../../data/mockData";
import { Tooth } from "./Tooth";
import type { ToothMeta } from "./dentalChartData";

const SPACING_X = 50;
const CURVE_DEPTH = 74;
const MAX_ROTATION = 36;
// >1 keeps anterior teeth (centrals, laterals) nearly upright and close to a
// flat line, then accelerates through the canine and out across the
// premolars/molars — a real dental arch curves at the "corner" (canine),
// not evenly across every tooth, so a pure parabola looks too mechanical.
const CURVE_POWER = 1.6;

/** Lays 16 teeth out along a natural dental-arch curve — front teeth sit
 * nearly flat and close to the mouth opening, the canine marks the visible
 * transition into the posterior, and premolars/molars fan progressively
 * outward and recede away from the opening, each rotated to follow the
 * curve tangent. */
export function DentalArch({
  teeth,
  arch,
  centerX,
  baseY,
  getStatus,
  getNote,
  selectedTooth,
  onSelect,
}: {
  teeth: ToothMeta[];
  arch: "upper" | "lower";
  centerX: number;
  baseY: number;
  getStatus: (fdi: string) => ToothStatus;
  getNote: (fdi: string) => string | undefined;
  selectedTooth: string | null;
  onSelect: (fdi: string) => void;
}) {
  return (
    <>
      {teeth.map((meta) => {
        const t = meta.index - 7.5;
        const normalizedT = t / 7.5;
        const curveT = Math.sign(normalizedT) * Math.abs(normalizedT) ** CURVE_POWER;
        const x = centerX + t * SPACING_X;
        const y = arch === "upper" ? baseY + CURVE_DEPTH * (1 - Math.abs(curveT)) : baseY + CURVE_DEPTH * Math.abs(curveT);
        const rotation = curveT * MAX_ROTATION;

        return (
          <Tooth
            key={meta.fdi}
            meta={meta}
            status={getStatus(meta.fdi)}
            hasNote={Boolean(getNote(meta.fdi))}
            selected={selectedTooth === meta.fdi}
            x={x}
            y={y}
            rotation={rotation}
            onSelect={onSelect}
          />
        );
      })}
    </>
  );
}
