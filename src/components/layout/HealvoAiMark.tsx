/**
 * Healvo AI's visual mark — a speech bubble with a small waveform, reading
 * unmistakably as "AI chat" rather than a generic sparkle/bot-face or
 * literal dental icon. Drawn as a stroke-based line icon (rounded caps/
 * joins) to match the rest of Healvo's lucide-react icon language. Reused
 * at every size: the floating launcher, the chat header, the per-message
 * identity marker, and (larger) the welcome state. Uses currentColor so it
 * inherits whatever teal/white treatment its container already applies.
 */
export function HealvoAiMark({
  size = 20,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="3.5" y="4.5" width="17" height="12.5" rx="5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M8.5 17 L7.7 20.3 L11.5 17.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="9" y1="8.5" x2="9" y2="12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="12" y1="7" x2="12" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="15" y1="8.5" x2="15" y2="12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
