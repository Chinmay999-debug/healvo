import { useEffect, useRef, useState } from "react";
import { Camera as CameraIcon, RotateCcw } from "lucide-react";
import { Button } from "../ui/Button";

/** Live device-camera capture with a retake/use-photo preview step. Requests
 * getUserMedia on mount and tears the stream down on unmount — works the
 * same way on desktop webcams and mobile device cameras. */
export function CameraCapture({
  onCapture,
  onCancel,
  onUseFileInstead,
}: {
  onCapture: (file: File) => void;
  onCancel: () => void;
  onUseFileInstead: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera access isn't available. You can upload a file instead.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        if (!cancelled) {
          setError("Camera access isn't available. You can upload a file instead.");
        }
      }
    }

    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setCapturedBlob(blob);
        setCapturedUrl(URL.createObjectURL(blob));
      },
      "image/jpeg",
      0.9,
    );
  }

  function retake() {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedUrl(null);
    setCapturedBlob(null);
  }

  function usePhoto() {
    if (!capturedBlob) return;
    onCapture(new File([capturedBlob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" }));
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-amber-bg)] text-[var(--color-amber-text)]">
          <CameraIcon size={18} strokeWidth={2} />
        </div>
        <h3 className="text-[14px] font-bold text-[var(--color-ink)]">
          Camera access isn&apos;t available
        </h3>
        <p className="max-w-xs text-[12.5px] text-[var(--color-muted)]">
          You can upload a file instead.
        </p>
        <div className="mt-2 flex gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Back
          </Button>
          <Button variant="primary" onClick={onUseFileInstead}>
            Upload from files
          </Button>
        </div>
      </div>
    );
  }

  if (capturedUrl) {
    return (
      <div>
        <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)]">
          <img
            src={capturedUrl}
            alt="Captured document"
            className="max-h-72 w-full object-contain"
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={retake}>
            <RotateCcw size={14} strokeWidth={2.25} />
            Retake
          </Button>
          <Button variant="primary" onClick={usePhoto}>
            Use photo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="max-h-72 w-full object-contain"
        />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" onClick={capture}>
          <CameraIcon size={14} strokeWidth={2.25} />
          Capture
        </Button>
      </div>
    </div>
  );
}
