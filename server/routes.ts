import type { Express } from "express";
import { createServer, type Server } from "http";
import { buildCommandCenterPayload, buildFeaturedNbaProp, getNbaGames } from "./services/nbaService";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, product: "seraphim-analytics", time: new Date().toISOString() });
  });

  app.get("/api/nba/games", async (req, res) => {
    try {
      const dates = typeof req.query.dates === "string" ? req.query.dates : undefined;
      const data = await getNbaGames(dates);
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(502).json({ error: "Failed to fetch NBA games from ESPN", detail: String(err) });
    }
  });

  app.get("/api/nba/featured-prop", async (req, res) => {
    try {
      const gameId = typeof req.query.gameId === "string" ? req.query.gameId : undefined;
      const data = await buildFeaturedNbaProp(gameId);
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(502).json({ error: "Failed to build featured NBA prop", detail: String(err) });
    }
  });

  app.get("/api/command-center", async (_req, res) => {
    try {
      const data = await buildCommandCenterPayload();
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(502).json({ error: "Failed to build Command Center", detail: String(err) });
    }
  });

  return httpServer;
}
