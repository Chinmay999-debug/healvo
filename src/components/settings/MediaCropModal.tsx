import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { cn, getErrorMessage } from "../../lib/utils";
import {
  baseCoverScale,
  clampOffset,
  loadImageFromFile,
  renderCropToBlob,
  MAX_ZOOM,
  MIN_ZOOM,
  type CropTransform,
} from "../../lib/imageCrop";

const VIEWPORT_SIZE = 256;

/** Shared pan/zoom crop modal for both the profile photo (circular frame)
 * and the clinic logo (rounded-square frame) — one fixed-size square
 * viewport IS the crop frame (what's visible inside it is exactly what
 * gets saved, Instagram/Twitter-avatar style), so there's no separate
 * "preview" step: what the user sees while dragging/zooming is the final
 * composition. A single 512x512 output keeps the math (and the saved file)
 * identical for both use cases; only the on-screen mask shape differs. */
export function MediaCropModal({
  open,
  file,
  shape,
  title,
  onCancel,
  onSave,
}: {
  open: boolean;
  file: File | null;
  shape: "circle" | "rounded";
  title: string;
  onCancel: () => void;
  onSave: (blob: Blob) => void | Promise<void>;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [transform, setTransform] = useState<CropTransform>({ offsetX: 0, offsetY: 0, zoom: MIN_ZOOM });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; startOffsetX: number; startOffsetY: number } | null>(null);

  useEffect(() => {
    if (!open || !file) {
      setImage(null);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    loadImageFromFile(file)
      .then((img) => {
        if (cancelled) {
          URL.revokeObjectURL(img.src);
          return;
        }
        objectUrl = img.src;
        setImage(img);
        // Center the image in the frame at the minimum (cover) zoom.
        const scale = baseCoverScale(img, VIEWPORT_SIZE);
        setTransform({
          zoom: MIN_ZOOM,
          offsetX: (VIEWPORT_SIZE - img.naturalWidth * scale) / 2,
          offsetY: (VIEWPORT_SIZE - img.naturalHeight * scale) / 2,
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(getErrorMessage(err, "That file doesn't look like a valid image."));
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, file]);

  const scaledSize = useMemo(() => {
    if (!image) return { width: 0, height: 0 };
    const scale = baseCoverScale(image, VIEWPORT_SIZE) * transform.zoom;
    return { width: image.naturalWidth * scale, height: image.naturalHeight * scale };
  }, [image, transform.zoom]);

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!image) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startOffsetX: transform.offsetX,
      startOffsetY: transform.offsetY,
    };
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId || !image) return;
    const nextX = drag.startOffsetX + (e.clientX - drag.startX);
    const nextY = drag.startOffsetY + (e.clientY - drag.startY);
    setTransform((t) => ({
      ...t,
      offsetX: clampOffset(nextX, VIEWPORT_SIZE, scaledSize.width),
      offsetY: clampOffset(nextY, VIEWPORT_SIZE, scaledSize.height),
    }));
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
  }

  // Zooming keeps the viewport's center point fixed in image-space, so
  // zooming in/out feels anchored rather than yanking the image sideways.
  function setZoom(nextZoom: number) {
    if (!image) return;
    const clampedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
    setTransform((t) => {
      const center = VIEWPORT_SIZE / 2;
      const ratio = clampedZoom / t.zoom;
      const nextOffsetX = center - (center - t.offsetX) * ratio;
      const nextOffsetY = center - (center - t.offsetY) * ratio;
      const scale = baseCoverScale(image, VIEWPORT_SIZE) * clampedZoom;
      return {
        zoom: clampedZoom,
        offsetX: clampOffset(nextOffsetX, VIEWPORT_SIZE, image.naturalWidth * scale),
        offsetY: clampOffset(nextOffsetY, VIEWPORT_SIZE, image.naturalHeight * scale),
      };
    });
  }

  async function handleSave() {
    if (!image) return;
    setSaving(true);
    try {
      const blob = await renderCropToBlob(image, transform, VIEWPORT_SIZE);
      await onSave(blob);
    } catch (err) {
      setLoadError(getErrorMessage(err, "Could not process that image."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onCancel} title={title}>
      {loadError && (
        <div className="mb-4 rounded-lg border border-[var(--color-danger-text)]/25 bg-[var(--color-danger-bg)] px-3 py-2.5 text-[12.5px] text-[var(--color-danger-text)]">
          {loadError}
        </div>
      )}

      {image && (
        <>
          <div className="flex justify-center">
            <div
              className={cn(
                "relative touch-none overflow-hidden border border-[var(--color-border-strong)] bg-[var(--color-canvas)] select-none",
                shape === "circle" ? "rounded-full" : "rounded-2xl",
              )}
              style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <img
                src={image.src}
                alt=""
                draggable={false}
                className="pointer-events-none absolute top-0 left-0 max-w-none"
                style={{
                  width: scaledSize.width,
                  height: scaledSize.height,
                  transform: `translate(${transform.offsetX}px, ${transform.offsetY}px)`,
                }}
              />
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <ZoomOut size={16} className="shrink-0 text-[var(--color-muted)]" />
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={transform.zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              aria-label="Zoom"
              className="w-full accent-[var(--color-teal)]"
            />
            <ZoomIn size={16} className="shrink-0 text-[var(--color-muted)]" />
          </div>
          <p className="mt-2 text-center text-[12px] text-[var(--color-muted-soft)]">
            Drag to reposition &middot; use the slider to zoom
          </p>
        </>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" type="button" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" type="button" onClick={() => void handleSave()} disabled={!image || saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </Modal>
  );
}
