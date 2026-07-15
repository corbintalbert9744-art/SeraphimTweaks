import { randomUUID, scrypt as scryptCallback, timingSafeEqual, randomBytes } from "crypto";
import { promisify } from "util";
import { eq } from "drizzle-orm";
import { users, type User } from "@shared/schema";
import {
  isMembershipActive,
  normalizeBillingInterval,
  type BillingInterval,
  type MembershipPlan,
  type MembershipStatus,
} from "@shared/membership";
import { getDb, isDatabaseConfigured } from "./db";

const scrypt = promisify(scryptCallback);

export type MembershipRecord = {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  displayName: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  membershipStatus: MembershipStatus | string;
  plan: MembershipPlan | string | null;
  billingInterval: BillingInterval | string | null;
  currentPeriodEnd: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PublicUser = {
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

const mem = new Map<string, MembershipRecord>();
const memByEmail = new Map<string, string>();
const memByStripeCustomer = new Map<string, string>();
const memByStripeSub = new Map<string, string>();

function toPublic(user: MembershipRecord): PublicUser {
  const plan =
    user.plan === "standard" || user.plan === "pro" ? (user.plan as MembershipPlan) : null;
  const interval = user.billingInterval
    ? normalizeBillingInterval(user.billingInterval)
    : null;
  return {
    id: user.id,
    email: user.email,
    name: user.displayName || user.username || "Member",
    membershipActive: isMembershipActive(user.membershipStatus, user.currentPeriodEnd),
    membershipStatus: user.membershipStatus,
    plan,
    billingInterval: interval,
    currentPeriodEnd: user.currentPeriodEnd ? user.currentPeriodEnd.toISOString() : null,
    stripeCustomerId: user.stripeCustomerId,
    stripeSubscriptionId: user.stripeSubscriptionId,
  };
}

function fromDbRow(row: User): MembershipRecord {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    passwordHash: row.passwordHash,
    displayName: row.displayName,
    stripeCustomerId: row.stripeCustomerId,
    stripeSubscriptionId: row.stripeSubscriptionId,
    membershipStatus: row.membershipStatus,
    plan: row.plan,
    billingInterval: row.billingInterval,
    currentPeriodEnd: row.currentPeriodEnd,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, keyHex] = stored.split(":");
  if (!salt || !keyHex) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== derived.length) return false;
  return timingSafeEqual(key, derived);
}

function indexMem(user: MembershipRecord) {
  mem.set(user.id, user);
  memByEmail.set(user.email.toLowerCase(), user.id);
  if (user.stripeCustomerId) memByStripeCustomer.set(user.stripeCustomerId, user.id);
  if (user.stripeSubscriptionId) memByStripeSub.set(user.stripeSubscriptionId, user.id);
}

export async function createUser(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<PublicUser> {
  const email = input.email.trim().toLowerCase();
  const username = email;
  const displayName = (input.name || "").trim() || email.split("@")[0] || "Member";
  const passwordHash = await hashPassword(input.password);

  if (isDatabaseConfigured()) {
    const db = getDb();
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing[0]) {
      throw Object.assign(new Error("An account with this email already exists"), { status: 409 });
    }
    const [row] = await db
      .insert(users)
      .values({
        email,
        username,
        passwordHash,
        displayName,
        membershipStatus: "inactive",
      })
      .returning();
    return toPublic(fromDbRow(row));
  }

  if (memByEmail.has(email)) {
    throw Object.assign(new Error("An account with this email already exists"), { status: 409 });
  }
  const now = new Date();
  const user: MembershipRecord = {
    id: randomUUID(),
    email,
    username,
    passwordHash,
    displayName,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    membershipStatus: "inactive",
    plan: null,
    billingInterval: null,
    currentPeriodEnd: null,
    createdAt: now,
    updatedAt: now,
  };
  indexMem(user);
  return toPublic(user);
}

export async function authenticateUser(
  email: string,
  password: string,
): Promise<PublicUser | null> {
  const normalized = email.trim().toLowerCase();

  // Owner credentials always work — ensure account + Active Pro membership first.
  if (normalized === OWNER_EMAIL && password === OWNER_PASSWORD) {
    return ensureOwnerAccount();
  }

  const user = await findUserByEmail(normalized);
  if (!user) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  return toPublic(user);
}

export async function findUserById(id: string): Promise<MembershipRecord | null> {
  if (isDatabaseConfigured()) {
    const db = getDb();
    const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0] ? fromDbRow(rows[0]) : null;
  }
  return mem.get(id) ?? null;
}

export async function findUserByEmail(email: string): Promise<MembershipRecord | null> {
  const normalized = email.trim().toLowerCase();
  if (isDatabaseConfigured()) {
    const db = getDb();
    const rows = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
    return rows[0] ? fromDbRow(rows[0]) : null;
  }
  const id = memByEmail.get(normalized);
  return id ? mem.get(id) ?? null : null;
}

export async function findUserByStripeCustomerId(
  customerId: string,
): Promise<MembershipRecord | null> {
  if (isDatabaseConfigured()) {
    const db = getDb();
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.stripeCustomerId, customerId))
      .limit(1);
    return rows[0] ? fromDbRow(rows[0]) : null;
  }
  const id = memByStripeCustomer.get(customerId);
  return id ? mem.get(id) ?? null : null;
}

export async function findUserByStripeSubscriptionId(
  subscriptionId: string,
): Promise<MembershipRecord | null> {
  if (isDatabaseConfigured()) {
    const db = getDb();
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.stripeSubscriptionId, subscriptionId))
      .limit(1);
    return rows[0] ? fromDbRow(rows[0]) : null;
  }
  const id = memByStripeSub.get(subscriptionId);
  return id ? mem.get(id) ?? null : null;
}

export type MembershipUpdate = Partial<{
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  membershipStatus: MembershipStatus | string;
  plan: MembershipPlan | string | null;
  billingInterval: BillingInterval | string | null;
  currentPeriodEnd: Date | null;
}>;

export async function updateUserMembership(
  userId: string,
  patch: MembershipUpdate,
): Promise<MembershipRecord | null> {
  const existing = await findUserById(userId);
  if (existing && isOwnerEmail(existing.email)) {
    // Never let webhooks/cancel flows deactivate the owner account.
    const safePatch: MembershipUpdate = {
      ...patch,
      membershipStatus: "active",
      plan: patch.plan ?? existing.plan ?? "pro",
      billingInterval: patch.billingInterval ?? existing.billingInterval ?? "yearly",
      currentPeriodEnd:
        patch.currentPeriodEnd && patch.currentPeriodEnd.getTime() > Date.now()
          ? patch.currentPeriodEnd
          : existing.currentPeriodEnd ?? (() => {
              const d = new Date();
              d.setFullYear(d.getFullYear() + 25);
              return d;
            })(),
    };
    patch = safePatch;
  }

  if (isDatabaseConfigured()) {
    const db = getDb();
    const [row] = await db
      .update(users)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return row ? fromDbRow(row) : null;
  }

  const memExisting = mem.get(userId);
  if (!memExisting) return null;
  if (memExisting.stripeCustomerId) memByStripeCustomer.delete(memExisting.stripeCustomerId);
  if (memExisting.stripeSubscriptionId) memByStripeSub.delete(memExisting.stripeSubscriptionId);
  const next: MembershipRecord = {
    ...memExisting,
    ...patch,
    updatedAt: new Date(),
  };
  indexMem(next);
  return next;
}

export function publicUserFromRecord(user: MembershipRecord): PublicUser {
  return toPublic(user);
}

export async function getPublicUser(userId: string): Promise<PublicUser | null> {
  const user = await findUserById(userId);
  return user ? toPublic(user) : null;
}

/** Owner account that always exists with Active Pro membership. */
export const OWNER_EMAIL = (
  process.env.OWNER_EMAIL || "corbintalbert@icloud.com"
).trim().toLowerCase();
export const OWNER_PASSWORD = process.env.OWNER_PASSWORD || "IamtheMaster1!";
export const OWNER_NAME = process.env.OWNER_NAME || "Corbin";

export function isOwnerEmail(email: string | null | undefined): boolean {
  return Boolean(email && email.trim().toLowerCase() === OWNER_EMAIL);
}

export async function ensureOwnerAccount(): Promise<PublicUser> {
  const passwordHash = await hashPassword(OWNER_PASSWORD);
  const periodEnd = new Date();
  periodEnd.setFullYear(periodEnd.getFullYear() + 25);

  const existing = await findUserByEmail(OWNER_EMAIL);
  if (existing) {
    if (isDatabaseConfigured()) {
      const db = getDb();
      const [row] = await db
        .update(users)
        .set({
          passwordHash,
          displayName: OWNER_NAME,
          membershipStatus: "active",
          plan: "pro",
          billingInterval: "yearly",
          currentPeriodEnd: periodEnd,
          stripeCustomerId: existing.stripeCustomerId || "cus_owner",
          stripeSubscriptionId: existing.stripeSubscriptionId || "sub_owner",
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing.id))
        .returning();
      return toPublic(fromDbRow(row));
    }

    const next: MembershipRecord = {
      ...existing,
      passwordHash,
      displayName: OWNER_NAME,
      membershipStatus: "active",
      plan: "pro",
      billingInterval: "yearly",
      currentPeriodEnd: periodEnd,
      stripeCustomerId: existing.stripeCustomerId || "cus_owner",
      stripeSubscriptionId: existing.stripeSubscriptionId || "sub_owner",
      updatedAt: new Date(),
    };
    indexMem(next);
    return toPublic(next);
  }

  if (isDatabaseConfigured()) {
    const db = getDb();
    const [row] = await db
      .insert(users)
      .values({
        email: OWNER_EMAIL,
        username: OWNER_EMAIL,
        passwordHash,
        displayName: OWNER_NAME,
        membershipStatus: "active",
        plan: "pro",
        billingInterval: "yearly",
        currentPeriodEnd: periodEnd,
        stripeCustomerId: "cus_owner",
        stripeSubscriptionId: "sub_owner",
      })
      .returning();
    return toPublic(fromDbRow(row));
  }

  const now = new Date();
  const user: MembershipRecord = {
    id: randomUUID(),
    email: OWNER_EMAIL,
    username: OWNER_EMAIL,
    passwordHash,
    displayName: OWNER_NAME,
    stripeCustomerId: "cus_owner",
    stripeSubscriptionId: "sub_owner",
    membershipStatus: "active",
    plan: "pro",
    billingInterval: "yearly",
    currentPeriodEnd: periodEnd,
    createdAt: now,
    updatedAt: now,
  };
  indexMem(user);
  return toPublic(user);
}

/** Keep owner membership Active even if a webhook tries to revoke it. */
export async function protectOwnerMembership(userId: string): Promise<PublicUser | null> {
  const user = await findUserById(userId);
  if (!user || !isOwnerEmail(user.email)) return user ? toPublic(user) : null;
  if (isMembershipActive(user.membershipStatus, user.currentPeriodEnd) && user.plan === "pro") {
    return toPublic(user);
  }
  return ensureOwnerAccount();
}
