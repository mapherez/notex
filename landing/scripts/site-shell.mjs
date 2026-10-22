// One build-time shell for the landing, every guide, and the legal pages.
// Links stay usable without JavaScript; only disclosures need enhancement.
const icons = {
  system:
    '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>',
  light:
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  dark: '<path d="M20.7 13A9 9 0 0 1 11 3.3 9 9 0 1 0 20.7 13Z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
};
const icon = (name, className = "") =>
  `<svg class="site-icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const mark =
  '<svg class="brand-mark" viewBox="0 0 64 64" width="32" height="32" fill="none" aria-hidden="true"><rect class="mark-tile" width="64" height="64" rx="17"/><path class="mark-letter" d="M18 46V22h6.5l15 20V22H46v24h-6.5l-15-20v20Z"/><circle fill="#8f9bf2" cx="47" cy="15" r="3.5"/></svg>';
const brand = (base) =>
  `<a class="site-brand" href="${base}index.html" aria-label="NoteX home">${mark}<span>Note<span class="site-brand-accent">X</span></span></a>`;
const link = (href, label, active = false) =>
  `<a href="${href}"${active ? ' aria-current="page"' : ""}>${label}</a>`;

export function siteHeader(base, current) {
  return `<header class="site-header" data-site-header>
  <div class="site-header-inner">
    ${brand(base)}
    <nav class="site-navigation" id="site-navigation" aria-label="Main navigation">
      ${link(`${base}index.html`, "Home", current === "home")}
      ${link(`${base}index.html#features`, "Features")}
      ${link(`${base}docs/`, "Documentation", current === "docs")}
      <div class="site-mobile-actions">
        <a class="site-action" href="https://notex.mapherez.com/app/">Open web app <span aria-hidden="true">↗</span></a>
        <a class="site-action site-action-primary" href="https://notex.mapherez.com/download">Download</a>
      </div>
    </nav>
    <div class="site-header-actions">
      <a class="site-web-link" href="https://notex.mapherez.com/app/">Open web app <span aria-hidden="true">↗</span></a>
      <a class="site-action site-action-primary" href="https://notex.mapherez.com/download">Download</a>
    </div>
    <button class="site-menu-toggle" data-site-menu type="button" aria-label="Open navigation" aria-controls="site-navigation" aria-expanded="false" hidden>${icon("menu")}</button>
    <div class="site-theme" data-theme-control hidden>
      <button class="site-theme-trigger" data-theme-trigger type="button" aria-label="Color theme: System" aria-expanded="false" aria-controls="site-theme-panel" title="Color theme: System"><span data-theme-icon>${icon("system")}</span></button>
      <div class="site-theme-panel" id="site-theme-panel" data-theme-panel hidden>
        <p class="site-theme-heading">Appearance</p>
        <div role="group" aria-label="Color theme">
          ${["system", "light", "dark"].map((value) => `<button class="site-theme-option" type="button" data-theme-value="${value}" aria-pressed="${value === "system"}">${icon(value)}<span>${value[0].toUpperCase() + value.slice(1)}</span>${icon("check", "site-theme-check")}</button>`).join("")}
        </div>
      </div>
    </div>
  </div>
</header>`;
}

export function siteFooter(base, current) {
  return `<footer class="site-footer"><div class="site-footer-inner">
  ${brand(base)}
  <nav aria-label="Footer links">
    ${link(`${base}index.html`, "Home", current === "home")}
    ${link(`${base}docs/`, "Documentation", current === "docs")}
    ${link("https://github.com/mapherez/notex", "GitHub")}
    ${link(`${base}privacy.html`, "Privacy", current === "privacy")}
    ${link(`${base}terms.html`, "Terms", current === "terms")}
  </nav>
</div></footer>`;
}
