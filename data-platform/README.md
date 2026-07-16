# Seraphim IQ — Data Platform

Python warehouse + analytics API for NBA → NFL → WNBA → ATP → WTA.

## Stack

| Layer | Choice |
|-------|--------|
| API | FastAPI (`/api/v1/*`) |
| DB | PostgreSQL (prod) or SQLite (local zero-config) |
| ORM | SQLAlchemy 2 |
| Jobs | APScheduler |
| Providers | Adapter interfaces — ESPN NBA live, The Odds API (key), mocks labeled |

Auth + Stripe stay on the Node/Express app (`npm run dev`). This service owns sports data.

## Quick start

```bash
cd data-platform
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Optional Postgres — otherwise SQLite file is created automatically
# export DATABASE_URL=postgresql://user:pass@localhost:5432/seraphim_analytics

# Optional live odds
# export ODDS_API_KEY=...

uvicorn app.main:app --reload --port 8000 --app-dir .
```

Or from repo root:

```bash
npm run data-platform
```

## Endpoints

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/v1/health` | Liveness + DB mode |
| GET | `/api/v1/providers` | Live vs mock vs needs config |
| GET | `/api/v1/leagues` | Rollout status per sport |
| GET | `/api/v1/nba/games` | ESPN schedule (+ warehouse upsert) |
| GET | `/api/v1/nba/featured-prop` | Live gamelog analytics |
| GET | `/api/v1/nba/command-center` | Command Center payload |
| POST | `/api/v1/nba/jobs/import-schedule` | Manual job |
| POST | `/api/v1/nba/jobs/import-injuries` | Manual job |
| POST | `/api/v1/nba/jobs/recalculate-analytics` | Manual job |

Node Express can proxy these (see `server/dataPlatformProxy.ts`) so the React app keeps calling `/api/*`.

## Scheduled jobs

| Job | Default | Purpose |
|-----|---------|---------|
| bootstrap_nba_sync | on start | ESPN → warehouse (games, players, logs, injuries, props) |
| nba_full_sync | every 60m | Full NBA day sync (`NBA_SYNC_MINUTES`) |
| import_games | 05:10 UTC daily | Today's NBA (+ NFL) schedule |
| refresh_odds | every 15m | Odds refresh (live or mock) |
| update_injuries | every 30m | Injury feed |
| import_stats | every 2h | Slate / gamelog refresh |
| recalculate_analytics | every 20m | L5/L10/L20, EV, scores |

Disable with `ENABLE_SCHEDULER=false`. Skip bootstrap with `BOOTSTRAP_NBA_SYNC=false`.

```bash
# Manual full sync
npm run data-platform:sync
# or
curl -X POST http://localhost:8000/api/v1/nba/jobs/sync
```

## Provider configuration (required vs mock)

| Provider | Status | Config |
|----------|--------|--------|
| **espn-nba** | Live (first legitimate provider) | None — public ESPN APIs |
| **the-odds-api** | Live when keyed | `ODDS_API_KEY` — without it, **mock -110** odds are used and flagged `oddsAreMock: true` |
| **espn-nfl** | Live | None |
| **espn-wnba** | Planned | Build after NBA warehouse stable |
| **ATP / WTA** | Needs selection | Choose a licensed tennis + odds provider before production |

See `PROVIDERS.md` for the adapter framework.

## Analytics transparency

Research Score, Confidence, EV, and side probabilities are **Seraphim model estimates**
from the rule-based factor engine (`PREDICTION.md`) — not sportsbook copies and not
guaranteed win chances. Do not invent a single “parlay chance of winning.”

## Prediction engine

See `PREDICTION.md`. Featured props return `projectedValue`, `overProbability`,
`underProbability`, and `influentialFactors`. Odds are `comparison-only`.

## Schema

SQLAlchemy models in `app/db/models.py` align with `shared/schema.ts` and add:

- `team_stats` — matchup rankings
- `prop_analytics` — cached L5/L10/L20, splits, scores, explain + model projection fields
- `line_snapshots` — movement history
- `provider_runs` — ingestion audit

## Development order

1. ✅ Database schema  
2. ✅ Provider adapter framework (`framework.py` + registry)  
3. ✅ NBA live data (ESPN) + scheduled warehouse sync  
4. ✅ NBA analytics + **rule-based prediction engine**  
5. ✅ FastAPI + scheduler  
6. ✅ Connect frontend (Express proxy)  
7. ✅ NFL live  
8. ⏳ WNBA → ATP → WTA  
