/**
 * Fail fast on misconfigured production so membership and sessions
 * never silently fall back to in-memory stores.
 */
import { isDatabaseConfigured } from "./db";

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Public site origin — APP_URL, or Render’s injected RENDER_EXTERNAL_URL. */
export function resolveAppUrl(): string | undefined {
  const raw = (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || "").trim();
  if (!raw) return undefined;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw.replace(/\/$/, "");
  return `https://${raw.replace(/\/$/, "")}`;
}

export function assertRuntimeConfig(): void {
  const problems: string[] = [];

  if (isProduction()) {
    if (!isDatabaseConfigured()) {
      problems.push("DATABASE_URL is required in production (Postgres for users + sessions)");
    }
    const sessionSecret = process.env.SESSION_SECRET?.trim();
    if (!sessionSecret || sessionSecret === "seraphim-iq-dev-session-secret" || sessionSecret === "replace-with-a-long-random-string") {
      problems.push("SESSION_SECRET must be a strong unique value in production");
    }
    const appUrl = resolveAppUrl();
    if (!appUrl) {
      problems.push("APP_URL (or RENDER_EXTERNAL_URL) must be set to the public https origin");
    } else if (!process.env.APP_URL?.trim() && process.env.RENDER_EXTERNAL_URL?.trim()) {
      // Normalize so Stripe redirects and cookies use the same origin.
      process.env.APP_URL = appUrl;
    }
  }

  if (problems.length) {
    throw new Error(
      `[runtime] Refusing to start:\n- ${problems.join("\n- ")}\nSee .env.example for required production variables.`,
    );
  }
}

/**
 * Owner account always exists with Active Pro.
 * Defaults are the product owner credentials; override via OWNER_* env if needed.
 */
export function ownerSeedCredentials(): { email: string; password: string; name: string } {
  return {
    email: (process.env.OWNER_EMAIL || "corbintalbert@icloud.com").trim().toLowerCase(),
    password: process.env.OWNER_PASSWORD || "IamtheMaster1!",
    name: (process.env.OWNER_NAME || "Corbin").trim() || "Corbin",
  };
}

/** Always seed/refresh the owner account on boot. */
export function shouldSeedOwnerAccount(): boolean {
  return true;
}
