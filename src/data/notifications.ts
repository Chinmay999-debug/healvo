// Local data for Healvo's own notification channel (the bell in the
// header) — NOT clinic-operational events (appointments, check-ins,
// payments, etc.), which already live in Today/Overview/Patients/Billing.
// This is Healvo-the-product talking to the user: welcome messages,
// trial/subscription state, Premium activation, feature announcements.
//
// There is no real trial/subscription/announcement system yet, so this
// starts empty — NotificationBell already renders an honest empty state
// when there are no notifications. Shaped so it can later be swapped for a
// real Supabase-backed feed without changing the components that consume
// it — see state/notifications.ts.

export type NotificationTone = "mint" | "blue" | "amber";

export interface HealvoNotification {
  id: string;
  title: string;
  message: string;
  /** Minutes before "now" this notification was sent — a mock-only stand-in
   * for a real timestamp, resolved to an actual Date in state/notifications.ts. */
  minutesAgo: number;
  read: boolean;
  tone: NotificationTone;
}

export const initialNotifications: HealvoNotification[] = [];
