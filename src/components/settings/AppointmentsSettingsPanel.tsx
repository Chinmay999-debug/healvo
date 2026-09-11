import { useState, type ReactNode } from "react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { inputClass } from "../ui/fieldStyles";
import { useClinicData } from "../../state/clinicData";
import { WEEKDAYS, type BreakPeriod, type Weekday } from "../../data/mockData";
import { validateBreak } from "../../lib/appointmentHours";
import { cn, getErrorMessage } from "../../lib/utils";

const timeSelectClass =
  "rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-[13px] text-[var(--color-ink)] outline-none focus:border-[var(--color-teal)] focus:ring-2 focus:ring-[var(--color-teal)]/15";

const DURATION_OPTIONS = [15, 20, 30, 45, 60];
const DEFAULT_NEW_BREAK: BreakPeriod = { startTime: "01:00 PM", endTime: "02:00 PM" };

// Half-hour clinic-hours options, 6 AM–11:30 PM — a separate concern from
// the public booking page's TIME_SLOTS (which are specific bookable slots).
function buildTimeOptions(): string[] {
  const options: string[] = [];
  for (let mins = 6 * 60; mins <= 23 * 60 + 30; mins += 30) {
    const hour24 = Math.floor(mins / 60);
    const minute = mins % 60;
    const period = hour24 >= 12 ? "PM" : "AM";
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    options.push(
      `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}`,
    );
  }
  return options;
}

const TIME_OPTIONS = buildTimeOptions();

export function AppointmentsSettingsPanel() {
  const { clinicSettings, updateClinicSettings } = useClinicData();
  const [draft, setDraft] = useState({
    workingDays: { ...clinicSettings.workingDays },
    openingTime: clinicSettings.openingTime,
    closingTime: clinicSettings.closingTime,
    appointmentDuration: clinicSettings.appointmentDuration,
    breaks: clinicSettings.breaks.map((b) => ({ ...b })),
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function toggleDay(day: Weekday) {
    setDraft((d) => ({
      ...d,
      workingDays: { ...d.workingDays, [day]: !d.workingDays[day] },
    }));
  }

  function addBreak() {
    setDraft((d) => ({ ...d, breaks: [...d.breaks, { ...DEFAULT_NEW_BREAK }] }));
  }

  function updateBreak(index: number, patch: Partial<BreakPeriod>) {
    setDraft((d) => ({
      ...d,
      breaks: d.breaks.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    }));
  }

  function removeBreak(index: number) {
    setDraft((d) => ({ ...d, breaks: d.breaks.filter((_, i) => i !== index) }));
  }

  const breakErrors = draft.breaks.map((brk, index) =>
    validateBreak(
      brk,
      draft.openingTime,
      draft.closingTime,
      draft.breaks.filter((_, i) => i !== index),
    ),
  );
  const hasInvalidBreak = breakErrors.some((error) => error !== null);

  async function handleSave() {
    if (hasInvalidBreak) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateClinicSettings(draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveError(getErrorMessage(err, "Could not save appointment settings."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="text-[16px] font-bold text-[var(--color-ink)]">Appointments</h2>
      <p className="mt-0.5 text-[13px] text-[var(--color-muted)]">
        Control how appointments work at your clinic.
      </p>

      <div className="mt-5">
        <div className="text-[12px] font-semibold text-[var(--color-muted)]">Working days</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {WEEKDAYS.map((day) => {
            const active = draft.workingDays[day];
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                aria-pressed={active}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                  active
                    ? "border-transparent bg-[var(--color-mint-bg)] text-[var(--color-mint-text)]"
                    : "border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:bg-[var(--color-canvas)]",
                )}
              >
                {day.slice(0, 3)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Field label="Opening time">
          <select
            value={draft.openingTime}
            onChange={(e) => setDraft((d) => ({ ...d, openingTime: e.target.value }))}
            className={inputClass}
          >
            {TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Closing time">
          <select
            value={draft.closingTime}
            onChange={(e) => setDraft((d) => ({ ...d, closingTime: e.target.value }))}
            className={inputClass}
          >
            {TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-5">
        <div className="text-[12px] font-semibold text-[var(--color-muted)]">Break hours</div>

        {draft.breaks.length === 0 ? (
          <p className="mt-2 text-[13px] text-[var(--color-muted-soft)]">No break</p>
        ) : (
          <div className="mt-2 space-y-2">
            {draft.breaks.map((brk, index) => (
              <div key={index}>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={brk.startTime}
                    onChange={(e) => updateBreak(index, { startTime: e.target.value })}
                    className={timeSelectClass}
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <span className="text-[13px] text-[var(--color-muted-soft)]">→</span>
                  <select
                    value={brk.endTime}
                    onChange={(e) => updateBreak(index, { endTime: e.target.value })}
                    className={timeSelectClass}
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeBreak(index)}
                    className="text-[12.5px] font-semibold text-[var(--color-amber-text)] hover:underline"
                  >
                    Remove
                  </button>
                </div>
                {breakErrors[index] && (
                  <p className="mt-1 text-[12px] text-[var(--color-amber-text)]">
                    {breakErrors[index]}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={addBreak}
          className="mt-2.5 text-[12.5px] font-semibold text-[var(--color-teal)] hover:underline"
        >
          + {draft.breaks.length === 0 ? "Add break" : "Add another break"}
        </button>
      </div>

      <div className="mt-5 sm:w-1/2 sm:pr-1.5">
        <Field label="Default appointment duration">
          <select
            value={draft.appointmentDuration}
            onChange={(e) =>
              setDraft((d) => ({ ...d, appointmentDuration: Number(e.target.value) }))
            }
            className={inputClass}
          >
            {DURATION_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} minutes
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Button
          variant="primary"
          onClick={() => void handleSave()}
          disabled={hasInvalidBreak || saving}
        >
          {saving ? "Saving…" : "Save changes"}
        </Button>
        {saved && (
          <span className="text-[12.5px] font-semibold text-[var(--color-mint-text)]">
            Saved
          </span>
        )}
        {saveError && (
          <span className="text-[12.5px] font-semibold text-[var(--color-danger-text)]">
            {saveError}
          </span>
        )}
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[12px] font-semibold text-[var(--color-muted)]">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
