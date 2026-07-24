# Two Render accounts — Seraphim IQ + Seraphim Tweaks

Both live sites are **suspended** when free-tier limits or billing trip on a single
Render workspace. Split them:

| Product | Domain | Git branch | Blueprint | Render account |
|---------|--------|------------|-----------|----------------|
| **Seraphim IQ** | `seraphimiq.com` | analytics / this IQ deploy branch | root `render.yaml` | **Account A** |
| **Seraphim Tweaks** | `seraphimtweaks.com` | `main` (Tweaks commerce) | root `render.yaml` on Tweaks PR | **Account B** |

Same GitHub repo is fine. Two Render logins = two free Postgres + separate hour pools.

## Why they died

- Free web services sleep and get **suspended** when the workspace hits limits.
- IQ needs **2 web services** (`seraphim-iq` + `seraphim-iq-data`) + Postgres.
- Tweaks needs **1 web service** + optional Postgres.
- One account running both burns free quota fast.

## Account A — Seraphim IQ (`seraphimiq.com`)

1. Create / log into **Render account A** (IQ only).
2. [Dashboard](https://dashboard.render.com) → **New** → **Blueprint**.
3. Connect `corbintalbert9744-art/SeraphimTweaks`.
4. Select branch with the IQ blueprint (this PR / `cursor/iq-render-account-754e`).
5. Apply blueprint. Services created:
   - `seraphim-iq` → public site
   - `seraphim-iq-data` → Python data API
   - `seraphim-iq-db` → Postgres
6. Wait until both web services show **Live** (first build can take several minutes).
7. **seraphim-iq** → Settings → Custom Domains → add `seraphimiq.com` (+ `www` if used).
8. Point DNS (Cloudflare / registrar) to the targets Render shows.
9. Environment (optional but needed for live books / billing):
   - On `seraphim-iq-data`: `PROPLINE_API_KEY`, `SHARPAPI_API_KEY` / `ODDS_API_KEY`
   - On `seraphim-iq`: Stripe keys + Payment Link URLs, `OWNER_EMAIL` / `OWNER_PASSWORD`
10. Health checks:
    - `https://seraphim-iq.onrender.com/api/health`
    - `https://seraphim-iq-data.onrender.com/api/v1/health`
    - `https://seraphimiq.com/` after DNS

**Do not** deploy Tweaks (`main` commerce app) into Account A.

## Account B — Seraphim Tweaks (`seraphimtweaks.com`)

1. Create / log into **Render account B** (Tweaks only) — different email/login than A.
2. New → Blueprint → same GitHub repo.
3. Branch: Tweaks deploy branch / `main` after the Tweaks `render.yaml` rename merges
   (service name must be `seraphim-tweaks`, **not** `seraphim-iq`).
4. Apply. Service: `seraphim-tweaks` (+ `seraphim-tweaks-db` if in blueprint).
5. Custom Domain → `seraphimtweaks.com`.
6. Health: `https://seraphim-tweaks.onrender.com/` then the custom domain.

**Do not** deploy the IQ data platform into Account B.

## Old suspended services

On the old shared account, leave suspended services alone or delete them after the
new accounts are live and DNS is moved. Do not keep both old and new pointing at
the same domain.

## Checklist

- [ ] Two separate Render logins (A = IQ, B = Tweaks)
- [ ] IQ blueprint applied on A from IQ branch
- [ ] Tweaks blueprint applied on B from Tweaks/`main` branch
- [ ] `seraphimiq.com` DNS → Account A `seraphim-iq`
- [ ] `seraphimtweaks.com` DNS → Account B `seraphim-tweaks`
- [ ] IQ data health OK; Command Center loads after login
- [ ] Tweaks home / pricing / buy links load
