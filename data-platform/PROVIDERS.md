# Provider adapter framework

Seraphim talks to sports data through **adapters** only. API routes and jobs
never call vendor SDKs directly.

## Architecture

```
API / Scheduler
      │
      ▼
ingestion (nba_sync, multi_sport_sync, *_board, pipelines)
      │
      ▼
ProviderBundle (registry.get_*_providers)
      │
      ├─ espn-nba / espn-nfl / espn-wnba  ← live, no API key
      ├─ nba-api (optional pip)          ← NBA Stats supplement, no key
      ├─ nflverse / nfl_data_py (optional) ← NFL supplement, no key
      ├─ mlb-statsapi                    ← live, no API key
      ├─ nhl-api                         ← live, no API key
      ├─ football-data-org               ← REQUIRES FOOTBALL_DATA_API_KEY
      ├─ tennis-abstract                 ← REQUIRES PROVIDER SELECTION (no scrape)
      ├─ the-odds-api                    ← live when ODDS_API_KEY is set
      └─ catalog-comparison-lines        ← labeled placeholders until keyed
      │
      ▼
PostgreSQL warehouse (SQLite fallback) + provider_runs audit
      │
      ▼
Projection Engine V1 → hit rates, projections, research/confidence scores
```

Framework modules:

| Module | Role |
|--------|------|
| `app/providers/framework.py` | DTOs, capability protocols, HTTP client w/ retries, `run_provider_job` |
| `app/providers/base.py` | Stable re-exports |
| `app/providers/registry.py` | League → adapter wiring |
| `app/ingestion/multi_sport_sync.py` | Cross-league warehouse orchestrator |
| `app/ingestion/generic_board.py` | Warehouse logs → Projection Engine V1 boards |

## Status

| Provider | Leagues | Live? | Config needed |
|----------|---------|-------|---------------|
| **espn-nba** | NBA | Yes | None |
| **espn-nfl** | NFL | Yes | None |
| **espn-wnba** | WNBA | Yes | None |
| **nba-api** | NBA (WNBA limited) | When `pip install nba_api` | Optional package |
| **nflverse** | NFL | When `pip install nfl_data_py` | Optional package |
| **mlb-statsapi** | MLB | Yes | None |
| **nhl-api** | NHL | Yes | None |
| **football-data-org** | Soccer | When keyed | **`FOOTBALL_DATA_API_KEY`** (free tier) |
| **tennis-abstract** | ATP, WTA | No | **REQUIRES PROVIDER SELECTION** — no public API; we do not scrape or invent data |
| **the-odds-api** | NBA, NFL, WNBA, MLB, NHL, Soccer, ATP*, WTA* | When keyed | **`ODDS_API_KEY`** |
| mock-odds | all | Dev fallback | None — labeled `oddsAreMock` |
| **catalog-comparison-lines** | All sports | Placeholders until keyed | PrizePicks, Underdog, FanDuel, DraftKings, BetMGM, Caesars, Fanatics, ESPN BET |

### Keys that must be set (not fabricated)

| Env var | Required for | Without it |
|---------|--------------|------------|
| `ODDS_API_KEY` | Live sportsbook prop odds | Comparison catalog placeholders (`requiresIntegration` / mock -110) |
| `FOOTBALL_DATA_API_KEY` | Soccer schedules | Soccer stays empty — **no invented fixtures** |
| *(none)* | Tennis Abstract | ATP/WTA stay `needs_provider` until a licensed feed is chosen |

Optional packages (no API keys):

```bash
pip install nba_api          # NBA Stats supplement
pip install nfl_data_py      # NFLVerse rosters / weekly stats
```

\* ATP/WTA sport keys in The Odds API must be verified per tournament before production use.

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
| refresh_odds | every 15m | Featured props + Odds API poll |
| recalculate_analytics | every 20m | Scores / EV |

Machine-readable status: `GET /api/v1/providers` and `GET /api/v1/leagues`  
Audit trail: `GET /api/v1/providers/runs`
