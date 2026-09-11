export type ToothType =
  | "central-incisor"
  | "lateral-incisor"
  | "canine"
  | "first-premolar"
  | "second-premolar"
  | "first-molar"
  | "second-molar"
  | "third-molar";

export interface ToothMeta {
  /** FDI two-digit notation, e.g. "46". */
  fdi: string;
  type: ToothType;
  arch: "upper" | "lower";
  quadrant: 1 | 2 | 3 | 4;
  /** Position along the chart, left to right: 0..15 within its arch row. */
  index: number;
}

const TYPE_BY_POSITION: ToothType[] = [
  "central-incisor",
  "lateral-incisor",
  "canine",
  "first-premolar",
  "second-premolar",
  "first-molar",
  "second-molar",
  "third-molar",
];

export const TOOTH_TYPE_LABEL: Record<ToothType, string> = {
  "central-incisor": "Central incisor",
  "lateral-incisor": "Lateral incisor",
  canine: "Canine",
  "first-premolar": "First premolar",
  "second-premolar": "Second premolar",
  "first-molar": "First molar",
  "second-molar": "Second molar",
  "third-molar": "Third molar (wisdom)",
};

function quadrantRow(quadrant: 1 | 2 | 3 | 4, arch: "upper" | "lower", order: number[], offset: number) {
  return order.map((position, i) => ({
    fdi: `${quadrant}${position}`,
    type: TYPE_BY_POSITION[position - 1],
    arch,
    quadrant,
    index: offset + i,
  }));
}

// Chart left-to-right = patient's right side first, matching standard
// clinical (radiographic) orientation: 18 17 16 15 14 13 12 11 | 21 22 23 24 25 26 27 28
export const UPPER_ARCH: ToothMeta[] = [
  ...quadrantRow(1, "upper", [8, 7, 6, 5, 4, 3, 2, 1], 0),
  ...quadrantRow(2, "upper", [1, 2, 3, 4, 5, 6, 7, 8], 8),
];

// 48 47 46 45 44 43 42 41 | 31 32 33 34 35 36 37 38
export const LOWER_ARCH: ToothMeta[] = [
  ...quadrantRow(4, "lower", [8, 7, 6, 5, 4, 3, 2, 1], 0),
  ...quadrantRow(3, "lower", [1, 2, 3, 4, 5, 6, 7, 8], 8),
];

export const ALL_TEETH: ToothMeta[] = [...UPPER_ARCH, ...LOWER_ARCH];

export function findTooth(fdi: string): ToothMeta | undefined {
  return ALL_TEETH.find((t) => t.fdi === fdi);
}
