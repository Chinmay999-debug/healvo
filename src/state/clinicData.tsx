import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  type Patient,
  type Visit,
  type VisitStatus,
  type Bill,
  type PaymentMethod,
  type StaffMember,
  type StaffRole,
  type ClinicSettings,
  type DoctorProfile,
  type Consultation,
  type ConsultationStatus,
  type VisitOutcome,
  type ToothRecord,
  type PatientDocument,
  type PatientDocumentType,
} from "../data/mockData";
import { nowTimeLabel, timeToMinutes, todayISO } from "../lib/utils";
import { phoneMatches } from "../lib/phone";
import { consumeClinicDetailsDraft } from "../lib/onboardingDraft";
import { useAuth } from "./authContext";
import * as patientsService from "../services/patients";
import * as visitsService from "../services/visits";
import * as consultationsService from "../services/consultations";
import * as toothChartService from "../services/toothChart";
import * as documentsService from "../services/documents";
import * as billingService from "../services/billing";
import * as staffService from "../services/staff";
import * as clinicService from "../services/clinic";

// P4.2: patients, visits, consultations and the dental chart are backed by
// Supabase, scoped to the signed-in user's active clinic membership (see
// state/authContext.tsx). P4.4 adds documents (real Storage-backed uploads),
// P4.5 adds bills/payments (via the create_bill()/record_payment() RPCs —
// see services/billing.ts). P4.6 adds staff (services/staff.ts, the
// clinic_staff roster table), clinic settings (services/clinic.ts, the
// `clinics` row) and the doctor profile (services/clinic.ts, the `profiles`
// row) — every entity in this provider is now Supabase-backed. isDemoAccount
// is no longer read by this file at all: every account, demo included,
// loads its real rows identically (the demo clinic's staff/profile identity
// is real seeded data — see healvo-backend/supabase/migrations/
// 20260910130000_demo_identity_and_staff_seed.sql — not a frontend branch).
//
// P4.7 removes what used to live here for the public booking page
// (bookAppointment/getAvailableDates/getSlotsForDate, plus their
// TIME_SLOTS/hashString mock-availability helpers) — that page
// (pages/BookAppointment.tsx) is no longer wrapped by this provider at all
// and no longer depends on the signed-in user's own clinic. It's keyed by
// the clinic's public slug and talks to services/publicBooking.ts's
// `public_booking_*` RPCs instead, which work identically for a genuinely
// anonymous visitor and a signed-in staff member alike. See
// healvo-backend/supabase/migrations/20260911100000_public_booking.sql.

export interface NewPatientDraft {
  name: string;
  phone: string;
  age?: string;
  gender?: string;
}

interface WalkInInput {
  patientId?: string;
  newPatient?: NewPatientDraft;
  reason: string;
}

export interface CreateBillItemInput {
  description: string;
  amount: number;
}

export interface CreateBillInput {
  patientId: string;
  visitId?: string;
  items: CreateBillItemInput[];
}

export interface RecordPaymentInput {
  billId: string;
  amount: number;
  method: PaymentMethod;
}

export interface NewStaffDraft {
  name: string;
  phone: string;
  role: StaffRole;
}

export interface PatientUpdateInput {
  name?: string;
  phone?: string;
  age?: string;
  gender?: string;
}

export interface NewConsultationInput {
  patientId: string;
  visitId?: string;
  visitReason?: string;
  patientWords?: string;
  clinicalNotes?: string;
  teethSelected?: string[];
  prescription?: string;
  followUpRequired?: boolean;
  followUpWhen?: string;
  followUpRecommendation?: string;
  visitOutcome?: VisitOutcome;
  status: ConsultationStatus;
}

export type ConsultationUpdateInput = Partial<Omit<NewConsultationInput, "patientId" | "status">> & {
  status?: ConsultationStatus;
};

export type ToothStatusInput = Partial<Pick<ToothRecord, "status" | "note">>;

export interface NewDocumentInput {
  patientId: string;
  visitId?: string;
  name: string;
  type: PatientDocumentType;
  file: File;
}

interface ClinicDataValue {
  /** True until the initial patients/visits/consultations/dental-chart load
   * (or a later clinic switch's reload) finishes. Everything else in this
   * context is available immediately (still mock-backed, per phase scope). */
  dataLoading: boolean;
  patients: Patient[];
  visits: Visit[];
  bills: Bill[];
  staff: StaffMember[];
  consultations: Consultation[];
  toothRecords: ToothRecord[];
  documents: PatientDocument[];
  clinicSettings: ClinicSettings;
  doctorProfile: DoctorProfile;
  todaysVisits: Visit[];
  waitingCount: number;
  findPatients: (query: string) => Patient[];
  addPatient: (draft: NewPatientDraft) => Promise<Patient>;
  updatePatient: (patientId: string, patch: PatientUpdateInput) => Promise<void>;
  registerWalkIn: (input: WalkInInput) => Promise<{ patient: Patient; visit: Visit }>;
  createBill: (input: CreateBillInput) => Promise<Bill>;
  recordPayment: (input: RecordPaymentInput) => Promise<Bill>;
  addStaff: (draft: NewStaffDraft) => Promise<StaffMember>;
  addConsultation: (input: NewConsultationInput) => Promise<Consultation>;
  updateConsultation: (id: string, patch: ConsultationUpdateInput) => Promise<Consultation | undefined>;
  setToothStatus: (patientId: string, tooth: string, patch: ToothStatusInput) => Promise<void>;
  addDocument: (input: NewDocumentInput) => Promise<PatientDocument>;
  deleteDocument: (id: string) => Promise<void>;
  updateClinicSettings: (patch: Partial<ClinicSettings>) => Promise<void>;
  updateDoctorProfile: (patch: Partial<DoctorProfile>) => Promise<void>;
  uploadAvatarPhoto: (blob: Blob) => Promise<void>;
  removeAvatarPhoto: () => Promise<void>;
  uploadClinicLogo: (blob: Blob) => Promise<void>;
  removeClinicLogo: () => Promise<void>;
  setVisitStatus: (visitId: string, status: VisitStatus) => Promise<void>;
  cancelVisit: (visitId: string) => Promise<void>;
}

const ClinicDataContext = createContext<ClinicDataValue | null>(null);

// Placeholder shown only until the real per-clinic load effect below
// resolves — mirrors `clinics`' own column defaults (see
// healvo-backend/supabase/migrations/20260829190200_clinics_profiles_memberships.sql)
// so there's no visible flash of different values once the real row loads.
const BLANK_CLINIC_SETTINGS: ClinicSettings = {
  clinicName: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  workingDays: {
    Monday: true,
    Tuesday: true,
    Wednesday: true,
    Thursday: true,
    Friday: true,
    Saturday: true,
    Sunday: false,
  },
  openingTime: "09:00 AM",
  closingTime: "07:00 PM",
  appointmentDuration: 30,
  onlineBookingEnabled: true,
  breaks: [],
  logoPath: null,
};

export function ClinicDataProvider({ children }: { children: ReactNode }) {
  const { activeClinic, profile, user, refresh } = useAuth();
  const clinicId = activeClinic?.id;
  const userId = user?.id;

  const [dataLoading, setDataLoading] = useState(true);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [toothRecords, setToothRecords] = useState<ToothRecord[]>([]);
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [clinicSettings, setClinicSettings] = useState<ClinicSettings>(BLANK_CLINIC_SETTINGS);

  // The doctor profile is never a separate copy of state — it's derived
  // directly from authContext's `profile`/`user` (the real `profiles` row +
  // auth.users email), which RequireAuthAndClinic already guarantees are
  // resolved before this provider ever mounts (see authContext.tsx's
  // `loading` gate). updateDoctorProfile persists then calls refresh(), so
  // this recomputes automatically — no local doctorProfile state to keep in
  // sync by hand (Part 6: user profile and clinic membership stay separate
  // concepts, never duplicated).
  const doctorProfile = useMemo<DoctorProfile>(
    () => ({
      name: profile?.full_name ?? "",
      email: user?.email ?? "",
      phone: profile?.phone ?? "",
      title: profile?.title ?? "",
      avatarPath: profile?.avatar_path ?? null,
    }),
    [profile, user],
  );

  useEffect(() => {
    if (!clinicId) {
      setPatients([]);
      setVisits([]);
      setConsultations([]);
      setToothRecords([]);
      setDocuments([]);
      setBills([]);
      setStaff([]);
      setClinicSettings(BLANK_CLINIC_SETTINGS);
      setDataLoading(false);
      return;
    }
    let cancelled = false;
    setDataLoading(true);

    // Onboarding (components/onboarding/OnboardingWizard.tsx) collects
    // phone/address/city before this provider ever mounts and hands them off
    // via onboardingDraft.ts's one-shot localStorage draft (it has no
    // useClinicData() to write into directly at that point). This is the
    // first real mount for that account/clinic, so — if a draft is waiting —
    // persist it to the real `clinics` row once here instead of the old
    // "read into local mock state" behavior; every later load just reads the
    // real row directly like any other entity.
    async function loadClinicSettings(clinic: string): Promise<ClinicSettings> {
      const draft = userId ? consumeClinicDetailsDraft(userId) : null;
      if (draft && (draft.phone || draft.address || draft.city)) {
        return clinicService.updateClinicSettings(clinic, {
          phone: draft.phone || undefined,
          address: draft.address || undefined,
          city: draft.city || undefined,
        });
      }
      return clinicService.getClinicSettings(clinic);
    }

    Promise.all([
      patientsService.listPatients(clinicId),
      visitsService.listVisits(clinicId),
      consultationsService.listConsultations(clinicId),
      toothChartService.listToothStatus(clinicId),
      documentsService.listDocuments(clinicId),
      billingService.listBills(clinicId),
      staffService.listStaff(clinicId),
      loadClinicSettings(clinicId),
    ])
      .then(([p, v, c, t, d, b, s, settings]) => {
        if (cancelled) return;
        setPatients(p);
        setVisits(v);
        setConsultations(c);
        setToothRecords(t);
        setDocuments(d);
        setBills(b);
        setStaff(s);
        setClinicSettings(settings);
      })
      .catch((err: unknown) => {
        console.error("Failed to load clinic data from Supabase:", err);
      })
      .finally(() => {
        if (!cancelled) setDataLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clinicId, userId]);

  const findPatients = useCallback(
    (query: string) => {
      const q = query.trim().toLowerCase().replace(/\s+/g, "");
      if (!q) return [];
      return patients
        .filter((p) => {
          const name = p.name.toLowerCase().replace(/\s+/g, "");
          return name.includes(q) || phoneMatches(p.phone, query);
        })
        .slice(0, 5);
    },
    [patients],
  );

  const addPatient = useCallback(
    async (draft: NewPatientDraft) => {
      if (!clinicId) throw new Error("No active clinic to add a patient to.");
      const patient = await patientsService.createPatient(clinicId, draft);
      setPatients((prev) => [...prev, patient]);
      return patient;
    },
    [clinicId],
  );

  const updatePatient = useCallback(async (patientId: string, patch: PatientUpdateInput) => {
    const updated = await patientsService.updatePatientRecord(patientId, patch);
    setPatients((prev) => prev.map((p) => (p.id === patientId ? updated : p)));
  }, []);

  const registerWalkIn = useCallback(
    async (input: WalkInInput) => {
      if (!clinicId) throw new Error("No active clinic to register a walk-in for.");
      const patient = input.patientId
        ? patients.find((p) => p.id === input.patientId)!
        : await addPatient(input.newPatient!);

      const visit = await visitsService.createVisit(clinicId, {
        patientId: patient.id,
        time: nowTimeLabel(),
        durationMinutes: 30,
        reason: input.reason,
        status: "checked-in",
        date: todayISO(),
        source: "walk-in",
      });
      setVisits((prev) => [...prev, visit]);
      return { patient, visit };
    },
    [clinicId, patients, addPatient],
  );

  // Creates the bill only — no payment is collected here. Collecting money
  // is a separate, explicit step (see recordPayment), so a bill always
  // starts "unpaid" even when the doctor plans to collect immediately.
  // Goes through create_bill() (see services/billing.ts) — atomically claims
  // the next invoice number and inserts the bill + items as one transaction.
  const createBill = useCallback(
    async (input: CreateBillInput) => {
      if (!clinicId) throw new Error("No active clinic to create a bill for.");
      const bill = await billingService.createBill(clinicId, input);
      setBills((prev) => [bill, ...prev]);
      return bill;
    },
    [clinicId],
  );

  // The only place a bill's collected/paid state changes. Supports being
  // called more than once per bill (partial payment now, remainder later) —
  // status is always recomputed from amountPaid vs amount, never set
  // directly. Goes through record_payment() (see services/billing.ts), which
  // locks the bill row so concurrent payments can't race, and rejects a
  // payment that would exceed the remaining balance rather than silently
  // clamping it (the bills_amount_paid_not_over_amount invariant is real).
  const recordPayment = useCallback(async (input: RecordPaymentInput) => {
    const bill = await billingService.recordPayment(input);
    setBills((prev) => prev.map((b) => (b.id === bill.id ? bill : b)));
    return bill;
  }, []);

  // Writes directly to `clinic_staff` (the roster table) — RLS already
  // restricts inserts to the clinic's owner/admin (see services/staff.ts),
  // so a non-owner caller gets a clear rejection here rather than a
  // silently-added local row.
  const addStaff = useCallback(
    async (draft: NewStaffDraft) => {
      if (!clinicId) throw new Error("No active clinic to add staff to.");
      const member = await staffService.createStaffMember(clinicId, draft);
      setStaff((prev) => [...prev, member]);
      return member;
    },
    [clinicId],
  );

  const addConsultation = useCallback(
    async (input: NewConsultationInput) => {
      if (!clinicId) throw new Error("No active clinic to add a consultation to.");
      const consultation = await consultationsService.createConsultation(clinicId, input);
      setConsultations((prev) => [...prev, consultation]);
      return consultation;
    },
    [clinicId],
  );

  // Used both to keep editing a "draft" in place across repeated saves, and
  // to flip a draft to "completed" — see ConsultationWorkspace.
  const updateConsultation = useCallback(
    async (id: string, patch: ConsultationUpdateInput) => {
      const existing = consultations.find((c) => c.id === id);
      if (!existing) return undefined;
      const updated = await consultationsService.updateConsultationRecord(id, patch);
      setConsultations((prev) => prev.map((c) => (c.id === id ? updated : c)));
      return updated;
    },
    [consultations],
  );

  // Appends a new dental_chart_entries row (history is append-only in the
  // real schema — see services/toothChart.ts) rather than upserting in
  // place, then updates the local flat view to match what
  // current_tooth_status would now return.
  const setToothStatus = useCallback(
    async (patientId: string, tooth: string, patch: ToothStatusInput) => {
      if (!clinicId) throw new Error("No active clinic to update the dental chart for.");
      const existing = toothRecords.find((r) => r.patientId === patientId && r.tooth === tooth);
      const next = {
        status: patch.status ?? existing?.status ?? "normal",
        note: patch.note !== undefined ? patch.note : existing?.note,
      };
      const recorded = await toothChartService.recordToothStatus(clinicId, patientId, tooth, next);
      setToothRecords((prev) => {
        const idx = prev.findIndex((r) => r.patientId === patientId && r.tooth === tooth);
        if (idx === -1) return [...prev, recorded];
        const copy = [...prev];
        copy[idx] = recorded;
        return copy;
      });
    },
    [clinicId, toothRecords],
  );

  const addDocument = useCallback(
    async (input: NewDocumentInput) => {
      if (!clinicId) throw new Error("No active clinic to add a document to.");
      const document = await documentsService.uploadDocument(clinicId, input);
      setDocuments((prev) => [document, ...prev]);
      return document;
    },
    [clinicId],
  );

  const deleteDocument = useCallback(
    async (id: string) => {
      const doc = documents.find((d) => d.id === id);
      if (!doc) return;
      await documentsService.deleteDocumentAndFile(id, doc.storagePath);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    },
    [documents],
  );

  // Direct authenticated write to `clinics` — RLS restricts this to the
  // clinic's owner (see services/clinic.ts), so a non-owner caller gets a
  // clear rejection rather than a silently-local-only change.
  const updateClinicSettings = useCallback(
    async (patch: Partial<ClinicSettings>) => {
      if (!clinicId) throw new Error("No active clinic to update settings for.");
      const updated = await clinicService.updateClinicSettings(clinicId, patch);
      setClinicSettings(updated);
    },
    [clinicId],
  );

  // Writes to the signed-in user's own `profiles` row, then re-runs
  // authContext's identity load so `profile` (and therefore the
  // `doctorProfile` derived above) reflects the change everywhere it's
  // read — Sidebar/TopBar included, with no extra wiring needed there.
  const updateDoctorProfile = useCallback(
    async (patch: Partial<DoctorProfile>) => {
      await clinicService.updateProfile(patch);
      await refresh();
    },
    [refresh],
  );

  const uploadAvatarPhoto = useCallback(
    async (blob: Blob) => {
      await clinicService.uploadAvatarPhoto(blob);
      await refresh();
    },
    [refresh],
  );

  const removeAvatarPhoto = useCallback(async () => {
    await clinicService.removeAvatarPhoto();
    await refresh();
  }, [refresh]);

  const uploadClinicLogo = useCallback(
    async (blob: Blob) => {
      if (!clinicId) throw new Error("No active clinic to update the logo for.");
      const updated = await clinicService.uploadClinicLogo(clinicId, blob);
      setClinicSettings(updated);
    },
    [clinicId],
  );

  const removeClinicLogo = useCallback(async () => {
    if (!clinicId) throw new Error("No active clinic to update the logo for.");
    const updated = await clinicService.removeClinicLogo(clinicId);
    setClinicSettings(updated);
  }, [clinicId]);

  const setVisitStatus = useCallback(async (visitId: string, status: VisitStatus) => {
    const updated = await visitsService.updateVisitStatus(visitId, status);
    setVisits((prev) => prev.map((v) => (v.id === visitId ? updated : v)));
  }, []);

  // The real `visits` table has no DELETE policy — cancellation is a soft
  // status update, not a row removal (see services/visits.ts). Unlike the
  // old mock, a cancelled visit stays visible (with a "Cancelled" badge)
  // rather than disappearing from the list.
  const cancelVisit = useCallback(async (visitId: string) => {
    const updated = await visitsService.cancelVisitRecord(visitId);
    setVisits((prev) => prev.map((v) => (v.id === visitId ? updated : v)));
  }, []);

  const todaysVisits = useMemo(() => {
    const iso = todayISO();
    return visits
      .filter((v) => v.date === iso)
      .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  }, [visits]);

  const waitingCount = useMemo(
    () => todaysVisits.filter((v) => v.status === "checked-in").length,
    [todaysVisits],
  );

  const value = useMemo(
    () => ({
      dataLoading,
      patients,
      visits,
      bills,
      staff,
      consultations,
      toothRecords,
      documents,
      clinicSettings,
      doctorProfile,
      todaysVisits,
      waitingCount,
      findPatients,
      addPatient,
      updatePatient,
      registerWalkIn,
      createBill,
      recordPayment,
      addStaff,
      addConsultation,
      updateConsultation,
      setToothStatus,
      addDocument,
      deleteDocument,
      updateClinicSettings,
      updateDoctorProfile,
      uploadAvatarPhoto,
      removeAvatarPhoto,
      uploadClinicLogo,
      removeClinicLogo,
      setVisitStatus,
      cancelVisit,
    }),
    [
      dataLoading,
      patients,
      visits,
      bills,
      staff,
      consultations,
      toothRecords,
      documents,
      clinicSettings,
      doctorProfile,
      todaysVisits,
      waitingCount,
      findPatients,
      addPatient,
      updatePatient,
      registerWalkIn,
      createBill,
      recordPayment,
      addStaff,
      addConsultation,
      updateConsultation,
      setToothStatus,
      addDocument,
      deleteDocument,
      updateClinicSettings,
      updateDoctorProfile,
      uploadAvatarPhoto,
      removeAvatarPhoto,
      uploadClinicLogo,
      removeClinicLogo,
      setVisitStatus,
      cancelVisit,
    ],
  );

  return (
    <ClinicDataContext.Provider value={value}>{children}</ClinicDataContext.Provider>
  );
}

export function useClinicData() {
  const ctx = useContext(ClinicDataContext);
  if (!ctx) {
    throw new Error("useClinicData must be used within a ClinicDataProvider");
  }
  return ctx;
}
