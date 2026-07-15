import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "seraphim-iq-membership-v1";

export type BillingInterval = "weekly" | "monthly" | "annually";
export type MembershipPlan = "standard" | "pro";

export interface MembershipUser {
  name: string;
  email: string;
}

export interface MembershipState {
  user: MembershipUser | null;
  membershipActive: boolean;
  plan: MembershipPlan | null;
  billingInterval: BillingInterval;
}

interface MembershipContextValue extends MembershipState {
  isAuthenticated: boolean;
  signUp: (input: { name: string; email: string; password: string }) => void;
  signIn: (input: { email: string; password: string }) => void;
  signOut: () => void;
  activateMembership: (plan: MembershipPlan, interval: BillingInterval) => void;
}

const defaultState: MembershipState = {
  user: null,
  membershipActive: false,
  plan: null,
  billingInterval: "monthly",
};

const MembershipContext = createContext<MembershipContextValue | null>(null);

function normalizeInterval(value: unknown): BillingInterval {
  if (value === "weekly" || value === "annually" || value === "yearly") {
    return value === "yearly" ? "annually" : value;
  }
  return "monthly";
}

function normalizePlan(value: unknown): MembershipPlan | null {
  if (value === "standard" || value === "pro" || value === "professional") {
    return value === "professional" ? "pro" : value;
  }
  return null;
}

function loadState(): MembershipState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as MembershipState;
    return {
      user: parsed.user ?? null,
      membershipActive: Boolean(parsed.membershipActive),
      plan: normalizePlan(parsed.plan),
      billingInterval: normalizeInterval(parsed.billingInterval),
    };
  } catch {
    return defaultState;
  }
}

function persist(state: MembershipState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function MembershipProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MembershipState>(() =>
    typeof window === "undefined" ? defaultState : loadState(),
  );

  useEffect(() => {
    persist(state);
  }, [state]);

  const signUp = useCallback((input: { name: string; email: string; password: string }) => {
    void input.password;
    setState((prev) => ({
      ...prev,
      user: { name: input.name.trim() || "Member", email: input.email.trim() },
    }));
  }, []);

  const signIn = useCallback((input: { email: string; password: string }) => {
    void input.password;
    setState((prev) => ({
      ...prev,
      user: {
        name: prev.user?.name || "Member",
        email: input.email.trim(),
      },
    }));
  }, []);

  const signOut = useCallback(() => {
    setState(defaultState);
  }, []);

  const activateMembership = useCallback((plan: MembershipPlan, interval: BillingInterval) => {
    setState((prev) => ({
      ...prev,
      membershipActive: true,
      plan,
      billingInterval: interval,
      user: prev.user ?? { name: "Member", email: "member@seraphim.iq" },
    }));
  }, []);

  const value = useMemo<MembershipContextValue>(
    () => ({
      ...state,
      isAuthenticated: Boolean(state.user),
      signUp,
      signIn,
      signOut,
      activateMembership,
    }),
    [state, signUp, signIn, signOut, activateMembership],
  );

  return <MembershipContext.Provider value={value}>{children}</MembershipContext.Provider>;
}

export function useMembership() {
  const ctx = useContext(MembershipContext);
  if (!ctx) throw new Error("useMembership must be used within MembershipProvider");
  return ctx;
}
