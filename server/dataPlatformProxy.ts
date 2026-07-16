/**
 * Optional proxy from Express → FastAPI data platform.
 * When DATA_PLATFORM_URL is set (default http://127.0.0.1:8000), sports
 * endpoints prefer the Python warehouse and fall back to the Node NBA service.
 */
import type { Express, Request, Response } from "express";

const BASE = process.env.DATA_PLATFORM_URL || "http://127.0.0.1:8000";
const ENABLED = process.env.DATA_PLATFORM_PROXY !== "0";

async function proxyGet(
  path: string,
  res: Response,
  fallback: () => Promise<void>,
  timeoutMs = 25_000,
) {
  if (!ENABLED) {
    await fallback();
    return;
  }
  try {
    const upstream = await fetch(`${BASE}${path}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!upstream.ok) {
      await fallback();
      return;
    }
    const data = await upstream.json();
    res.json({ ...data, _source: "data-platform" });
  } catch {
    await fallback();
  }
}

export function registerDataPlatformProxy(
  app: Express,
  handlers: {
    nbaGames: (req: Request, res: Response) => Promise<void>;
    featuredProp: (req: Request, res: Response) => Promise<void>;
    commandCenter: (req: Request, res: Response) => Promise<void>;
  },
) {
  app.get("/api/nba/games", async (req, res) => {
    const qs = typeof req.query.dates === "string" ? `?dates=${encodeURIComponent(req.query.dates)}` : "";
    await proxyGet(`/api/v1/nba/games${qs}`, res, () => handlers.nbaGames(req, res));
  });

  app.get("/api/nba/featured-prop", async (req, res) => {
    const qs = typeof req.query.gameId === "string" ? `?gameId=${encodeURIComponent(req.query.gameId)}` : "";
    await proxyGet(`/api/v1/nba/featured-prop${qs}`, res, () => handlers.featuredProp(req, res));
  });

  app.get("/api/command-center", async (req, res) => {
    await proxyGet(`/api/v1/nba/command-center`, res, () => handlers.commandCenter(req, res));
  });

  // NFL — data platform only (no Node ESPN fallback yet)
  app.get("/api/nfl/games", async (req, res) => {
    const qs = typeof req.query.dates === "string" ? `?dates=${encodeURIComponent(req.query.dates)}` : "";
    await proxyGet(`/api/v1/nfl/games${qs}`, res, async () => {
      res.status(503).json({
        error: "NFL data requires the Python data platform",
        hint: "Start with: npm run data-platform",
      });
    });
  });

  app.get("/api/nfl/featured-prop", async (req, res) => {
    const qs = typeof req.query.gameId === "string" ? `?gameId=${encodeURIComponent(req.query.gameId)}` : "";
    await proxyGet(`/api/v1/nfl/featured-prop${qs}`, res, async () => {
      res.status(503).json({
        error: "NFL featured prop requires the Python data platform",
        hint: "Start with: npm run data-platform",
      });
    });
  });

  app.get("/api/nfl/props", async (req, res) => {
    const refresh = req.query.refresh === "1" || req.query.refresh === "true" ? "?refresh=true" : "";
    await proxyGet(
      `/api/v1/nfl/props${refresh}`,
      res,
      async () => {
        res.status(503).json({
          error: "NFL board requires the Python data platform",
          hint: "Start with: npm run data-platform",
          props: [],
          players: [],
        });
      },
      180_000,
    );
  });

  app.get("/api/nfl/players", async (_req, res) => {
    await proxyGet(`/api/v1/nfl/players`, res, async () => {
      res.status(503).json({ error: "NFL players require the data platform", players: [] });
    });
  });

  // NBA board / players / prop detail — data platform warehouse
  app.get("/api/nba/props", async (req, res) => {
    const refresh = req.query.refresh === "1" || req.query.refresh === "true" ? "?refresh=true" : "";
    // First slate ingest can take a while (ESPN gamelogs × players)
    await proxyGet(
      `/api/v1/nba/props${refresh}`,
      res,
      async () => {
        res.status(503).json({
          error: "NBA board requires the Python data platform",
          hint: "Start with: npm run data-platform",
          props: [],
          players: [],
        });
      },
      180_000,
    );
  });

  app.get("/api/nba/props/:id", async (req, res) => {
    await proxyGet(`/api/v1/nba/props/${encodeURIComponent(req.params.id)}`, res, async () => {
      res.status(503).json({ error: "NBA prop detail requires the data platform" });
    });
  });

  app.get("/api/nba/players", async (_req, res) => {
    await proxyGet(`/api/v1/nba/players`, res, async () => {
      res.status(503).json({ error: "NBA players require the data platform", players: [] });
    });
  });

  app.get("/api/nba/players/:id", async (req, res) => {
    await proxyGet(`/api/v1/nba/players/${encodeURIComponent(req.params.id)}`, res, async () => {
      res.status(503).json({ error: "NBA player profile requires the data platform" });
    });
  });

  // WNBA — ESPN live + PrizePicks comparison placeholders
  app.get("/api/wnba/games", async (req, res) => {
    const qs = typeof req.query.dates === "string" ? `?dates=${encodeURIComponent(req.query.dates)}` : "";
    await proxyGet(`/api/v1/wnba/games${qs}`, res, async () => {
      res.status(503).json({ error: "WNBA requires the data platform", games: [] });
    });
  });

  app.get("/api/wnba/props", async (req, res) => {
    const refresh = req.query.refresh === "1" || req.query.refresh === "true" ? "?refresh=true" : "";
    await proxyGet(
      `/api/v1/wnba/props${refresh}`,
      res,
      async () => {
        res.status(503).json({
          error: "WNBA board requires the Python data platform",
          hint: "Start with: npm run data-platform",
          props: [],
          players: [],
        });
      },
      180_000,
    );
  });

  app.get("/api/wnba/props/:id", async (req, res) => {
    await proxyGet(`/api/v1/wnba/props/${encodeURIComponent(req.params.id)}`, res, async () => {
      res.status(503).json({ error: "WNBA prop detail requires the data platform" });
    });
  });

  app.get("/api/wnba/players", async (_req, res) => {
    await proxyGet(`/api/v1/wnba/players`, res, async () => {
      res.status(503).json({ error: "WNBA players require the data platform", players: [] });
    });
  });

  app.get("/api/wnba/players/:id", async (req, res) => {
    await proxyGet(`/api/v1/wnba/players/${encodeURIComponent(req.params.id)}`, res, async () => {
      res.status(503).json({ error: "WNBA player profile requires the data platform" });
    });
  });

  app.get("/api/v1/providers", async (_req, res) => {
    try {
      const upstream = await fetch(`${BASE}/api/v1/providers`, { signal: AbortSignal.timeout(8_000) });
      if (!upstream.ok) throw new Error(String(upstream.status));
      res.json(await upstream.json());
    } catch {
      res.status(503).json({
        error: "Data platform unavailable",
        hint: "Start with: npm run data-platform",
        providers: [],
      });
    }
  });

  app.get("/api/v1/providers/runs", async (req, res) => {
    const limit = typeof req.query.limit === "string" ? req.query.limit : "25";
    try {
      const upstream = await fetch(`${BASE}/api/v1/providers/runs?limit=${encodeURIComponent(limit)}`, {
        signal: AbortSignal.timeout(8_000),
      });
      if (!upstream.ok) throw new Error(String(upstream.status));
      res.json(await upstream.json());
    } catch {
      res.status(503).json({ error: "Data platform unavailable", runs: [] });
    }
  });

  app.post("/api/nba/jobs/sync", async (req, res) => {
    const qs = new URLSearchParams();
    if (typeof req.query.dates === "string") qs.set("dates", req.query.dates);
    if (typeof req.query.max_games === "string") qs.set("max_games", req.query.max_games);
    if (typeof req.query.per_team === "string") qs.set("per_team", req.query.per_team);
    const suffix = qs.toString() ? `?${qs}` : "";
    try {
      const upstream = await fetch(`${BASE}/api/v1/nba/jobs/sync${suffix}`, {
        method: "POST",
        signal: AbortSignal.timeout(300_000),
      });
      res.status(upstream.status).json(await upstream.json());
    } catch {
      res.status(503).json({
        error: "NBA sync requires the Python data platform",
        hint: "Start with: npm run data-platform",
      });
    }
  });

  app.get("/api/v1/health", async (_req, res) => {
    try {
      const upstream = await fetch(`${BASE}/api/v1/health`, { signal: AbortSignal.timeout(5_000) });
      res.status(upstream.status).json(await upstream.json());
    } catch {
      res.status(503).json({ ok: false, error: "data-platform down" });
    }
  });
}
