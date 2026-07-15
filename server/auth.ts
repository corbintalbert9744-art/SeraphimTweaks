import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import MemoryStoreFactory from "memorystore";
import type { PublicUser } from "./membershipStore";
import { getPublicUser } from "./membershipStore";

const MemoryStore = MemoryStoreFactory(session);

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

export type AuthedRequest = Request & { user?: PublicUser };

export function configureSession(app: Express) {
  const secret = process.env.SESSION_SECRET || "seraphim-iq-dev-session-secret";
  const isProd = process.env.NODE_ENV === "production";

  app.set("trust proxy", 1);
  app.use(
    session({
      name: "seraphim.sid",
      secret,
      resave: false,
      saveUninitialized: false,
      store: new MemoryStore({ checkPeriod: 24 * 60 * 60 * 1000 }),
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
