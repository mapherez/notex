import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Marked, Renderer } from 'marked';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist');
const site = 'https://notex.mapherez.com';
const navigation = JSON.parse(await readFile(path.join(root, 'docs/navigation.json'), 'utf8'));
const pages = navigation.flatMap(group => group.pages.map(page => ({ ...page, group: group.title })));
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const slugify = text => text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
const plainText = text => text.replace(/<[^>]*>/g, '').replace(/!?\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[`*_#>|]/g, '').replace(/\s+/g, ' ').trim();
const href = page => `./${page.slug === 'index' ? 'index' : page.slug}.html`;
const canonical = page => `${site}/docs/${page.slug === 'index' ? '' : `${page.slug}.html`}`;

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
  <meta name="theme-color" content="#090a0c">
  <meta property="og:title" content="${escape(page.title)} — NoteX documentation">
  <meta property="og:description" content="${escape(page.description)}">
  <meta property="og:type" content="website"><meta property="og:url" content="${canonical(page)}">
  <meta property="og:image" content="${site}/assets/notex-logo.webp">
  <link rel="canonical" href="${canonical(page)}">
  <link rel="icon" href="../assets/notex-logo.webp" type="image/webp">
  <link rel="stylesheet" href="../styles.css"><link rel="stylesheet" href="./docs.css">
  <script src="./docs.js" defer></script>
</head>
<body class="docs-body">
  <a class="skip-link" href="#main-content">Skip to content</a>
  <header class="site-nav"><div class="nav-inner">
    <a class="brand" href="../index.html" aria-label="NoteX home"><img src="../assets/notex-logo.webp" alt="" width="32" height="32"><span>NoteX</span><span class="docs-brand-label">/ Docs</span></a>
    <nav aria-label="Primary navigation"><a href="../index.html">Overview</a><a href="./index.html" aria-current="true">Documentation</a><a href="https://github.com/mapherez/notex">GitHub</a><a class="docs-download" href="https://github.com/mapherez/notex/releases/latest">Download <span aria-hidden="true">↗</span></a></nav>
  </div></header>
  <div class="docs-shell">
    <aside class="docs-sidebar" aria-label="Documentation topics">
      <search class="docs-search" hidden>
        <label for="docs-search-input">Search documentation</label>
        <div class="docs-search-control"><span aria-hidden="true">⌕</span><input id="docs-search-input" type="search" placeholder="Find a guide…" aria-controls="docs-search-results"><kbd>/</kbd></div>
        <p id="docs-search-status" class="docs-search-status" role="status"></p>
        <ul id="docs-search-results" class="docs-search-results" hidden></ul>
      </search>
      <details class="docs-topic-menu" open><summary>Browse documentation</summary><nav aria-label="Documentation">${sidebar(page)}</nav></details>
      <a class="docs-sidebar-help" href="https://github.com/mapherez/notex/issues">Have a question? <span aria-hidden="true">↗</span><span>Send feedback on GitHub</span></a>
    </aside>
    <main id="main-content" class="docs-main" tabindex="-1">
      <div class="docs-breadcrumb"><a href="./index.html">Documentation</a><span aria-hidden="true">/</span><span>${escape(page.group)}</span></div>
      <p class="docs-description">${escape(page.description)}</p>
      <article class="docs-article">${article.html}</article>
      <div class="docs-article-footer"><span>For the Windows desktop release</span><a href="https://github.com/mapherez/notex/edit/main/landing/docs/content/${page.slug}.md">Improve this guide <span aria-hidden="true">↗</span></a></div>
      <nav class="docs-pagination" aria-label="Previous and next articles">
        ${previous ? `<a href="${href(previous)}"><span>← Previous</span><strong>${escape(previous.title)}</strong></a>` : '<span></span>'}
        ${next ? `<a href="${href(next)}"><span>Next →</span><strong>${escape(next.title)}</strong></a>` : '<span></span>'}
      </nav>
    </main>
    <aside class="docs-on-this-page"><nav aria-label="On this page"><p>On this page</p><ul>${article.headings.map(heading => `<li><a href="#${heading.id}">${escape(heading.text)}</a></li>`).join('')}</ul></nav><div class="docs-local-card"><span class="docs-local-dot"></span><strong>Your notes. Your computer.</strong><p>No account needed.<br>Works offline.</p></div></aside>
  </div>
  <footer class="site-footer docs-footer"><span>NoteX · A place for knowledge you return to.</span><nav aria-label="Legal links"><a href="../privacy.html">Privacy</a><a href="../terms.html">Terms</a></nav></footer>
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
for (const file of ['index.html', 'styles.css', 'home.css', 'privacy.html', 'terms.html', 'CNAME', 'assets']) {
  await cp(path.join(root, file), path.join(output, file), { recursive: true });
}
for (const file of ['docs.css', 'docs.js']) await cp(path.join(root, `docs/${file}`), path.join(output, `docs/${file}`));
const searchIndex = [];
for (const [index, { page, markdown, article }] of articles.entries()) {
  await writeFile(path.join(output, `docs/${page.slug}.html`), document(page, article, index));
  searchIndex.push({ title: page.title, description: page.description, group: page.group, href: href(page), text: plainText(markdown) });
}
await writeFile(path.join(output, 'docs/search-index.json'), JSON.stringify(searchIndex));
await writeFile(path.join(output, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${site}/sitemap.xml\n`);
await writeFile(path.join(output, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[`${site}/`, `${site}/privacy.html`, `${site}/terms.html`, ...pages.map(canonical)].map(url => `<url><loc>${escape(url)}</loc></url>`).join('')}</urlset>`);
console.log(`Built NoteX website and ${pages.length} documentation articles → landing/dist`);
