import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Card } from "../ui/Card";
import { DentalArch } from "./DentalArch";
import { DentalChartLegend } from "./DentalChartLegend";
import { ToothDetailPanel } from "./ToothDetailPanel";
import { ALL_TEETH, LOWER_ARCH, UPPER_ARCH, findTooth } from "./dentalChartData";
import {
  TOOTH_STATUS_GRADIENT_STOPS,
  TOOTH_STATUS_SUMMARY_PHRASE,
  toothFillGradientId,
} from "./toothStatusMeta";
import { useClinicData } from "../../state/clinicData";
import type { Patient, ToothStatus } from "../../data/mockData";

const VIEWBOX_WIDTH = 860;
const CENTER_X = VIEWBOX_WIDTH / 2;
const ARCH_VIEWBOX_HEIGHT = 160;
const UPPER_BASE_Y = 46;
const LOWER_BASE_Y = 30;

const svgClass = "mx-auto block h-auto w-full min-w-[560px] max-w-[820px]";
const archLabelClass =
  "text-center text-[10px] font-semibold tracking-[0.08em] text-[var(--color-muted)] uppercase";

/** Definitions shared by both arch <svg> elements — an id defined here
 * resolves fine from sibling inline SVGs, so this only needs to exist once. */
function ChartDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true">
      <defs>
        {Object.entries(TOOTH_STATUS_GRADIENT_STOPS).map(([status, stops]) => (
          <linearGradient key={status} id={toothFillGradientId(status as ToothStatus)} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stops[0]} />
            <stop offset="100%" stopColor={stops[1]} />
          </linearGradient>
        ))}
        <radialGradient id="tooth-selected-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--color-teal)" stopOpacity="0.1" />
          <stop offset="60%" stopColor="var(--color-mint-bg)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--color-mint-bg)" stopOpacity="0" />
        </radialGradient>
        <filter id="tooth-elevate" x="-60%" y="-60%" width="220%" height="220%">
          <feDropShadow dx="0" dy="1.2" stdDeviation="1.7" floodColor="var(--color-teal)" floodOpacity="0.16" />
        </filter>
      </defs>
    </svg>
  );
}

/** The authoritative, patient-persistent tooth chart — Consultation reads
 * its teethSelected live from the same shared toothRecords this page edits,
 * so nothing here is isolated local state that could be lost on navigation. */
export function DentalChart() {
  const { patient } = useOutletContext<{ patient: Patient }>();
  const { toothRecords, setToothStatus } = useClinicData();

  const [selectedTooth, setSelectedTooth] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  // Adjusted during render (React's recommended pattern) rather than in an
  // effect, so switching patients never costs an extra render pass.
  const [syncedPatientId, setSyncedPatientId] = useState(patient.id);
  if (patient.id !== syncedPatientId) {
    setSyncedPatientId(patient.id);
    setSelectedTooth(null);
    setNoteDraft("");
  }

  // toothRecords is sparse — a tooth only has a row once it's set away from
  // "normal" — so this is already just the patient's non-normal teeth.
  const patientRecords = useMemo(
    () => toothRecords.filter((r) => r.patientId === patient.id),
    [toothRecords, patient.id],
  );

  const recordFor = (fdi: string) => patientRecords.find((r) => r.tooth === fdi);
  const statusFor = (fdi: string): ToothStatus => recordFor(fdi)?.status ?? "normal";
  const noteFor = (fdi: string) => recordFor(fdi)?.note;

  const summaryParts = useMemo(() => {
    return (Object.keys(TOOTH_STATUS_SUMMARY_PHRASE) as Exclude<ToothStatus, "normal">[])
      .map((status) => ({
        count: patientRecords.filter((r) => r.status === status).length,
        phrase: TOOTH_STATUS_SUMMARY_PHRASE[status],
      }))
      .filter((part) => part.count > 0)
      .map((part) => `${part.count} ${part.phrase}`);
  }, [patientRecords]);

  function handleSelect(fdi: string) {
    setSelectedTooth(fdi);
    setNoteDraft(noteFor(fdi) ?? "");
  }

  function handleStatusChange(status: ToothStatus) {
    if (!selectedTooth) return;
    void setToothStatus(patient.id, selectedTooth, { status }).catch((err: unknown) => {
      console.error("Failed to save tooth status:", err);
    });
  }

  // Local-only while typing — persisting on every keystroke would append a
  // new dental_chart_entries history row per keystroke (that table is
  // append-only in the real schema, see services/toothChart.ts). Committed
  // on blur instead, via handleNoteBlur.
  function handleNoteChange(note: string) {
    setNoteDraft(note);
  }

  function handleNoteBlur() {
    if (!selectedTooth) return;
    const existingNote = noteFor(selectedTooth);
    const trimmed = noteDraft.trim() || undefined;
    if (trimmed === existingNote) return;
    void setToothStatus(patient.id, selectedTooth, { note: trimmed }).catch((err: unknown) => {
      console.error("Failed to save tooth note:", err);
    });
  }

  const selectedMeta = selectedTooth ? (findTooth(selectedTooth) ?? null) : null;

  return (
    <div>
      <div className="mb-5 text-[12.5px] font-semibold text-[var(--color-muted)]">
        Tap a tooth to view or update its status.
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="min-w-0 px-4 py-5">
          <ChartDefs />

          <div className="overflow-x-auto">
            <div className={archLabelClass}>Upper arch</div>
            <svg
              viewBox={`0 0 ${VIEWBOX_WIDTH} ${ARCH_VIEWBOX_HEIGHT}`}
              role="img"
              aria-label={`Upper arch for ${patient.name}, teeth 18 to 28`}
              className={svgClass}
            >
              <DentalArch
                teeth={UPPER_ARCH}
                arch="upper"
                centerX={CENTER_X}
                baseY={UPPER_BASE_Y}
                getStatus={statusFor}
                getNote={noteFor}
                selectedTooth={selectedTooth}
                onSelect={handleSelect}
              />
            </svg>

            <div className={`${archLabelClass} mt-1`}>Lower arch</div>
            <svg
              viewBox={`0 0 ${VIEWBOX_WIDTH} ${ARCH_VIEWBOX_HEIGHT}`}
              role="img"
              aria-label={`Lower arch for ${patient.name}, teeth 48 to 38`}
              className={svgClass}
            >
              <DentalArch
                teeth={LOWER_ARCH}
                arch="lower"
                centerX={CENTER_X}
                baseY={LOWER_BASE_Y}
                getStatus={statusFor}
                getNote={noteFor}
                selectedTooth={selectedTooth}
                onSelect={handleSelect}
              />
            </svg>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-3">
            <div>
              <span className="text-[12.5px] font-bold text-[var(--color-ink)]">
                {ALL_TEETH.length} teeth
              </span>
              <span className="ml-2 text-[12px] text-[var(--color-muted)]">
                {summaryParts.length > 0 ? summaryParts.join(" · ") : "All teeth normal"}
              </span>
            </div>
            <DentalChartLegend />
          </div>
        </Card>

        <ToothDetailPanel
          tooth={selectedMeta}
          status={selectedTooth ? statusFor(selectedTooth) : "normal"}
          note={noteDraft}
          onStatusChange={handleStatusChange}
          onNoteChange={handleNoteChange}
          onNoteBlur={handleNoteBlur}
          onClose={() => setSelectedTooth(null)}
        />
      </div>
    </div>
  );
}
