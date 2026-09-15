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
import { getClinicBillingState, hasGraceAccess } from "../services/platformBilling";
import type { ClinicBillingState, ClinicSubscription } from "../types/subscription";

export interface SubscriptionContextValue {
  subscription: ClinicSubscription | null;
  /** Recurring billing state (auto-renew, next charge, grace). Null if unavailable. */
  billing: ClinicBillingState | null;
  loading: boolean;
  error: string | null;
  hasAccess: boolean;
  isTrial: boolean;
  isExpired: boolean;
  isActive: boolean;
  /** Paid time has ended but the server's 3-day renewal grace still applies. */
  inGrace: boolean;
  autoRenew: boolean;
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
  const [billing, setBilling] = useState<ClinicBillingState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    if (!clinicId || !user) {
      setSubscription(null);
      setBilling(null);
      setLoading(false);
      return;
    }

    try {
      const [data, billingState] = await Promise.all([
        getClinicSubscription(clinicId),
        // Billing state only adds grace and auto-renew detail; if it can't load,
        // access falls back to the paid entitlement alone.
        getClinicBillingState(clinicId).catch(() => null),
      ]);
      setSubscription(data);
      setBilling(billingState);
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
    const paidAccess = hasSubscriptionAccess(subscription);
    const inGrace = !paidAccess && hasGraceAccess(billing);

    return {
      subscription,
      billing,
      loading,
      error,
      hasAccess: paidAccess || inGrace,
      isTrial: isTrialing(subscription),
      isExpired: isTrialExpired(subscription),
      isActive: isActiveSubscribed(subscription),
      inGrace,
      autoRenew: billing?.auto_renew ?? false,
      daysRemaining: getDaysRemaining(subscription),
      endsAt: getAccessEndsAt(subscription),
      activePlan: getActivePlan(subscription),
      refreshSubscription: fetchSubscription,
    };
  }, [subscription, billing, loading, error, fetchSubscription]);

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
