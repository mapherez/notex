# syntax=docker/dockerfile:1

FROM --platform=$BUILDPLATFORM node:24-alpine AS build

WORKDIR /site
ENV npm_config_audit=false npm_config_fund=false npm_config_update_notifier=false

# Use the repository lockfile, installing only the landing workspace.
# Keep this layer cached when HTML, CSS or Markdown changes.
COPY package.json package-lock.json ./
COPY landing/package.json ./landing/
RUN npm ci --workspace landing --include-workspace-root=false --ignore-scripts

COPY landing/ ./landing/
RUN npm run build --workspace landing && npm run check --workspace landing

FROM nginx:stable-alpine AS runtime

LABEL org.opencontainers.image.source="https://github.com/mapherez/notex" \
      org.opencontainers.image.description="NoteX static landing page and documentation"

RUN rm -rf /usr/share/nginx/html/*
COPY docker/landing/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /site/landing/dist/ /usr/share/nginx/html/

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
