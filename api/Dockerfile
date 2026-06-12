# syntax=docker/dockerfile:1.7

# ============================================
# Deps stage — npm ci (better-sqlite3 : prebuild musl,
# toolchain dispo en fallback si le prebuild manque)
# ============================================
FROM node:24-alpine AS deps
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ============================================
# Runtime stage — Node 24 exécute le TS nativement (type stripping)
# ============================================
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

RUN mkdir -p /data && chown node:node /data
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "src/server.ts"]
