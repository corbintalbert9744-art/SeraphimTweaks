# Seraphim Analytics (separate from Seraphim Tweaks)

This branch/app is the **sports research platform**.

It is **not** the Seraphim Tweaks commerce site. Do not deploy this build to the live Tweaks domain.

## What’s live now

- **Command Center** (`/`) — best EV, confidence, injuries, top props, games soon, Prop of the Day
- **NBA first data source** — ESPN scoreboard + athlete gamelogs via `/api/nba/*`
- **Analytics engine** (`shared/analytics.ts`) — L5/L10/L20, no-vig, EV, Research Score, Confidence, DQS, AI explanation
- **Database schema** (`shared/schema.ts`) — players, teams, games, props, sportsbooks, odds, game logs, injuries, saved parlays, users

## Run

```bash
git checkout cursor/sports-analytics-dashboard-754e
npm install
cp .env.example .env   # add DATABASE_URL when Postgres is ready
npm run dev
```

### API

- `GET /api/health`
- `GET /api/nba/games` — ESPN scoreboard (optional `?dates=YYYYMMDD`)
- `GET /api/nba/featured-prop` — one player prop from real gamelogs + analytics
- `GET /api/command-center` — Command Center payload

### Odds note

Without `ODDS_API_KEY`, featured props use **placeholder −110/−110** books. Games + hit rates are still real ESPN data.

### Database

```bash
# when DATABASE_URL is set
npm run db:push
```

## Product separation

- **Tweaks (production):** `SeraphimTweaks` `main` — leave alone
- **Analytics:** this branch / eventual `SeraphimTweaks-clone` home
