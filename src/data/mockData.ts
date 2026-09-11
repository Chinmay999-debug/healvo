// Local mock data for the Healvo frontend foundation.
// Shaped so each export can later be swapped for a real API response
// without changing the components that consume it.

import { todayISO } from "../lib/utils";

export const clinic = {
  name: "Sharma Dental",
  location: "Indiranagar, Bengaluru",
  initial: "A",
  phone: "+91 80 4123 4567",
  slug: "sharma-dental",
  bookingPath: "/book/sharma-dental",
  bookingDisplayUrl: "healvo.in/book/sharma-dental",
};

export const doctor = {
  name: "Dr. Ananya Sharma",
  firstName: "Ananya",
  role: "Owner · Dentist",
  initials: "AS",
};

// The signed-in user's own editable profile — separate from `doctor` (the
// static demo-page identity used only by the still-mock-backed public
// booking page) and from `staff` (clinic-wide roster records), the same way
// ClinicSettings sits apart from `clinic`. Real data comes from the
// `profiles` table + auth.users email (see services/clinic.ts,
// state/clinicData.tsx) — Settings > Account edits this for real as of P4.6.
export interface DoctorProfile {
  name: string;
  email: string;
  phone: string;
  title: string;
}

// Healvo supports exactly two staff roles. Access is role-based and
// automatic — there is no separate permission-level selector. Backed by the
// `clinic_staff` roster table as of P4.6 (see services/staff.ts) — Doctor
// maps to the DB's `dentist`, Reception to `staff`.
export type StaffRole = "Doctor" | "Reception";
export type StaffStatus = "Active" | "Inactive";

export interface StaffMember {
  id: string;
  name: string;
  initials: string;
  role: StaffRole;
  phone: string;
  status: StaffStatus;
}

// The clinic's own configuration — Settings edits this for real as of P4.6,
// backed by the `clinics` table (see services/clinic.ts,
// state/clinicData.tsx). The public booking page reads
// workingDays/openingTime/closingTime/appointmentDuration for availability.
export type Weekday =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

export const WEEKDAYS: Weekday[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/** A block of clinic hours during which no appointments are bookable. */
export interface BreakPeriod {
  /** "hh:mm AM/PM" — matches the format used across visit/bill times. */
  startTime: string;
  endTime: string;
}

export interface ClinicSettings {
  clinicName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  workingDays: Record<Weekday, boolean>;
  /** "hh:mm AM/PM" — matches the format used across visit/bill times. */
  openingTime: string;
  closingTime: string;
  /** Minutes. */
  appointmentDuration: number;
  onlineBookingEnabled: boolean;
  breaks: BreakPeriod[];
}


// "cancelled" added for P4.2: the real `visits` table has no DELETE policy
// (a cancelled visit must remain in the database — see
// healvo-backend/supabase/migrations/20260829190300_patients_visits.sql), so
// cancelVisit() now sets this status instead of removing the row.
export type VisitStatus =
  | "scheduled"
  | "checked-in"
  | "in-treatment"
  | "completed"
  | "cancelled";

export type VisitSource = "manual" | "walk-in" | "online";

export interface Visit {
  id: string;
  time: string;
  durationMinutes: number;
  patientName: string;
  patientInitials: string;
  patientMeta: string;
  patientPhone?: string;
  reason: string;
  status: VisitStatus;
  /** ISO date (YYYY-MM-DD) the visit falls on. Defaults to today when omitted. */
  date?: string;
  patientId?: string;
  source?: VisitSource;
}

export const todaysVisits: Visit[] = [
  {
    id: "v1",
    time: "09:30 AM",
    durationMinutes: 30,
    patientName: "Priya Sharma",
    patientInitials: "PS",
    patientMeta: "Age 27",
    patientPhone: "+919876543210",
    reason: "Root canal consultation",
    status: "completed",
    patientId: "p1",
    source: "manual",
  },
  {
    id: "v2",
    time: "10:15 AM",
    durationMinutes: 45,
    patientName: "Rahul Verma",
    patientInitials: "RV",
    patientMeta: "Age 30",
    patientPhone: "+919845012345",
    reason: "Routine cleaning",
    status: "in-treatment",
    patientId: "p3",
    source: "manual",
  },
  {
    id: "v3",
    time: "11:00 AM",
    durationMinutes: 30,
    patientName: "Neha Jain",
    patientInitials: "NJ",
    patientMeta: "Age 29",
    patientPhone: "+919123456780",
    reason: "Tooth sensitivity",
    status: "checked-in",
    patientId: "p4",
    source: "manual",
  },
  {
    id: "v4",
    time: "11:45 AM",
    durationMinutes: 40,
    patientName: "Amit Gupta",
    patientInitials: "AG",
    patientMeta: "Age 36",
    patientPhone: "+919988766554",
    reason: "Crown fitting",
    status: "scheduled",
    patientId: "p5",
    source: "manual",
  },
  {
    id: "v5",
    time: "12:30 PM",
    durationMinutes: 30,
    patientName: "Sneha Singh",
    patientInitials: "SS",
    patientMeta: "Age 24",
    patientPhone: "+919000011223",
    reason: "Braces review",
    status: "scheduled",
    patientId: "p6",
    source: "manual",
  },
  {
    id: "v6",
    time: "01:15 PM",
    durationMinutes: 30,
    patientName: "Vikram Shah",
    patientInitials: "VS",
    patientMeta: "Age 42",
    patientPhone: "+919812345678",
    reason: "Walk-in · Dental pain",
    status: "scheduled",
    patientId: "p7",
    source: "walk-in",
  },
  {
    id: "v7",
    time: "02:00 PM",
    durationMinutes: 45,
    patientName: "Arjun Nair",
    patientInitials: "AN",
    patientMeta: "Age 31",
    patientPhone: "+919712388990",
    reason: "Wisdom tooth consultation",
    status: "scheduled",
    patientId: "p8",
    source: "manual",
  },
  {
    id: "v8",
    time: "02:45 PM",
    durationMinutes: 30,
    patientName: "Rohit Mehta",
    patientInitials: "RM",
    patientMeta: "Age 34",
    patientPhone: "+919654321098",
    reason: "Routine cleaning",
    status: "scheduled",
    patientId: "p9",
    source: "manual",
  },
];

export type PatientType = "new" | "returning";
export type Gender = "Male" | "Female" | "Other";

export interface Patient {
  id: string;
  name: string;
  initials: string;
  phone: string;
  /** P4.3: BookAppointment collects this (patients.email in the real
   * schema, added in P4.1 for exactly this purpose) — no longer dropped. */
  email?: string;
  age?: number;
  gender?: Gender;
  type: PatientType;
  /** ISO timestamp `patients.created_at` was inserted — Overview's Recent
   * Activity feed uses this to place "new patient" entries in real
   * chronological order alongside real payments/visits (see Overview.tsx). */
  createdAt?: string;
}

// Phone numbers are stored in normalized "+91XXXXXXXXXX" form — see lib/phone.ts.
// Format with formatPhoneDisplay() wherever a phone number is shown in the UI.
export const patients: Patient[] = [
  { id: "p1", name: "Priya Sharma", initials: "PS", phone: "+919876543210", age: 27, gender: "Female", type: "returning" },
  { id: "p2", name: "Priya Shah", initials: "PS", phone: "+919876544321", age: 33, gender: "Female", type: "returning" },
  { id: "p3", name: "Rahul Verma", initials: "RV", phone: "+919845012345", age: 30, gender: "Male", type: "returning" },
  { id: "p4", name: "Neha Jain", initials: "NJ", phone: "+919123456780", age: 29, gender: "Female", type: "returning" },
  { id: "p5", name: "Amit Gupta", initials: "AG", phone: "+919988766554", age: 36, gender: "Male", type: "returning" },
  { id: "p6", name: "Sneha Singh", initials: "SS", phone: "+919000011223", age: 24, gender: "Female", type: "new" },
  { id: "p7", name: "Vikram Shah", initials: "VS", phone: "+919812345678", age: 42, gender: "Male", type: "returning" },
  { id: "p8", name: "Arjun Nair", initials: "AN", phone: "+919712388990", age: 31, gender: "Male", type: "new" },
  { id: "p9", name: "Rohit Mehta", initials: "RM", phone: "+919654321098", age: 34, gender: "Male", type: "returning" },
];

// Prior clinic visits (all dated before today) so the Patients directory has
// realistic visit history — total visit counts and last-visit dates — to
// derive from. Today's visits above cover the current day; this covers the past.
function historyVisit(
  id: string,
  patientId: string,
  date: string,
  reason: string,
): Visit {
  const patient = patients.find((p) => p.id === patientId)!;
  return {
    id,
    time: "10:00 AM",
    durationMinutes: 30,
    patientName: patient.name,
    patientInitials: patient.initials,
    patientMeta: patient.age ? `Age ${patient.age}` : "",
    patientPhone: patient.phone,
    reason,
    status: "completed",
    date,
    patientId: patient.id,
    source: "manual",
  };
}

export const pastVisits: Visit[] = [
  historyVisit("h1", "p1", "2026-08-20", "Follow-up cleaning"),
  historyVisit("h2", "p1", "2026-08-12", "Cavity filling"),
  historyVisit("h3", "p1", "2026-07-28", "Routine checkup"),
  historyVisit("h4", "p1", "2026-07-10", "Teeth whitening"),
  historyVisit("h5", "p1", "2026-06-22", "Routine checkup"),
  historyVisit("h6", "p1", "2026-05-30", "Cleaning"),
  historyVisit("h7", "p1", "2026-05-02", "Consultation"),

  historyVisit("h8", "p3", "2026-08-18", "Cavity filling"),
  historyVisit("h9", "p3", "2026-07-25", "Routine checkup"),
  historyVisit("h10", "p3", "2026-06-30", "Cleaning"),
  historyVisit("h11", "p3", "2026-06-05", "Consultation"),

  historyVisit("h12", "p4", "2026-08-05", "Consultation"),

  historyVisit("h13", "p5", "2026-08-12", "Crown consultation"),
  historyVisit("h14", "p5", "2026-07-15", "Routine checkup"),
  historyVisit("h15", "p5", "2026-06-20", "Cleaning"),

  historyVisit("h16", "p7", "2026-07-30", "Dental pain follow-up"),
  historyVisit("h17", "p7", "2026-06-18", "Routine checkup"),

  historyVisit("h18", "p9", "2026-08-08", "Routine checkup"),
  historyVisit("h19", "p9", "2026-06-14", "Cleaning"),

  historyVisit("h20", "p2", "2026-08-14", "Routine checkup"),
  historyVisit("h21", "p2", "2026-07-02", "Cleaning"),
  historyVisit("h22", "p2", "2026-05-20", "Consultation"),
];

export type PaymentMethod = "Cash" | "UPI" | "Card" | "Other";

// Clinic-collection status, not an accounts-receivable state machine — a
// bill is unpaid until money is recorded against it, then partially-paid or
// paid once amountPaid catches up to amount. See recordPayment in clinicData.
export type BillStatus = "unpaid" | "partially-paid" | "paid";

/** One line on a bill — "Root canal consultation", "X-ray", etc. */
export interface BillItem {
  description: string;
  amount: number;
}

/** One payment collected against a bill. A bill can be paid in more than one
 * pass (e.g. partial today, remainder next visit), so this is an array. */
export interface Payment {
  id: string;
  amount: number;
  method: PaymentMethod;
  /** ISO date (YYYY-MM-DD) the payment was collected. */
  date: string;
  /** "hh:mm AM/PM" time of collection. */
  time: string;
}

export interface Bill {
  id: string;
  patientId: string;
  /** Visit this bill was generated for. Omitted when a bill isn't tied to a specific visit. */
  visitId?: string;
  invoiceNumber: string;
  /** Short human-readable summary of the bill — the first item's
   * description, or "<first item> +N more" for multi-item bills. Kept
   * alongside `items` so existing single-line displays (billing tables,
   * related-activity rows) don't need to special-case line items. */
  treatment: string;
  /** Line items making up this bill. Always at least one entry. */
  items: BillItem[];
  /** Total of all items — the amount owed. */
  amount: number;
  /** Sum of all payments recorded so far. */
  amountPaid: number;
  payments: Payment[];
  /** Most recent payment method, when any payment has been recorded. */
  paymentMethod?: PaymentMethod;
  /** ISO date (YYYY-MM-DD) the bill was created. */
  date: string;
  /** "hh:mm AM/PM" time the bill was created, when known. */
  time?: string;
  status: BillStatus;
}

const TREATMENT_AMOUNTS: Record<string, number> = {
  "Root canal consultation": 2500,
  "Follow-up cleaning": 1200,
  "Cavity filling": 1800,
  "Routine checkup": 800,
  "Teeth whitening": 4500,
  Cleaning: 1000,
  Consultation: 600,
  "Crown consultation": 3200,
  "Dental pain follow-up": 900,
};
const DEFAULT_TREATMENT_AMOUNT = 1000;

const PAYMENT_METHODS: PaymentMethod[] = ["UPI", "Cash", "Card", "Other"];

// Seeded bills are all historical and fully collected — a real clinic's
// past billing history wouldn't still be sitting unpaid — so each one gets
// a single payment for its full amount, recorded the same day as the bill.
function billForVisit(visit: Visit, index: number): Bill {
  const amount = TREATMENT_AMOUNTS[visit.reason] ?? DEFAULT_TREATMENT_AMOUNT;
  const method = PAYMENT_METHODS[index % PAYMENT_METHODS.length];
  const date = visit.date ?? todayISO();
  return {
    id: `b-${visit.id}`,
    patientId: visit.patientId!,
    visitId: visit.id,
    invoiceNumber: `INV-${1001 + index}`,
    treatment: visit.reason,
    items: [{ description: visit.reason, amount }],
    amount,
    amountPaid: amount,
    payments: [{ id: `pay-${visit.id}`, amount, method, date, time: visit.time }],
    paymentMethod: method,
    date,
    time: visit.time,
    status: "paid",
  };
}

// A bill for every visit that has actually happened (completed) so far —
// each one carries a real patientId/visitId, never a hardcoded patient name.
export const bills: Bill[] = [
  ...todaysVisits.filter((v) => v.status === "completed"),
  ...pastVisits,
].map((visit, index) => billForVisit(visit, index));

export type PatientDocumentType = "X-ray" | "Photo" | "Prescription" | "Report" | "Other";

// X-rays, photos, prescriptions, reports — anything attached to a patient
// record. Belongs to the patient by default; visitId is an optional link,
// never required. storagePath is the object's path in the private
// `patient-documents` Storage bucket (P4.4) — never a permanent/public URL;
// the UI resolves it to a short-lived signed URL only when actually
// displaying or opening the file (see services/documents.ts).
export interface PatientDocument {
  id: string;
  patientId: string;
  visitId?: string;
  name: string;
  type: PatientDocumentType;
  storagePath: string;
  fileType: string;
  /** Bytes. */
  fileSize: number;
  /** ISO date (YYYY-MM-DD). */
  uploadedAt: string;
}

// Intentionally empty — every patient starts with no documents so the
// Documents tab's empty state is what a fresh clinic actually sees.
export const patientDocuments: PatientDocument[] = [];

export type ConsultationStatus = "draft" | "completed";

// Deliberately just 3 outcomes — no "Referred" and no other hospital-style
// outcomes. Healvo is built for private dental clinics.
export type VisitOutcome = "consultation-only" | "treatment-planned" | "treatment-completed";

// Kept deliberately small — one doctor-facing note field (clinicalNotes)
// instead of separate diagnosis/treatment-planned/procedure-performed
// fields, and teethSelected is the only place tooth numbers live (the
// Dental Chart tab is their source of truth, not a typed input here).
export interface Consultation {
  id: string;
  patientId: string;
  /** Visit this consultation was recorded during, when known. */
  visitId?: string;
  /** ISO date (YYYY-MM-DD) the consultation was recorded. */
  date: string;
  /** Snapshot of the associated visit's reason at save time, when known. */
  visitReason?: string;
  /** The complaint in the patient's own words. */
  patientWords?: string;
  /** Findings, diagnosis, treatment and advice — one free-text field. */
  clinicalNotes?: string;
  /** Set via the Dental Chart tab, not typed here. */
  teethSelected: string[];
  /** Plain text, one item per line — no medication database in V1. */
  prescription?: string;
  followUpRequired: boolean;
  /** A preset ("7 days"/"14 days"/"30 days") or an ISO date when custom. */
  followUpWhen?: string;
  followUpRecommendation?: string;
  visitOutcome?: VisitOutcome;
  status: ConsultationStatus;
}

// A seeded consultation for Priya Sharma's most recent visit so the Patient
// Record's Overview has something real to show during development.
export const consultations: Consultation[] = [
  {
    id: "c1",
    patientId: "p1",
    visitId: "v1",
    date: todayISO(),
    visitReason: "Root canal consultation",
    patientWords: "Pain in lower right tooth for 3 days.",
    clinicalNotes:
      "Tooth 46 has deep caries with suspected irreversible pulpitis — sensitive to cold and pressure, mild swelling. Root canal treatment planned; discussed procedure and duration with patient.",
    teethSelected: ["46"],
    prescription: "Amoxicillin 500mg — 1 tab x 3/day\nIbuprofen 400mg — SOS",
    followUpRequired: true,
    followUpWhen: "7 days",
    followUpRecommendation: "Begin root canal treatment.",
    visitOutcome: "treatment-planned",
    status: "completed",
  },
];

export type ToothStatus =
  | "normal"
  | "needs-attention"
  | "treatment-planned"
  | "treatment-completed"
  | "missing";

// Sparse by design — most teeth have no record at all and are treated as
// "normal". A tooth only gets a row here once a doctor sets a non-default
// status or note for it via the Dental Chart.
export interface ToothRecord {
  patientId: string;
  /** FDI tooth number, e.g. "46". */
  tooth: string;
  status: ToothStatus;
  note?: string;
}

// Kept consistent with the seeded consultation above — Priya Sharma's RCT on
// tooth 46 shows up identically in both places.
export const toothRecords: ToothRecord[] = [
  { patientId: "p1", tooth: "46", status: "treatment-planned", note: "RCT in progress" },
  { patientId: "p3", tooth: "18", status: "missing", note: "Extracted" },
  { patientId: "p5", tooth: "36", status: "treatment-completed", note: "RCT completed 2024" },
  { patientId: "p7", tooth: "26", status: "needs-attention", note: "Sensitivity to cold" },
];

export const VISIT_REASONS = [
  "Consultation",
  "Dental pain",
  "Cleaning",
  "Follow-up",
  "Tooth sensitivity",
  "Other",
] as const;


export type ActivityTone = "mint" | "blue" | "amber";

export interface ActivityEntry {
  id: string;
  icon: "check" | "file" | "activity";
  tone: ActivityTone;
  title: string;
  subtitle: string;
  time: string;
}

// The Recent Activity feed itself is computed live from real patients/
// visits/bills — see Overview.tsx's buildRecentActivity. QA finding: this
// used to be a hardcoded array (fictional names/amounts) rendered verbatim
// on every clinic's real dashboard, including brand-new empty clinics —
// genuine mock-data leakage, not a demo-only feature, removed here.
