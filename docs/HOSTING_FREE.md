# Free forever hosting (no Render)

**Best free option:** one **Oracle Cloud Always Free** Ampere VM + Docker.  
Both sites on the same box, separate domains, free HTTPS via Caddy.

| Site | Domain | Container |
|------|--------|-----------|
| Seraphim IQ | `seraphimiq.com` | `iq` (Node + Python data platform) + Postgres |
| Seraphim Tweaks | `seraphimtweaks.com` | `tweaks` |

## 1. Create the free VM (once)

1. Sign up: https://www.oracle.com/cloud/free/ (card for verification, $0 charge if you stay on Always Free).
2. Create **VM.Standard.A1.Flex** (Ampere): **2–4 OCPU**, **12–24 GB RAM**, Ubuntu 22.04.
3. Networking → Security List / NSG: allow **22, 80, 443** from `0.0.0.0/0`.
4. Note the public IP. SSH in:

```bash
ssh ubuntu@YOUR_VPS_IP
```

## 2. Install both sites (one command)

```bash
sudo bash -c 'curl -fsSL https://raw.githubusercontent.com/corbintalbert9744-art/SeraphimTweaks/cursor/free-vps-hosting-754e/deploy/free-vps/setup.sh | bash'
```

Or:

```bash
git clone -b cursor/free-vps-hosting-754e https://github.com/corbintalbert9744-art/SeraphimTweaks.git
cd SeraphimTweaks
sudo bash deploy/free-vps/setup.sh
```

## 3. Point DNS

At your registrar / Cloudflare, A records → VPS IP:

- `seraphimiq.com`
- `seraphimtweaks.com`

Wait for DNS, then open both URLs (Caddy gets certificates automatically).

## 4. Optional keys

```bash
sudo nano /opt/seraphim/iq/deploy/free-vps/.env
# add PROPLINE_API_KEY / Stripe / etc.
cd /opt/seraphim/iq/deploy/free-vps && sudo docker compose up -d
```

## Why not Render / Fly / Railway

- **Render free:** sleeps + suspends (you already hit this).
- **Fly / Railway:** limited free credit, not forever.
- **Oracle Always Free:** keeps running 24/7 within Always Free shapes.

## Temporary tunnels (already running in Cursor)

While this agent is up you can use the Cloudflare tunnel URLs from the previous message. They die when the agent stops — the Oracle VPS does not.
