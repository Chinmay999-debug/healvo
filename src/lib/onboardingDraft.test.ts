import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearWizardDraft,
  profileNameForPrefill,
  readWizardDraft,
  saveWizardDraft,
  type WizardDraft,
} from "./onboardingDraft";

// The default vitest environment is node, which has no localStorage. A tiny
// in-memory stand-in keeps these tests honest without pulling in jsdom.
function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

const USER = "user-1";

const draft: WizardDraft = {
  step: 2,
  aboutYou: { fullName: "Dr. Priya Nair", mobile: "9876543210", title: "Owner · Dentist" },
  clinic: {
    clinicName: "Sharma Dental",
    phone: "9812345678",
    address: "12 MG Road",
    city: "Bengaluru",
  },
};

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
});

describe("wizard draft round trip", () => {
  it("returns null when nothing has been saved", () => {
    expect(readWizardDraft(USER)).toBeNull();
  });

  it("restores everything the user typed, including the step", () => {
    saveWizardDraft(USER, draft);
    expect(readWizardDraft(USER)).toEqual(draft);
  });

  it("keeps drafts of different users apart", () => {
    saveWizardDraft(USER, draft);
    expect(readWizardDraft("someone-else")).toBeNull();
  });

  it("forgets the draft once cleared", () => {
    saveWizardDraft(USER, draft);
    clearWizardDraft(USER);
    expect(readWizardDraft(USER)).toBeNull();
  });
});

describe("wizard draft resilience", () => {
  it("survives corrupted JSON instead of throwing", () => {
    localStorage.setItem(`healvo-onboarding-wizard-${USER}`, "{not json");
    expect(readWizardDraft(USER)).toBeNull();
  });

  it("fills in missing fields rather than yielding undefined", () => {
    localStorage.setItem(
      `healvo-onboarding-wizard-${USER}`,
      JSON.stringify({ aboutYou: { fullName: "Solo" } }),
    );
    expect(readWizardDraft(USER)).toEqual({
      step: 1,
      aboutYou: { fullName: "Solo", mobile: "", title: "" },
      clinic: { clinicName: "", phone: "", address: "", city: "" },
    });
  });

  it("never resumes past step 2, where the clinic already exists", () => {
    saveWizardDraft(USER, { ...draft, step: 4 });
    expect(readWizardDraft(USER)?.step).toBe(1);
  });

  it("does not throw when storage refuses to write", () => {
    vi.stubGlobal("localStorage", {
      ...memoryStorage(),
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    } as Storage);
    expect(() => saveWizardDraft(USER, draft)).not.toThrow();
  });
});

describe("profileNameForPrefill", () => {
  it("uses a real name, such as the one Google supplies", () => {
    expect(profileNameForPrefill("Priya Nair", "priya@gmail.com")).toBe("Priya Nair");
  });

  it("ignores the email handle_new_user() falls back to", () => {
    expect(profileNameForPrefill("dr.qa@healvo.in", "dr.qa@healvo.in")).toBe("");
  });

  it("ignores any address-shaped value, whoever it belongs to", () => {
    expect(profileNameForPrefill("someone@else.com", "me@healvo.in")).toBe("");
  });

  it("ignores a case-different match against the account email", () => {
    expect(profileNameForPrefill("DR.QA@Healvo.in", "dr.qa@healvo.in")).toBe("");
  });

  it("returns empty for nothing at all", () => {
    expect(profileNameForPrefill(null, null)).toBe("");
    expect(profileNameForPrefill("   ", "a@b.com")).toBe("");
  });
});
