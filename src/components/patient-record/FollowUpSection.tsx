import { cn } from "../../lib/utils";
import { SegmentedControl } from "./SegmentedControl";

const FOLLOW_UP_PRESETS = ["7 days", "14 days", "30 days"] as const;

const inputClass =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-[13.5px] text-[var(--color-ink)] outline-none focus:border-[var(--color-teal)] focus:ring-2 focus:ring-[var(--color-teal)]/15";

const REQUIRED_OPTIONS: { value: "no" | "yes"; label: string }[] = [
  { value: "no", label: "No follow-up required" },
  { value: "yes", label: "Follow-up recommended" },
];

export interface FollowUpValues {
  required: boolean;
  /** One of FOLLOW_UP_PRESETS, or "custom" when a specific date is picked. */
  when: string;
  customDate: string;
  recommendation: string;
}

/** Follow-up defaults to "No follow-up required" — the doctor is never
 * forced to fill in when/recommendation unless they opt into a follow-up. */
export function FollowUpSection({
  values,
  onChange,
}: {
  values: FollowUpValues;
  onChange: <K extends keyof FollowUpValues>(key: K, value: FollowUpValues[K]) => void;
}) {
  return (
    <div>
      <div className="text-[13.5px] font-bold text-[var(--color-ink)]">Follow-up</div>

      <div className="mt-2">
        <SegmentedControl
          options={REQUIRED_OPTIONS}
          value={values.required ? "yes" : "no"}
          onChange={(next) => onChange("required", next === "yes")}
        />
      </div>

      {values.required && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[12px] font-semibold text-[var(--color-muted)]">When?</span>
            <select
              value={values.when}
              onChange={(e) => onChange("when", e.target.value)}
              className={cn(inputClass, "mt-1")}
            >
              {FOLLOW_UP_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {preset}
                </option>
              ))}
              <option value="custom">Custom date</option>
            </select>
            {values.when === "custom" && (
              <input
                type="date"
                value={values.customDate}
                onChange={(e) => onChange("customDate", e.target.value)}
                className={cn(inputClass, "mt-2")}
              />
            )}
          </label>

          <label className="block">
            <span className="text-[12px] font-semibold text-[var(--color-muted)]">
              Recommendation
            </span>
            <input
              value={values.recommendation}
              onChange={(e) => onChange("recommendation", e.target.value)}
              placeholder="e.g. Review after 7 days"
              className={cn(inputClass, "mt-1")}
            />
          </label>
        </div>
      )}
    </div>
  );
}
