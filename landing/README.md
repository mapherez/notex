# NoteX website

The public website is static and separate from the Tauri app. Its build does not
build or serve React, change SQLite, or publish unreleased web/Drive features.
The separate landing package contains only the Markdown build dependency.

## Build and preview

Use Node 22 (Node 20 or newer is supported):

```powershell
npm --prefix landing ci
npm --prefix landing run build
npm --prefix landing run check
npm --prefix landing run preview
```

Preview at **<http://127.0.0.1:4174>**. Generated files live in `landing/dist/`,
which is ignored by Git. Visitors do not download a framework or Markdown parser.
Reading and navigation work without JavaScript; local search is an enhancement.

## Edit documentation

- Articles: `landing/docs/content/*.md`.
- Groups, titles, descriptions, and order: `landing/docs/navigation.json`.
- Shared layout and metadata: `landing/scripts/build.mjs`.
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
- `styles.css`: shared theme; `home.css`: homepage refinements.
- `privacy.html` and `terms.html`: bilingual legal pages.

## Deployment

The **Deploy Landing Page** workflow builds the site and uploads `landing/dist`
to GitHub Pages. It runs on `main` changes under `landing/` and can be triggered
manually. It uses the separate landing lockfile with `npm ci`.

The `CNAME` stays `notex.mapherez.com` and is copied into the build. With other
hosting, publish the contents of `landing/dist`, not the source folder.
