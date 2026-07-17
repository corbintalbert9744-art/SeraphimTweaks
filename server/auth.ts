import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import MemoryStoreFactory from "memorystore";
import connectPgSimple from "connect-pg-simple";
import type { PublicUser } from "./membershipStore";
import { getPublicUser } from "./membershipStore";
import { isDatabaseConfigured } from "./db";
import { isProduction } from "./runtimeConfig";

const MemoryStore = MemoryStoreFactory(session);
const PgSession = connectPgSimple(session);

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

export type AuthedRequest = Request & { user?: PublicUser };

function sessionStore() {
  if (isDatabaseConfigured()) {
    return new PgSession({
      conString: process.env.DATABASE_URL,
      tableName: "session",
      createTableIfMissing: true,
      pruneSessionInterval: 60 * 15,
    });
  }
  if (isProduction()) {
    throw new Error("DATABASE_URL is required for session persistence in production");
  }
  console.warn("[auth] DATABASE_URL unset — using in-memory sessions (dev only)");
  return new MemoryStore({ checkPeriod: 24 * 60 * 60 * 1000 });
}

export function configureSession(app: Express) {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret) {
    if (isProduction()) {
      throw new Error("SESSION_SECRET is required in production");
    }
    console.warn("[auth] SESSION_SECRET unset — using insecure dev default");
  }
  const resolvedSecret = secret || "seraphim-iq-dev-session-secret";
  const isProd = isProduction();

  app.set("trust proxy", 1);
  app.use(
    session({
      name: "seraphim.sid",
      secret: resolvedSecret,
      resave: false,
      saveUninitialized: false,
      store: sessionStore(),
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: isProd,
        maxAge: 30 * 24 * 60 * 60 * 1000,
      },
    }),
  );
}

export async function loadSessionUser(req: AuthedRequest, _res: Response, next: NextFunction) {
  try {
    if (req.session?.userId) {
      const user = await getPublicUser(req.session.userId);
      if (user) req.user = user;
      else delete req.session.userId;
    }
  } catch (err) {
    console.error("loadSessionUser", err);
  }
  next();
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  return next();
}

export function requireActiveMembership(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (!req.user.membershipActive) {
    return res.status(403).json({ error: "Active membership required" });
  }
  return next();
}
