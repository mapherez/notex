# NoteX Style System Guidelines

## Source Of Truth

This document makes the CSS audit rules permanent. The master plan is
`Audit/99_css_audit_decision_log.md`; the numbered audit files remain required
for area-specific detail.

Use this document before adding or moving styles. If it conflicts with
`Audit/99_css_audit_decision_log.md`, the audit decision log controls phase
order and gates. The detailed audit for the affected area controls the local
technical evidence.

## Style Directory Responsibilities

`src/styles/abstracts`

- Design-system data and Sass helpers.
- Examples: base tokens, breakpoint map, z-index map, helper functions, focused
  mixins.
- Do not put selectors here.

`src/styles/themes`

- Theme-specific CSS variables for dark/light and future themes.
- Examples: surfaces, text colors, borders, overlays, chip bases, shadows.
- Do not put page or component selectors here.

`src/styles/base`

- Global element reset and global UI typography primitives.
- Examples: reset rules, `.page-title`, `.page-subtitle`.
- Do not put editor/content typography here unless a specific editor phase says
  to do so.

`src/styles/layout`

- App shell and layout systems that frame the whole product.
- Examples: sidebar, topbar, app shell layout.
- Do not put reusable component primitives here unless they are shell-only.

`src/styles/components`

- Reusable component styles and global primitives.
- Examples: buttons, menus, surfaces, chips, badges, thumbnails, filters,
  modals, toast, editor toolbars when their phase owns them.
- Keep files small and named by responsibility.

`src/styles/pages`

- Page-only layout and widgets.
- Pages may compose global primitives, but must not define reusable primitives.
- If a selector is used by two or more unrelated pages/components, consider a
  component owner instead.

`src/styles/responsive`

- Temporary catch-all responsive area.
- New responsive work should live near the owner when practical.
- This file should shrink as ownership migrations progress.

## Where New Styles Go

Add a style to `base` when it is a global browser reset or UI typography rule
used across pages.

Add a style to `components` when the selector describes reusable UI behavior:
buttons, chips, surfaces, popovers, badges, menus, rows, thumbnails, filters, or
states shared across pages.

Add a style to `pages` when it describes one page's composition or a widget that
is not reused outside that page.

Add a style to `layout` when it belongs to the persistent shell around the app,
not to a page inside the shell.

Leave a style local when it is contextual, appears once, and does not represent a
system rule.

## Token Rules

Use CSS custom properties as the styling API:

```scss
padding: var(--nx-card-padding);
color: var(--nx-color-text-muted);
```

Create a token when the value is a system rule reused across owners, such as:

- spacing scale steps;
- card or compact card padding;
- section and row gaps;
- control heights;
- icon button size;
- pill radius;
- focus ring width/offset/color;
- popover width/radius/shadow;
- typography sizes, weights, and line heights;
- content max widths with clear layout meaning;
- z-index layers with named behavior.

Do not create a token just to hide a one-off value. Hardcoded values may stay
when they are artwork colors, thumbnail fallbacks, intrinsic asset dimensions,
contextual offsets, or documented local behavior.

## Theme Rules

Use theme variables for UI colors that need to respond to dark/light modes:

- canvas and surfaces;
- text and muted text;
- borders;
- inputs;
- hover surfaces;
- backdrops and overlays;
- chip base colors;
- popover/floating shadows;
- inverse/on-accent text.

Keep thumbnail/artwork colors out of theme tokens unless the product decides that
they should adapt to themes.

Do not introduce `[data-accent]` or new theme families without a dedicated UX and
implementation decision.

## Typography Rules

UI typography and editor/content typography are separate systems.

UI typography may use shared classes and tokens, for example `.page-title`,
`.page-subtitle`, modal title tokens, section title tokens, control text, labels,
captions, and rows.

Editor/content typography includes ProseMirror, markdown previews, document
body, node views, tables, and note headings. Do not move those rules into
`base/_typography.scss` during general UI cleanup.

## Responsive Rules

Use semantic breakpoint names and helpers for new responsive work. Current
foundation names are:

- `mobile`: `680px`
- `tablet`: `900px`
- `tablet-wide`: `1024px`
- `content-collapse`: `1180px`
- `desktop-small`: `1366px`
- `desktop`: `1920px`
- `desktop-1440p`: `2560px`
- `desktop-4k`: `3840px`

Responsive behavior should move toward owner files:

- shell rules near shell styles;
- dashboard rules near dashboard styles;
- note list/grid rules near their owners;
- modals near modal styles;
- editor rules only during the editor phase.

Do not change breakpoints while moving selector ownership. Move first, validate,
then migrate hardcoded values to helpers in a separate step.

## Primitive Rules

Create a primitive only when it has a clear repeated role and owner.

Good primitive candidates:

- buttons and icon buttons;
- surfaces/panels;
- badges and chips;
- menus/popovers;
- thumbnails;
- meta rows;
- color dots;
- shared popular tag rows.

Bad primitive candidates:

- a generic `.card`;
- a giant `_primitives.scss`;
- page-only widgets promoted globally for convenience;
- editor/Tiptap rules moved before the editor phase.

When extracting a primitive, keep selector names and visual behavior stable first.
Renames and cleanup come after ownership is proven.

## Checklists

For a new page:

- Put page composition in `src/styles/pages`.
- Reuse existing primitives for surfaces, buttons, chips, menus, thumbnails, and
  empty states.
- Add page-only responsive rules beside the page owner when possible.
- Do not define reusable primitives in the page file.
- Validate dark/light, empty states, long titles, and narrow widths.

For a new component:

- Decide whether it is app-wide, page-specific, or shell-specific.
- Use existing tokens before adding new values.
- Add new tokens only when they describe a reusable system rule.
- Keep focus-visible states accessible and visible.
- Avoid hardcoded z-index values; use the z-index map once the area migrates.

For a CSS refactor:

- Read `Audit/99_css_audit_decision_log.md`.
- Read the detailed audit for the affected area.
- Move selectors before renaming them.
- Do not mix redesign with ownership cleanup.
- Do not remove legacy selectors without `rg` evidence and visual validation.
- Run `npm run check:styles` and `npm run build` when feasible.

## Audit Anti-Patterns To Avoid

- Page files defining global primitives like panels, settings cards, chips, or
  badges.
- `_responsive.scss` becoming the owner of unrelated layouts.
- `_notes.scss` owning chips, thumbnails, dashboard widgets, row layout, and
  menus at the same time.
- `_filters.scss` owning notes grid/list behavior and floating menus.
- `_forms.scss` owning page typography or legal-page layout long term.
- Dashboard styles defining primitives used by Profile, Tags, or EmptyState.
- Editor/content typography mixed into UI typography.
- New hardcoded breakpoints that duplicate existing semantic thresholds.
