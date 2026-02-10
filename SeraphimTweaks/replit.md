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

## Deployment
- Target: Autoscale
- Build: `npm run build`
- Run: `npm run start`

## Recent Changes
- 2026-02-10: Initialized project in Replit environment. Moved files to root, configured PostgreSQL, set up dev workflow.
- 2026-02-10: Updated live stats with 0.2s fluctuation speed and reordered page sections (Dashboard -> Performance -> Trusted) for better proof flow.
