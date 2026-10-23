import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Marked, Renderer } from 'marked';
import { siteHeader, siteFooter } from './site-shell.mjs';
import { cleanHtmlLinks, pagePath } from './urls.mjs';
import { fingerprintAssets } from './fingerprint.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist');
const site = 'https://notex.mapherez.com';
const navigation = JSON.parse(await readFile(path.join(root, 'docs/navigation.json'), 'utf8'));
const pages = navigation.flatMap(group => group.pages.map(page => ({ ...page, group: group.title })));
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const slugify = text => text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
const plainText = text => text.replace(/<[^>]*>/g, '').replace(/!?\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[`*_#>|]/g, '').replace(/\s+/g, ' ').trim();
const href = page => pagePath(`docs/${page.slug}.html`);
const canonical = page => `${site}${href(page)}`;

// These are repository-authored articles, never user-supplied Markdown.
// Generate the entire article at build time: reading and navigating need no JS.
function renderArticle(markdown) {
  const headings = [];
  const ids = new Map();
  const parser = new Marked({ gfm: true });
  parser.use({ renderer: {
    heading({ tokens, depth, text }) {
      const base = slugify(plainText(text));
      const count = ids.get(base) ?? 0;
      ids.set(base, count + 1);
      const id = count ? `${base}-${count + 1}` : base;
      if (depth === 2) headings.push({ id, text: plainText(text) });
      return `<h${depth} id="${id}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
    },
    link(token) {
      // Authors can link to a sibling article as ordinary Markdown.
      const url = token.href.replace(/\.md(?=#|$)/, '.html');
      return `<a href="${escape(url)}"${token.title ? ` title="${escape(token.title)}"` : ''}>${this.parser.parseInline(token.tokens)}</a>`;
    },
    code({ text, lang }) {
      return `<pre tabindex="0"><code${lang ? ` class="language-${escape(lang.split(/\s/)[0])}"` : ''}>${escape(text)}</code></pre>\n`;
    },
    table(token) {
      return `<div class="docs-table-wrap" role="region" aria-label="Reference table" tabindex="0">${Renderer.prototype.table.call(this, token)}</div>`;
    }
  } });
  return { html: parser.parse(markdown), headings };
}

function sidebar(current) {
  return navigation.map(group => `<section class="docs-nav-group"><h2>${escape(group.title)}</h2><ul>${group.pages.map(page => `<li><a href="${href(page)}"${page.slug === current.slug ? ' aria-current="page"' : ''}>${escape(page.title)}</a></li>`).join('')}</ul></section>`).join('');
}

function document(page, article, index) {
  const previous = pages[index - 1];
  const next = pages[index + 1];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(page.title)} — NoteX documentation</title>
  <meta name="description" content="${escape(page.description)}">
  <meta name="theme-color" content="#f7f8fc"><meta name="color-scheme" content="light dark">
  <meta property="og:title" content="${escape(page.title)} — NoteX documentation">
  <meta property="og:description" content="${escape(page.description)}">
  <meta property="og:type" content="website"><meta property="og:url" content="${canonical(page)}">
  <meta property="og:image" content="${site}/assets/notex-mark-512.png">
  <link rel="canonical" href="${canonical(page)}">
  <link rel="icon" href="../assets/favicon.ico" sizes="any"><link rel="icon" href="../assets/notex-mark.svg" data-icon-light="../assets/notex-mark-light.svg" data-icon-dark="../assets/notex-mark-dark.svg" type="image/svg+xml" sizes="any"><link rel="apple-touch-icon" href="../assets/apple-touch-icon.png">
  <script src="../theme.js"></script>
  <link rel="stylesheet" href="../assets/fonts/fonts.css">
  <link rel="stylesheet" href="../styles.css"><link rel="stylesheet" href="./docs.css">
  <link rel="stylesheet" href="../shell.css">
  <script src="../site.js" defer></script>
  <script src="./docs.js" defer></script>
</head>
<body class="docs-body">
  <a class="skip-link" href="#main-content">Skip to content</a>
  ${siteHeader('../', 'docs')}
  <div class="docs-shell">
    <aside class="docs-sidebar" aria-label="Documentation topics">
      <search class="docs-search" data-index-url="./search-index.json" hidden>
        <label for="docs-search-input">Search documentation</label>
        <div class="docs-search-control"><span aria-hidden="true">⌕</span><input id="docs-search-input" type="search" placeholder="Find a guide…" aria-controls="docs-search-results"><kbd>/</kbd></div>
        <p id="docs-search-status" class="docs-search-status" role="status"></p>
        <ul id="docs-search-results" class="docs-search-results" hidden></ul>
      </search>
      <details class="docs-topic-menu" open><summary>Browse documentation</summary><nav aria-label="Documentation">${sidebar(page)}</nav></details>
    </aside>
    <main id="main-content" class="docs-main" tabindex="-1">
      <div class="docs-breadcrumb"><a href="./index.html">Documentation</a><span aria-hidden="true">/</span><span>${escape(page.group)}</span></div>
      <article class="docs-article">${article.html}</article>
      <nav class="docs-pagination" aria-label="Previous and next articles">
        ${previous ? `<a href="${href(previous)}"><span>← Previous</span><strong>${escape(previous.title)}</strong></a>` : "<span></span>"}
        ${next ? `<a href="${href(next)}"><span>Next →</span><strong>${escape(next.title)}</strong></a>` : "<span></span>"}
      </nav>
    </main>
    <aside class="docs-on-this-page"><nav aria-label="On this page"><p>On this page</p><ul>${article.headings.map((heading) => `<li><a href="#${heading.id}">${escape(heading.text)}</a></li>`).join("")}</ul></nav></aside>
  </div>
  ${siteFooter('../', 'docs')}
</body>
</html>`;
}

const slugs = new Set();
for (const page of pages) {
  if (!/^[a-z0-9-]+$/.test(page.slug) || slugs.has(page.slug)) throw new Error(`Invalid or duplicate article slug: ${page.slug}`);
  slugs.add(page.slug);
}
const sources = await readdir(path.join(root, 'docs/content'));
for (const file of sources.filter(file => file.endsWith('.md'))) {
  if (!slugs.has(file.slice(0, -3))) throw new Error(`Article missing from navigation: ${file}`);
}

const articles = await Promise.all(pages.map(async page => {
  const markdown = await readFile(path.join(root, `docs/content/${page.slug}.md`), 'utf8');
  if ((markdown.match(/^# /gm) ?? []).length !== 1) throw new Error(`${page.slug} needs exactly one H1`);
  const article = renderArticle(markdown);
  return { page, markdown, article };
}));
// Build in a dedicated output directory; never write over Markdown or sources.
if (path.relative(root, output) !== 'dist') throw new Error('Unexpected build output directory');
await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, 'docs'), { recursive: true });
for (const file of ['index.html', 'privacy.html', 'terms.html']) {
  const current = file === 'index.html' ? 'home' : file.replace('.html', '');
  const source = await readFile(path.join(root, file), 'utf8');
  if (!source.includes('<!-- site-header -->') || !source.includes('<!-- site-footer -->')) throw new Error('Missing shared shell markers: ' + file);
  await writeFile(path.join(output, file), cleanHtmlLinks(source.replace('<!-- site-header -->', siteHeader('./', current)).replace('<!-- site-footer -->', siteFooter('./', current)), `/${file}`));
}
for (const file of ['styles.css', 'home.css', 'shell.css', 'theme.js', 'site.js', 'home.js', 'CNAME', 'assets']) {
  await cp(path.join(root, file), path.join(output, file), { recursive: true });
}
for (const file of ['docs.css', 'docs.js']) await cp(path.join(root, `docs/${file}`), path.join(output, `docs/${file}`));
const searchIndex = [];
for (const [index, { page, markdown, article }] of articles.entries()) {
  await writeFile(path.join(output, `docs/${page.slug}.html`), cleanHtmlLinks(document(page, article, index), `/docs/${page.slug}.html`));
  searchIndex.push({ title: page.title, description: page.description, group: page.group, href: href(page), text: plainText(markdown) });
}
await writeFile(path.join(output, 'docs/search-index.json'), JSON.stringify(searchIndex));
await writeFile(path.join(output, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${site}/sitemap.xml\n`);
await writeFile(path.join(output, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[`${site}/`, `${site}/privacy`, `${site}/terms`, ...pages.map(canonical)].map(url => `<url><loc>${escape(url)}</loc></url>`).join('')}</urlset>`);
await fingerprintAssets(output);
console.log(`Built NoteX website and ${pages.length} documentation articles → landing/dist`);
