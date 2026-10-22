# NoteX website

The public website is static and separate from the Tauri app. Its build does not
build or serve React, change SQLite, or publish unreleased web/Drive features.
The separate landing package contains only the Markdown build dependency.

## Build and preview

Use Node 24 and run these commands from the repository root:

```powershell
npm ci
npm run build --workspace landing
npm run check --workspace landing
npm run preview --workspace landing
```

Preview at **<http://127.0.0.1:4174>**. Generated files live in `landing/dist/`,
which is ignored by Git. Visitors do not download a framework or Markdown parser.
Reading and navigation work without JavaScript; local search is an enhancement.

## Edit documentation

- Articles: `landing/docs/content/*.md`.
- Groups, titles, descriptions, and order: `landing/docs/navigation.json`.
- Shared layout and metadata: `landing/scripts/build.mjs`.
- Shared header/footer for every page: `landing/scripts/site-shell.mjs`.
- Docs styling: `landing/docs/docs.css`.
- Search and responsive topic disclosure: `landing/docs/docs.js`.

Edit the Markdown and build again. Use exactly one `#` page title and `##`
headings for the generated “On this page” index. Tables, lists, blockquotes,
fenced code blocks, and ordinary Markdown links are supported.

Link to sibling articles using `[Title](keyboard.md)`; the build converts the
extension to `.html`. Section links work too:
`[Export one note](import-export.md#export-one-note)`.

To add an article:

1. Create `landing/docs/content/my-topic.md`.
2. Add a navigation entry with `slug: "my-topic"`, a title, and a description.
3. Build and preview. The sidebar, previous/next links, search index, and sitemap
   are generated together.

Images can live in `landing/assets/`, referenced as `../assets/example.webp`.
Use useful alt text and reasonably sized assets. Repository-authored HTML is
supported for images with known dimensions and lazy loading. Articles and their
embedded HTML are trusted repository content, not user input.

Keep public guides aligned with released functionality. Developer plans and
checkpoints stay in `Documentation/Developer/`, outside the published site.

## Homepage and legal pages

- `index.html`: overview, features, MCP, guides, FAQ, and download.
- `styles.css`: shared light/dark palette and base components; `home.css`: landing layout.
- `theme.js`: system preference by default, with shared, persisted light/dark overrides.
- `shell.css` and `site.js`: shared responsive navigation and footer.
- `home.js`: accessible product-preview tabs.
- `assets/fonts/`: self-hosted DM Sans and Manrope variable fonts with their OFL licenses.
- `brand.md`: logo geometry, light/dark variants, and native icon exports.
- `privacy.html` and `terms.html`: English legal pages.

The homepage and legal source files use `<!-- site-header -->` and
`<!-- site-footer -->` markers. The build renders the same shared components
into those markers and into every documentation page. Preview the generated
site through the local server rather than opening the source HTML directly.

Keep public copy in English and describe product behavior without release
numbers or release announcements. Patch notes inside the app hold that history.
Google sign-in starts automatic Drive backups on desktop and in the browser;
it is sign-in, rather than an account-wide backup switch, that is optional on
desktop. The site check rejects release numbers, stale copy, and header/footer
navigation that differs between pages.

## Deployment

The **Publish NoteX Landing Image** workflow (`.github/workflows/deploy-landing.yml`)
builds and checks a dedicated Docker image, then publishes it to
`ghcr.io/mapherez/notex-landing` for AMD64 and ARM64. It runs on relevant changes
on `main`, or manually on `main`. It replaces the former GitHub Pages workflow.
Tags are `latest` and `sha-<full commit SHA>`, independent of app release versions.

The image, build cache, workflow and `docker-compose.landing.yml` are independent
of the webapp. Only landing HTML, CSS, assets and generated docs are served. The
build installs only the landing workspace using the root lockfile; it does not
compile the app, desktop, backend or MCP. The runtime contains Nginx and static
files, with no Node process, volumes, credentials or OAuth configuration.

The public domain stays `notex.mapherez.com`. Keep the existing Cloudflare worker
handling downloads and the separate `/app/` routing. This container does not
implement `/download` or serve `/app/`; a direct request to those paths returns
404. All download and webapp links stay unchanged. `CNAME` remains in the static
build for compatibility but does not configure Docker hosting.

### Run on the host

After the first image publication, make the GHCR package public for anonymous
pulls, or authenticate the host to GHCR if keeping it private. The workflow uses
the built-in `GITHUB_TOKEN`; no additional Actions secret is required.

Copy `docker-compose.landing.yml` to a separate host directory, for example
`~/homelab/notex-landing/docker-compose.yml`. Then run:

```sh
cd ~/homelab/notex-landing
docker compose pull
docker compose up -d
docker compose ps
```

Default endpoint: `http://HOST_IP:8094/`; health check: `/healthz`. Direct the
existing landing/docs origin to this port, preserving the worker and webapp
routes. HTTPS remains at the existing public proxy. This Compose file requires
no checkout or build on the host and does not start or update the webapp.

Optional `.env` next to the host Compose file:

```dotenv
NOTEX_LANDING_PORT=8094
NOTEX_LANDING_TAG=latest
```

For updates, repeat `docker compose pull` and `docker compose up -d` after the
workflow publishes. Pin `NOTEX_LANDING_TAG=sha-<full commit SHA>` to deploy or
roll back to a specific build. A style change reuses the dependency layer unless
the package manifests or lockfile changed. Static files use `Cache-Control:
no-cache` so browsers revalidate after updates; explicit Cloudflare cache rules
can override origin caching and may require a purge.

### Build and check locally

From the repository root, with Docker running:

```sh
docker build -f docker/landing/Dockerfile -t notex-landing:check .
node scripts/check-landing-image.mjs notex-landing:check
```

The dedicated Docker ignore file excludes app sources, local data, credentials,
dependencies and previous build output. The image check validates Nginx,
homepage, all documentation articles, search, legal pages, assets, caching,
directory redirects and 404s outside this deployment. Existing local build and
preview commands remain available above.
