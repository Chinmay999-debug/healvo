/**
 * Meta pixel wiring for the app.
 *
 * Two things make this different from the marketing site's copy, and both are
 * deliberate:
 *
 * 1. PageView is NOT fired from index.html. Every event the pixel sends carries
 *    the current URL, and this app's URLs contain patient identifiers
 *    (/patients/<uuid>/consultation, /billing/<billId>). Firing on page load
 *    would hand Meta a patient's record id the moment a doctor opened it. So
 *    the base code only calls init, and PageView is sent from React for the
 *    handful of routes that carry no clinical identifier at all.
 *
 * 2. Automatic Advanced Matching is off (set in index.html, before init). Left
 *    on, the pixel scrapes input fields and button text off the page — which in
 *    here means patient names, phone numbers and prescriptions.
 *
 * The only events this app reports are StartTrial and Purchase, both fired from
 * server-confirmed state rather than from a click, and both carrying nothing but
 * a plan code, an amount and an opaque id.
 */

export const META_PIXEL_ID = "1390497239915643";

type Fbq = (...args: unknown[]) => void;

declare global {
  interface Window {
    fbq?: Fbq;
  }
}

function fbq(...args: unknown[]): void {
  window.fbq?.(...args);
}

/**
 * Routes that may report a PageView, matched against the whole pathname.
 *
 * An allowlist rather than a blocklist: a new route added later is silently
 * untracked, which is the safe way round. /patients, /billing, /reports, /staff
 * and the public /book/<slug> page are all absent on purpose — the first four
 * put record ids in the URL, and the booking page belongs to a clinic's
 * patients, who are not who we are advertising to.
 */
const PAGE_VIEW_ROUTES = [/^\/$/, /^\/overview$/, /^\/settings(\/[a-z-]+)?$/];

export function isTrackablePath(pathname: string): boolean {
  return PAGE_VIEW_ROUTES.some((route) => route.test(pathname));
}

export function trackPageView(pathname: string): void {
  if (!isTrackablePath(pathname)) return;
  fbq("track", "PageView");
}

/* ------------------------------------------------------------------------- */
/* Once-only delivery                                                         */
/* ------------------------------------------------------------------------- */

const SENT_KEY = "healvo:meta-pixel:sent";

/**
 * Remembers which conversions have already been reported, keyed by the
 * server-side id of the thing that happened (a subscription id, an invoice
 * number). Survives reloads, so a refresh on the "you're all set" screen or a
 * second visit to Settings cannot double-count a conversion.
 */
function alreadySent(key: string): boolean {
  try {
    const raw = window.localStorage.getItem(SENT_KEY);
    const sent = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(sent) && sent.includes(key);
  } catch {
    // Private mode, blocked storage, corrupt JSON. Reporting the event twice is
    // a worse failure than reporting it once too often is, but neither is worth
    // throwing inside a checkout, so treat it as unsent and carry on.
    return false;
  }
}

function markSent(key: string): void {
  try {
    const raw = window.localStorage.getItem(SENT_KEY);
    const sent = raw ? (JSON.parse(raw) as string[]) : [];
    const next = Array.isArray(sent) ? sent : [];
    next.push(key);
    // Keeps the key from growing without bound on a shared reception machine.
    window.localStorage.setItem(SENT_KEY, JSON.stringify(next.slice(-50)));
  } catch {
    /* see alreadySent */
  }
}

/* ------------------------------------------------------------------------- */
/* Conversions                                                                */
/* ------------------------------------------------------------------------- */

/**
 * The trial actually began.
 *
 * Called only once create_clinic_with_owner has returned and the server has
 * confirmed the subscription is genuinely `trialing` — never from the "Start
 * free trial" button, which at that point has only navigated someone to a form.
 * Deduplicated on the subscription id, so the wizard's final step can be
 * reloaded freely.
 */
export function trackStartTrial(input: { subscriptionId: string; planCode: string; trialDays: number }): void {
  const key = `StartTrial:${input.subscriptionId}`;
  if (alreadySent(key)) return;
  markSent(key);

  fbq(
    "track",
    "StartTrial",
    {
      content_name: input.planCode,
      content_category: "subscription",
      value: 0,
      currency: "INR",
      predicted_ltv: 0,
      trial_days: input.trialDays,
    },
    // Gives Meta a stable key to collapse duplicates on, and leaves the door
    // open for a Conversions API send of the same event later.
    { eventID: key },
  );
}

/**
 * Money actually changed hands.
 *
 * Fired only where the checkout hook has server confirmation of a captured
 * payment — never when Razorpay's modal opens, never when it closes, and not
 * for an authorised-but-not-yet-charged monthly mandate (that is `autorenew_on`,
 * where the first charge is still in the future).
 */
export function trackPurchase(input: {
  transactionId: string;
  planCode: string;
  valueInPaise: number | null;
}): void {
  if (input.valueInPaise == null) return;

  const key = `Purchase:${input.transactionId}`;
  if (alreadySent(key)) return;
  markSent(key);

  fbq(
    "track",
    "Purchase",
    {
      content_name: input.planCode,
      content_type: "product",
      content_ids: [input.planCode],
      value: input.valueInPaise / 100,
      currency: "INR",
    },
    { eventID: key },
  );
}
