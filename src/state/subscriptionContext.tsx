import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./authContext";
import {
  getClinicSubscription,
  hasSubscriptionAccess,
  isTrialing,
  isTrialExpired,
  isActiveSubscribed,
  getDaysRemaining,
  getAccessEndsAt,
  getActivePlan,
} from "../services/subscription";
import type { ClinicSubscription } from "../types/subscription";

export interface SubscriptionContextValue {
  subscription: ClinicSubscription | null;
  loading: boolean;
  error: string | null;
  hasAccess: boolean;
  isTrial: boolean;
  isExpired: boolean;
  isActive: boolean;
  daysRemaining: number;
  endsAt: Date | null;
  activePlan: { code: string; name: string; interval: string } | null;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { activeClinic, user } = useAuth();
  const clinicId = activeClinic?.id;

  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<ClinicSubscription | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    if (!clinicId || !user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      const data = await getClinicSubscription(clinicId);
      setSubscription(data);
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Failed to load subscription details");
    } finally {
      setLoading(false);
    }
  }, [clinicId, user]);

  useEffect(() => {
    setLoading(true);
    fetchSubscription();
  }, [fetchSubscription]);

  const value = useMemo<SubscriptionContextValue>(() => {
    const hasAccess = hasSubscriptionAccess(subscription);
    const isTrial = isTrialing(subscription);
    const isExpired = isTrialExpired(subscription);
    const isActive = isActiveSubscribed(subscription);
    const daysRemaining = getDaysRemaining(subscription);
    const endsAt = getAccessEndsAt(subscription);
    const activePlan = getActivePlan(subscription);

    return {
      subscription,
      loading,
      error,
      hasAccess,
      isTrial,
      isExpired,
      isActive,
      daysRemaining,
      endsAt,
      activePlan,
      refreshSubscription: fetchSubscription,
    };
  }, [subscription, loading, error, fetchSubscription]);

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return context;
}
