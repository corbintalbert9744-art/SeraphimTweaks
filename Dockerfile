# Seraphim Analytics — Node app + Python data-platform in one image
FROM node:20-bookworm-slim AS node-build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip python3-venv \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY --from=node-build /app/dist ./dist
COPY --from=node-build /app/client/dist ./client/dist
COPY server ./server
COPY shared ./shared
COPY scripts ./scripts
COPY migrations ./migrations
COPY data-platform ./data-platform

WORKDIR /app/data-platform
RUN python3 -m venv /opt/venv \
  && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHON=/opt/venv/bin/python \
    PYTHONPATH=/app/data-platform \
    NODE_ENV=production \
    PORT=5000 \
    DATA_PLATFORM_URL=http://127.0.0.1:8000 \
    ENABLE_SCHEDULER=true \
    BOOTSTRAP_NBA_SYNC=true

WORKDIR /app
EXPOSE 5000 8000
CMD ["node", "scripts/start-stack.mjs"]
