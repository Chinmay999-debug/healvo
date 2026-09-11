// Shared client-side image validation + crop rendering for MediaCropModal.
// No cropping library — this is plain <canvas> + pointer-drag math, which
// keeps the modal itself fully styleable with Healvo's own components
// (Modal/Button) instead of a generic third-party cropper UI.

export const MAX_SOURCE_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB — generous for a phone photo
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const ACCEPTED_IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

// Fixed output frame for both the profile photo and the clinic logo — see
// MediaCropModal's doc comment for why a single square works for both.
export const CROP_OUTPUT_SIZE = 512;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return "Please choose a JPG, PNG, or WEBP image.";
  }
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    return "That image is too large. Choose one under 8MB.";
  }
  return null;
}

/** The returned image's `.src` is an object URL the caller must revoke
 * (e.g. on modal close/unmount) once it's done being displayed — it stays
 * alive here since the crop modal renders this exact element's `src`
 * directly, not just its decoded pixel data. */
export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file doesn't look like a valid image."));
    };
    img.src = url;
  });
}

export interface CropTransform {
  /** CSS-pixel offset of the image's top-left corner within the square
   * viewport, at the current zoom. */
  offsetX: number;
  offsetY: number;
  /** 1 = image just covers the viewport (no gaps); up to MAX_ZOOM. */
  zoom: number;
}

/** The scale (viewport CSS px per natural image px) at zoom = 1: just
 * covers the square viewport, same rule as CSS `object-fit: cover`. */
export function baseCoverScale(img: HTMLImageElement, viewportSize: number): number {
  return Math.max(viewportSize / img.naturalWidth, viewportSize / img.naturalHeight);
}

/** Clamps a pan offset so the (zoomed) image always fully covers the
 * viewport on both axes — the user can never pan to reveal empty space. */
export function clampOffset(
  offset: number,
  viewportSize: number,
  scaledImageSize: number,
): number {
  const minOffset = viewportSize - scaledImageSize; // negative or zero
  return Math.min(0, Math.max(minOffset, offset));
}

/** Renders the current crop selection to a square JPEG blob at
 * CROP_OUTPUT_SIZE — the deterministic, final composition every surface in
 * the app displays (never relies on CSS object-fit at render time). */
export function renderCropToBlob(
  img: HTMLImageElement,
  transform: CropTransform,
  viewportSize: number,
): Promise<Blob> {
  const scale = baseCoverScale(img, viewportSize) * transform.zoom;
  // Natural-image-pixel rectangle visible inside the viewport window.
  const sx = -transform.offsetX / scale;
  const sy = -transform.offsetY / scale;
  const sSize = viewportSize / scale;

  const canvas = document.createElement("canvas");
  canvas.width = CROP_OUTPUT_SIZE;
  canvas.height = CROP_OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas isn't supported in this browser."));

  ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, CROP_OUTPUT_SIZE, CROP_OUTPUT_SIZE);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not process that image."))),
      "image/jpeg",
      0.9,
    );
  });
}
