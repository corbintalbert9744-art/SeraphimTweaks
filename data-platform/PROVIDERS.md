# Provider adapter framework

Seraphim talks to sports data through **adapters** only. API routes and jobs
never call vendor SDKs directly.

## Architecture

```
API / Scheduler
      │
      ▼
ingestion (nba_sync, multi_sport_sync, line_aggregation_sync, *_board)
      │
      ▼
ProviderBundle (registry.get_*_providers)
      │
      ├─ espn-* / mlb-statsapi / nhl-api / …
      ├─ line-aggregator ─────────────────────────────┐
      │     ├─ propline       (PROPLINE_API_KEY)       │ priority
      │     ├─ sharpapi       (SHARPAPI_API_KEY)       │ + fallback
      │     ├─ the-odds-api   (ODDS_API_KEY)           │ on 429 /
      │     └─ antelytics     (ANTELYTICS_API_KEY)     │ unsupported
      └─ catalog-comparison-lines ← UI operator catalog
      │
      ▼
PostgreSQL warehouse (odds + line_snapshots with timestamps + source)
      │
      ▼
Projection Engine V1 → boards / prop detail (reads cache, not live vendors)
```

## Multi-provider market lines

| Adapter | Env var | Docs |
|---------|---------|------|
| **PropLine** | `PROPLINE_API_KEY` | https://prop-line.com/docs |
| **SharpAPI** | `SHARPAPI_API_KEY` | https://docs.sharpapi.io/ |
| **The Odds API** | `ODDS_API_KEY` | https://the-odds-api.com/ |
| **Antelytics** | `ANTELYTICS_API_KEY` (+ optional `ANTELYTICS_BASE_URL`) | Scaffold — unavailable until keyed / schema confirmed |

Priority (override with `LINE_PROVIDER_PRIORITY`):

```
propline,sharpapi,the-odds-api,antelytics
```

Behavior:

1. Query configured providers in order
2. Skip unconfigured / unsupported leagues (clear reason, **no fabrications**)
3. On HTTP 429 → fall through to next provider
4. Merge duplicates by `(sportsbook, player, market, side)` — higher priority wins
5. Persist to `odds` + `line_snapshots` with `captured_at` + `source` / `provider`
6. Scheduler job `refresh_odds` (default every 15 min) — pages read Postgres only

Manual sync: `POST /api/v1/jobs/sync-lines`  
Status: `GET /api/v1/lines/providers`

Adding a new provider: implement `LineMarketProvider` in `app/providers/<name>/`, register in `line_aggregation/factory.py`. Frontend stays unchanged when sportsbook slugs map to the canonical catalog.

## Sports data status

| Provider | Leagues | Live? | Config needed |
|----------|---------|-------|---------------|
| **espn-nba** | NBA | Yes | None |
| **espn-nfl** | NFL | Yes | None |
| **espn-wnba** | WNBA | Yes | None |
| **espn-soccer** | Soccer | Yes (schedule + pick'em slate) | None |
| **espn-tennis** | ATP, WTA | Yes (schedule + pick'em slate) | None |
| **mlb-statsapi** | MLB | Yes | None |
| **nhl-api** | NHL | Yes | None |
| **football-data-org** | Soccer | When keyed | `FOOTBALL_DATA_API_KEY` |
| **line-aggregator** | Multi | When any line key set | See table above |

### Keys (never fabricate without them)

| Env var | Purpose |
|---------|---------|
| `PROPLINE_API_KEY` | Primary multi-book player props |
| `SHARPAPI_API_KEY` | SharpAPI odds / props fallback |
| `ODDS_API_KEY` | The Odds API fallback |
| `ANTELYTICS_API_KEY` | Antelytics scaffold |
| `FOOTBALL_DATA_API_KEY` | Optional soccer schedule enrichment |

## Sync entry points

```bash
# Full multi-sport pass
cd data-platform && PYTHONPATH=. python3 scripts/sync_all_sports.py

# Or via API
curl -X POST http://localhost:8000/api/v1/jobs/sync-all
curl -X POST http://localhost:8000/api/v1/mlb/jobs/sync
curl -X POST http://localhost:8000/api/v1/nhl/jobs/sync
```

Scheduled (when `ENABLE_SCHEDULER=true`):

| Job | Default | Purpose |
|-----|---------|---------|
| bootstrap_nba_sync | on API start | Initial NBA warehouse fill |
| bootstrap_multi_sport | when `BOOTSTRAP_MULTI_SPORT=true` | MLB/NHL/Soccer/etc. on start |
| nba_full_sync | every 60m (`NBA_SYNC_MINUTES`) | Games, players, logs, injuries, props |
| multi_sport_sync | every 6h (`MULTI_SPORT_SYNC_HOURS`) | MLB/NHL/Soccer warehouse refresh |
| import_games | 05:10 UTC daily | Fresh schedule |
| update_injuries | every 30m | Injury refresh |
| refresh_odds | every 15m | Multi-provider line aggregator → odds + snapshots |
| recalculate_analytics | every 20m | Scores / EV |

Machine-readable status: `GET /api/v1/providers` and `GET /api/v1/leagues`  
Audit trail: `GET /api/v1/providers/runs`
