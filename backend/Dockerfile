# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS build

ENV npm_config_audit=false \
    npm_config_fund=false \
    npm_config_update_notifier=false

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY packages/notex-mcp-contract/package.json packages/notex-mcp-contract/package-lock.json ./packages/notex-mcp-contract/
RUN npm ci --prefix packages/notex-mcp-contract

COPY packages/notex-mcp-contract/tsconfig.json ./packages/notex-mcp-contract/tsconfig.json
COPY packages/notex-mcp-contract/src ./packages/notex-mcp-contract/src
RUN npm run build --prefix packages/notex-mcp-contract

COPY backend/package.json backend/package-lock.json ./backend/
RUN npm ci --prefix backend

COPY backend/tsconfig.json ./backend/tsconfig.json
COPY backend/src ./backend/src
RUN npm run build --prefix backend \
    && npm prune --omit=dev --prefix backend \
    && npm prune --omit=dev --prefix packages/notex-mcp-contract

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production \
    NOTEX_MCP_HOST=0.0.0.0 \
    NOTEX_MCP_PORT=8080 \
    NOTEX_MCP_DATABASE_PATH=/data/notex-mcp.sqlite \
    NOTEX_MCP_ALLOWED_HOSTS=127.0.0.1,localhost

RUN groupadd --gid 10001 notex \
    && useradd --uid 10001 --gid notex --no-create-home --shell /usr/sbin/nologin notex \
    && mkdir -p /app/backend /app/packages/notex-mcp-contract /data \
    && chown -R notex:notex /app /data

WORKDIR /app/backend

COPY --from=build --chown=notex:notex /app/backend/package.json /app/backend/package-lock.json ./
COPY --from=build --chown=notex:notex /app/backend/dist ./dist
COPY --from=build --chown=notex:notex /app/backend/node_modules ./node_modules
COPY --from=build --chown=notex:notex /app/packages/notex-mcp-contract/package.json /app/packages/notex-mcp-contract/package.json
COPY --from=build --chown=notex:notex /app/packages/notex-mcp-contract/dist /app/packages/notex-mcp-contract/dist
COPY --from=build --chown=notex:notex /app/packages/notex-mcp-contract/node_modules /app/packages/notex-mcp-contract/node_modules

USER notex

EXPOSE 8080
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:8080/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]

STOPSIGNAL SIGTERM
CMD ["node", "dist/main.js"]
