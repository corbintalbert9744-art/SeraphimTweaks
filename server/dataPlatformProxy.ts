/**
 * Optional proxy from Express → FastAPI data platform.
 * When DATA_PLATFORM_URL is set (default http://127.0.0.1:8000), sports
 * endpoints prefer the Python warehouse and fall back to the Node NBA service.
 */
import type { Express, Request, Response } from "express";
import { resolveDataPlatformUrl } from "./runtimeConfig";

const BASE = resolveDataPlatformUrl();
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
      // Forward real 404s (player/prop missing) — do not mask as "platform down"
      if (upstream.status === 404) {
        const data = await upstream.json().catch(() => ({ detail: "Not found" }));
        res.status(404).json(data);
        return;
      }
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
    // Command Center aggregates multi-sport pick'em — allow cold-start headroom.
    await proxyGet(`/api/v1/nba/command-center`, res, () => handlers.commandCenter(req, res), 90_000);
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
    const qs = new URLSearchParams();
    if (req.query.refresh === "1" || req.query.refresh === "true") qs.set("refresh", "true");
    if (typeof req.query.platform === "string" && req.query.platform) {
      qs.set("platform", req.query.platform);
    }
    const suffix = qs.toString() ? `?${qs}` : "";
    await proxyGet(
      `/api/v1/nfl/props${suffix}`,
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
    const qs = new URLSearchParams();
    if (req.query.refresh === "1" || req.query.refresh === "true") qs.set("refresh", "true");
    if (typeof req.query.platform === "string" && req.query.platform) {
      qs.set("platform", req.query.platform);
    }
    const suffix = qs.toString() ? `?${qs}` : "";
    // First slate ingest can take a while (ESPN gamelogs × players)
    await proxyGet(
      `/api/v1/nba/props${suffix}`,
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
    const qs = new URLSearchParams();
    if (typeof req.query.platform === "string" && req.query.platform) {
      qs.set("platform", req.query.platform);
    }
    const suffix = qs.toString() ? `?${qs}` : "";
    await proxyGet(
      `/api/v1/nba/players/${encodeURIComponent(req.params.id)}${suffix}`,
      res,
      async () => {
        res.status(503).json({ error: "NBA player profile requires the data platform" });
      },
      120_000,
    );
  });

  // WNBA — ESPN live + PrizePicks comparison placeholders
  app.get("/api/wnba/games", async (req, res) => {
    const qs = typeof req.query.dates === "string" ? `?dates=${encodeURIComponent(req.query.dates)}` : "";
    await proxyGet(`/api/v1/wnba/games${qs}`, res, async () => {
      res.status(503).json({ error: "WNBA requires the data platform", games: [] });
    });
  });

  app.get("/api/wnba/props", async (req, res) => {
    const qs = new URLSearchParams();
    if (req.query.refresh === "1" || req.query.refresh === "true") qs.set("refresh", "true");
    if (typeof req.query.platform === "string" && req.query.platform) {
      qs.set("platform", req.query.platform);
    }
    const suffix = qs.toString() ? `?${qs}` : "";
    await proxyGet(
      `/api/v1/wnba/props${suffix}`,
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
    const qs = new URLSearchParams();
    if (typeof req.query.platform === "string" && req.query.platform) {
      qs.set("platform", req.query.platform);
    }
    const suffix = qs.toString() ? `?${qs}` : "";
    await proxyGet(
      `/api/v1/wnba/players/${encodeURIComponent(req.params.id)}${suffix}`,
      res,
      async () => {
        res.status(503).json({ error: "WNBA player profile requires the data platform" });
      },
      120_000,
    );
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

  // Arbitrage Finder — cross-book Over/Under surebets
  app.get("/api/arbitrage", async (req, res) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (typeof v === "string") qs.set(k, v);
    }
    const suffix = qs.toString() ? `?${qs}` : "";
    await proxyGet(
      `/api/v1/arbitrage${suffix}`,
      res,
      async () => {
        res.status(503).json({
          error: "Arbitrage finder requires the data platform",
          opportunities: [],
          count: 0,
        });
      },
      180_000,
    );
  });

  app.get("/api/arbitrage/meta", async (_req, res) => {
    await proxyGet(`/api/v1/arbitrage/meta`, res, async () => {
      res.json({ refreshSeconds: 300, defaultTotalStake: 100 });
    });
  });

  app.get("/api/arbitrage/prop/:id", async (req, res) => {
    const qs = new URLSearchParams();
    if (typeof req.query.league === "string") qs.set("league", req.query.league);
    if (typeof req.query.totalStake === "string") qs.set("totalStake", req.query.totalStake);
    const suffix = qs.toString() ? `?${qs}` : "";
    await proxyGet(
      `/api/v1/arbitrage/prop/${encodeURIComponent(req.params.id)}${suffix}`,
      res,
      async () => {
        res.status(503).json({ error: "Arbitrage prop scan requires the data platform" });
      },
    );
  });

  // Positive Expected Value (+EV) board
  app.get("/api/plus-ev", async (req, res) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (typeof v === "string") qs.set(k, v);
    }
    const suffix = qs.toString() ? `?${qs}` : "";
    await proxyGet(`/api/v1/plus-ev${suffix}`, res, async () => {
      res.status(503).json({
        error: "+EV board requires the data platform",
        props: [],
        count: 0,
      });
    }, 180_000);
  });

  app.get("/api/plus-ev/thresholds", async (_req, res) => {
    await proxyGet(`/api/v1/plus-ev/thresholds`, res, async () => {
      res.json({ plusEvThreshold: 4, strongPlusEvThreshold: 12 });
    });
  });

  app.get("/api/plus-ev/prop/:id", async (req, res) => {
    const qs = typeof req.query.league === "string" ? `?league=${encodeURIComponent(req.query.league)}` : "";
    await proxyGet(
      `/api/v1/plus-ev/prop/${encodeURIComponent(req.params.id)}${qs}`,
      res,
      async () => {
        res.status(503).json({ error: "+EV prop detail requires the data platform" });
      },
    );
  });

  // Live Odds Comparison — canonical books + pick'em via provider adapters
  app.get("/api/odds/providers", async (_req, res) => {
    await proxyGet(`/api/v1/odds/providers`, res, async () => {
      res.status(503).json({ error: "Odds providers require the data platform", providers: [] });
    });
  });

  app.get("/api/odds/comparison/:id", async (req, res) => {
    const propId = req.params.id;
    const qs = typeof req.query.league === "string" ? `?league=${encodeURIComponent(req.query.league)}` : "";
    await proxyGet(
      `/api/v1/odds/comparison/${encodeURIComponent(propId)}${qs}`,
      res,
      async () => {
        res.status(503).json({ error: "Live odds comparison requires the data platform", books: [] });
      },
    );
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

  // /api/v1/health is registered in routes.ts (public ops probe).

  const proxyLeagueGet = (mount: string, upstream: string, timeoutMs = 120_000) => {
    app.get(mount, async (req, res) => {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(req.query)) {
        if (typeof v === "string") qs.set(k, v);
      }
      const suffix = qs.toString() ? `?${qs}` : "";
      try {
        const up = await fetch(`${BASE}${upstream}${suffix}`, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(timeoutMs),
        });
        res.status(up.status).json(await up.json());
      } catch {
        res.status(503).json({
          error: "Data platform unavailable",
          hint: "Start with: npm run data-platform",
          props: [],
          games: [],
          live: false,
        });
      }
    });
  };

  proxyLeagueGet("/api/mlb/games", "/api/v1/mlb/games");
  proxyLeagueGet("/api/mlb/props", "/api/v1/mlb/props", 180_000);
  proxyLeagueGet("/api/mlb/players", "/api/v1/mlb/players", 180_000);
  proxyLeagueGet("/api/nhl/games", "/api/v1/nhl/games");
  proxyLeagueGet("/api/nhl/props", "/api/v1/nhl/props", 180_000);
  proxyLeagueGet("/api/nhl/players", "/api/v1/nhl/players", 180_000);
  proxyLeagueGet("/api/soccer/games", "/api/v1/soccer/games");
  proxyLeagueGet("/api/soccer/props", "/api/v1/soccer/props", 180_000);
  proxyLeagueGet("/api/soccer/players", "/api/v1/soccer/players", 180_000);
  proxyLeagueGet("/api/tennis/games", "/api/v1/tennis/games");
  proxyLeagueGet("/api/tennis/props", "/api/v1/tennis/props", 180_000);
  proxyLeagueGet("/api/tennis/players", "/api/v1/tennis/players", 180_000);

  // Player detail — Express does not match /players/:id against /players list routes
  const proxyPlayerDetail = (mount: string, upstream: string) => {
    app.get(`${mount}/:id`, async (req, res) => {
      try {
        const qs = new URLSearchParams();
        if (typeof req.query.platform === "string" && req.query.platform) {
          qs.set("platform", req.query.platform);
        }
        const suffix = qs.toString() ? `?${qs}` : "";
        const up = await fetch(
          `${BASE}${upstream}/${encodeURIComponent(req.params.id)}${suffix}`,
          {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(120_000),
          },
        );
        const data = await up.json().catch(() => ({ detail: "Not found" }));
        // Normalize bare profile payloads to { ok, player } for the research UI
        if (up.ok && data && typeof data === "object" && !("player" in data) && data.markets) {
          res.status(up.status).json({ ok: true, player: data, _source: "data-platform" });
          return;
        }
        res.status(up.status).json(
          up.ok && data && typeof data === "object"
            ? { ...data, _source: "data-platform" }
            : data,
        );
      } catch {
        res.status(503).json({
          error: "Data platform unavailable",
          hint: "Start with: npm run data-platform",
        });
      }
    });
  };
  proxyPlayerDetail("/api/mlb/players", "/api/v1/mlb/players");
  proxyPlayerDetail("/api/nhl/players", "/api/v1/nhl/players");
  proxyPlayerDetail("/api/soccer/players", "/api/v1/soccer/players");
  proxyPlayerDetail("/api/tennis/players", "/api/v1/tennis/players");
  proxyPlayerDetail("/api/nfl/players", "/api/v1/nfl/players");

  // prop detail proxies
  app.get("/api/mlb/props/:id", async (req, res) => {
    try {
      const up = await fetch(`${BASE}/api/v1/mlb/props/${encodeURIComponent(req.params.id)}`, {
        signal: AbortSignal.timeout(30_000),
      });
      res.status(up.status).json(await up.json());
    } catch {
      res.status(503).json({ error: "Data platform unavailable" });
    }
  });
  app.get("/api/nhl/props/:id", async (req, res) => {
    try {
      const up = await fetch(`${BASE}/api/v1/nhl/props/${encodeURIComponent(req.params.id)}`, {
        signal: AbortSignal.timeout(30_000),
      });
      res.status(up.status).json(await up.json());
    } catch {
      res.status(503).json({ error: "Data platform unavailable" });
    }
  });
  app.get("/api/tennis/props/:id", async (req, res) => {
    try {
      const tour =
        typeof req.query.tour === "string" ? `?tour=${encodeURIComponent(req.query.tour)}` : "";
      const up = await fetch(
        `${BASE}/api/v1/tennis/props/${encodeURIComponent(req.params.id)}${tour}`,
        { signal: AbortSignal.timeout(30_000) },
      );
      res.status(up.status).json(await up.json());
    } catch {
      res.status(503).json({ error: "Data platform unavailable" });
    }
  });
  app.get("/api/soccer/props/:id", async (req, res) => {
    try {
      const up = await fetch(`${BASE}/api/v1/soccer/props/${encodeURIComponent(req.params.id)}`, {
        signal: AbortSignal.timeout(30_000),
      });
      res.status(up.status).json(await up.json());
    } catch {
      res.status(503).json({ error: "Data platform unavailable" });
    }
  });

  app.post("/api/jobs/sync-all", async (req, res) => {
    const qs = typeof req.query.dates === "string" ? `?dates=${encodeURIComponent(req.query.dates)}` : "";
    try {
      const upstream = await fetch(`${BASE}/api/v1/jobs/sync-all${qs}`, {
        method: "POST",
        signal: AbortSignal.timeout(600_000),
      });
      res.status(upstream.status).json(await upstream.json());
    } catch {
      res.status(503).json({
        error: "Multi-sport sync requires the Python data platform",
        hint: "Start with: npm run data-platform",
      });
    }
  });

  app.post("/api/jobs/sync-lines", async (_req, res) => {
    try {
      const upstream = await fetch(`${BASE}/api/v1/jobs/sync-lines`, {
        method: "POST",
        signal: AbortSignal.timeout(300_000),
      });
      res.status(upstream.status).json(await upstream.json());
    } catch {
      res.status(503).json({
        error: "Line aggregation sync requires the Python data platform",
        hint: "Start with: npm run data-platform",
      });
    }
  });

  app.get("/api/lines/providers", async (_req, res) => {
    try {
      const upstream = await fetch(`${BASE}/api/v1/lines/providers`, {
        signal: AbortSignal.timeout(15_000),
      });
      res.status(upstream.status).json(await upstream.json());
    } catch {
      res.status(503).json({ error: "Data platform unavailable", adapters: [] });
    }
  });
}
