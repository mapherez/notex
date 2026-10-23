// Public page URLs are independent of the .html files used by the static build.
export const siteOrigin = 'https://notex.mapherez.com';

export function pagePath(filename) {
  const pathname = `/${filename.replace(/^\/+/, '')}`;
  return pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
}

export function cleanPageLink(value, from = '/') {
  if (!value || value.startsWith('#')) return value;
  const url = new URL(value, `${siteOrigin}${from}`);
  if (url.origin !== siteOrigin || !url.pathname.endsWith('.html')) return value;
  const clean = `${pagePath(url.pathname)}${url.search}${url.hash}`;
  return value.startsWith(siteOrigin) ? `${siteOrigin}${clean}` : clean;
}

export function cleanHtmlLinks(html, from) {
  return html.replace(/\b(href|content)="([^"]*)"/g,
    (match, attribute, value) => `${attribute}="${cleanPageLink(value, from)}"`);
}

export function legacyRedirect(pathname) {
  if (pathname === '/docs') return '/docs/';
  if (pathname === '/index.html' || pathname === '/docs/index.html'
    || /^\/(?:privacy|terms|docs\/[a-z0-9-]+)\.html$/.test(pathname)) return pagePath(pathname);
  return null;
}

export function staticFile(pathname) {
  if (pathname.endsWith('/')) return `${pathname}index.html`;
  if (/^\/(?:privacy|terms|docs\/[a-z0-9-]+)$/.test(pathname)) return `${pathname}.html`;
  return pathname;
}

export const immutableAsset = /\.[a-f0-9]{12}\.(?:css|js|json|woff2?|png|jpe?g|webp|svg|ico)$/;
