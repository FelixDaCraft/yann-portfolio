# syntax=docker/dockerfile:1.7

# ============================================
# Build stage — Vite static export
# ============================================
FROM node:24-alpine AS builder
WORKDIR /app

RUN corepack enable pnpm

COPY package.json pnpm-lock.yaml* ./
# --ignore-scripts bypasses pnpm v10 strict build-scripts approval.
# esbuild ships its binary pre-built so its post-install isn't required.
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .
RUN pnpm build

# ============================================
# Runtime stage — nginx serving /dist
# ============================================
FROM nginx:1.27-alpine AS runner

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
