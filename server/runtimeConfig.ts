/**
 * Fail fast on misconfigured production so membership and sessions
 * never silently fall back to in-memory stores.
 */
import { isDatabaseConfigured } from "./db";

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
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
    if (!process.env.APP_URL?.trim()) {
      problems.push("APP_URL should be set to the public site origin in production");
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
