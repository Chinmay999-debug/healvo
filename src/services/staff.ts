import { supabase } from "../lib/supabaseClient";
import type { StaffMember, StaffRole, StaffStatus } from "../data/mockData";
import { normalizePhone } from "../lib/phone";
import { initials } from "../lib/utils";

/** P4.6 data-access layer for `clinic_staff` — the roster table designed in
 * P4.1 specifically for this page (see healvo-backend/supabase/migrations/
 * 20260829190200_clinics_profiles_memberships.sql). Deliberately NOT
 * `clinic_memberships` (the real auth/login bridge) — adding a roster entry
 * here grants no login access and requires no privileged RPC, since the
 * existing RLS policy on clinic_staff (owner/admin insert+update, any
 * clinic member can read) already enforces the right permission model with
 * a plain authenticated table write. No delete/deactivate function exists
 * here because no such control exists anywhere in the current UI (the
 * `/staff/:id` route is still a Placeholder page) — see the P4.6 final
 * report for that documented limitation. */

// Locked mapping (see services/clinic.ts's ClinicRole comment): Doctor ->
// dentist, Reception -> staff. clinic_staff.role can technically hold
// 'owner'/'admin' too, but nothing in this app ever writes those from here.
const ROLE_TO_DB: Record<StaffRole, "dentist" | "staff"> = {
  Doctor: "dentist",
  Reception: "staff",
};

function roleFromDb(role: string): StaffRole {
  return role === "dentist" ? "Doctor" : "Reception";
}

function statusFromDb(status: string): StaffStatus {
  return status === "active" ? "Active" : "Inactive";
}

const SELECT_COLUMNS = "id, full_name, phone, role, status";

interface StaffRow {
  id: string;
  full_name: string;
  phone: string | null;
  role: string;
  status: string;
}

function fromRow(row: StaffRow): StaffMember {
  return {
    id: row.id,
    name: row.full_name,
    initials: initials(row.full_name) || "?",
    role: roleFromDb(row.role),
    phone: row.phone ?? "",
    status: statusFromDb(row.status),
  };
}

export async function listStaff(clinicId: string): Promise<StaffMember[]> {
  const { data, error } = await supabase
    .from("clinic_staff")
    .select(SELECT_COLUMNS)
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

export interface StaffDraftInput {
  name: string;
  phone: string;
  role: StaffRole;
}

export async function createStaffMember(
  clinicId: string,
  draft: StaffDraftInput,
): Promise<StaffMember> {
  const { data, error } = await supabase
    .from("clinic_staff")
    .insert({
      clinic_id: clinicId,
      full_name: draft.name.trim(),
      phone: normalizePhone(draft.phone),
      role: ROLE_TO_DB[draft.role],
      status: "active",
    })
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return fromRow(data);
}
