import { useCallback, useMemo, useState } from "react";
import { initialNotifications, type NotificationTone } from "../data/notifications";

/** The shape a real Supabase-backed feed will eventually return — `useNotifications`
 * is the seam: swap its internals for a fetch/subscription later and every
 * consumer (just NotificationBell today) keeps working unchanged. */
export interface Notification {
  id: string;
  title: string;
  message: string;
  createdAt: Date;
  read: boolean;
  tone: NotificationTone;
}

function seedNotifications(): Notification[] {
  const now = Date.now();
  return initialNotifications.map((n) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    createdAt: new Date(now - n.minutesAgo * 60_000),
    read: n.read,
    tone: n.tone,
  }));
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>(seedNotifications);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  return { notifications, unreadCount, markAsRead, markAllAsRead };
}
