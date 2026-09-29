import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Lock, SendHorizontal, X } from "lucide-react";
import { useClinicData } from "../../state/clinicData";
import { useAuth } from "../../state/authContext";
import { useSubscription } from "../../state/subscriptionContext";
import { getClinicEntitlements } from "../../services/subscription";
import { supabase } from "../../lib/supabaseClient";
import { buildHealvoAiContext } from "../../lib/aiContext";
import { cn } from "../../lib/utils";
import { HealvoAiMark } from "./HealvoAiMark";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_PROMPTS = [
  "What's happening today?",
  "Who is waiting right now?",
  "Show me today's schedule",
  "How much did we collect today?",
];

const GENERIC_ERROR = "Sorry, I couldn't reach Healvo AI right now. Please try again.";

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Derives a short greeting name from the editable doctor profile — e.g.
 * "Dr. Ananya Sharma" -> "Dr. Ananya" — rather than hardcoding one. */
function getGreetingName(fullName: string) {
  const match = fullName.match(/^(Dr\.?\s+\w+)/i);
  return match ? match[1] : fullName.split(" ")[0];
}

export type AiAccess = "enabled" | "locked" | "hidden";

/** The last entitlement lookup that actually resolved, tagged with its clinic. */
export interface AiLookup {
  clinicId: string;
  result: boolean | "error";
}

/**
 * Presentation only: the server (/api/ai/chat -> has_entitlement) is the real
 * gate. Trial/Premium see the assistant, a clinic without the AI entitlement
 * (Core) sees a locked launcher with the Premium upgrade, and anything else
 * (no access, nothing resolved yet for this clinic, lookup failed) shows nothing.
 * A lookup for a different clinic is never reused.
 */
export function resolveAiAccess(state: {
  loading: boolean;
  hasAccess: boolean;
  clinicId: string | undefined;
  lookup: AiLookup | null;
}): AiAccess {
  const { loading, hasAccess, clinicId, lookup } = state;
  if (loading || !hasAccess || !clinicId || !lookup || lookup.clinicId !== clinicId) return "hidden";
  if (lookup.result === "error") return "hidden";
  return lookup.result ? "enabled" : "locked";
}

/**
 * Every page renders its own AppShell, so this widget remounts on navigation.
 * The last lookup that resolved is kept here so a remount starts from the
 * known state instead of flashing hidden. It is still re-read on every mount
 * and subscription change, and never applied to a different clinic.
 */
let lastResolvedLookup: AiLookup | null = null;

function useAiAccess(): AiAccess {
  const { activeClinic } = useAuth();
  const { subscription, hasAccess, loading } = useSubscription();
  const clinicId = activeClinic?.id;
  const [lookup, setLookup] = useState<AiLookup | null>(() => lastResolvedLookup);

  useEffect(() => {
    if (!clinicId) return;
    let cancelled = false;
    // No reset while this runs: the previous resolved result stays on screen
    // (visible, locked or hidden) and is replaced only when this lookup settles.
    // It's re-read on every subscription change, so it's never stale for long.
    getClinicEntitlements(clinicId)
      .then((entitlements) => {
        const resolved: AiLookup = { clinicId, result: entitlements.aiAssistant };
        lastResolvedLookup = resolved;
        if (!cancelled) setLookup(resolved);
      })
      .catch(() => {
        const failed: AiLookup = { clinicId, result: "error" };
        lastResolvedLookup = failed;
        if (!cancelled) setLookup(failed);
      });
    return () => {
      cancelled = true;
    };
    // Re-read whenever the subscription changes (upgrade, renewal, expiry).
  }, [clinicId, subscription]);

  return resolveAiAccess({ loading, hasAccess, clinicId, lookup });
}

/**
 * Global floating Healvo AI launcher. Mounted once in AppShell so it's
 * available on every clinic page without navigating away from the current
 * route. Replaces the old sidebar "Healvo AI" card.
 */
export function HealvoAiWidget() {
  const access = useAiAccess();
  if (access === "enabled") return <HealvoAiChat />;
  if (access === "locked") return <HealvoAiLocked />;
  return null;
}

/** Launcher + card for clinics whose plan doesn't include Healvo AI. */
function HealvoAiLocked() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div className="pointer-events-none fixed right-3 bottom-3 z-[45] sm:right-6 sm:bottom-6">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close Healvo AI" : "Healvo AI, included with Premium"}
          aria-expanded={open}
          title="Healvo AI is included with Premium"
          className="pointer-events-auto relative flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-raised)] text-[var(--color-teal)] shadow-xl outline-none transition-transform duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-[var(--color-teal)]/50 sm:h-14 sm:w-14"
        >
          {open ? <X size={20} strokeWidth={2} /> : <HealvoAiMark size={20} />}
          {!open && (
            <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-ink-solid)] text-[var(--color-ink-solid-text)] ring-2 ring-[var(--color-canvas)]">
              <Lock size={10} strokeWidth={2.75} />
            </span>
          )}
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Healvo AI"
          className="healvo-panel-in fixed right-3 bottom-[72px] z-[45] w-[calc(100vw-24px)] max-w-[330px] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-4 shadow-xl sm:right-6 sm:bottom-24"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-mint-bg)] text-[var(--color-teal)]">
              <HealvoAiMark size={16} />
            </div>
            <span className="text-[13.5px] font-bold text-[var(--color-ink)]">Healvo AI</span>
            <span className="rounded-full bg-[var(--color-teal)]/10 px-2 py-0.5 text-[11px] font-bold text-[var(--color-teal)]">
              Premium
            </span>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-muted)]">
            Ask about today's schedule, who's waiting and what you've collected. Healvo AI is included with the
            Premium plan.
          </p>
          <Link
            to="/settings/subscription"
            onClick={() => setOpen(false)}
            className="mt-3.5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--color-ink-solid)] px-3.5 py-2.5 text-[13px] font-bold text-[var(--color-ink-solid-text)] transition-colors hover:bg-[var(--color-ink-solid-hover)]"
          >
            See Premium plans
            <ArrowRight size={14} strokeWidth={2.5} />
          </Link>
        </div>
      )}
    </>
  );
}

/** Launcher + chat panel for clinics entitled to Healvo AI. */
function HealvoAiChat() {
  const { activeClinic } = useAuth();
  const { clinicSettings, todaysVisits, waitingCount, patients, bills, doctorProfile } =
    useClinicData();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRetry, setPendingRetry] = useState<ChatMessage[] | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
  }, [input]);

  async function performSend(nextMessages: ChatMessage[]) {
    setError(null);
    setIsLoading(true);
    try {
      const context = buildHealvoAiContext({
        clinicName: clinicSettings.clinicName,
        todaysVisits,
        waitingCount,
        patients,
        bills,
      });
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          clinic_id: activeClinic?.id,
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
          context,
        }),
      });

      const data = (await res.json().catch(() => null)) as { reply?: string; error?: string } | null;

      if (!res.ok || !data?.reply) {
        throw Object.assign(new Error(data?.error ?? "request_failed"), { status: res.status });
      }

      setMessages((prev) => [...prev, { id: createId(), role: "assistant", content: data.reply! }]);
      setPendingRetry(null);
    } catch (err) {
      // 401/403/429 carry a message meant for the user (sign in again, plan
      // doesn't include AI, slow down); anything else is a generic failure.
      const status = (err as { status?: number }).status;
      const userFacing = status === 401 || status === 403 || status === 429;
      setError(userFacing && err instanceof Error ? err.message : GENERIC_ERROR);
      setPendingRetry(status === 401 || status === 403 ? null : nextMessages);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    const nextMessages = [...messages, { id: createId(), role: "user" as const, content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    void performSend(nextMessages);
  }

  function handleRetry() {
    if (!pendingRetry || isLoading) return;
    void performSend(pendingRetry);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    handleSend(input);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  }

  function handleToggle() {
    setOpen((o) => !o);
  }

  const greetingName = getGreetingName(doctorProfile.name);

  return (
    <>
      {/* QA finding, fixed here: this whole fixed bottom-right container sits
          on top of page content in that corner (Consultation's "Complete
          visit"/"Save draft" buttons, confirmed live) — and a plain <div>
          is hit-testable wherever its box is, filled or not, regardless of
          its children's own pointer-events. Making only the decorative
          hint inert (pointer-events-none on that child alone) wasn't
          enough: document.elementFromPoint() at the real button's center
          still returned this outer container itself, since the flex row
          reserves the hint's layout space even while it's visually hidden.
          pointer-events-none here, with pointer-events-auto opted back in
          on just the round toggle button below, makes the empty/hint area
          truly inert while keeping the real click target working —
          group-hover on the hint still activates from hovering that button,
          since CSS :hover propagates to ancestors regardless of the
          ancestor's own pointer-events value. */}
      <div className="group pointer-events-none fixed right-3 bottom-3 z-[45] flex items-center gap-2 sm:right-6 sm:bottom-6">
        {!open && (
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none flex flex-col items-start whitespace-nowrap rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3.5 py-2.5 text-left shadow-xl transition-all duration-300 ease-out motion-reduce:transition-none",
              "translate-x-2 opacity-0",
              "pointer-fine:group-hover:translate-x-0 pointer-fine:group-hover:opacity-100",
            )}
          >
            <span className="text-[12.5px] font-semibold text-[var(--color-teal)]">
              Talk to Healvo AI
            </span>
            <span className="text-[11px] text-[var(--color-muted)]">Your clinic assistant</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleToggle}
          aria-label={open ? "Close Healvo AI" : "Open Healvo AI"}
          title="Healvo AI"
          className="pointer-events-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-teal)] text-white shadow-xl sm:h-14 sm:w-14 outline-none transition-transform duration-150 hover:bg-[#0c93a3] active:scale-95 focus-visible:ring-2 focus-visible:ring-[var(--color-teal)]/50"
        >
          {open ? <X size={22} strokeWidth={2} /> : <HealvoAiMark size={22} />}
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Healvo AI"
          className={cn(
            "healvo-panel-in fixed z-[45] flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] shadow-xl",
            "inset-x-3 top-6 bottom-6",
            "sm:inset-x-auto sm:top-auto sm:left-auto sm:right-6 sm:bottom-24 sm:h-[620px] sm:max-h-[calc(100vh-140px)] sm:w-[400px]",
          )}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-mint-bg)] text-[var(--color-teal)]">
                <HealvoAiMark size={16} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[13.5px] font-bold text-[var(--color-ink)]">
                    Healvo AI
                  </span>
                  <span className="shrink-0 rounded-full bg-[var(--color-mint-bg)] px-1.5 py-[1px] text-[9px] font-bold tracking-wide text-[var(--color-teal)] uppercase">
                    Beta
                  </span>
                </div>
                <div className="truncate text-[11.5px] text-[var(--color-muted)]">Your clinic assistant</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close Healvo AI"
              className="shrink-0 rounded-lg p-1.5 text-[var(--color-muted)] outline-none transition-colors hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-teal)]/50"
            >
              <X size={18} />
            </button>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-2 text-center">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-mint-bg)] text-[var(--color-teal)]">
                  <HealvoAiMark size={26} />
                </div>
                <div className="text-[14px] font-bold text-[var(--color-ink)]">
                  Hi {greetingName} 👋
                </div>
                <div className="mt-1.5 max-w-[280px] text-[13px] leading-relaxed text-[var(--color-muted)]">
                  I&apos;m Healvo AI, your clinic assistant. I can help you quickly understand
                  today&apos;s schedule, patients, billing, and more.
                </div>
                <div className="mt-5 w-full space-y-2">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => handleSend(prompt)}
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] px-3 py-2.5 text-left text-[12.5px] font-medium text-[var(--color-ink)] outline-none transition-colors hover:border-transparent hover:bg-[var(--color-mint-bg)] focus-visible:ring-2 focus-visible:ring-[var(--color-teal)]/50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((m) => (
                  <div key={m.id} className={cn("flex gap-2", m.role === "user" ? "justify-end" : "items-start")}>
                    {m.role === "assistant" && (
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--color-mint-bg)] text-[var(--color-teal)]">
                        <HealvoAiMark size={13} />
                      </div>
                    )}
                    <div
                      className={cn(
                        "whitespace-pre-wrap text-[13px] leading-relaxed",
                        m.role === "user"
                          ? "max-w-[85%] rounded-2xl rounded-br-sm bg-[var(--color-ink-solid)] px-3.5 py-2.5 text-[var(--color-ink-solid-text)]"
                          : "max-w-[88%] pt-0.5 text-[var(--color-ink)]",
                      )}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--color-mint-bg)] text-[var(--color-teal)]">
                      <HealvoAiMark size={13} />
                    </div>
                    <div className="flex items-center gap-1 pt-2.5 text-[var(--color-muted-soft)]" aria-live="polite">
                      <span className="sr-only">Healvo AI is responding</span>
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
                    </div>
                  </div>
                )}

                {error && (
                  <div className="rounded-lg border border-[var(--color-danger-text)]/25 bg-[var(--color-danger-bg)] px-3 py-2.5 text-[12.5px] text-[var(--color-danger-text)]">
                    <p>{error}</p>
                    {pendingRetry && (
                      <button
                        type="button"
                        onClick={handleRetry}
                        className="mt-1.5 font-semibold underline underline-offset-2 outline-none"
                      >
                        Try again
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-[var(--color-border)] p-3">
            <form onSubmit={onSubmit} className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder="Ask Healvo AI..."
                aria-label="Ask Healvo AI"
                className="max-h-28 min-h-9 flex-1 resize-none rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted-soft)] focus:border-[var(--color-teal)]"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                aria-label="Send message"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-ink-solid)] text-[var(--color-ink-solid-text)] outline-none transition-colors hover:bg-[var(--color-ink-solid-hover)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <SendHorizontal size={16} strokeWidth={2} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
