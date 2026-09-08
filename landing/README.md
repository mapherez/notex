# NoteX Landing Page

This folder contains the static public website for NoteX.

It is intentionally separate from the Tauri desktop app. Deploying this folder does not build or serve the React app in `src/`, and it does not affect local SQLite storage or parked cloud sync code.

Public pages:

- `index.html` - product overview, local MCP, and download links
- `privacy.html` - bilingual privacy policy
- `terms.html` - bilingual terms of service

## Local Preview

Open `landing/index.html` directly in a browser, or serve the folder with any static file server.

## Deployment

The manual GitHub Actions workflow `Deploy Landing Page` publishes this folder to GitHub Pages.

The included `CNAME` configures GitHub Pages for:

```text
notex.mapherez.com
```

If the domain is deployed somewhere other than GitHub Pages, remove or ignore `landing/CNAME` in that hosting setup.
