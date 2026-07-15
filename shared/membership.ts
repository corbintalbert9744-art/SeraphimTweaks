/** Shared membership / billing types used by client + server */

export const MEMBERSHIP_PLANS = ["standard", "pro"] as const;
export type MembershipPlan = (typeof MEMBERSHIP_PLANS)[number];

export const BILLING_INTERVALS = ["monthly", "yearly"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const MEMBERSHIP_STATUSES = [
  "inactive",
  "active",
  "past_due",
  "canceled",
  "incomplete",
] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export function isMembershipPlan(value: unknown): value is MembershipPlan {
  return value === "standard" || value === "pro";
}

export function isBillingInterval(value: unknown): value is BillingInterval {
  return value === "monthly" || value === "yearly" || value === "annually";
}

/** Normalize legacy "annually" → "yearly" */
export function normalizeBillingInterval(value: unknown): BillingInterval {
  if (value === "yearly" || value === "annually") return "yearly";
  return "monthly";
}

export function isMembershipActive(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

/** Display prices (USD) — Stripe Price IDs come from env */
export const DISPLAY_PRICES: Record<BillingInterval, Record<MembershipPlan, number>> = {
  monthly: { standard: 19.99, pro: 24.99 },
  yearly: { standard: 199.99, pro: 249.99 },
};
