# Seraphim Analytics database schema

Canonical definitions live in:

| Layer | Path |
|-------|------|
| Drizzle ORM (Node / app) | `shared/schema.ts` |
| SQLAlchemy ORM (Python warehouse) | `data-platform/app/db/models.py` |
| SQL migration | `migrations/0001_seraphim_full_schema.sql` |
| Alembic revision | `data-platform/alembic/versions/0001_seraphim_full_schema.py` |

## Apply

```bash
# Preferred when DATABASE_URL is set (Postgres)
psql "$DATABASE_URL" -f migrations/0001_seraphim_full_schema.sql

# Or Drizzle push (syncs shared/schema.ts)
npm run db:push

# Or Alembic (from data-platform/)
cd data-platform && alembic upgrade head
```

Without `DATABASE_URL`, Node uses in-memory membership **in development only** and the data platform uses SQLite (`create_all`). Production refuses to start without Postgres. Sessions use the `session` table via `connect-pg-simple` (`migrations/0002_session_store.sql`).

## Entity map

| Domain | Tables |
|--------|--------|
| Users & billing | `users`, `subscriptions` |
| Catalog | `sports`, `teams`, `players`, `games` |
| Performance | `player_game_logs`, `injuries`, `team_stats` |
| Props & lines | `props`, `sportsbooks`, `odds`, `line_snapshots` |
| Model projections | `prop_analytics` (projected value, research score, confidence, EV, edge) |
| User research | `saved_parlays`, `saved_parlay_legs`, `alerts` |
| Ops | `provider_runs` |

## Notes

- **Model projections** are first-class in `prop_analytics` — independent of sportsbook lines.
- **Odds / pick'em** are comparison-only (`odds.is_mock`, `sportsbooks.kind` = `sportsbook` \| `pickem`).
- **Research Score** and **Confidence Score** are separate integer columns on `prop_analytics`.
- NBA is the first live league; `sports` seeds NFL / WNBA / ATP / WTA / MLB for expansion.
- Local Postgres: `npm run db:up` then set `DATABASE_URL` (see `.env.example`). ESPN sync writes games/players/logs/injuries/props + `provider_runs` via `npm run data-platform:sync`.
