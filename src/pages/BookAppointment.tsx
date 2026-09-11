import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarCheck, CheckCircle2, Phone } from "lucide-react";
import { Logo } from "../components/ui/Logo";
import { PhoneInput } from "../components/ui/PhoneInput";
import { VISIT_REASONS } from "../data/mockData";
import {
  getPublicAvailability,
  getPublicAvailableDates,
  getPublicBookingInfo,
  submitPublicBooking,
  type PublicClinicInfo,
  type PublicSlot,
} from "../services/publicBooking";
import {
  cn,
  dateFromISO,
  initials,
  shortWeekdayDateLabel,
  todayISO,
  weekdayDateLabel,
  getErrorMessage,
} from "../lib/utils";
import { formatPhoneDisplay, isValidIndianMobile } from "../lib/phone";

const inputClass =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-[14px] text-[var(--color-ink)] outline-none focus:border-[var(--color-teal)] focus:ring-2 focus:ring-[var(--color-teal)]/15";

interface DateOption {
  iso: string;
  label: string;
}

// "Today"/"Tomorrow" by real date difference, not array position — the
// dates array returned by the server may skip a day with zero availability.
function labelForDate(iso: string): string {
  const diffDays = Math.round(
    (dateFromISO(iso).getTime() - dateFromISO(todayISO()).getTime()) / 86400000,
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return shortWeekdayDateLabel(dateFromISO(iso));
}

export default function BookAppointment() {
  const { slug } = useParams<{ slug: string }>();

  const [loadingInfo, setLoadingInfo] = useState(true);
  const [info, setInfo] = useState<PublicClinicInfo | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);

  const [dateOptions, setDateOptions] = useState<DateOption[]>([]);
  const [datesLoading, setDatesLoading] = useState(false);

  const [slots, setSlots] = useState<PublicSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [reason, setReason] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState("");
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [booked, setBooked] = useState<{
    reason: string;
    dateLabel: string;
    time: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoadingInfo(true);
    setInfoError(null);
    getPublicBookingInfo(slug)
      .then((result) => {
        if (cancelled) return;
        setInfo(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setInfoError(getErrorMessage(err, "Could not load this booking page."));
      })
      .finally(() => {
        if (!cancelled) setLoadingInfo(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!slug || !info || !info.onlineBookingEnabled) return;
    let cancelled = false;
    setDatesLoading(true);
    getPublicAvailableDates(slug)
      .then((isoDates) => {
        if (cancelled) return;
        setDateOptions(isoDates.map((iso) => ({ iso, label: labelForDate(iso) })));
      })
      .catch(() => {
        if (!cancelled) setDateOptions([]);
      })
      .finally(() => {
        if (!cancelled) setDatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, info]);

  useEffect(() => {
    if (!slug || !date) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    setSlotsLoading(true);
    getPublicAvailability(slug, date)
      .then((result) => {
        if (!cancelled) setSlots(result);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, date]);

  const reasonReady = reason !== null && (reason !== "Other" || customReason.trim());
  const detailsReady = name.trim().length > 1 && isValidIndianMobile(phone);
  const canConfirm = reasonReady && date && time && detailsReady;

  function selectDate(iso: string) {
    setDate(iso);
    setTime(null);
  }

  async function handleConfirm() {
    if (!canConfirm || !date || !time || !slug) return;
    const finalReason = reason === "Other" ? customReason.trim() : (reason ?? "");
    setSubmitting(true);
    setError(null);
    try {
      const confirmation = await submitPublicBooking({
        slug,
        date,
        time,
        reason: finalReason,
        name,
        phone,
        email: email || undefined,
      });
      setBooked({
        reason: finalReason,
        dateLabel: weekdayDateLabel(dateFromISO(confirmation.date)),
        time: confirmation.time,
      });
    } catch (err) {
      setError(
        getErrorMessage(err, "Could not book this appointment. Please call the clinic directly."),
      );
      // The slot might have just been taken by someone else — refresh so
      // the grid reflects reality instead of a stale "available" state.
      if (date) {
        getPublicAvailability(slug, date)
          .then(setSlots)
          .catch(() => {});
      }
    } finally {
      setSubmitting(false);
    }
  }

  const clinicInitials = useMemo(() => (info ? initials(info.name) || "?" : "?"), [info]);
  const locationLabel = useMemo(
    () => [info?.address, info?.city].filter(Boolean).join(", "),
    [info],
  );

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-lg">
        {loadingInfo ? (
          <LoadingCard />
        ) : infoError ? (
          <MessageCard title="Something went wrong" message={infoError} />
        ) : !info ? (
          <MessageCard
            title="Booking page not found"
            message="We couldn't find this clinic's booking page. Please check the link and try again."
          />
        ) : (
          <>
            <ClinicHeader info={info} initials={clinicInitials} location={locationLabel} />

            <div className="mt-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm sm:p-6">
              {booked ? (
                <SuccessView booked={booked} clinicName={info.name} phone={info.phone} />
              ) : !info.onlineBookingEnabled ? (
                <div className="py-2 text-center">
                  <h2 className="text-[15px] font-bold text-[var(--color-ink)]">
                    Online booking isn't available right now
                  </h2>
                  <p className="mt-1.5 text-[13.5px] text-[var(--color-muted)]">
                    {info.phone
                      ? "Please call the clinic directly to schedule your appointment."
                      : "Please contact the clinic directly to schedule your appointment."}
                  </p>
                  {info.phone && (
                    <a
                      href={`tel:${info.phone.replace(/\s+/g, "")}`}
                      className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-[var(--color-teal)] hover:underline"
                    >
                      <Phone size={13} strokeWidth={2.5} />
                      Call {info.name}
                    </a>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <Section heading="What would you like to visit for?">
                    <div className="flex flex-wrap gap-2">
                      {VISIT_REASONS.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setReason(r)}
                          className={cn(
                            "rounded-lg border px-3.5 py-2 text-[13.5px] font-semibold transition-colors",
                            reason === r
                              ? "border-transparent bg-[var(--color-teal)] text-white"
                              : "border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-canvas)]",
                          )}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                    {reason === "Other" && (
                      <input
                        autoFocus
                        value={customReason}
                        onChange={(e) => setCustomReason(e.target.value)}
                        placeholder="Tell us what you need"
                        className={cn(inputClass, "mt-3")}
                      />
                    )}
                  </Section>

                  {reasonReady && (
                    <Section heading="Choose a date">
                      {datesLoading ? (
                        <p className="text-[13px] text-[var(--color-muted)]">Loading dates…</p>
                      ) : dateOptions.length === 0 ? (
                        <p className="text-[13px] text-[var(--color-muted)]">
                          No upcoming availability. Please call the clinic directly.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {dateOptions.map((d) => (
                            <button
                              key={d.iso}
                              type="button"
                              onClick={() => selectDate(d.iso)}
                              className={cn(
                                "rounded-lg border px-3.5 py-2 text-[13.5px] font-semibold transition-colors",
                                date === d.iso
                                  ? "border-transparent bg-[var(--color-teal)] text-white"
                                  : "border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-canvas)]",
                              )}
                            >
                              {d.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </Section>
                  )}

                  {reasonReady && date && (
                    <Section heading="Choose a time">
                      {slotsLoading ? (
                        <p className="text-[13px] text-[var(--color-muted)]">Loading times…</p>
                      ) : (
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {slots.map((s) => (
                            <button
                              key={s.time}
                              type="button"
                              disabled={!s.available}
                              onClick={() => setTime(s.time)}
                              className={cn(
                                "rounded-lg border px-2 py-2 text-[13px] font-semibold transition-colors",
                                !s.available &&
                                  "cursor-not-allowed border-[var(--color-border)] bg-[var(--color-canvas)] text-[var(--color-muted-soft)] line-through",
                                s.available &&
                                  time !== s.time &&
                                  "border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-canvas)]",
                                s.available &&
                                  time === s.time &&
                                  "border-transparent bg-[var(--color-teal)] text-white",
                              )}
                            >
                              {s.time}
                            </button>
                          ))}
                        </div>
                      )}
                    </Section>
                  )}

                  {reasonReady && date && time && (
                    <Section heading="Your details">
                      <div className="space-y-3">
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Full name"
                          className={inputClass}
                        />
                        <PhoneInput value={phone} onChange={setPhone} size="md" />
                        <input
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Email (optional)"
                          className={inputClass}
                        />
                      </div>
                    </Section>
                  )}

                  {canConfirm && (
                    <Section heading="Confirm your appointment">
                      <div className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
                        <SummaryRow label="Clinic" value={info.name} />
                        <SummaryRow label="Date" value={weekdayDateLabel(dateFromISO(date!))} />
                        <SummaryRow label="Time" value={time!} />
                        <SummaryRow
                          label="Reason"
                          value={reason === "Other" ? customReason.trim() : (reason ?? "")}
                        />
                        <SummaryRow label="Name" value={name} />
                        <SummaryRow label="Phone" value={formatPhoneDisplay(phone)} />
                      </div>

                      {error && (
                        <p className="mt-3 text-[12.5px] font-semibold text-[var(--color-danger-text)]">
                          {error}
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={() => void handleConfirm()}
                        disabled={submitting}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-ink-solid)] px-4 py-3 text-[14px] font-bold text-[var(--color-ink-solid-text)] transition-colors hover:bg-[var(--color-ink-solid-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <CalendarCheck size={17} strokeWidth={2.25} />
                        {submitting ? "Booking…" : "Book appointment"}
                      </button>
                    </Section>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        <div className="mt-6 flex items-center justify-center gap-1.5 text-[12px] text-[var(--color-muted-soft)]">
          Powered by <Logo className="text-[14px]" />
        </div>
      </div>
    </div>
  );
}

function ClinicHeader({
  info,
  initials: clinicInitials,
  location,
}: {
  info: PublicClinicInfo;
  initials: string;
  location: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-center shadow-sm sm:p-6">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-mint-bg)] text-[15px] font-bold text-[var(--color-teal)]">
        {clinicInitials}
      </div>
      <h1 className="mt-3 text-[19px] font-extrabold tracking-tight text-[var(--color-ink)]">
        {info.name}
      </h1>
      {location && (
        <p className="mt-0.5 text-[13.5px] text-[var(--color-muted)]">{location}</p>
      )}
      {info.doctorName && (
        <p className="mt-0.5 text-[12.5px] text-[var(--color-muted-soft)]">{info.doctorName}</p>
      )}
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center shadow-sm">
      <p className="text-[13.5px] text-[var(--color-muted)]">Loading…</p>
    </div>
  );
}

function MessageCard({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center shadow-sm">
      <h1 className="text-[16px] font-bold text-[var(--color-ink)]">{title}</h1>
      <p className="mt-1.5 text-[13.5px] text-[var(--color-muted)]">{message}</p>
    </div>
  );
}

function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="text-[14.5px] font-bold text-[var(--color-ink)]">{heading}</h2>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3.5 py-2.5">
      <span className="text-[12px] font-semibold text-[var(--color-muted)]">{label}</span>
      <span className="max-w-[65%] truncate text-[13.5px] font-semibold text-[var(--color-ink)]">
        {value}
      </span>
    </div>
  );
}

function SuccessView({
  booked,
  clinicName,
  phone,
}: {
  booked: { reason: string; dateLabel: string; time: string };
  clinicName: string;
  phone: string | null;
}) {
  return (
    <div className="flex flex-col items-center py-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-mint-bg)] text-[var(--color-mint-text)]">
        <CheckCircle2 size={28} />
      </div>
      <h2 className="mt-4 text-[18px] font-extrabold text-[var(--color-ink)]">
        Appointment booked
      </h2>
      <p className="mt-1 text-[13.5px] text-[var(--color-muted)]">
        Your appointment at {clinicName} is confirmed.
      </p>

      <div className="mt-5 w-full rounded-xl bg-[var(--color-canvas)] px-5 py-4">
        <div className="text-[15px] font-bold text-[var(--color-ink)]">
          {booked.dateLabel}
        </div>
        <div className="text-[15px] font-bold text-[var(--color-teal)]">
          {booked.time}
        </div>
        <div className="mt-1 text-[13px] text-[var(--color-muted)]">{booked.reason}</div>
      </div>

      {phone && (
        <div className="mt-5 border-t border-[var(--color-border)] pt-4 text-[12.5px] text-[var(--color-muted)]">
          Need to change something?{" "}
          <a
            href={`tel:${phone.replace(/\s+/g, "")}`}
            className="inline-flex items-center gap-1 font-semibold text-[var(--color-teal)] hover:underline"
          >
            <Phone size={12} strokeWidth={2.5} />
            Call {clinicName}
          </a>
        </div>
      )}
    </div>
  );
}
