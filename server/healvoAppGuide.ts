/**
 * What Healvo's interface actually contains, for Healvo AI's "how do I…"
 * answers. The model has no other knowledge of the product, so without this
 * it describes generic clinic software (date-of-birth fields, insurance,
 * "Schedule Appointment" buttons) that Healvo does not have.
 *
 * Keep this in step with the UI: when a screen, button label or form field
 * changes, change it here in the same commit. Every label below is the exact
 * text on screen. Server-only — it is never sent to the browser.
 */
export const HEALVO_APP_GUIDE = `HEALVO INTERFACE GUIDE (the only screens, buttons and fields that exist)

Navigation
- Left sidebar: Overview, Today, Patients, Billing, Reports, Staff, Settings. On a phone, open it with the menu icon at the top left.
- Top bar: a search box ("Search patients, invoices..."), a light/dark theme toggle and notifications.
- Account menu: the "..." button next to your name at the bottom of the sidebar, with Profile, Subscription & Plan and Log out. (Log out is also under Settings > Account.)
- The Healvo AI button is at the bottom right of every screen.

Overview (dashboard)
- Cards: Today's Collection, Patients Today, Waiting, New Patients Today. Also Today's schedule, Revenue Trend (7 days / 30 days / 3 months) and Recent Activity.
- "Quick action" button: Walk-in registration, Appointment booking link (shows the link with Copy and Open booking page), Create bill.

Patients
- "Add patient" opens a form with exactly these fields: Full name (required), Phone number (required, 10-digit Indian mobile, +91 is fixed), Age, Gender (Male, Female, Other), and a checkbox "Patient agreed to receive WhatsApp appointment messages". Then press "Add patient". Adding a patient does not create a visit.
- There are no date of birth, address, email, insurance, referral, allergy or medical-history fields on this form.
- Two patients in one clinic cannot share a phone number.
- Search by name or phone with "Search patients". Click a patient to open their record.

Patient record
- Buttons at the top: "Book appointment" (opens the clinic's online booking page in a new tab), "Create bill", "Edit patient" (same fields as Add patient).
- Tabs: Overview, Consultation, Dental chart, Documents, History, Billing.

Appointments and visits
- Appointments are booked on the clinic's online booking page: Patient record > "Book appointment", Today > "Book appointment", or the booking link in Settings > Booking. Staff use the same page as patients: choose a reason (Consultation, Dental pain, Cleaning, Follow-up, Tooth sensitivity, Other), a date, a time slot, then type Full name, phone number, optional email and tick "Send me appointment updates on WhatsApp" if the patient agrees, and press "Book appointment". Nothing is pre-filled, even when opened from a patient record: type the patient's name and phone again. A phone number that already belongs to a patient adds the visit to that patient; a new number creates a new patient.
- Walk-ins: Today > "Add patient" (or Quick action > Walk-in registration). Search for the patient or press "Register new patient", choose the reason, then "Register walk-in". The visit is added to today as Checked in.
- Today shows only today's visits. Each visit's status badge moves it forward one step: Scheduled > "Check in" > "Start treatment" > "Complete visit". The row button opens the patient or the consultation ("Start consultation" / "Continue").
- Future appointments appear only inside each patient's record, under Overview > "Recent visits". There is no calendar, no list of tomorrow's or upcoming appointments, no cancelling or rescheduling, and no booking for a date the booking page doesn't offer.

Consultation (patient record > Consultation)
- Works on the patient's current visit. Fields: Patient's words, Clinical notes, Dental chart ("Open dental chart" link, shows the selected teeth), Prescription (free text, "Medicines and dosage"), Follow-up ("No follow-up required" or "Follow-up recommended", then When? 7 days / 14 days / 30 days / Custom date, and a Recommendation), Visit outcome (Consultation only / Treatment planned / Treatment completed).
- Buttons: "Save draft" (shows "Draft saved") and "Complete visit" (completes the consultation and the visit). Completed consultations appear in the History tab.
- Prescriptions cannot be printed or downloaded.

Dental chart (patient record > Dental chart)
- 32 permanent teeth, FDI numbering: upper 18-11 and 21-28, lower 48-41 and 31-38. Tap a tooth to open its panel. Statuses: Normal, Needs attention, Treatment planned, Treatment completed, Missing, plus an optional Note. Changes save automatically. "Close tooth details" closes the panel.

Documents (patient record > Documents)
- "Upload / attach" > Camera or Upload from files. JPG, PNG, WEBP or PDF, up to 20 MB. Then set Name, Type (X-ray, Photo, Prescription, Report, Other) and optionally Attach to visit, and press "Upload". Each document has View and Delete.

Billing
- "Create bill" (Billing page, patient record, or Quick action): choose the patient, optionally a visit, then items (description and amount, "Add item" for more), and press "Create bill". Invoice numbers are automatic (INV-1001, INV-1002, ...).
- Open a bill with "View". The invoice has "Print / Download" and "Record payment": amount (cannot exceed what's left to pay) and method (buttons: Cash, UPI, Card, Other), then "Record payment". Status moves Unpaid > Partially paid > Paid.
- The Billing page cards: Today's Collection, Total Billed, Paid Bills, Pending Payments.
- Not available: refunds, discounts, taxes per item, editing or deleting a bill or payment.

Reports
- Revenue Trend and Patient Trend, for Today, This week, This month, Last 6 months, This year or Custom range (From / To, then Apply).
- There is no treatment-wise or doctor-wise report.

Staff
- "Add staff": Full name, Phone number, Role (Doctor or Reception). This keeps a record of the team only — staff cannot sign in to Healvo yet. There are no staff accounts, invitations, guest access or per-person permissions; only the person who created the clinic can sign in. If someone asks how staff can use Healvo, the answer is that staff sign-in isn't available yet — do not suggest sharing the owner's login or creating another clinic account.

Settings
- Clinic: logo, Clinic name, Phone, Email, Address, City, then "Save changes".
- Subscription & Plan: trial status, plans (Core and Premium, monthly or annual) and billing history.
- Appointments: Working days, Opening time, Closing time, Break hours, Default appointment duration, then "Save changes".
- Booking: the "Online booking" switch, the booking link, "Copy link" and "Open booking page".
- Account: Profile (photo, Full name, Email, Phone, Professional title), Security (change password), Appearance (theme) and Log out.

Plans
- New clinics get a 15-day free trial. Core has clinic management and online booking. Premium adds Healvo AI and WhatsApp appointment confirmations. During the trial Healvo AI is included; WhatsApp confirmations need Premium.

Things Healvo cannot do
- Healvo AI cannot change anything: it cannot add, edit, book, cancel, bill, record payments or send messages. It can only explain the screens above and read the clinic summary it is given.
- Healvo has no deleting of patients, no SMS, no insurance or claims, no inventory, no lab orders and no bulk data export (single invoices can be printed or downloaded).`;
