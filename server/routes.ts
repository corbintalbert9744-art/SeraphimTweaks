import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { buildCommandCenterPayload, buildFeaturedNbaProp, getNbaGames } from "./services/nbaService";
import { registerAuthAndBillingRoutes } from "./billingRoutes";
import { registerDataPlatformProxy } from "./dataPlatformProxy";
import { requireActiveMembership, requireAuth } from "./auth";
import { resolveDataPlatformUrl } from "./runtimeConfig";

const DATA_PLATFORM_URL = resolveDataPlatformUrl();

/** Member-only sports / research APIs (auth + active membership). */
const MEMBER_API_PREFIXES = [
  "/api/nba",
  "/api/nfl",
  "/api/wnba",
  "/api/mlb",
  "/api/nhl",
  "/api/soccer",
  "/api/tennis",
  "/api/command-center",
  "/api/arbitrage",
  "/api/plus-ev",
  "/api/odds",
  "/api/jobs",
  "/api/lines",
  "/api/v1/providers",
] as const;

async function probeDataPlatform(): Promise<{
  ok: boolean;
  status?: number;
  detail?: string;
}> {
  try {
    const upstream = await fetch(`${DATA_PLATFORM_URL}/api/v1/health`, {
      signal: AbortSignal.timeout(3_000),
      headers: { Accept: "application/json" },
    });
    if (!upstream.ok) {
      return { ok: false, status: upstream.status, detail: "Data platform returned an error" };
    }
    return { ok: true, status: upstream.status };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : "Data platform unreachable",
    };
  }
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  registerAuthAndBillingRoutes(app);

  app.get("/api/health", async (_req, res) => {
    const platform = await probeDataPlatform();
    // Always 200 for liveness (Render / load balancers). dataPlatform.ok shows warehouse status.
    res.status(200).json({
      ok: true,
      ready: platform.ok,
      product: "seraphim-analytics",
      time: new Date().toISOString(),
      databaseConfigured: Boolean(process.env.DATABASE_URL?.trim()),
      dataPlatform: {
        url: DATA_PLATFORM_URL,
        ...platform,
        hint: platform.ok
          ? undefined
          : "Start the warehouse with npm run data-platform (or npm run start:all / dev:all)",
      },
    });
  });

  // Public platform health probe (no membership) for ops monitors.
  app.get("/api/v1/health", async (_req, res) => {
    const platform = await probeDataPlatform();
    if (!platform.ok) {
      return res.status(503).json({
        status: "degraded",
        dataPlatform: platform,
        hint: "Start with: npm run data-platform",
      });
    }
    try {
      const upstream = await fetch(`${DATA_PLATFORM_URL}/api/v1/health`, {
        signal: AbortSignal.timeout(5_000),
      });
      const data = await upstream.json().catch(() => ({}));
      return res.status(upstream.status).json(data);
    } catch (err) {
      return res.status(503).json({
        status: "down",
        detail: err instanceof Error ? err.message : "unreachable",
      });
    }
  });

  for (const prefix of MEMBER_API_PREFIXES) {
    app.use(prefix, requireAuth, requireActiveMembership);
  }

  async function nbaGames(req: Request, res: Response) {
    try {
      const dates = typeof req.query.dates === "string" ? req.query.dates : undefined;
      const data = await getNbaGames(dates);
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(502).json({ error: "Failed to fetch NBA games from ESPN", detail: String(err) });
    }
  }

  async function featuredProp(req: Request, res: Response) {
    try {
      const gameId = typeof req.query.gameId === "string" ? req.query.gameId : undefined;
      const data = await buildFeaturedNbaProp(gameId);
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(502).json({ error: "Failed to build featured NBA prop", detail: String(err) });
    }
  }

  async function commandCenter(_req: Request, res: Response) {
    try {
      const data = await buildCommandCenterPayload();
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(502).json({ error: "Failed to build Command Center", detail: String(err) });
    }
  }

  // Prefer Python data platform when running; fall back to Node ESPN adapters.
  registerDataPlatformProxy(app, { nbaGames, featuredProp, commandCenter });

  return httpServer;
}
