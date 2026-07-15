import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { BillingInterval, MembershipPlan } from "@shared/membership";
import { normalizeBillingInterval } from "@shared/membership";

export type { BillingInterval, MembershipPlan };

export interface MembershipUser {
  id?: string;
  name: string;
  email: string;
}

export interface MembershipState {
  user: MembershipUser | null;
  membershipActive: boolean;
  membershipStatus: string | null;
  plan: MembershipPlan | null;
  billingInterval: BillingInterval;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  loading: boolean;
}

interface MembershipContextValue extends MembershipState {
  isAuthenticated: boolean;
  refresh: () => Promise<void>;
  signUp: (input: { name: string; email: string; password: string }) => Promise<void>;
  signIn: (input: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  startCheckout: (plan: MembershipPlan, interval: BillingInterval) => Promise<void>;
}

const defaultState: MembershipState = {
  user: null,
  membershipActive: false,
  membershipStatus: null,
  plan: null,
  billingInterval: "monthly",
  currentPeriodEnd: null,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  loading: true,
};

const MembershipContext = createContext<MembershipContextValue | null>(null);

type ApiUser = {
  id: string;
  email: string;
  name: string;
  membershipActive: boolean;
  membershipStatus: string;
  plan: MembershipPlan | null;
  billingInterval: BillingInterval | null;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};

function fromApiUser(apiUser: ApiUser): Omit<MembershipState, "loading"> {
  return {
    user: { id: apiUser.id, name: apiUser.name, email: apiUser.email },
    membershipActive: Boolean(apiUser.membershipActive),
    membershipStatus: apiUser.membershipStatus,
    plan: apiUser.plan === "standard" || apiUser.plan === "pro" ? apiUser.plan : null,
    billingInterval: normalizeBillingInterval(apiUser.billingInterval ?? "monthly"),
    currentPeriodEnd: apiUser.currentPeriodEnd,
    stripeCustomerId: apiUser.stripeCustomerId,
    stripeSubscriptionId: apiUser.stripeSubscriptionId,
  };
}

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || res.statusText;
  } catch {
    return res.statusText || "Request failed";
  }
}

export function MembershipProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MembershipState>(defaultState);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.status === 401) {
        setState({ ...defaultState, loading: false });
        return;
      }
      if (!res.ok) {
        setState((prev) => ({ ...prev, loading: false }));
        return;
      }
      const data = (await res.json()) as { user: ApiUser };
      setState({ ...fromApiUser(data.user), loading: false });
    } catch {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signUp = useCallback(async (input: { name: string; email: string; password: string }) => {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await readError(res));
    const data = (await res.json()) as { user: ApiUser };
    setState({ ...fromApiUser(data.user), loading: false });
  }, []);

  const signIn = useCallback(async (input: { email: string; password: string }) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await readError(res));
    const data = (await res.json()) as { user: ApiUser };
    setState({ ...fromApiUser(data.user), loading: false });
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setState({ ...defaultState, loading: false });
  }, []);

  const startCheckout = useCallback(async (plan: MembershipPlan, interval: BillingInterval) => {
    const res = await fetch("/api/checkout/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ plan, interval }),
    });
    if (!res.ok) throw new Error(await readError(res));
    const data = (await res.json()) as { url: string };
    if (!data.url) throw new Error("Checkout session missing redirect URL");
    window.location.assign(data.url);
  }, []);

  const value = useMemo<MembershipContextValue>(
    () => ({
      ...state,
      isAuthenticated: Boolean(state.user),
      refresh,
      signUp,
      signIn,
      signOut,
      startCheckout,
    }),
    [state, refresh, signUp, signIn, signOut, startCheckout],
  );

  return <MembershipContext.Provider value={value}>{children}</MembershipContext.Provider>;
}

export function useMembership() {
  const ctx = useContext(MembershipContext);
  if (!ctx) throw new Error("useMembership must be used within MembershipProvider");
  return ctx;
}
