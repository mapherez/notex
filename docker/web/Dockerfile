# syntax=docker/dockerfile:1

FROM --platform=$BUILDPLATFORM node:24-bookworm-slim AS build

WORKDIR /app
ENV npm_config_audit=false npm_config_fund=false npm_config_update_notifier=false

COPY package.json package-lock.json ./
COPY packages/notex-mcp-contract/package.json packages/notex-mcp-contract/package-lock.json ./packages/notex-mcp-contract/
RUN npm ci --prefix packages/notex-mcp-contract && npm ci

COPY packages/notex-mcp-contract/tsconfig.json ./packages/notex-mcp-contract/
COPY packages/notex-mcp-contract/scripts ./packages/notex-mcp-contract/scripts
COPY packages/notex-mcp-contract/src ./packages/notex-mcp-contract/src
COPY tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts vitest.config.ts index.html ./
COPY src ./src
COPY public ./public
COPY scripts/build-web-worker.mjs ./scripts/build-web-worker.mjs

# These are public web configuration values. Never pass the desktop secret.
ARG VITE_GOOGLE_WEB_CLIENT_ID
ARG VITE_GOOGLE_WEB_ORIGIN
ENV NOTEX_WEB_BASE_PATH=/app/
RUN node --input-type=module -e 'const id = process.env.VITE_GOOGLE_WEB_CLIENT_ID?.trim(); const origin = process.env.VITE_GOOGLE_WEB_ORIGIN?.trim(); if (!id || !origin) throw new Error("Missing Google web build configuration"); const url = new URL(origin); if (url.protocol !== "https:" || url.origin !== origin) throw new Error("Google web origin must be an HTTPS origin without a path or trailing slash");' \
    && npm run build

FROM nginx:stable-alpine AS runtime

LABEL org.opencontainers.image.source="https://github.com/mapherez/notex" \
      org.opencontainers.image.description="NoteX browser app with personal Google Drive backups"

COPY docker/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/app/

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
