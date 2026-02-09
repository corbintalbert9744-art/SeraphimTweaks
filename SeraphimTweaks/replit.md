# Seraphim Tweaks

## Overview
A gaming PC optimization product website for "Seraphim Tweaks" — a brand selling PC performance tweaks (FPS Boost, Zero Delay, Bloom Reducer). Built with a React frontend and Express backend. The site features a landing page with product details, pricing cards, feature highlights, and individual product detail pages. Checkout is handled externally via Payhip (no internal cart or payment processing).

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 19 with TypeScript
- **Bundler**: Vite (client root is `client/`, build output goes to `dist/public`)
- **Styling**: TailwindCSS v4 with `@tailwindcss/vite` plugin, using CSS variables for theming (dark theme, gold/yellow accent colors)
- **UI Components**: shadcn/ui (new-york style) with Radix UI primitives — extensive component library in `client/src/components/ui/`
- **Routing**: wouter (lightweight client-side router, NOT react-router)
- **State Management**: TanStack React Query for server state
- **Path Aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`, `@assets/` maps to `attached_assets/`

### Pages & Routing
- `/` — Home page (landing page with hero, features, pricing cards)
- `/product/:id` — Product detail page (looks up product by slug from `client/src/lib/products.ts`)
- Product data is defined client-side in `client/src/lib/products.ts` as a static Record, not fetched from an API
- "Buy Now" buttons on product detail pages open external Payhip checkout URLs (via `window.open`), not internal routes

### Backend
- **Framework**: Express 5 on Node.js
- **Entry**: `server/index.ts` creates an HTTP server
- **Dev Mode**: Vite dev server middleware is attached to Express (see `server/vite.ts`) for HMR on port 5000
- **Production**: Static files served from `dist/public` with SPA fallback (see `server/static.ts`)
- **API Routes**: Registered in `server/routes.ts` under `/api` prefix — currently minimal/empty
- **Storage**: In-memory storage (`MemStorage` class in `server/storage.ts`) implementing `IStorage` interface with basic user CRUD

### Database
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema**: Defined in `shared/schema.ts` — currently only a `users` table (id, username, password)
- **Validation**: Zod schemas generated from Drizzle schema via `drizzle-zod`
- **Config**: `drizzle.config.ts` reads `DATABASE_URL` environment variable
- **Migration**: `npm run db:push` pushes schema directly to database
- **Note**: The app currently uses `MemStorage` instead of the database for runtime storage. The database schema exists but isn't actively connected to the storage layer.

### Build System
- **Script**: `script/build.ts` runs Vite build for client, then esbuild for server
- **Server Bundle**: Uses esbuild with an allowlist of dependencies to bundle (reduces cold start syscalls), externalizing everything else
- **Output**: Client → `dist/public`, Server → `dist/index.cjs`

### Project Structure
```
client/                  # React frontend
  src/
    components/ui/       # shadcn/ui components
    hooks/               # Custom React hooks
    lib/                 # Utilities, product data, query client
    pages/               # Page components (Home, ProductPage, not-found)
    App.tsx              # Root app with router
    main.tsx             # Entry point
    index.css            # Tailwind + theme variables
  index.html             # HTML template
server/                  # Express backend
  index.ts               # Server entry, middleware setup
  routes.ts              # API route registration
  storage.ts             # In-memory storage implementation
  static.ts              # Production static file serving
  vite.ts                # Dev mode Vite middleware
shared/                  # Shared between client and server
  schema.ts              # Drizzle schema + Zod types
script/                  # Build scripts
  build.ts               # Production build orchestration
attached_assets/         # Static assets and task reference files
```

### Key Scripts
- `npm run dev` — Start development server (Express + Vite HMR) on port 5000
- `npm run build` — Production build (client + server)
- `npm run start` — Run production server
- `npm run db:push` — Push Drizzle schema to PostgreSQL
- `npm run check` — TypeScript type checking

## External Dependencies

### Third-Party Services
- **Payhip** — External checkout/payment processing. Products link directly to Payhip cart URLs at `seraphimtweaks.com/buy`. No payment logic exists in this codebase.
- **Google Fonts** — Loads Architects Daughter, DM Sans, Fira Code, and Geist Mono fonts

### Database
- **PostgreSQL** — Required via `DATABASE_URL` environment variable. Used with Drizzle ORM. Schema is minimal (users table only).

### Key NPM Dependencies
- `express` v5 — HTTP server
- `drizzle-orm` + `drizzle-kit` — Database ORM and migration tooling
- `drizzle-zod` + `zod` — Schema validation
- `@tanstack/react-query` — Async state management
- `wouter` — Client-side routing
- `connect-pg-simple` — PostgreSQL session store (available but not actively used)
- `react-day-picker`, `embla-carousel-react`, `recharts`, `vaul`, `react-resizable-panels`, `input-otp` — Various UI libraries for shadcn/ui components
- Extensive Radix UI primitives for accessible component building

### Deployment
- Target: Render.com (also compatible with Replit Autoscale)
- Build command: `npm run build`
- Start command: `npm run start`
- The server serves the SPA with a catch-all fallback to `index.html`