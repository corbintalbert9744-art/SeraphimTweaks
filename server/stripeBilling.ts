import Stripe from "stripe";
import type {
  BillingInterval,
  MembershipPlan,
  MembershipStatus,
} from "@shared/membership";
import { isBillingInterval, isMembershipPlan, normalizeBillingInterval } from "@shared/membership";
import {
  findUserById,
  findUserByEmail,
  findUserByStripeCustomerId,
  findUserByStripeSubscriptionId,
  updateUserMembership,
} from "./membershipStore";

let stripeSingleton: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw Object.assign(new Error("STRIPE_SECRET_KEY is not configured"), { status: 503 });
  }
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(key, {
      apiVersion: "2026-06-24.dahlia",
      typescript: true,
    });
  }
  return stripeSingleton;
}

function priceEnvKey(plan: MembershipPlan, interval: BillingInterval): string {
  const i = interval === "yearly" ? "YEARLY" : "MONTHLY";
  const p = plan === "pro" ? "PRO" : "STANDARD";
  return `STRIPE_PRICE_${p}_${i}`;
}

/** Live Stripe Payment Links from Corbin (override via STRIPE_PAYMENT_LINK_* env). */
const DEFAULT_PAYMENT_LINKS: Record<MembershipPlan, Record<BillingInterval, string>> = {
  standard: {
    monthly: "https://buy.stripe.com/8x27sN54F2lz0NefgC9k400",
    yearly: "https://buy.stripe.com/dRmcN7eFf3pDbrSd8u9k401",
  },
  pro: {
    monthly: "https://buy.stripe.com/bJe6oJcx7f8l2VmfgC9k402",
    yearly: "https://buy.stripe.com/bJe3cx1Stf8l7bC6K69k403",
  },
};

function paymentLinkEnvKey(plan: MembershipPlan, interval: BillingInterval): string {
  const i = interval === "yearly" ? "YEARLY" : "MONTHLY";
  const p = plan === "pro" ? "PRO" : "STANDARD";
  return `STRIPE_PAYMENT_LINK_${p}_${i}`;
}

export function getStripePaymentLinkUrl(
  plan: MembershipPlan,
  interval: BillingInterval,
): string | null {
  const envKey = paymentLinkEnvKey(plan, interval);
  const fromEnv = process.env[envKey]?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return DEFAULT_PAYMENT_LINKS[plan][interval] || null;
}

export function paymentLinksConfigured(): boolean {
  return (["standard", "pro"] as const).every((plan) =>
    (["monthly", "yearly"] as const).every((interval) => Boolean(getStripePaymentLinkUrl(plan, interval))),
  );
}

/** Build a Payment Link URL with buyer identity for webhook / success confirm. */
export function buildPaymentLinkCheckoutUrl(input: {
  plan: MembershipPlan;
  interval: BillingInterval;
  userId: string;
  email: string;
}): { url: string; sessionId: string } {
  const base = getStripePaymentLinkUrl(input.plan, input.interval);
  if (!base) {
    throw Object.assign(new Error("Payment link not configured for this plan"), { status: 503 });
  }
  const url = new URL(base);
  url.searchParams.set("client_reference_id", input.userId);
  if (input.email) url.searchParams.set("prefilled_email", input.email);
  // Helps ops / support; Stripe ignores unknown params on the hosted page.
  url.searchParams.set("utm_source", "seraphim_iq");
  url.searchParams.set("utm_content", `${input.plan}_${input.interval}`);
  return { url: url.toString(), sessionId: "" };
}

export function getStripePriceId(plan: MembershipPlan, interval: BillingInterval): string {
  const envKey = priceEnvKey(plan, interval);
  const priceId = process.env[envKey]?.trim();
  if (!priceId) {
    throw Object.assign(
      new Error(`Missing Stripe Price ID env var ${envKey}`),
      { status: 503 },
    );
  }
  return priceId;
}

export function appBaseUrl(req?: { protocol?: string; get?: (h: string) => string | undefined }) {
  const fromEnv = (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || "").trim();
  if (fromEnv) {
    if (fromEnv.startsWith("http://") || fromEnv.startsWith("https://")) {
      return fromEnv.replace(/\/$/, "");
    }
    return `https://${fromEnv.replace(/\/$/, "")}`;
  }
  if (req?.get) {
    const host = req.get("host");
    if (host) {
      const proto = req.get("x-forwarded-proto") || req.protocol || "http";
      return `${proto}://${host}`;
    }
  }
  return `http://127.0.0.1:${process.env.PORT || 5000}`;
}

export async function getOrCreateStripeCustomer(user: {
  id: string;
  email: string;
  name: string;
  stripeCustomerId: string | null;
}): Promise<string> {
  const stripe = getStripe();
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId: user.id },
  });
  await updateUserMembership(user.id, { stripeCustomerId: customer.id });
  return customer.id;
}

export async function createCheckoutSession(input: {
  userId: string;
  email: string;
  name: string;
  stripeCustomerId: string | null;
  plan: MembershipPlan;
  interval: BillingInterval;
  baseUrl: string;
}): Promise<{ url: string; sessionId: string }> {
  // Prefer Corbin's hosted Payment Links so buyers hit the exact Stripe Checkout pages.
  const paymentLink = getStripePaymentLinkUrl(input.plan, input.interval);
  if (paymentLink) {
    return buildPaymentLinkCheckoutUrl({
      plan: input.plan,
      interval: input.interval,
      userId: input.userId,
      email: input.email,
    });
  }

  const stripe = getStripe();
  const priceId = getStripePriceId(input.plan, input.interval);
  const customerId = await getOrCreateStripeCustomer({
    id: input.userId,
    email: input.email,
    name: input.name,
    stripeCustomerId: input.stripeCustomerId,
  });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: input.userId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${input.baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.baseUrl}/pricing`,
    allow_promotion_codes: true,
    metadata: {
      userId: input.userId,
      plan: input.plan,
      billingInterval: input.interval,
    },
    subscription_data: {
      metadata: {
        userId: input.userId,
        plan: input.plan,
        billingInterval: input.interval,
      },
    },
  });

  if (!session.url) {
    throw Object.assign(new Error("Stripe Checkout Session missing URL"), { status: 502 });
  }

  return { url: session.url, sessionId: session.id };
}

function mapStripeStatus(status: Stripe.Subscription.Status): MembershipStatus {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return "canceled";
    case "incomplete":
    case "paused":
    default:
      return status === "incomplete" ? "incomplete" : "inactive";
  }
}

function periodEndFromSubscription(sub: Stripe.Subscription): Date | null {
  const items = sub.items?.data ?? [];
  const ends = items
    .map((item) => item.current_period_end)
    .filter((n): n is number => typeof n === "number");
  if (ends.length) return new Date(Math.max(...ends) * 1000);
  const legacy = (sub as Stripe.Subscription & { current_period_end?: number }).current_period_end;
  if (typeof legacy === "number") return new Date(legacy * 1000);
  return null;
}

async function resolveUserIdFromSubscription(sub: Stripe.Subscription): Promise<string | null> {
  const metaUserId = sub.metadata?.userId;
  if (metaUserId) {
    const user = await findUserById(metaUserId);
    if (user) return user.id;
  }
  if (sub.id) {
    const bySub = await findUserByStripeSubscriptionId(sub.id);
    if (bySub) return bySub.id;
  }
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (customerId) {
    const byCustomer = await findUserByStripeCustomerId(customerId);
    if (byCustomer) return byCustomer.id;
  }
  return null;
}

function planFromMetadata(meta: Stripe.Metadata | null | undefined): MembershipPlan | null {
  const plan = meta?.plan;
  return isMembershipPlan(plan) ? plan : null;
}

function intervalFromMetadata(meta: Stripe.Metadata | null | undefined): BillingInterval | null {
  const interval = meta?.billingInterval;
  if (!interval) return null;
  return isBillingInterval(interval) ? normalizeBillingInterval(interval) : null;
}

function planFromPriceId(priceId: string | null | undefined): MembershipPlan | null {
  if (!priceId) return null;
  for (const plan of ["standard", "pro"] as const) {
    for (const interval of ["monthly", "yearly"] as const) {
      const envId = process.env[priceEnvKey(plan, interval)]?.trim();
      if (envId && envId === priceId) return plan;
    }
  }
  return null;
}

function intervalFromPriceId(priceId: string | null | undefined): BillingInterval | null {
  if (!priceId) return null;
  for (const plan of ["standard", "pro"] as const) {
    for (const interval of ["monthly", "yearly"] as const) {
      const envId = process.env[priceEnvKey(plan, interval)]?.trim();
      if (envId && envId === priceId) return interval;
    }
  }
  return null;
}

function planFromProductName(name: string | null | undefined): MembershipPlan | null {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n.includes("standard")) return "standard";
  if (/\bpro\b/.test(n) || n.includes("iq pro")) return "pro";
  return null;
}

/** Infer plan + interval from Checkout Session (Payment Links often omit our metadata). */
async function resolvePlanAndInterval(
  session: Stripe.Checkout.Session,
): Promise<{ plan: MembershipPlan | null; interval: BillingInterval | null }> {
  let plan = planFromMetadata(session.metadata);
  let interval = intervalFromMetadata(session.metadata);
  if (plan && interval) return { plan, interval };

  try {
    const stripe = getStripe();
    const full = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ["line_items.data.price.product", "subscription"],
    });
    const item = full.line_items?.data?.[0];
    const price = item?.price;
    const priceId = typeof price === "string" ? price : price?.id;
    const recurring = typeof price === "object" && price ? price.recurring : null;
    if (!interval && recurring?.interval === "year") interval = "yearly";
    if (!interval && recurring?.interval === "month") interval = "monthly";
    if (!plan) plan = planFromPriceId(priceId);
    if (!interval) interval = intervalFromPriceId(priceId);

    const product = typeof price === "object" && price ? price.product : null;
    const productName =
      typeof product === "object" && product && "name" in product
        ? String((product as Stripe.Product).name || "")
        : typeof price === "object" && price
          ? price.nickname || ""
          : "";
    if (!plan) plan = planFromProductName(productName);

    const sub =
      typeof full.subscription === "object" && full.subscription
        ? full.subscription
        : null;
    if (sub) {
      if (!plan) plan = planFromMetadata(sub.metadata);
      if (!interval) interval = intervalFromMetadata(sub.metadata);
    }
  } catch (err) {
    console.warn("[stripe] could not infer plan/interval from session line items", err);
  }

  return { plan, interval };
}

export async function applySubscriptionToUser(sub: Stripe.Subscription): Promise<void> {
  const userId = await resolveUserIdFromSubscription(sub);
  if (!userId) {
    console.warn("[stripe] No user for subscription", sub.id);
    return;
  }

  const status = mapStripeStatus(sub.status);
  const active = status === "active";
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;

  await updateUserMembership(userId, {
    stripeCustomerId: customerId ?? undefined,
    stripeSubscriptionId: sub.id,
    membershipStatus: active ? "active" : status,
    plan: planFromMetadata(sub.metadata) ?? undefined,
    billingInterval: intervalFromMetadata(sub.metadata) ?? undefined,
    currentPeriodEnd: periodEndFromSubscription(sub),
  });
}

export async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const stripe = getStripe();
  const userId = session.client_reference_id || session.metadata?.userId;
  if (!userId) {
    console.warn("[stripe] checkout.session.completed missing userId");
    return;
  }

  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

  const inferred = await resolvePlanAndInterval(session);
  const plan = inferred.plan ?? planFromMetadata(session.metadata);
  const interval = inferred.interval ?? intervalFromMetadata(session.metadata);

  await updateUserMembership(userId, {
    stripeCustomerId: customerId ?? undefined,
    stripeSubscriptionId: subscriptionId ?? undefined,
    membershipStatus: session.payment_status === "paid" || session.status === "complete" ? "active" : "incomplete",
    plan: plan ?? undefined,
    billingInterval: interval ?? undefined,
  });

  if (subscriptionId) {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    // Stamp plan/interval onto subscription metadata when Payment Links omit them.
    if ((plan || interval) && (!sub.metadata?.plan || !sub.metadata?.billingInterval)) {
      try {
        await stripe.subscriptions.update(subscriptionId, {
          metadata: {
            ...sub.metadata,
            userId,
            ...(plan ? { plan } : {}),
            ...(interval ? { billingInterval: interval } : {}),
          },
        });
        sub.metadata = {
          ...sub.metadata,
          userId,
          ...(plan ? { plan } : {}),
          ...(interval ? { billingInterval: interval } : {}),
        };
      } catch (err) {
        console.warn("[stripe] could not stamp subscription metadata", err);
      }
    }
    await applySubscriptionToUser(sub);
  }
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      await applySubscriptionToUser(event.data.object as Stripe.Subscription);
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = await resolveUserIdFromSubscription(sub);
      if (!userId) break;
      await updateUserMembership(userId, {
        membershipStatus: "canceled",
        stripeSubscriptionId: sub.id,
        currentPeriodEnd: periodEndFromSubscription(sub),
      });
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const parent = (
        invoice as Stripe.Invoice & {
          parent?: { subscription_details?: { subscription?: string | { id: string } } | null } | null;
          subscription?: string | { id: string } | null;
        }
      ).parent;
      const legacySub = (
        invoice as Stripe.Invoice & { subscription?: string | { id: string } | null }
      ).subscription;
      const raw =
        parent?.subscription_details?.subscription ?? legacySub ?? null;
      const subId = typeof raw === "string" ? raw : raw?.id;
      if (!subId) break;
      const user = await findUserByStripeSubscriptionId(subId);
      if (!user) break;
      await updateUserMembership(user.id, { membershipStatus: "past_due" });
      break;
    }
    default:
      break;
  }
}

export async function confirmCheckoutSession(input: {
  userId?: string | null;
  sessionId: string;
}): Promise<{ membershipActive: boolean; userId: string }> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(input.sessionId, {
    expand: ["subscription", "customer"],
  });

  const sessionUserId = session.client_reference_id || session.metadata?.userId || null;

  if (input.userId && sessionUserId && input.userId !== sessionUserId) {
    throw Object.assign(new Error("Checkout session does not belong to this user"), { status: 403 });
  }

  if (session.mode !== "subscription") {
    throw Object.assign(new Error("Checkout session is not a subscription"), { status: 400 });
  }

  if (session.status !== "complete" && session.payment_status !== "paid") {
    throw Object.assign(new Error("Checkout session is not paid yet"), { status: 402 });
  }

  // Resolve / restore the local user. In-memory stores reset on server restart, so recreate from Stripe if needed.
  let userId = sessionUserId;
  let user = userId ? await findUserById(userId) : null;

  const customerObj =
    typeof session.customer === "object" && session.customer && !("deleted" in session.customer && session.customer.deleted)
      ? session.customer
      : null;
  const customerId =
    typeof session.customer === "string" ? session.customer : customerObj?.id || null;
  const email =
    session.customer_details?.email ||
    customerObj?.email ||
    session.customer_email ||
    null;

  if (!user && customerId) {
    user = await findUserByStripeCustomerId(customerId);
    if (user) userId = user.id;
  }

  if (!user && email) {
    user = await findUserByEmail(email);
    if (user) userId = user.id;
  }

  if (!user && email) {
    const { createUser } = await import("./membershipStore");
    const created = await createUser({
      email,
      password: `stripe-${session.id}`,
      name: session.customer_details?.name || email.split("@")[0] || "Member",
    });
    userId = created.id;
    user = await findUserById(userId);
  }

  if (!userId || !user) {
    throw Object.assign(
      new Error("Could not match this Checkout Session to an account. Please log in and try again."),
      { status: 404 },
    );
  }

  // Ensure metadata carries the resolved user for webhook handlers
  if (!session.metadata) (session as { metadata?: Record<string, string> }).metadata = {};
  session.metadata = { ...session.metadata, userId };
  if (!session.client_reference_id) {
    (session as { client_reference_id?: string | null }).client_reference_id = userId;
  }

  await handleCheckoutSessionCompleted(session);

  const sub =
    typeof session.subscription === "object" && session.subscription
      ? session.subscription
      : typeof session.subscription === "string"
        ? await stripe.subscriptions.retrieve(session.subscription)
        : null;
  if (sub) {
    sub.metadata = { ...sub.metadata, userId };
    await applySubscriptionToUser(sub);
  } else {
    // Still mark active from completed checkout if subscription expand failed
    const inferred = await resolvePlanAndInterval(session);
    await updateUserMembership(userId, {
      membershipStatus: "active",
      stripeCustomerId: customerId,
      stripeSubscriptionId:
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id || undefined,
      plan: inferred.plan ?? (session.metadata?.plan || undefined),
      billingInterval: inferred.interval ?? (session.metadata?.billingInterval || undefined),
    });
  }

  const fresh = await findUserById(userId);
  return {
    userId,
    membershipActive: Boolean(
      fresh && (fresh.membershipStatus === "active" || fresh.membershipStatus === "trialing"),
    ),
  };
}

export function constructWebhookEvent(rawBody: Buffer | string, signature: string): Stripe.Event {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw Object.assign(new Error("STRIPE_WEBHOOK_SECRET is not configured"), { status: 503 });
  }
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}
