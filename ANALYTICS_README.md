# Seraphim Analytics (separate from Seraphim Tweaks)

This branch/app is the **sports research platform**.

It is **not** the Seraphim Tweaks commerce site. Do not deploy this build to the live Tweaks domain.

## What’s live now

- **Command Center** (`/app`) — best EV, confidence, injuries, top props, games soon, Prop of the Day
- **Membership** — Standard / Pro, Stripe Checkout, Pro feature locks
- **Node API** — auth, billing, ESPN NBA fallback adapters
- **Data platform** (`data-platform/`) — FastAPI + SQLAlchemy warehouse + provider adapters + scheduler

## Run

```bash
npm install
cp .env.example .env

# Terminal A — Python warehouse / analytics API
npm run data-platform

# Terminal B — React + Express (auth, Stripe, UI)
npm run dev
```

Express proxies `/api/nba/*` and `/api/command-center` to the data platform when it is up, and falls back to the Node ESPN adapters if it is not.

### One-shot NBA ingest (no server)

```bash
npm run data-platform:once
```

### Postgres (optional)

```bash
docker compose up -d postgres
# set DATABASE_URL in .env, then:
npm run db:push
```

Without `DATABASE_URL`, the data platform uses SQLite automatically.

## API

### Node (always)

- `GET /api/health`
- Auth + Stripe routes under `/api/auth/*`, `/api/checkout/*`, `/api/stripe/*`

### Data platform (via proxy or `:8000`)

- `GET /api/v1/health`
- `GET /api/v1/providers` — live vs mock vs needs configuration
- `GET /api/v1/leagues`
- `GET /api/nba/games` → warehouse ESPN schedule
- `GET /api/nba/featured-prop`
- `GET /api/command-center`

## Odds note

Without `ODDS_API_KEY`, props use **mock −110/−110** books flagged `oddsAreMock: true`. Games + hit rates still use real ESPN data.

## Model transparency

Research Score, Confidence, EV, and no-vig are **model estimates** from evidence — not guaranteed win probabilities. Do not present a single “parlay chance of winning.”

## Development order (data platform)

1. Database schema ✅
2. Provider adapter framework ✅
3. NBA live data ✅
4. NBA analytics ✅
5. Connect frontend (proxy) ✅
6. Expand NFL → ATP → WTA → WNBA (next)

See `data-platform/README.md`.

## Product separation

- **Tweaks (production):** `SeraphimTweaks` `main` → `seraphimtweaks.com` on its **own** Render account
- **IQ / Analytics:** this app → `seraphimiq.com` on a **different** Render account (needs `seraphim-iq` + `seraphim-iq-data` + Postgres)

See **`docs/HOSTING_FREE.md`** for the recommended free forever host (Oracle Always Free + Docker).
Render is optional legacy — prefer the VPS path. Do not put IQ and Tweaks on one free PaaS quota.
