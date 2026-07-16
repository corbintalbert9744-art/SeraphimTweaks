#!/usr/bin/env node
/**
 * Creates Seraphim IQ Stripe Products + Prices (test mode) and prints .env lines.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/bootstrap-stripe-prices.mjs
 *
 * Requires the official `stripe` package (already in package.json).
 */
import Stripe from "stripe";
import { writeFileSync, existsSync, readFileSync } from "fs";

const key = process.env.STRIPE_SECRET_KEY?.trim();
if (!key) {
  console.error("Set STRIPE_SECRET_KEY before running this script.");
  process.exit(1);
}

const stripe = new Stripe(key);

const CATALOG = [
  {
    plan: "standard",
    name: "Seraphim IQ Standard",
    description: "Full research boards across all supported sports.",
    monthly: 1999,
    yearly: 19999,
  },
  {
    plan: "pro",
    name: "Seraphim IQ Pro",
    description: "Standard plus premium Discord picks and AI research tools.",
    monthly: 2499,
    yearly: 24999,
  },
];

async function ensureProduct(item) {
  const existing = await stripe.products.search({
    query: `name:'${item.name}' AND active:'true'`,
    limit: 1,
  });
  if (existing.data[0]) return existing.data[0];
  return stripe.products.create({
    name: item.name,
    description: item.description,
    metadata: { plan: item.plan, product: "seraphim-iq" },
  });
}

async function ensurePrice(productId, plan, interval, unitAmount) {
  const envKey =
    interval === "year"
      ? `STRIPE_PRICE_${plan.toUpperCase()}_YEARLY`
      : `STRIPE_PRICE_${plan.toUpperCase()}_MONTHLY`;

  const prices = await stripe.prices.list({
    product: productId,
    active: true,
    type: "recurring",
    limit: 100,
  });
  const match = prices.data.find(
    (p) =>
      p.recurring?.interval === interval &&
      p.unit_amount === unitAmount &&
      p.currency === "usd",
  );
  if (match) return { envKey, id: match.id, created: false };

  const created = await stripe.prices.create({
    product: productId,
    currency: "usd",
    unit_amount: unitAmount,
    recurring: { interval },
    metadata: { plan, billingInterval: interval === "year" ? "yearly" : "monthly" },
  });
  return { envKey, id: created.id, created: true };
}

async function main() {
  const lines = [
    `STRIPE_SECRET_KEY=${key}`,
    `# Optional publishable key for client Elements (Checkout hosted mode does not require it)`,
    `STRIPE_PUBLISHABLE_KEY=${process.env.STRIPE_PUBLISHABLE_KEY || "pk_test_..."}`,
    `STRIPE_WEBHOOK_SECRET=${process.env.STRIPE_WEBHOOK_SECRET || "whsec_..."}`,
    `APP_URL=${process.env.APP_URL || "http://localhost:5000"}`,
    `SESSION_SECRET=${process.env.SESSION_SECRET || "seraphim-iq-dev-session-secret"}`,
  ];

  for (const item of CATALOG) {
    const product = await ensureProduct(item);
    console.log(`Product ${item.plan}: ${product.id}`);
    const monthly = await ensurePrice(product.id, item.plan, "month", item.monthly);
    const yearly = await ensurePrice(product.id, item.plan, "year", item.yearly);
    console.log(`  ${monthly.envKey}=${monthly.id}${monthly.created ? " (created)" : " (existing)"}`);
    console.log(`  ${yearly.envKey}=${yearly.id}${yearly.created ? " (created)" : " (existing)"}`);
    lines.push(`${monthly.envKey}=${monthly.id}`);
    lines.push(`${yearly.envKey}=${yearly.id}`);
  }

  const out = `${lines.join("\n")}\n`;
  console.log("\n--- .env snippet ---\n");
  console.log(out.replace(/sk_test_[A-Za-z0-9]+/, "sk_test_***"));

  if (!existsSync(".env")) {
    writeFileSync(".env", out, { mode: 0o600 });
    console.log("Wrote /workspace/.env (gitignored).");
  } else {
    const current = readFileSync(".env", "utf8");
    const merged = new Map();
    for (const line of current.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) merged.set(m[1], m[2]);
    }
    for (const line of lines) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !line.startsWith("#")) merged.set(m[1], m[2]);
    }
    const next = [...merged.entries()].map(([k, v]) => `${k}=${v}`).join("\n") + "\n";
    writeFileSync(".env", next, { mode: 0o600 });
    console.log("Updated /workspace/.env (gitignored).");
  }

  console.log(`
Next:
  1. stripe listen --forward-to localhost:5000/api/stripe/webhook
  2. Put the whsec_... value into STRIPE_WEBHOOK_SECRET
  3. Restart npm run dev and subscribe from /checkout
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
