# Healvo Backend Architecture Audit (P4.0)

Audit + architecture only. Nothing in the application was modified to produce this document. Grounded entirely in the current codebase as of this pass — no invented entities.

Files inspected: `src/data/mockData.ts`, `src/state/clinicData.tsx`, `src/lib/aiContext.ts`, `server/aiChat.ts`, `vite.config.ts`, `src/components/patient-record/{dentalChartData,historyTimeline}.ts`, `src/components/billing/billStatusMeta.ts`, `src/App.tsx`, `src/components/layout/ClinicSelector.tsx`, `src/pages/{BookAppointment,Reports}.tsx`, `src/components/settings/AccountSettingsPanel.tsx`, `src/components/patient-record/AddDocumentModal.tsx`, `.env.example`.

---

## 1. Existing data model — the complete map

Everything lives in two files: `src/data/mockData.ts` (types + seed arrays) and `src/state/clinicData.tsx` (the single React Context — `ClinicDataProvider` — that holds all state in `useState` and exposes every CRUD function via `useClinicData()`). No other file touches raw data arrays directly; ~30 components/pages consume only `useClinicData()`. This is the single seam the whole migration goes through.

```
clinic (static identity) ─┐
clinicSettings (editable) ─┴─▶ ONE clinic, today

doctor (static display)
doctorProfile (editable account fields)   } both describe the same seeded user
staffMembers[]                             } roster, including that same user

patients[]
  └─ visits[] (patientId)          — appointment + visit lifecycle, one entity
       ├─ consultations[] (visitId?)     — 0 or 1 per visit
       ├─ bills[] (visitId?)             — 0..n per visit
       │    ├─ items[]  (embedded)
       │    └─ payments[] (embedded)
       └─ patientDocuments[] (visitId?)  — belongs to patient, visit link optional
  └─ toothRecords[] (patientId + tooth)  — sparse, CURRENT state only, no history

recentActivity[]   — static mock, NOT wired to any real CRUD action
revenueSeries/revenueSummary — static mock, NOT derived (Reports page computes live from bills instead)
dentalChartData (ALL_TEETH etc.) — static FDI geometry constant, not clinic data at all
```

Per-entity detail:

- **clinic** (`mockData.ts:7`) — `{ name, location, initial, phone, slug, bookingPath, bookingDisplayUrl }`. Used only for display (sidebar `ClinicSelector`, booking route). `ClinicSelector` is a link to Settings, not a clinic switcher — confirmed by reading it; there is no multi-clinic UI today.
- **doctor** (`mockData.ts:17`) — static `{ name, firstName, role: "Owner · Dentist", initials }`, used in sidebar/topbar. `role` is a free-text display string, not a structured role — the only structured role type in the app is `StaffRole`.
- **doctorProfile** (`mockData.ts:28`) — `{ name, email, phone, title }`, edited via Settings → Account. Distinct from `doctor` and from `staffMembers` by explicit code comment — three places the "same person" is represented.
- **staffMembers[]** (`mockData.ts:47`) — `{ id, name, initials, role: "Doctor"|"Reception", phone, status: "Active"|"Inactive" }`. `AddStaffModal` collects **name + phone + role only — no email, no invite step**. There is no login for staff today.
- **clinicSettings** (`mockData.ts:105`) — `{ clinicName, phone, email, address, city, workingDays: Record<Weekday,bool>, openingTime, closingTime, appointmentDuration (minutes), onlineBookingEnabled, breaks: BreakPeriod[] }`. Overlaps with `clinic` (name/phone both exist in both objects) — this is a frontend split, not a domain requirement.
- **patients[]** (`mockData.ts:278`) — `{ id, name, initials, phone, age?, gender?, type: "new"|"returning" }`. `type` is set once at creation (`addPatient` always sets `"new"`) and **no code ever transitions it to `"returning"`** — this is an existing gap in the app, not something to silently "fix" in the backend design.
- **visits[]** (`mockData.ts:152`) — `{ id, time, durationMinutes, patientName, patientInitials, patientMeta, patientPhone?, reason, status: scheduled|checked-in|in-treatment|completed, date?, patientId?, source?: manual|walk-in|online }`. **This single entity is both "appointment" and "visit"** — there is no separate appointment concept anywhere in the codebase. `patientName/patientInitials/patientMeta/patientPhone` are pure denormalization for the in-memory array (no join available) — not meaningful in a relational DB.
- **bills[]** (`mockData.ts:384`) — `{ id, patientId, visitId?, invoiceNumber, treatment (denormalized summary), items: BillItem[], amount, amountPaid, payments: Payment[], paymentMethod?, date, time?, status: unpaid|partially-paid|paid }`. `BillItem = {description, amount}`, `Payment = {id, amount, method, date, time}`, both embedded arrays, not separate top-level mock arrays.
  - **No `updateBill`/`deleteBill`/`voidBill` function exists.** Bills and their items are immutable after `createBill`. Only `recordPayment` ever mutates a bill afterward, and only `amountPaid`/`payments`/`status`/`paymentMethod`.
  - `invoiceNumber` is generated as `INV-${1001 + bills.length}` — not concurrency-safe, and leaks total bill count into the number itself.
- **consultations[]** (`mockData.ts:491`) — `{ id, patientId, visitId?, date, visitReason? (point-in-time snapshot), patientWords?, clinicalNotes? (single free-text field, by design — comment explicitly rejects separate diagnosis/treatment fields), teethSelected: string[], prescription? (plain text, "no medication database in V1" per comment), followUpRequired, followUpWhen? (preset OR ISO date, same field), followUpRecommendation?, visitOutcome?: consultation-only|treatment-planned|treatment-completed, status: draft|completed }`.
- **toothRecords[]** (`mockData.ts:548`) — `{ patientId, tooth (FDI code string), status: normal|needs-attention|treatment-planned|treatment-completed|missing, note? }`. Sparse — a tooth only gets a row once it's touched. `setToothStatus` in `clinicData.tsx:496` **upserts by (patientId, tooth)** — there is currently no history, each save overwrites the prior state.
- **patientDocuments[]** (`mockData.ts:463`) — `{ id, patientId, visitId?, name, type: X-ray|Photo|Prescription|Report|Other, fileUrl, fileType (MIME), fileSize (bytes), uploadedAt }`. `fileUrl` is a **blob: URL held in browser memory only** — nothing is actually uploaded anywhere today. Seed array is intentionally empty. Client-side cap is 20MB (`AddDocumentModal.tsx:23`); the `accept` attribute is the only MIME gate (trivially bypassed).
- **recentActivity[]** (`mockData.ts:623`) — static array of 3 hardcoded entries. Confirmed by grep: **no CRUD function anywhere pushes to it.** It is decorative today, not derived from real state.
- **revenueSeries/revenueSummary** (`mockData.ts:577`) — fully static, consumed only by `RevenueChart` on the Overview page. By contrast, `Reports.tsx`'s `RevenueTrendCard`/`PatientTrendCard` **do** compute live from `bills`/`visits` via `useClinicData()`. This is an inconsistency in the current app (Overview shows fake numbers, Reports shows real ones), not a backend requirement — flagged for awareness, not something this pass fixes.
- **dentalChartData** (`components/patient-record/dentalChartData.ts`) — a hardcoded array of all 32 permanent-teeth FDI positions/types/quadrants. Pure UI geometry constant. **Not clinic data — no database table needed.**
- **historyTimeline / buildVisitHistory** (`components/patient-record/historyTimeline.ts`) — a pure client-side join of visits + consultations + bills + toothRecords for the Patient History tab. Not a persisted entity — becomes a SQL query/view.
- **BookAppointment collects `email`** (`pages/BookAppointment.tsx:24`) and passes it into `bookAppointment()`, but `BookingInput.email` is **silently dropped** — `Patient` has no `email` field, so nothing persists it today. Flagged as a decision point in §6.

**Auth reality check:** there is no login screen, no session, no "current user" threaded through any component. The app renders one hardcoded identity (`doctor`) for everyone. This is a genuinely blank slate for auth design, not a migration.

---

## 2. Multi-tenant model

Grounded decision: **one `clinics` table, one bridge table (`clinic_memberships`) between `auth.users` and `clinics`, and every clinic-owned table carries a `clinic_id`.** A user has zero-to-many memberships; today the product only ever creates one, but nothing in the schema prevents more later.

```
auth.users (Supabase-managed)
   │ 1:1
   ▼
profiles (id = auth.users.id)
   │
   │ 1:many
   ▼
clinic_memberships (user_id, clinic_id, role, status)
   │ many:1
   ▼
clinics
   │ 1:many (clinic_id FK on every row below)
   ├─ patients
   │    ├─ visits
   │    │    ├─ consultations
   │    │    └─ documents (visit_id optional)
   │    ├─ dental_chart_entries
   │    ├─ documents
   │    └─ bills
   │         ├─ bill_items
   │         └─ payments
   └─ (clinics row itself holds settings — see §5)
```

Ownership rule, applied uniformly: **every clinic-owned table has a NOT NULL `clinic_id uuid references clinics(id)`.** Rows never move between clinics — no cross-clinic FK ever points at a differently-scoped parent (e.g. a `visit_id` FK always belongs to the same `clinic_id` as the bill referencing it; enforced by including `clinic_id` directly on the child rather than trusting a transitive join, which also keeps RLS policies a single flat check instead of a multi-hop join).

Cascading:
- `clinics` → nothing cascades from clinic deletion in v1 (clinic deletion isn't a feature the app has; if ever added, it should be a soft `deleted_at`, not `ON DELETE CASCADE` across a whole tenant's medical records).
- `patients` → `ON DELETE RESTRICT` is safer than cascade for a patient with billing history; the app has no "delete patient" feature today, so this is precautionary, not derived from existing behavior.
- `visits` → `bills.visit_id`, `consultations.visit_id`, `documents.visit_id` should be `ON DELETE SET NULL` (matches the mock's `visitId?` optionality — a bill/consultation/document can already exist without a visit).
- `bills` → `bill_items`/`payments` are `ON DELETE CASCADE` (they have no independent meaning without their bill — matches how the mock embeds them as arrays on `Bill`).
- `clinic_memberships` → `ON DELETE CASCADE` from both `auth.users` and `clinics`.

Nullable vs required, the few non-obvious ones:
- `visits.patient_id` — the mock type has it as `patientId?` (optional!), but every function that creates a visit (`registerWalkIn`, `bookAppointment`, `historyVisit`) always sets it. No code path creates a patientless visit. **Recommend NOT NULL** in the DB — tightening an accidentally-optional TS field to match actual usage, not a behavior change.
- `bills.visit_id`, `consultations.visit_id`, `documents.visit_id` — genuinely optional in real usage (a bill can be raised with no visit selected in `CreateBillModal`). Keep nullable.
- `patients.age`, `patients.gender` — optional today, keep optional.

---

## 3. Authentication architecture

```
auth.users                     Supabase-managed: email, password hash, session.
   │                           Nothing clinic-specific stored here.
   ▼
profiles                       id (= auth.users.id, PK/FK), full_name, phone, title,
                                created_at.
                                Replaces the "name/phone/title" part of doctorProfile.
                                Do NOT duplicate email here — read it via auth.users
                                (through auth.uid()/session) or a security-definer
                                view if a joined read is ever needed. Duplicating
                                email invites drift between the two copies.
   │
   ▼
clinic_memberships              user_id (FK → auth.users), clinic_id (FK → clinics),
                                 role (owner | doctor | reception), status (active|inactive),
                                 invited_email (nullable), created_at.
                                 Replaces staffMembers AND is the multi-tenant bridge.
   │
   ▼
clinics                         The tenant. See §5 for columns.
```

Mapping the current demo identity forward:
- **Dr. Ananya Sharma** → one `auth.users` row (email `ananya@sharmadental.in`, matching `initialDoctorProfile.email`) + one `profiles` row (`full_name: "Dr. Ananya Sharma"`, `title: "Owner · Dentist"`, `phone`) + one `clinic_memberships` row (`role: owner`, `clinic_id` = Sharma Dental's row).
- **Riya Mehta** (`st2`, Reception) → in the *current* app she's a roster entry with no email and no login. She should become a `clinic_memberships` row with **`user_id` left nullable** until she's actually invited into Supabase Auth (see the `owner`-role note below and the roster-vs-membership decision in §17). Forcing every `AddStaffModal` submission to immediately create a Supabase Auth user would require collecting an email the current form doesn't ask for — that's a product decision, not something this audit should silently assume.

**One addition beyond what the app has today:** `StaffRole` only has `"Doctor"|"Reception"`. Multi-tenant SaaS needs at least one role that can manage clinic settings, invite/remove staff, and (later) billing/subscription — the app's own `doctor.role` display string ("Owner · Dentist") already gestures at this without ever encoding it structurally. Recommend a third `clinic_role` value, `owner`, layered on top of the existing two — flagged explicitly here as the one deliberate addition, not something derived from existing code.

What belongs where:
| Data | Lives in |
|---|---|
| email, password, session | `auth.users` (Supabase Auth) |
| full name, phone, title/display role text | `profiles` |
| which clinic(s), what role, active/inactive | `clinic_memberships` |
| clinic name/contact/hours/booking config | `clinics` |

---

## 4. Row Level Security strategy

Two helper functions (SECURITY DEFINER, so policies stay one-liners and to sidestep the classic Supabase gotcha where a policy on `clinic_memberships` that queries `clinic_memberships` recurses into itself):

```sql
create or replace function is_clinic_member(target_clinic uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from clinic_memberships
    where clinic_id = target_clinic and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function is_clinic_owner(target_clinic uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from clinic_memberships
    where clinic_id = target_clinic and user_id = auth.uid()
      and role = 'owner' and status = 'active'
  );
$$;
```

Table-by-table (every clinic-owned table gets the same two-policy shape — read via membership, write via membership, with owner-only carve-outs where noted):

| Table | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| `clinics` | `is_clinic_member(id)` | `is_clinic_owner(id)` only |
| `clinic_memberships` | `is_clinic_member(clinic_id)` (so staff can see their clinic-mates, matching today's Staff page) | `is_clinic_owner(clinic_id)` only (adding/removing staff is an owner action — no equivalent gating exists in the current single-tenant app, so this is a new, deliberate rule) |
| `profiles` | own row only (`id = auth.uid()`), plus readable by anyone who shares a clinic (needed to render staff names) via a join through `clinic_memberships` | own row only |
| `patients` | `is_clinic_member(clinic_id)` | `is_clinic_member(clinic_id)` (both roles can add/edit patients today — `AddPatientModal`/`EditPatientModal` aren't role-gated in the UI) |
| `visits` | `is_clinic_member(clinic_id)` | `is_clinic_member(clinic_id)` |
| `consultations` | `is_clinic_member(clinic_id)` | `is_clinic_member(clinic_id)` — clinical notes; consider `doctor`+`owner` only for INSERT/UPDATE later, but the current UI never gates this by role either |
| `dental_chart_entries` | `is_clinic_member(clinic_id)` | `is_clinic_member(clinic_id)` |
| `documents` | `is_clinic_member(clinic_id)` | `is_clinic_member(clinic_id)` |
| `bills` / `bill_items` / `payments` | `is_clinic_member(clinic_id)` | `is_clinic_member(clinic_id)` |

Every table gets `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` **and** `FORCE ROW LEVEL SECURITY` the moment it's created — the Supabase `anon`/`authenticated` keys are public by design, so a table with RLS enabled but no policies simply denies everyone, which is the safe default while the schema is being built out incrementally. Cross-clinic leakage (Clinic A reading Clinic B's patients/visits/billing/documents/staff/settings) is structurally impossible under this design because every policy bottoms out in the same `clinic_memberships` check — there's no table that skips it.

Storage RLS (bucket `patient-documents`) mirrors this by parsing `clinic_id` out of the object path (see §7) instead of joining a table:

```sql
create policy "clinic members read own documents"
on storage.objects for select
using (bucket_id = 'patient-documents' and is_clinic_member((storage.foldername(name))[1]::uuid));
```

---

## 5. Database schema

Enums:

```sql
create type clinic_role as enum ('owner', 'doctor', 'reception');
create type membership_status as enum ('active', 'inactive');
create type patient_gender as enum ('male', 'female', 'other');
create type patient_type as enum ('new', 'returning');
create type visit_status as enum ('scheduled', 'checked_in', 'in_treatment', 'completed', 'cancelled'); -- see note below
create type visit_source as enum ('manual', 'walk_in', 'online');
create type consultation_status as enum ('draft', 'completed');
create type visit_outcome as enum ('consultation_only', 'treatment_planned', 'treatment_completed');
create type tooth_status as enum ('normal', 'needs_attention', 'treatment_planned', 'treatment_completed', 'missing');
create type document_type as enum ('x_ray', 'photo', 'prescription', 'report', 'other');
create type bill_status as enum ('unpaid', 'partially_paid', 'paid'); -- partially_paid kept per explicit requirement
create type payment_method as enum ('cash', 'upi', 'card', 'other');
```

> **`cancelled` note:** today `cancelVisit` (`clinicData.tsx:542`) hard-deletes the visit row from the in-memory array — there is no `cancelled` status in the current type. In Postgres, hard-deleting a real clinic's appointment history is a bigger loss than clearing a local array (no audit trail, breaks any FK from a bill/document that referenced it). **Recommendation, not yet decided:** add `cancelled` and switch `cancelVisit` to a soft status update. Flagged here as a decision for you, not silently assumed — the schema below includes it as the only status value with no current UI equivalent.

```sql
create table clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,                 -- e.g. "sharma-dental", drives /book/:slug
  phone text,
  email text,
  address text,
  city text,
  working_days jsonb not null default '{"monday":true,"tuesday":true,"wednesday":true,"thursday":true,"friday":true,"saturday":true,"sunday":false}',
  opening_time time not null default '09:00',
  closing_time time not null default '19:00',
  appointment_duration_minutes int not null default 30,
  online_booking_enabled boolean not null default true,
  breaks jsonb not null default '[]',         -- [{startTime,endTime}], small+bounded, no child table needed
  next_invoice_seq int not null default 1001, -- atomic per-clinic invoice counter, see §17
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- merges `clinic` + `clinicSettings` from mockData.ts — the split was a frontend
-- artifact (two objects with overlapping name/phone fields), not a domain need.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  title text,                                  -- "Owner · Dentist" style display string
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table clinic_memberships (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,   -- nullable: roster entry before invite acceptance
  invited_email text,                                          -- set when inviting; null once user_id is attached
  role clinic_role not null default 'reception',
  status membership_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (clinic_id, user_id)
);
create index on clinic_memberships (user_id);
create index on clinic_memberships (clinic_id);

create table patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete restrict,
  first_name text not null,
  last_name text,
  phone text not null,                         -- normalized "+91XXXXXXXXXX", matches lib/phone.ts today
  email text,                                   -- NEW: BookAppointment already collects it and drops it (see §6)
  age smallint,
  gender patient_gender,
  patient_type patient_type not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, phone)
);
create index on patients (clinic_id);
create index on patients (clinic_id, lower(first_name || ' ' || coalesce(last_name, ''))); -- name search

create table visits (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete restrict,
  visit_date date not null,
  start_time time not null,                     -- was a "hh:mm AM/PM" string; native `time` is the better fit
  duration_minutes int not null default 30,
  reason text not null,
  status visit_status not null default 'scheduled',
  source visit_source not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on visits (clinic_id, visit_date);
create index on visits (patient_id);
-- patientName/patientInitials/patientMeta/patientPhone from the mock are NOT
-- columns here — they're 100% derivable via the patients FK join.

create table consultations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete restrict,
  visit_id uuid references visits(id) on delete set null,
  consultation_date date not null default current_date,
  visit_reason text,                            -- intentional point-in-time snapshot, per existing code comment
  patient_words text,
  clinical_notes text,
  teeth_selected text[] not null default '{}',  -- FDI codes; array is enough, no join table needed
  prescription text,                            -- plain text by design (no medication table in V1)
  follow_up_required boolean not null default false,
  follow_up_when text,                          -- preset label OR ISO date, kept as-is to match existing UI
  follow_up_recommendation text,
  visit_outcome visit_outcome,
  status consultation_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on consultations (patient_id);
create index on consultations (visit_id);

create table dental_chart_entries (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete restrict,
  tooth text not null,                          -- FDI code, e.g. "46"
  status tooth_status not null,
  note text,
  recorded_by uuid references auth.users(id),
  recorded_at timestamptz not null default now()
);
create index on dental_chart_entries (patient_id, tooth, recorded_at desc);
-- APPEND-ONLY (see §9). "Current status" = latest row per (patient_id, tooth).

create table documents (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete restrict,
  visit_id uuid references visits(id) on delete set null,
  name text not null,
  type document_type not null,
  storage_path text not null,                   -- path in the `patient-documents` bucket, not a blob: URL
  mime_type text not null,
  file_size_bytes bigint not null,
  uploaded_by uuid references auth.users(id),
  uploaded_at timestamptz not null default now()
);
create index on documents (patient_id);

create table bills (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete restrict,
  visit_id uuid references visits(id) on delete set null,
  invoice_number text not null,
  treatment text not null,                       -- denormalized summary, computed once at insert (items are immutable — see §17)
  amount numeric(10,2) not null,
  amount_paid numeric(10,2) not null default 0,
  status bill_status not null default 'unpaid',
  bill_date date not null default current_date,
  bill_time time,
  created_at timestamptz not null default now(),
  unique (clinic_id, invoice_number)
);
create index on bills (clinic_id, bill_date);
create index on bills (patient_id);

create table bill_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references bills(id) on delete cascade,
  description text not null,
  amount numeric(10,2) not null,
  sort_order int not null default 0
);
create index on bill_items (bill_id);

create table payments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  bill_id uuid not null references bills(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete restrict,
  amount numeric(10,2) not null,
  method payment_method not null,
  paid_date date not null default current_date,
  paid_time time,
  recorded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index on payments (bill_id);
create index on payments (clinic_id, paid_date);
```

Note on `paymentMethod` (singular, on `Bill`) from the mock: it's fully derivable as "the method of the most recent row in `payments` for this bill" — not stored as a column, computed at read time in the service layer.

---

## 6. Mock data → Supabase mapping

```
clinic.name / clinicSettings.clinicName     → clinics.name
clinic.phone / clinicSettings.phone         → clinics.phone
clinicSettings.email                        → clinics.email
clinicSettings.address / .city              → clinics.address / clinics.city
clinicSettings.workingDays                  → clinics.working_days (jsonb)
clinicSettings.openingTime/.closingTime     → clinics.opening_time/.closing_time (time, not string)
clinicSettings.appointmentDuration          → clinics.appointment_duration_minutes
clinicSettings.onlineBookingEnabled         → clinics.online_booking_enabled
clinicSettings.breaks                       → clinics.breaks (jsonb)
clinic.slug / bookingPath / bookingDisplayUrl → clinics.slug (path/display URL derived, not stored)
clinic.initial                              → derived in UI from clinics.name, not stored

doctorProfile.name                          → profiles.full_name
doctorProfile.phone                         → profiles.phone
doctorProfile.title                         → profiles.title
doctorProfile.email                         → auth.users.email (not duplicated in profiles)
doctor.role ("Owner · Dentist")              → derived display string from clinic_memberships.role + profiles.title

staffMembers[].name                         → profiles.full_name (joined via clinic_memberships.user_id)
staffMembers[].initials                     → derived in UI from full_name, not stored
staffMembers[].role                         → clinic_memberships.role
staffMembers[].phone                        → profiles.phone
staffMembers[].status                       → clinic_memberships.status

patient.id                                  → patients.id
patient.name                                → patients.first_name / patients.last_name
patient.initials                            → derived in UI from name, not stored
patient.phone                               → patients.phone
patient.age                                 → patients.age
patient.gender                              → patients.gender
patient.type                                → patients.patient_type
(BookAppointment's collected but unused `email`) → patients.email (NEW column — decision: start persisting it since the UI already asks for it)

visit.id                                    → visits.id
visit.time                                  → visits.start_time (time, not "hh:mm AM/PM" string)
visit.durationMinutes                       → visits.duration_minutes
visit.patientName/.patientInitials/.patientMeta/.patientPhone → NOT stored; join visits.patient_id → patients
visit.reason                                → visits.reason
visit.status                                → visits.status
visit.date                                  → visits.visit_date
visit.patientId                             → visits.patient_id (made NOT NULL — see §2)
visit.source                                → visits.source

bill.id                                     → bills.id
bill.patientId / .visitId                   → bills.patient_id / bills.visit_id
bill.invoiceNumber                          → bills.invoice_number (generated server-side, see §17)
bill.treatment                              → bills.treatment
bill.items[]                                → bill_items rows (bill_id FK)
bill.amount                                 → bills.amount
bill.amountPaid                             → bills.amount_paid (kept in sync by recordPayment transaction)
bill.payments[]                             → payments rows (bill_id FK)
bill.paymentMethod                          → NOT stored; derived from latest payments row
bill.date / .time                           → bills.bill_date / bills.bill_time
bill.status                                 → bills.status

consultation.* (all fields)                 → consultations.* (1:1 column mapping, see schema)

toothRecord.{patientId,tooth,status,note}   → dental_chart_entries — each save is an INSERT (history), not an
                                               UPDATE; "current status" = latest row per (patient_id, tooth)

patientDocument.id/.patientId/.visitId/.name/.type → documents (1:1)
patientDocument.fileUrl (blob:)              → documents.storage_path (Supabase Storage object path) + signed URL
patientDocument.fileType                     → documents.mime_type
patientDocument.fileSize                     → documents.file_size_bytes
patientDocument.uploadedAt                   → documents.uploaded_at

recentActivity[]                             → NOT a table; derive a "recent activity" query from
                                               patients.created_at / payments.created_at / visits.updated_at
                                               (see §17 — no dedicated table, avoids inventing an entity the
                                               app doesn't actually use for anything beyond decoration today)
revenueSeries/revenueSummary                  → NOT a table; replace with the same live bills/payments
                                               aggregation Reports.tsx already computes client-side, now as
                                               a SQL query (see §13)
dentalChartData (ALL_TEETH, TOOTH_TYPE_LABEL) → NOT a table; stays a static frontend constant
```

---

## 7. Document storage architecture

- **Bucket:** single private bucket `patient-documents` (not public — these are medical records/X-rays/prescriptions).
- **Path structure:** `{clinic_id}/{patient_id}/{document_id}.{ext}` — UUIDs only in the path (no original filename, no PII), original filename preserved in `documents.name`. The `clinic_id}` segment as the first path component is what the storage RLS policy in §4 parses via `storage.foldername(name)[1]`.
- **Relationship to `documents` table:** the table is the source of truth for metadata (`name`, `type`, `mime_type`, `file_size_bytes`, ownership); the bucket only holds bytes. A signed URL is generated on demand from `storage_path` when the UI needs to display/download a file — never a permanent public URL, given Free-tier bandwidth is limited and these are patient records.
- **MIME/size:** enforce the same allowlist the client already uses (`jpg/jpeg/png/webp/pdf`) as a Postgres `check` constraint on `documents.mime_type` plus a Storage bucket-level file-size limit (mirror the existing 20MB client cap, or lower it — Free tier gives 1GB total storage, so a handful of large X-rays per patient adds up fast; recommend compressing images client-side before upload once this is implemented, not required for this pass).
- **Deletion:** `deleteDocument` today does `URL.revokeObjectURL` + array filter. The Supabase equivalent is two calls in one client-side transaction-like sequence: delete the object from Storage, then delete the `documents` row (or vice versa with a cleanup job if the storage call fails) — no cascading delete exists from Postgres into Storage automatically, this must be explicit application code.
- **Access:** every read goes through RLS-gated `storage.objects` policies (§4) plus a signed URL with a short TTL (e.g. 60s), generated only after the app has already confirmed (via the `documents` row's RLS-visible existence) that the requesting user's clinic owns it.

---

## 8. Billing & payments model

Confirmed relational shape, one bill → many items → many payments, exactly mirroring the mock's embedded arrays:

```
bills (amount, amount_paid, status)
 ├─ bill_items (description, amount)   -- immutable after creation, no edit/delete function exists today
 └─ payments (amount, method, paid_date)  -- append-only, recordPayment always adds, never edits/removes a row
```

`status` is **always recomputed from `amount_paid` vs `amount`**, never set directly — this exactly matches `recordPayment`'s existing logic (`clinicData.tsx:439`): `amount_paid >= amount → paid`, `0 < amount_paid < amount → partially_paid`, `amount_paid == 0 → unpaid`. As instructed, **`partially_paid` stays a first-class enum value** even though the current seed data never produces it (every seeded bill is paid in full in one shot) — nothing in the schema or the `recordPayment` logic needs to change to support it; it already works today, it's just never exercised by demo data. This should be implemented as a single SQL transaction (insert into `payments`, then update `bills.amount_paid`/`status` in the same statement/RPC) so a partial failure never leaves the two out of sync — the mock's `setBills` callback happens to do both atomically for free because it's one `setState` call; Postgres needs an explicit transaction or a `SECURITY DEFINER` RPC function to get the same guarantee.

---

## 9. Dental chart

**Decision: append-only history log (`dental_chart_entries`), not a mutable current-state table.** The mock's `toothRecords` array is genuinely current-state-only — `setToothStatus` upserts by `(patientId, tooth)` and the prior state is gone. The prompt explicitly requires preserving clinical history rather than overwriting it, so the backend should not replicate the mock's overwrite behavior literally.

Implementation that satisfies this **without changing the UI at all**: every call that today would call `setToothStatus` becomes an `INSERT` into `dental_chart_entries` instead of an `UPSERT`. Every read that today does `toothRecords.find(patientId, tooth)` becomes "latest row per `(patient_id, tooth)`" — a `DISTINCT ON (patient_id, tooth) ... ORDER BY recorded_at DESC` query, exposed as a view (`current_tooth_status`) so the data-access layer can keep reading it as if it were still a simple current-state table:

```sql
create view current_tooth_status as
select distinct on (patient_id, tooth) *
from dental_chart_entries
order by patient_id, tooth, recorded_at desc;
```

The component tree never needs to know the underlying table changed shape — `ClinicDataProvider.toothRecords` continues to be "one row per (patient, tooth) with the current status," now sourced from the view instead of the raw table. Full tooth history becomes available for free (e.g. a future "tooth timeline" feature) without any additional migration later.

---

## 10. Consultations & visits — the lifecycle

The app deliberately has **no separate `appointment` concept** — `visits` *is* the appointment, carrying it through its own lifecycle via `status`:

```
scheduled ──(check-in)──▶ checked_in ──(start treatment)──▶ in_treatment ──▶ completed
   ▲
   └─ created by bookAppointment() [online] or manual scheduling
        (registerWalkIn() skips straight to checked_in — no "scheduled" phase for a walk-in)
```

A `consultation` is optional clinical content attached to a visit (`visit_id` nullable on `consultations`), created/edited via `ConsultationWorkspace` while a visit is in progress, and only counts as finalized history once its own `status` flips from `draft` to `completed` (confirmed by `historyTimeline.ts:14` explicitly excluding drafts from the Patient History view). A visit can reach `completed` status without ever having a completed consultation attached — they're tracked independently, matching the existing type shapes (`Visit.status` and `Consultation.status` are two separate enums, never conflated in the mock).

"Treatment" is not a distinct entity in the app — treatment content lives inside `consultations.clinical_notes` (free text) and `consultations.visit_outcome` (`treatment_planned`/`treatment_completed`). No separate `treatments` table is warranted; inventing one would be adding a concept the current product doesn't have.

Minimum clean model: **`visits` (the appointment/visit lifecycle) + `consultations` (the clinical record, 0 or 1 per visit) is the full picture** — nothing collapsed, nothing invented.

---

## 11. AI context for the backend phase

Current shape (`buildHealvoAiContext`, `src/lib/aiContext.ts`) is already minimal and explicitly excludes phone numbers and any patient-identifying field beyond name — it's a snapshot of clinic name, today's visits (time/patientName/reason/status only), waiting count, patient count, and today's billing/collection summary. This is exactly the right amount of context and should be preserved as-is in shape.

What changes once Supabase is live: **where the context is assembled.** Today `/api/ai/chat` (`server/aiChat.ts:81`, `sanitizeContext`) trusts whatever JSON blob the browser sends, only capping its byte size — it never validates that the context actually belongs to the requesting user's clinic. That's harmless today because there's no real tenant boundary to violate. Once clinics are real, this becomes the thing to fix (flagged in §17, not implemented here): the server-side handler should re-derive the context itself from Supabase using the caller's authenticated session (resolve `clinic_id` from `clinic_memberships` server-side, then run the same aggregation queries §13 already needs for Reports/Overview) rather than accepting a client-supplied context as ground truth. The Groq API key stays exactly where it is — read only inside `server/aiChat.ts` from `env.GROQ_API_KEY`, never exposed to client code (`vite.config.ts:8`'s comment already states this explicitly, and it's correct as written). No change needed there.

---

## 12. CRUD operations → future Supabase operations

| Current (`clinicData.tsx`) | Future Supabase operation |
|---|---|
| `addPatient()` | `INSERT patients` |
| `updatePatient()` | `UPDATE patients` |
| `findPatients()` | `SELECT patients WHERE clinic_id = ... AND (name ilike / phone matches)` |
| `registerWalkIn()` | `INSERT patients` (if new) + `INSERT visits` (status `checked_in`, source `walk_in`) — one RPC/transaction |
| `bookAppointment()` | find-or-`INSERT patients` by phone + `INSERT visits` (status `scheduled`, source `online`) — one RPC/transaction |
| `getAvailableDates()` / `getSlotsForDate()` | `SELECT visits WHERE clinic_id AND visit_date` + slot math against `clinics.opening_time/closing_time/appointment_duration_minutes/breaks` — read-only query, no new table |
| `setVisitStatus()` | `UPDATE visits SET status = ...` |
| `cancelVisit()` | today: `DELETE visits` row. Recommended: `UPDATE visits SET status = 'cancelled'` (see §5 flag) |
| `createBill()` | `INSERT bills` + `INSERT bill_items` (batch) — one transaction, `amount` computed server-side from items, never trusted from the client |
| `recordPayment()` | `INSERT payments` + `UPDATE bills SET amount_paid, status` — one transaction/RPC, status recomputed server-side (§8) |
| `addStaff()` | `INSERT clinic_memberships` (+ `INSERT profiles`/Auth invite once that flow exists — see §17) |
| `addConsultation()` | `INSERT consultations` |
| `updateConsultation()` | `UPDATE consultations` |
| `setToothStatus()` | `INSERT dental_chart_entries` (append, not update — §9) |
| `addDocument()` | Storage upload to `patient-documents` bucket + `INSERT documents` referencing the resulting path |
| `deleteDocument()` | Storage object delete + `DELETE documents` row |
| `updateClinicSettings()` | `UPDATE clinics` |
| `updateDoctorProfile()` | `UPDATE profiles` (+ `auth.updateUser()` if email changes) |

---

## 13. Performance & indexing

Only indexes that map to queries the app actually makes (already reflected in §5's DDL, summarized here with the query they serve):

| Query pattern | Index |
|---|---|
| All patients for a clinic (Patients page) | `patients(clinic_id)` |
| Patient search by name/phone (`findPatients`) | `patients(clinic_id, lower(name expr))`; phone search stays a `LIKE`/normalized-equality scan — patient counts per clinic are small enough at this stage not to need a trigram index yet |
| Visits by clinic + date (Today page, booking slots) | `visits(clinic_id, visit_date)` |
| Visits by patient (Patient History/Visits tab) | `visits(patient_id)` |
| Bills by clinic + date (Billing page, Reports revenue) | `bills(clinic_id, bill_date)` |
| Bills by patient (Patient Billing tab) | `bills(patient_id)` |
| Documents by patient | `documents(patient_id)` |
| Payments by bill | `payments(bill_id)` |
| Payments by clinic + date (today's collection, AI context, Reports) | `payments(clinic_id, paid_date)` |
| Tooth history lookup | `dental_chart_entries(patient_id, tooth, recorded_at desc)` |
| Membership lookups (every RLS check) | `clinic_memberships(user_id)`, `clinic_memberships(clinic_id)` |

Nothing beyond this — no full-text search index, no GIN/trigram index, no partitioning. At early-access scale (one to low-dozens of clinics, hundreds of patients each) a handful of B-tree indexes on the actual filter/join columns is enough; anything more is premature for a $0/month single-Postgres-instance stage.

---

## 14. Free-tier constraint

Supabase Free plan gives (subject to Supabase's own current limits, verify at implementation time): ~500MB database, ~1GB file storage, limited monthly bandwidth, up to 50,000 monthly active Auth users, and the project pauses after a week of total inactivity (a non-issue once real traffic exists, but relevant for a dormant early-access project — a scheduled no-op ping may be worth setting up later, not part of this pass).

What this design deliberately avoids introducing:
- **No Redis / paid queue** — nothing in the current app needs background jobs beyond what Postgres itself can do (the invoice-sequence counter in §17 is a plain atomic column update, not a queue).
- **No separate paid backend server** — `server/aiChat.ts` already proves the pattern that works at $0: a small Node/Vite middleware handling one sensitive endpoint. This can continue as-is on whatever $0 static+Node host is chosen, or move into a Supabase Edge Function later purely for deployment consolidation — not required to hit $0.
- **No observability platform** — Supabase's built-in dashboard/logs are sufficient at this scale.
- **No vector DB / pgvector** — the AI feature is Groq-hosted chat over a small JSON snapshot, not RAG; nothing in the current app needs embeddings.
- **Storage discipline** — keep the `patient-documents` bucket lean (§7); 1GB disappears fast with unmodified phone-camera X-ray photos across many clinics.
- **RLS instead of a second authorization layer** — Postgres RLS is free and built into the plan; no separate policy engine needed.

---

## 15. Migration strategy — mock data → Supabase

The current codebase already has the right seam: **`useClinicData()`'s public interface (`ClinicDataValue` in `clinicData.tsx:172`) is the entire contract every component depends on.** Not one component imports `mockData.ts` arrays directly for mutation — they all go through the context. This means the migration is:

```
Supabase (Postgres + Auth + Storage)
   ↓
a data-access layer (new: e.g. src/services/*.ts, one module per entity —
patients.ts, visits.ts, bills.ts, documents.ts, staff.ts, consultations.ts,
toothChart.ts, clinicSettings.ts — each exporting the same function
*signatures* clinicData.tsx already defines: addPatient, updatePatient,
registerWalkIn, bookAppointment, createBill, recordPayment, addStaff,
addConsultation, updateConsultation, setToothStatus, addDocument,
deleteDocument, updateClinicSettings, updateDoctorProfile, getAvailableDates,
getSlotsForDate, setVisitStatus, cancelVisit)
   ↓
ClinicDataProvider — internals swap from useState(mockData) + array mutation
to Supabase queries/mutations (React Query or plain async + useState/useEffect
for caching), but the exported `ClinicDataValue` shape stays IDENTICAL
   ↓
existing hooks/components/pages — ZERO changes required, since they only ever
call useClinicData()
   ↓
existing UI — unchanged
```

This is exactly why the audit doesn't recommend scattering `supabase-js` calls through components: `ClinicDataProvider` is the one file whose internals change; everything downstream of `useClinicData()` is insulated from the migration entirely. Recommend doing it entity-by-entity (e.g. patients first, then visits, etc.) rather than one big-bang swap, since each entity's read/write pair can be verified against the existing UI independently.

---

## 16. Seed data strategy (design only, not implemented)

A `supabase/seed.sql` (or a small TS seed script run against the Supabase client with a service-role key, dev-only) that recreates Sharma Dental 1:1 from `mockData.ts`:

1. One `clinics` row (`Sharma Dental`, slug `sharma-dental`, matching `initialClinicSettings`).
2. One `auth.users` + `profiles` + `clinic_memberships` (`role: owner`) for Dr. Ananya Sharma; one for Riya Mehta (`role: reception`) — or, matching current reality more closely, an owner-only auth user plus a `clinic_memberships` row for Riya with `user_id = null` (roster-only, no login) — this is the same open decision flagged in §3/§17.
3. The 9 seeded `patients` rows, phone-normalized exactly as `mockData.ts` has them.
4. `visits`: today's 8 (`todaysVisits`) + the historical ones (`pastVisits`), same reasons/dates/statuses.
5. `bills` + `bill_items` + `payments`: regenerate using the same `TREATMENT_AMOUNTS` map and "every completed visit gets a fully-paid bill" logic `billForVisit()` already encodes.
6. One seeded `consultations` row (Priya Sharma / tooth 46 RCT) and the 4 seeded `dental_chart_entries` rows, exactly matching `toothRecords`.
7. `patientDocuments` stays empty, matching the current seed.

Keep this seed script hand-maintained alongside `mockData.ts` for now (they'll diverge in structure, not in the demo story they tell) rather than trying to auto-generate one from the other — the volume here is small enough that automation would cost more than it saves.

---

## 17. Security audit

**SAFE NOW** (nothing here is exploitable today because there is no real backend or tenant boundary yet):
- All CRUD is client-only in-memory state; no network persistence, so no cross-tenant leak is possible — there's only one tenant, and it isn't real.
- `GROQ_API_KEY` is correctly server-side-only, read inside `server/aiChat.ts` from `env.GROQ_API_KEY`, never shipped to the client bundle (confirmed by reading `vite.config.ts` and the middleware).
- Document blob URLs are local-browser-memory only, never transmitted anywhere.

**NEEDS CHANGE BEFORE PRODUCTION:**
- **No authentication exists at all.** Every screen must move behind Supabase Auth + an active `clinic_memberships` row before real clinic data is loaded.
- **Client-generated IDs.** Every `id` in the mock (`p-${Date.now()}`, `v-${Date.now()}`, `b-${Date.now()}`, `pay-${Date.now()}`, `doc-${Date.now()}`, `c-${Date.now()}`, `st-${Date.now()}`) is timestamp-based — fine for a disposable array, not safe or even collision-free for a real database. Every insert must use server-generated `gen_random_uuid()` (Postgres default), never a client-supplied ID.
- **AI context is currently trusted verbatim from the client** (`sanitizeContext` only size-caps it, never validates it belongs to the caller's actual clinic). Must be re-derived server-side from the authenticated session once real data flows through it — see §11.
- **Invoice numbering** (`INV-${1001 + bills.length}`) is not concurrency-safe (two simultaneous bills could collide) and incidentally exposes the clinic's total bill count in the number itself. Replace with `clinics.next_invoice_seq`, incremented atomically inside the same transaction that creates the bill (`UPDATE clinics SET next_invoice_seq = next_invoice_seq + 1 WHERE id = ... RETURNING next_invoice_seq`).
- **Document validation is client-side only** — the 20MB cap and file-type `accept` attribute are both trivially bypassed. Server/Storage-side enforcement (bucket size limit, a `check` constraint on `documents.mime_type`) is required before real files are accepted.
- **`cancelVisit` hard-deletes.** Once shared, persistent, potentially-audited clinic records are involved, an irreversible `DELETE` on what's conceptually a cancellation is riskier than clearing a local array. Recommend soft-cancel (flagged as a decision in §5, not assumed).
- **RLS must be enabled the instant every table is created** — Supabase's `anon`/`authenticated` keys can read any table with RLS off by default, so there should be no gap between "table exists" and "RLS + policies exist" while building out the schema.
- **Service-role key** (if ever needed, e.g. for a future staff-invite flow) must only ever live in a trusted server context, following exactly the pattern `server/aiChat.ts` already establishes correctly for `GROQ_API_KEY` — never in client code, never with a `VITE_` prefix.
- **"Change password" in Settings → Account is currently a no-op placeholder** — must go through Supabase's real password-update flow (session-authenticated) once wired up, not a plain form submit.
- **Staff roster vs. real accounts:** `AddStaffModal` collects name/phone/role only, no email — so it cannot create a real Supabase Auth user today. This needs an explicit product decision before backend wiring (roster-only entries with `user_id` attached later via invite, vs. requiring an email up front and changing the modal) — flagged, not decided, here.

---

## 18. Final architecture summary

### A. Relationship map
See the diagram in §2. Single source: `auth.users → profiles`, `auth.users ↔ clinics` via `clinic_memberships`, `clinics → {patients, visits, consultations, dental_chart_entries, documents, bills → {bill_items, payments}}`, all clinic-owned tables carrying a direct `clinic_id`.

### B. Complete table list
`clinics`, `profiles`, `clinic_memberships`, `patients`, `visits`, `consultations`, `dental_chart_entries`, `documents`, `bills`, `bill_items`, `payments` — 11 tables. No `appointments`, no `treatments`, no `activity_log`, no `notifications` table — none of these are needed to represent what the current app actually does (see §10, §17's "recentActivity" note).

### C. Complete enum list
`clinic_role`, `membership_status`, `patient_gender`, `patient_type`, `visit_status` (incl. proposed `cancelled`), `visit_source`, `consultation_status`, `visit_outcome`, `tooth_status`, `document_type`, `bill_status` (incl. `partially_paid`), `payment_method` — 12 enums.

### D. RLS strategy
Two SECURITY DEFINER helpers (`is_clinic_member`, `is_clinic_owner`) reused across every table; `clinics`/`clinic_memberships` writes are owner-gated, everything else is member-gated for both read and write, matching the current app's lack of finer-grained role gating in the UI. Every table: `ENABLE` + `FORCE ROW LEVEL SECURITY` from the moment it's created.

### E. Storage strategy
One private bucket, `patient-documents`, path-scoped by `clinic_id` as the first path segment, RLS on `storage.objects` via the same membership check, signed URLs generated on demand, no public bucket access.

### F. Auth strategy
Supabase Auth (`auth.users`) holds credentials only; `profiles` holds display info; `clinic_memberships` is the many-to-many bridge (built for multi-clinic from day one, populated 1:1 today); the demo identity (Dr. Ananya Sharma) becomes the first real `owner` account.

### G. Data-access/service-layer architecture
`src/services/*.ts` (one module per entity, function signatures mirroring today's `useClinicData()` exactly) sits between Supabase and `ClinicDataProvider`; `ClinicDataProvider`'s public `ClinicDataValue` shape stays unchanged so every existing component/hook/page needs zero modification.

### H. Mock → Supabase migration plan
Entity-by-entity swap of `ClinicDataProvider`'s internals (patients → visits → bills/payments → consultations → dental chart → documents → staff/settings), each verified against the existing UI before moving to the next, per §15.

### I. Seed-data strategy
Hand-maintained `supabase/seed.sql` recreating Sharma Dental 1:1 from `mockData.ts`'s exact patients/visits/bills/consultation/tooth records, per §16.

### J. Security concerns
Client-generated IDs, unvalidated AI context, non-atomic invoice numbering, client-only document validation, hard-delete cancellation, and the missing staff-invite flow are the concrete items to close before real clinic data is loaded — full detail in §17.

### K. Recommended implementation order for next backend phases
1. **P4.1 — Supabase project foundations:** enums + `clinics`/`profiles`/`clinic_memberships` tables + RLS helper functions + Supabase Auth wiring (login/signup screens, session handling in the app — currently absent entirely). Seed one real owner account against Sharma Dental.
2. **P4.2 — Core clinical/operational tables:** `patients`, `visits`, `consultations`, `dental_chart_entries`, with RLS, and swap `ClinicDataProvider`'s patient/visit/consultation/tooth-chart internals over to Supabase behind the unchanged public interface.
3. **P4.3 — Billing:** `bills`/`bill_items`/`payments`, atomic invoice-sequence + payment-transaction RPCs, swap billing internals.
4. **P4.4 — Documents:** Storage bucket + `documents` table + upload/delete flow, replacing blob URLs.
5. **P4.5 — Staff/invite flow:** decide and implement the roster-vs-Auth-invite question (§17), wire `AddStaffModal` accordingly.
6. **P4.6 — AI context hardening:** move context assembly server-side, scoped to the authenticated session's clinic, per §11.
7. **P4.7 — Cleanup:** replace Overview's static `revenueSeries`/`revenueSummary` with the same live aggregation Reports already uses; decide on `cancelVisit` soft-delete; decide on a lightweight derived "recent activity" query if that feed should become real.

---

## READY FOR P4.1 checklist

**Decided (this pass):**
- ✅ Full existing data model traced and mapped (§1) — no gaps, no guessing.
- ✅ Multi-tenant model: `clinics` + `clinic_memberships` bridge, `clinic_id` on every owned table (§2).
- ✅ Auth model: `auth.users` → `profiles` → `clinic_memberships` → `clinics`, no duplicated auth data (§3).
- ✅ RLS strategy: uniform membership-check policy via two SECURITY DEFINER helpers, table-by-table (§4).
- ✅ Full initial schema: 11 tables, 12 enums, all columns/types/constraints/indexes specified (§5, §13).
- ✅ Mock → schema field mapping for every entity (§6).
- ✅ Storage architecture: one private bucket, `clinic_id`-scoped paths, signed URLs (§7).
- ✅ Billing model keeps `partially_paid` as a real, working state (§8).
- ✅ Dental chart becomes append-only history (`dental_chart_entries` + latest-per-tooth view) — no UI change, no lost history (§9).
- ✅ Visit/consultation lifecycle model confirmed — no new "appointment" or "treatment" tables invented (§10).
- ✅ AI context shape confirmed minimal/correct; Groq key confirmed correctly server-side already (§11).
- ✅ Every current CRUD function mapped to its future Supabase operation (§12).
- ✅ Free-tier constraints respected — no paid services introduced anywhere in this design (§14).
- ✅ Migration path: entity-by-entity swap behind the existing `useClinicData()` seam, zero component changes (§15).

**Still needs a decision from you before/at implementation:**
- ❓ `visits.status`: add `cancelled` and soft-cancel, or keep hard-delete? (§5, §17)
- ❓ Staff onboarding: roster-only entries (`user_id` nullable, invited later) vs. requiring email + immediate Auth invite in `AddStaffModal`? (§3, §17)
- ❓ Add the `owner` clinic role now (needed for any owner-gated RLS policy to mean anything), or start everyone as `doctor`/`reception` and defer owner-only gating? (§3)
- ❓ Persist the `email` field `BookAppointment` already collects but currently drops, or leave it dropped? (§6)
- ❓ Confirm current Supabase Free-tier numeric limits at implementation time (they change) before finalizing storage/compression decisions (§14).

**Not yet implemented (by design — this was an audit only):**
- No Supabase tables created.
- No RLS policies applied.
- No migrations written.
- No mock data replaced.
- No UI changes.
- No dependencies installed (`@supabase/supabase-js` will be needed starting at P4.1, not added here).
