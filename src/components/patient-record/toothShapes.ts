import type { ToothType } from "./dentalChartData";

/**
 * Crown silhouette + subtle internal anatomy per tooth type, each in a
 * shared 32×48 local viewBox with the cervical/gumline edge at y=0 and the
 * incisal or occlusal edge at y=48. Proportions vary deliberately by type —
 * incisors are broad flat blades, the canine tapers to a single point,
 * premolars show two cusps with a shallow notch, molars show a broad
 * multi-cusp table with a central fissure — so each type reads as a
 * distinct, recognizable tooth rather than an interchangeable outline.
 *
 * `anatomy` is a stroke-only overlay (developmental grooves / cusp ridges)
 * drawn on top of the crown fill — this is what turns a flat silhouette
 * into something that reads as a clinical illustration rather than an icon.
 * Tooth.tsx flips the whole group vertically for the lower arch; nothing
 * here needs left/right mirroring since every shape is bilaterally
 * symmetric by design.
 */
export interface ToothShape {
  crown: string;
  anatomy: string;
}

export const TOOTH_SHAPES: Record<ToothType, ToothShape> = {
  "central-incisor": {
    crown:
      "M11,3 C11,1.3 13,0 16,0 C19,0 21,1.3 21,3 L22,14 C22.5,25 23,34 21.5,40 C20.4,45 18,48 16,48 C14,48 11.6,45 10.5,40 C9,34 9.5,25 10,14 Z",
    anatomy: "M12,37 L12,43.5 M20,37 L20,43.5",
  },

  "lateral-incisor": {
    crown:
      "M12.5,3 C12.5,1.4 14,0 16,0 C18,0 19.5,1.4 19.5,3 L20.2,12 C20.7,21 21,29 19.8,35 C18.8,41.5 17,48 16,48 C15,48 13.2,41.5 12.2,35 C11,29 11.3,21 11.8,12 Z",
    anatomy: "M16,35 L16,43",
  },

  canine: {
    crown:
      "M11.5,3 C11.5,1.4 13.6,0 16,0 C18.4,0 20.5,1.4 20.5,3 L21.2,18 C21.2,23 19.8,26.5 17.4,31.5 L16,48 L14.6,31.5 C12.2,26.5 10.8,23 10.8,18 Z",
    anatomy: "M16,6 L16,37",
  },

  "first-premolar": {
    crown:
      "M5.5,4 C5.5,1.8 9,0 16,0 C23,0 26.5,1.8 26.5,4 L27.5,17 C28,24.5 27.5,31 25.3,36 C23.8,39.3 20.8,38.7 18.3,36 C17,34.6 15,34.6 13.7,36 C11.2,38.7 8.2,39.3 6.7,36 C4.5,31 4,24.5 4.5,17 Z",
    anatomy: "M12,6 L12,28 M20,6 L20,28 M13,28 L19,28",
  },

  "second-premolar": {
    crown:
      "M6,4 C6,1.8 9.3,0 16,0 C22.7,0 26,1.8 26,4 L27,17 C27.3,23.8 26.7,30 24.6,34.3 C23.2,37.1 20.5,36.2 18.2,34.2 C17,33.1 15,33.1 13.8,34.2 C11.5,36.2 8.8,37.1 7.4,34.3 C5.3,30 4.7,23.8 5,17 Z",
    anatomy: "M13,6 L13,26 M19,6 L19,26 M14,26 L18,26",
  },

  "first-molar": {
    crown:
      "M2.5,5.5 C2.5,2.3 8,0 16,0 C24,0 29.5,2.3 29.5,5.5 L30.2,18 C30.5,25.5 29.5,32 26.8,35.7 C25,38.2 22.5,35.2 20,36.8 C18,38 14,38 12,36.8 C9.5,35.2 7,38.2 5.2,35.7 C2.5,32 1.5,25.5 1.8,18 Z",
    anatomy: "M9,6 L9,28 M16,6 L16,32 M23,6 L23,28 M10,20 L22,20",
  },

  "second-molar": {
    crown:
      "M3.5,5.5 C3.5,2.6 8.7,0 16,0 C23.3,0 28.5,2.6 28.5,5.5 L29,17.5 C29.3,24.5 28.3,30.5 25.7,34 C24,36.3 21.7,33.3 19.4,34.8 C17.7,35.9 14.3,35.9 12.6,34.8 C10.3,33.3 8,36.3 6.3,34 C3.7,30.5 2.7,24.5 3,17.5 Z",
    anatomy: "M10,6 L10,26 M16,6 L16,30 M22,6 L22,26 M11,19 L21,19",
  },

  "third-molar": {
    crown:
      "M6,7 C6,3.6 10,1.2 16,1.2 C22,1.2 26,3.6 26,7 L26.5,17 C26.8,22.5 25.9,27.3 23.6,30 C22,31.9 19.4,29.6 17.1,31 C16.4,31.4 15.6,31.4 14.9,31 C12.6,29.6 10,31.9 8.4,30 C6.1,27.3 5.2,22.5 5.5,17 Z",
    anatomy: "M13,9 L13,22 M19,9 L19,22 M14,21 L18,21",
  },
};
