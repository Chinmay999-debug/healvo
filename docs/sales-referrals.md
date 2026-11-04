# Sales referrals & attribution

Healvo's field sales team each get a referral link such as
`https://app.healvo.in/signup?ref=RAHUL01`. A doctor who registers through it is
attributed to that salesperson on the server, and the clinic they create in
onboarding is credited to them permanently.

| Piece | Where |
| --- | --- |
| Schema, rules, RPCs | `healvo-backend/supabase/migrations/20261104120000_sales_referrals.sql` |
| Rollback (manual, not a migration) | `healvo-backend/supabase/rollbacks/20261104120000_sales_referrals_down.sql` |
| SQL regression test | `healvo-backend/supabase/tests/sales_referrals.test.sql` |
| Invitation edge function | `healvo-backend/supabase/functions/admin-invite-salesperson/` |
| Invitation email | `healvo-backend/supabase/templates/invite.html` |
| Doctor app: link capture | `src/lib/salesReferral.ts` (+ `.test.ts`) |
| Doctor app: salesperson pages | `src/pages/sales/SalesDashboard.tsx`, `SalesWelcome.tsx` |
| Admin app | `healvo-admin/src/pages/SalesReferrals.tsx`, `SalespersonDetail.tsx`, `components/sales/*` |

## Data model

- `salespersons` – name, email (unique, lower-case), phone, `status` active/inactive, `auth_user_id` once invited.
- `sales_referral_codes` – `code` (unique, `^[A-Z0-9]{3,20}$`), `is_active`. Codes never change after creation.
- `sales_referral_clicks` – one row per link visit (deduplicated per browser per code per 24 h; capped at 120 new rows per code per minute). Holds the opaque `visit_token` and `signup_initiated_at`.
- `sales_referrals` – one row per attributed **user** (unique `referred_user_id`), later its **first clinic** (unique `clinic_id`). `voided_at` lets a super admin exclude a fake/test registration (kept for audit).

Trial, paid and churn are **not stored**. `sales_referral_facts()` derives them on every read from
`clinic_subscriptions` and `subscription_payments` (live `key_mode` only). *Paid* = at least one
captured live subscription payment. Test-mode payments, complimentary grants and entitlement
overrides never count. No trigger was added to any billing table.

Lifecycle stages: `awaiting_verification` → `awaiting_onboarding` → `trial` → `paid`
(or `trial_ended` / `no_subscription`; a paid clinic whose subscription is cancelled/expired is `churned`).

## How attribution flows

1. **Link visit** – `?ref=CODE` on any app page calls `sales_record_referral_visit` (anonymous). The
   server validates the code (active code + active salesperson) and returns only `{valid, token}`.
   The browser keeps the first valid code (localStorage + first-party cookie, 60 days).
2. **Signup form** – marks `signup_initiated_at`, then `supabase.auth.signUp` carries
   `healvo_ref_code`/`healvo_ref_token` (and `full_name`) in user metadata.
3. **auth.users trigger** `on_auth_user_created_sales_referral` attributes the new user immediately,
   before email verification. From here on the attribution is in Postgres: verifying on another
   device, clearing storage, logging out/in cannot lose it. The trigger swallows its own errors and
   can never block a signup.
4. **Google sign-in** cannot carry metadata, so after any sign-in of a user with no clinic,
   `RequireAuthAndClinic` calls `sales_claim_referral` with the stored code.
5. **Onboarding** – `create_clinic_with_owner` makes a last attribution attempt from
   `p_attribution.sales_ref_code`, then credits the new clinic (`sales_link_clinic`). Both steps are
   wrapped so a sales error can never fail clinic creation. The 15-day Core trial is created exactly as before.

All three entry points call the same `sales_attribute_user()` rules:

- first touch wins (insert … on conflict do nothing on the unique user index);
- only an active code of an active salesperson creates **new** credit; existing credit survives deactivation;
- no salesperson account (by auth id or email) is ever attributed – no self-referral;
- a user who already has any clinic membership is never attributed – existing clinics are never reassigned;
- only the first clinic of a referred user is credited.

A doctor who registered without a link and has **not yet created a clinic** can still be attributed
by the first link they use afterwards (the salesperson helped them finish). Once a clinic exists, never.

## Access control

All four tables: RLS enabled + forced, no policies, no grants to `anon`/`authenticated`.

| Caller | Can call |
| --- | --- |
| anon | `sales_record_referral_visit`, `sales_mark_signup_started` |
| signed-in doctor | `sales_claim_referral` (own account only), `sales_whoami` |
| salesperson | `sales_get_my_dashboard` – scoped to `auth.uid()`, no id parameter; inactive → 42501. Returns clinic name, doctor name, dates, stage, plan name. No emails, phones, amounts, patient or clinical data. |
| any Healvo admin | `admin_sales_overview`, `admin_sales_list_salespersons`, `admin_sales_list_referrals`, `admin_sales_get_salesperson`, `admin_sales_suggest_code` |
| super admin | `admin_sales_create_salesperson`, `_update_salesperson`, `_set_salesperson_status`, `_set_code_active`, `_void_referral`, `_get_invite_target`, and the invite edge function. All audited in `platform_audit_logs`. |
| service_role | `sales_internal_link_invited_user` (edge function only) |

Salesperson logins are created only by `admin-invite-salesperson` (Supabase `inviteUserByEmail`; the
salesperson chooses their own password at `/sales/welcome`). The function also sets
`app_metadata.healvo_role = "salesperson"`, which the doctor app uses **only for routing**; every
permission check is done in SQL against `salespersons`. `create_clinic_with_owner` refuses salesperson
accounts, and the admin app refuses anyone not in `healvo_admins`.

## Operating it

- **Add** a salesperson (admin → Sales & Referrals → Add salesperson). A code like `RAHUL01` is suggested.
- **Invite** from the row's ⋯ menu. Resend works until they first log in; after that they use *Forgot password*.
- **Pause link** stops new credit for that code; **Deactivate** stops new credit and dashboard access. Neither removes past credit.
- **Void** (⊘ on a referred clinic row) removes a fake/test registration from all metrics, with a reason.
- Date filters: registrations and everything after them are a cohort by **registration date**; clicks by **visit date**; IST days.
- Conversion rate = clinics that have ever paid ÷ clinics onboarded.

## Deploying

1. `npx supabase db push` (one migration: `20261104120000`). Confirm with `migration list` that it is the only pending one.
2. Run `supabase/tests/sales_referrals.test.sql` against production (rolled back; writes nothing).
3. `npx supabase functions deploy admin-invite-salesperson` (JWT verification on, the default).
   Optional secret `SALES_INVITE_REDIRECT_URL` (default `https://app.healvo.in/sales/welcome`; must be in the Auth redirect allow-list, which `https://app.healvo.in/**` already covers).
4. Dashboard → Authentication → Emails → *Invite user*: subject *You're invited to the Healvo sales team*, body = `templates/invite.html`.
5. Deploy healvo-main and healvo-admin. Order is flexible: the doctor app treats a missing RPC as "not a salesperson" and carries on.

## Known limits

- Clicks come from an unauthenticated endpoint, so they can be inflated by a script (capped at 120/min/code). Registrations and clinics require real accounts.
- Codes are guessable by design (they are printed on cards/WhatsApp); a valid code reveals nothing but its own validity.
- A salesperson could sign up a fake clinic with a second email address. Paid conversion is the trustworthy metric; use *Void* for anything suspicious.
- Cross-device *before* signup (link opened on a phone, account created on a laptop without the link) cannot be attributed – there is no identity to join on yet.
