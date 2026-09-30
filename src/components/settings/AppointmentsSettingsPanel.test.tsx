import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WEEKDAYS, type ClinicSettings } from "../../data/mockData";
import { validateClinicHours } from "../../lib/appointmentHours";

// The panel reads its initial draft from useClinicData and renders one Button
// (Save). Both are mocked: updateClinicSettings records whether an UPDATE
// would be sent, and Button captures the props the panel gives it so the test
// can press "Save" without a DOM.
const updateClinicSettings = vi.fn(async (_patch: unknown) => {});
let settings: Pick<
  ClinicSettings,
  "workingDays" | "openingTime" | "closingTime" | "appointmentDuration" | "breaks"
>;
let saveButton: { onClick?: () => void; disabled?: boolean } | null = null;

vi.mock("../../state/clinicData", () => ({
  useClinicData: () => ({ clinicSettings: settings, updateClinicSettings }),
}));

vi.mock("../ui/Button", () => ({
  Button: (props: { onClick?: () => void; disabled?: boolean }) => {
    saveButton = props;
    return null;
  },
}));

import { AppointmentsSettingsPanel } from "./AppointmentsSettingsPanel";

const HOURS_MESSAGE = "Closing time must be later than opening time.";

// No breaks by default: a break outside invalid hours would block Save on
// its own and hide whether the hours check does.
function renderWith(
  openingTime: string,
  closingTime: string,
  breaks: ClinicSettings["breaks"] = [],
) {
  settings = {
    workingDays: Object.fromEntries(WEEKDAYS.map((d) => [d, true])) as ClinicSettings["workingDays"],
    openingTime,
    closingTime,
    appointmentDuration: 30,
    breaks,
  };
  return renderToStaticMarkup(<AppointmentsSettingsPanel />);
}

beforeEach(() => {
  updateClinicSettings.mockClear();
  saveButton = null;
});

describe("validateClinicHours", () => {
  it("accepts closing after opening", () => {
    expect(validateClinicHours("09:00 AM", "07:00 PM")).toBeNull();
    expect(validateClinicHours("06:00 AM", "11:30 PM")).toBeNull();
    expect(validateClinicHours("11:30 AM", "12:00 PM")).toBeNull();
  });

  it("rejects equal times", () => {
    expect(validateClinicHours("10:00 AM", "10:00 AM")).toBe(HOURS_MESSAGE);
  });

  it("rejects closing before opening", () => {
    expect(validateClinicHours("11:30 PM", "06:00 AM")).toBe(HOURS_MESSAGE);
    expect(validateClinicHours("12:30 PM", "12:00 PM")).toBe(HOURS_MESSAGE);
  });
});

describe("AppointmentsSettingsPanel clinic hours", () => {
  it("valid hours: no message, Save enabled, and saving sends the update", async () => {
    const html = renderWith("09:00 AM", "07:00 PM", [{ startTime: "01:00 PM", endTime: "02:00 PM" }]);
    expect(html).not.toContain(HOURS_MESSAGE);
    expect(saveButton?.disabled).toBe(false);

    saveButton!.onClick!();
    await vi.waitFor(() => expect(updateClinicSettings).toHaveBeenCalledTimes(1));
    expect(updateClinicSettings.mock.calls[0][0]).toMatchObject({
      openingTime: "09:00 AM",
      closingTime: "07:00 PM",
      appointmentDuration: 30,
      breaks: [{ startTime: "01:00 PM", endTime: "02:00 PM" }],
    });
  });

  it("equal times: message shown, Save disabled, nothing sent", async () => {
    const html = renderWith("10:00 AM", "10:00 AM");
    expect(html).toContain(HOURS_MESSAGE);
    expect(saveButton?.disabled).toBe(true);

    saveButton!.onClick!();
    await Promise.resolve();
    expect(updateClinicSettings).not.toHaveBeenCalled();
  });

  it("closing before opening: message shown, Save disabled, nothing sent", async () => {
    const html = renderWith("11:30 PM", "06:00 AM");
    expect(html).toContain(HOURS_MESSAGE);
    expect(saveButton?.disabled).toBe(true);

    saveButton!.onClick!();
    await Promise.resolve();
    expect(updateClinicSettings).not.toHaveBeenCalled();
  });

  it("existing break validation is unchanged", () => {
    const html = renderWith("09:00 AM", "07:00 PM", [{ startTime: "08:00 AM", endTime: "09:30 AM" }]);
    expect(html).toContain("Break must fall within clinic opening hours.");
    expect(html).not.toContain(HOURS_MESSAGE);
    expect(saveButton?.disabled).toBe(true);
  });
});
