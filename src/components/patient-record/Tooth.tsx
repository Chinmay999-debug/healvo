import type { KeyboardEvent } from "react";
import type { ToothStatus } from "../../data/mockData";
import type { ToothMeta } from "./dentalChartData";
import { TOOTH_SHAPES } from "./toothShapes";
import { TOOTH_STATUS_STYLE, toothFillGradientId } from "./toothStatusMeta";

const HALF_W = 16;
const HALF_H = 24;

/** A single tooth crown, positioned and rotated along its arch by the
 * caller. Purely presentational + interaction — status colors, gradients
 * and shape data all come from lookup tables so this stays data-driven. */
export function Tooth({
  meta,
  status,
  hasNote,
  selected,
  x,
  y,
  rotation,
  onSelect,
}: {
  meta: ToothMeta;
  status: ToothStatus;
  hasNote: boolean;
  selected: boolean;
  x: number;
  y: number;
  rotation: number;
  onSelect: (fdi: string) => void;
}) {
  const style = TOOTH_STATUS_STYLE[status];
  const shape = TOOTH_SHAPES[meta.type];
  const flip = meta.arch === "lower";
  const labelY = meta.arch === "upper" ? -34 : 35;
  const strokeWidth = (style.strokeWidth ?? 1.6) + (selected ? 1 : 0);

  function handleKeyDown(e: KeyboardEvent<SVGGElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(meta.fdi);
    }
  }

  return (
    <g
      transform={`translate(${x}, ${y}) rotate(${rotation})`}
      className="group cursor-pointer outline-none"
      tabIndex={0}
      role="button"
      aria-label={`Tooth ${meta.fdi}, ${status.replace("-", " ")}`}
      aria-pressed={selected}
      onClick={() => onSelect(meta.fdi)}
      onKeyDown={handleKeyDown}
    >
      {/* Selected halo — a soft, tight glow sitting close behind the crown,
          not a separate floating object; the tooth's own stronger outline
          (below) carries most of the "selected" emphasis. */}
      {selected && <circle cx={0} cy={0} r={25} fill="url(#tooth-selected-halo)" />}

      {/* Keyboard focus ring — subtle teal, no browser-default outline. */}
      <circle
        cx={0}
        cy={0}
        r={31}
        strokeWidth={3}
        className="fill-none stroke-[var(--color-teal)] opacity-0 transition-opacity group-focus-visible:opacity-60"
      />

      <g
        transform={flip ? `translate(${-HALF_W},${HALF_H}) scale(1,-1)` : `translate(${-HALF_W},${-HALF_H})`}
        style={selected ? { filter: "url(#tooth-elevate)" } : undefined}
        className="transition-transform"
      >
        <path
          d={shape.crown}
          fill={status === "missing" ? "none" : `url(#${toothFillGradientId(status)})`}
          stroke={style.stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={style.dashed ? "3.5 3" : undefined}
          strokeLinejoin="round"
          opacity={style.faded ? 0.6 : 1}
        />
        {status !== "missing" && (
          <path
            d={shape.anatomy}
            fill="none"
            stroke="#d8d3c6"
            strokeWidth={0.9}
            strokeLinecap="round"
            opacity={0.55}
          />
        )}
      </g>

      {hasNote && status !== "missing" && (
        <circle cx={19} cy={-20} r={3.4} className="fill-[var(--color-teal)] stroke-white" strokeWidth={1} />
      )}

      <text
        x={0}
        y={labelY}
        textAnchor="middle"
        className="pointer-events-none fill-[var(--color-muted)] text-[10px] font-semibold select-none"
      >
        {meta.fdi}
      </text>
    </g>
  );
}
