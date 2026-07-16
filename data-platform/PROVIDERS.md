# Provider adapter framework

Seraphim talks to sports data through **adapters** only. API routes and jobs
never call vendor SDKs directly.

## Architecture

```
API / Scheduler
      │
      ▼
ingestion (nba_sync, nba_board, pipelines)
      │
      ▼
ProviderBundle (registry.get_nba_providers)
      │
      ├─ espn-nba     ← first legitimate provider (live, no API key)
      ├─ the-odds-api ← live when ODDS_API_KEY is set
      └─ mocks        ← clearly labeled placeholders
      │
      ▼
PostgreSQL warehouse (SQLite fallback) + provider_runs audit
```

Framework modules:

| Module | Role |
|--------|------|
| `app/providers/framework.py` | DTOs, capability protocols, HTTP client w/ retries, `run_provider_job` |
| `app/providers/base.py` | Stable re-exports |
| `app/providers/registry.py` | League → adapter wiring |
| `app/providers/espn/nba.py` | Live ESPN NBA adapter |
| `app/ingestion/nba_sync.py` | Full day sync into the warehouse |

## Status

| Provider | Leagues | Live? | Config needed |
|----------|---------|-------|---------------|
| **espn-nba** | NBA | Yes | None |
| espn-nfl | NFL | Yes | None |
| the-odds-api | NBA, NFL, WNBA, ATP*, WTA* | When keyed | `ODDS_API_KEY` |
| mock-odds | all | Dev fallback | None — labeled `oddsAreMock` |
| **catalog-comparison-lines** | All sports | Placeholders until keyed | PrizePicks, Underdog, FanDuel, DraftKings, BetMGM, Caesars, Fanatics, ESPN BET |
| espn-wnba | WNBA | Not yet | Build adapter (next) |
| mlb / nhl / soccer | MLB, NHL, Soccer | Not yet | **REQUIRES PROVIDER** |
| tennis | ATP, WTA | Not yet | **REQUIRES PROVIDER SELECTION** |

### Line Comparison adapters

`app/providers/comparison_lines.py` defines a fixed catalog of 8 operators.
Each row is always returned to the UI. When an operator is not connected,
the backend emits a **placeholder line** with `requiresIntegration: true`.
Live The Odds API quotes overlay FanDuel / DraftKings / BetMGM (and mapped
books) without changing PropDetail or `LineComparison`.

\* ATP/WTA sport keys in The Odds API must be verified per tournament before production use.

## ESPN NBA (first legitimate provider)

Public ESPN endpoints (no key):

- Scoreboard → today's games / teams
- Team roster → players
- Athlete gamelog → historical game logs for projections
- Game summary → injuries + leaders for slate picks

Sync entry points:

```bash
# One-shot
cd data-platform && PYTHONPATH=. python3 scripts/sync_nba_warehouse.py

# Or via API
curl -X POST http://localhost:8000/api/v1/nba/jobs/sync
```

Scheduled (when `ENABLE_SCHEDULER=true`):

| Job | Default | Purpose |
|-----|---------|---------|
| bootstrap_nba_sync | on API start | Initial warehouse fill |
| nba_full_sync | every 60m (`NBA_SYNC_MINUTES`) | Games, players, logs, injuries, props |
| import_games | 05:10 UTC daily | Fresh schedule |
| update_injuries | every 30m | Injury refresh |
| import_stats | every 2h | Slate refresh |
| recalculate_analytics | every 20m | Scores / EV |

Machine-readable status: `GET /api/v1/providers`  
Audit trail: `GET /api/v1/providers/runs`
