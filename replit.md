# Seraphim Tweaks

## Overview
A gaming tweaks product website built with Express + Vite + React (TypeScript). Features a landing page with product details, pricing, and customer info sections.

## Architecture
- **Frontend**: React 19 with Vite, TailwindCSS v4, shadcn/ui components, wouter for routing
- **Backend**: Express 5 server serving both API routes and the Vite dev server on port 5000
- **Database**: PostgreSQL via Drizzle ORM (schema in `shared/schema.ts`)
- **Storage**: Currently using in-memory storage (`MemStorage` in `server/storage.ts`)

## Project Structure
- `client/` - React frontend (entry: `client/src/main.tsx`)
- `server/` - Express backend (entry: `server/index.ts`)
- `shared/` - Shared types and schemas (Drizzle + Zod)
- `script/` - Build scripts
- `attached_assets/` - Static assets

## Scripts
- `npm run dev` - Development server (port 5000)
- `npm run build` - Production build (client + server)
- `npm run start` - Production server
- `npm run db:push` - Push Drizzle schema to database

## Deployment (public internet)

Cursor does **not** host the live site. Use Replit Deploy (this repo) or Docker on any VPS.

### Replit Deploy (recommended for this project)
1. Open the repo in Replit → **Deploy** → Autoscale.
2. Add a Replit Postgres database (or paste an external `DATABASE_URL`).
3. Set Secrets (same names as `.env.example`):
   - `DATABASE_URL`, `SESSION_SECRET` (long random), `APP_URL` (your `https://….replit.app`)
   - Stripe live keys + 4 price IDs + `STRIPE_WEBHOOK_SECRET`
   - At least one of `PROPLINE_API_KEY` / `SHARPAPI_API_KEY` / `ODDS_API_KEY`
4. Point Stripe webhook to `https://YOUR_DOMAIN/api/stripe/webhook`.
5. Build: `npm run build` · Run: `npm run start:all` (Node + Python data-platform).

### Docker (VPS / Railway / Fly)
```bash
docker compose up --build -d
```
Requires `.env` with production secrets. App listens on `:5000`.

## Recent Changes
- 2026-02-11: Imported project from GitHub. Moved files from SeraphimTweaks-1/ subdirectory to workspace root. Configured workflow and deployment for Replit environment.
- 2026-04-28: Added dedicated `/pricing` page (`client/src/pages/Pricing.tsx`) showing all product boxes. Home page nav "Pricing" link and all "Buy Now" buttons now navigate to `/pricing` instead of scrolling. Pricing data extracted to shared `pricingPlans` export in `client/src/lib/products.ts`. Updated all Discord links sitewide to `https://discord.gg/zFZxh9RKdC`.
