#!/usr/bin/env bash
# Install Seraphim IQ + Seraphim Tweaks on one free Ubuntu VPS (Oracle Always Free recommended).
set -euo pipefail

REPO="${REPO:-https://github.com/corbintalbert9744-art/SeraphimTweaks.git}"
IQ_BRANCH="${IQ_BRANCH:-cursor/free-vps-hosting-754e}"
TWEAKS_BRANCH="${TWEAKS_BRANCH:-cursor/tweaks-render-account-754e}"
ROOT="${ROOT:-/opt/seraphim}"
IQ_DIR="$ROOT/iq"
TWEAKS_DIR="$ROOT/tweaks"
COMPOSE_DIR="$IQ_DIR/deploy/free-vps"

echo "==> Seraphim free VPS setup"
echo "    IQ branch:     $IQ_BRANCH"
echo "    Tweaks branch: $TWEAKS_BRANCH"
echo "    Install root:  $ROOT"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Re-run as root (sudo bash setup.sh)" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl git openssl

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Installing Docker"
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

mkdir -p "$ROOT"

clone_or_update() {
  local dir="$1" branch="$2"
  if [[ -d "$dir/.git" ]]; then
    echo "==> Updating $dir ($branch)"
    git -C "$dir" fetch origin "$branch"
    git -C "$dir" checkout "$branch"
    git -C "$dir" reset --hard "origin/$branch"
  else
    echo "==> Cloning $branch → $dir"
    git clone --depth 1 --branch "$branch" "$REPO" "$dir"
  fi
}

clone_or_update "$IQ_DIR" "$IQ_BRANCH"
clone_or_update "$TWEAKS_DIR" "$TWEAKS_BRANCH"

# Ensure Tweaks has a production Dockerfile (older main may not)
if [[ ! -f "$TWEAKS_DIR/Dockerfile" ]]; then
  cat >"$TWEAKS_DIR/Dockerfile" <<'EOF'
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --include=dev
COPY . .
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=5001
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/client/dist ./client/dist
EXPOSE 5001
CMD ["node", "dist/index.cjs"]
EOF
fi

cd "$COMPOSE_DIR"
if [[ ! -f .env ]]; then
  echo "==> Writing .env with random secrets"
  cp .env.example .env
  PG=$(openssl rand -hex 16)
  SS=$(openssl rand -hex 32)
  sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$PG/" .env
  sed -i "s/^SESSION_SECRET=.*/SESSION_SECRET=$SS/" .env
fi

# Tell compose where Tweaks source lives
if ! grep -q '^TWEAKS_CONTEXT=' .env; then
  echo "TWEAKS_CONTEXT=$TWEAKS_DIR" >> .env
else
  sed -i "s|^TWEAKS_CONTEXT=.*|TWEAKS_CONTEXT=$TWEAKS_DIR|" .env
fi

echo "==> Building & starting (first build can take several minutes)"
docker compose --env-file .env up -d --build

IP=$(curl -fsSL -m 5 https://ifconfig.me 2>/dev/null || curl -fsSL -m 5 https://api.ipify.org 2>/dev/null || echo "<your-vps-ip>")

cat <<EOF

========================================================================
 Seraphim is starting on this VPS
========================================================================

 1. Oracle / cloud firewall: allow inbound TCP 22, 80, 443

 2. DNS (Cloudflare or registrar) — A records to: $IP
      seraphimiq.com       → $IP
      www.seraphimiq.com   → $IP   (optional)
      seraphimtweaks.com   → $IP
      www.seraphimtweaks.com → $IP (optional)

 3. Wait ~2–5 min, then open:
      https://seraphimiq.com
      https://seraphimtweaks.com

 4. IQ login (owner Pro):
      email from OWNER_EMAIL in $COMPOSE_DIR/.env
      (default corbintalbert@icloud.com)

 Useful:
   cd $COMPOSE_DIR && docker compose logs -f iq
   cd $COMPOSE_DIR && docker compose ps
   cd $COMPOSE_DIR && docker compose restart

 Edit secrets / PropLine / Stripe:
   nano $COMPOSE_DIR/.env
   cd $COMPOSE_DIR && docker compose up -d

========================================================================
EOF
