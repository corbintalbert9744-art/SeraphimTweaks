import type { Express, Response } from "express";
import { z } from "zod";
import {
  configureSession,
  loadSessionUser,
  requireAuth,
  type AuthedRequest,
} from "./auth";
import {
  authenticateUser,
  createUser,
  ensureOwnerAccount,
  ensureStandardDemoAccount,
  getPublicUser,
  isOwnerEmail,
  protectOwnerMembership,
  updateUserMembership,
} from "./membershipStore";
import {
  appBaseUrl,
  confirmCheckoutSession,
  constructWebhookEvent,
  createCheckoutSession,
  handleStripeEvent,
  isStripeConfigured,
} from "./stripeBilling";
import { isBillingInterval, isMembershipPlan, normalizeBillingInterval } from "@shared/membership";

const signupSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.string().email(),
  password: z.string().min(6).max(200),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

const checkoutSchema = z.object({
  plan: z.enum(["standard", "pro"]),
  interval: z.enum(["monthly", "yearly", "annually"]),
});

const confirmSchema = z.object({
  sessionId: z.string().min(1),
});

function sendError(res: Response, err: unknown) {
  const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 500;
  const message = err instanceof Error ? err.message : "Server error";
  if (status >= 500) console.error(err);
  return res.status(status || 500).json({ error: message });
}

export function registerAuthAndBillingRoutes(app: Express) {
  configureSession(app);
  app.use(loadSessionUser);

  // Seed owner + Standard demo accounts.
  void ensureOwnerAccount().catch((err) => console.error("[owner] seed failed", err));
  void ensureStandardDemoAccount().catch((err) => console.error("[standard-demo] seed failed", err));

  app.post("/api/auth/signup", async (req: AuthedRequest, res) => {
    try {
      const body = signupSchema.parse(req.body);
      if (isOwnerEmail(body.email)) {
        return res.status(409).json({ error: "This email is reserved. Please log in instead." });
      }
      const user = await createUser({
        email: body.email,
        password: body.password,
        name: body.name,
      });
      req.session.userId = user.id;
      res.status(201).json({ user });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: err.errors[0]?.message || "Invalid input" });
      }
      return sendError(res, err);
    }
  });

  app.post("/api/auth/login", async (req: AuthedRequest, res) => {
    try {
      const body = loginSchema.parse(req.body);
      const user = await authenticateUser(body.email, body.password);
      if (!user) return res.status(401).json({ error: "Invalid email or password" });
      req.session.userId = user.id;
      res.json({ user });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: err.errors[0]?.message || "Invalid input" });
      }
      return sendError(res, err);
    }
  });

  app.post("/api/auth/logout", (req: AuthedRequest, res) => {
    req.session.destroy(() => {
      res.clearCookie("seraphim.sid");
      res.json({ ok: true });
    });
  });

  app.get("/api/auth/me", async (req: AuthedRequest, res) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    let fresh = await protectOwnerMembership(req.user.id);
    if (!fresh) fresh = await getPublicUser(req.user.id);
    if (!fresh) return res.status(401).json({ error: "Not authenticated" });

    // Defense in depth: if renewal date has passed, revoke locally even before webhook.
    // Owner account is never revoked this way.
    if (
      !isOwnerEmail(fresh.email) &&
      fresh.membershipStatus === "active" &&
      fresh.currentPeriodEnd &&
      new Date(fresh.currentPeriodEnd).getTime() < Date.now()
    ) {
      await updateUserMembership(fresh.id, { membershipStatus: "canceled" });
      fresh = (await getPublicUser(fresh.id))!;
    }

    req.user = fresh;
    res.json({ user: fresh });
  });

  app.post("/api/checkout/session", requireAuth, async (req: AuthedRequest, res) => {
    try {
      if (!isStripeConfigured()) {
        return res.status(503).json({
          error:
            "Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_* environment variables.",
        });
      }
      const body = checkoutSchema.parse(req.body);
      if (!isMembershipPlan(body.plan) || !isBillingInterval(body.interval)) {
        return res.status(400).json({ error: "Invalid plan or interval" });
      }
      const interval = normalizeBillingInterval(body.interval);
      const user = req.user!;
      if (user.membershipActive) {
        return res.status(409).json({ error: "Membership is already active" });
      }
      const session = await createCheckoutSession({
        userId: user.id,
        email: user.email,
        name: user.name,
        stripeCustomerId: user.stripeCustomerId,
        plan: body.plan,
        interval,
        baseUrl: appBaseUrl(req),
      });
      res.json(session);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: err.errors[0]?.message || "Invalid input" });
      }
      return sendError(res, err);
    }
  });

  // Public confirm: restores the login session from a paid Stripe Checkout Session.
  app.post("/api/checkout/confirm", async (req: AuthedRequest, res) => {
    try {
      if (!isStripeConfigured()) {
        return res.status(503).json({ error: "Stripe is not configured" });
      }
      const body = confirmSchema.parse(req.body);
      const result = await confirmCheckoutSession({
        userId: req.user?.id ?? null,
        sessionId: body.sessionId,
      });
      req.session.userId = result.userId;
      const fresh = await getPublicUser(result.userId);
      req.user = fresh ?? undefined;
      res.json({ ...result, user: fresh });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: err.errors[0]?.message || "Invalid input" });
      }
      return sendError(res, err);
    }
  });

  app.get("/api/billing/config", (_req, res) => {
    res.json({
      stripeConfigured: isStripeConfigured(),
      webhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim() && !process.env.STRIPE_WEBHOOK_SECRET.includes("...")),
      intervals: ["monthly", "yearly"],
      plans: ["standard", "pro"],
      pricesConfigured: Boolean(
        process.env.STRIPE_PRICE_STANDARD_MONTHLY &&
          process.env.STRIPE_PRICE_STANDARD_YEARLY &&
          process.env.STRIPE_PRICE_PRO_MONTHLY &&
          process.env.STRIPE_PRICE_PRO_YEARLY,
      ),
    });
  });

  // Dev-only: simulate a paid member so you can open /app without completing Checkout.
  if (process.env.NODE_ENV !== "production") {
    app.post("/api/dev/activate-membership", requireAuth, async (req: AuthedRequest, res) => {
      try {
        const plan = req.body?.plan === "standard" ? "standard" : "pro";
        const interval = req.body?.interval === "yearly" ? "yearly" : "monthly";
        const periodEnd = new Date();
        periodEnd.setDate(periodEnd.getDate() + (interval === "yearly" ? 365 : 30));
        await updateUserMembership(req.user!.id, {
          membershipStatus: "active",
          plan,
          billingInterval: interval,
          currentPeriodEnd: periodEnd,
          stripeCustomerId: req.user!.stripeCustomerId || "cus_dev_preview",
          stripeSubscriptionId: req.user!.stripeSubscriptionId || "sub_dev_preview",
        });
        const fresh = await getPublicUser(req.user!.id);
        res.json({ user: fresh });
      } catch (err) {
        return sendError(res, err);
      }
    });
  }

  // Stripe webhooks — signature verified against raw body
  app.post("/api/stripe/webhook", async (req, res) => {
    try {
      const signature = req.headers["stripe-signature"];
      if (!signature || typeof signature !== "string") {
        return res.status(400).json({ error: "Missing stripe-signature header" });
      }
      const rawBody = req.rawBody;
      if (!rawBody || !(rawBody instanceof Buffer || typeof rawBody === "string")) {
        return res.status(400).json({ error: "Missing raw request body for webhook verification" });
      }
      const event = constructWebhookEvent(rawBody as Buffer, signature);
      await handleStripeEvent(event);
      res.json({ received: true });
    } catch (err) {
      console.error("[stripe webhook]", err);
      const message = err instanceof Error ? err.message : "Webhook error";
      res.status(400).json({ error: message });
    }
  });
}
