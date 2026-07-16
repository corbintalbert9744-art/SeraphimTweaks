import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { buildCommandCenterPayload, buildFeaturedNbaProp, getNbaGames } from "./services/nbaService";
import { registerAuthAndBillingRoutes } from "./billingRoutes";
import { registerDataPlatformProxy } from "./dataPlatformProxy";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  registerAuthAndBillingRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, product: "seraphim-analytics", time: new Date().toISOString() });
  });

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
