import { cn } from "../../lib/utils";

/** The one shared avatar-or-fallback renderer — used for the signed-in
 * user's own photo, the clinic logo, and every plain-initials badge
 * (patients, staff, billing rows) alike, so "photo vs. initials" is decided
 * in exactly one place. `shape` (not a className override — this project's
 * `cn` is a plain join, not tailwind-merge, so a caller-supplied rounding
 * class can't reliably beat a hardcoded one) picks the container radius, so
 * both the photo and initials states render inside an identically-shaped
 * container — swapping between them never changes the avatar's silhouette. */
export function Avatar({
  initials,
  photoUrl,
  shape = "circle",
  className,
  size = 36,
}: {
  initials: string;
  /** A resolved, displayable image URL (e.g. from useSignedMediaUrl). When
   * present, renders the photo instead of the initials fallback. */
  photoUrl?: string | null;
  /** "circle" for people (default), "rounded" for clinic identity. */
  shape?: "circle" | "rounded";
  className?: string;
  size?: number;
}) {
  const shapeClass = shape === "rounded" ? "rounded-2xl" : "rounded-full";

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt=""
        className={cn(shapeClass, "object-cover shrink-0", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center bg-[var(--color-mint-bg)] font-bold text-[var(--color-teal)] shrink-0",
        shapeClass,
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(11, Math.round(size * 0.36)),
      }}
    >
      {initials}
    </div>
  );
}
