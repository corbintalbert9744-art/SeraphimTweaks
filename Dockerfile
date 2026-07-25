# Seraphim Tweaks — production image (commerce site only)
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
# Vite client lands in dist/public (not client/dist)
COPY --from=build /app/dist ./dist
EXPOSE 5001
CMD ["node", "dist/index.cjs"]
