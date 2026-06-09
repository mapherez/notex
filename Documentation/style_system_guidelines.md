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

## Spacing Rules

NoteX uses a compact spacing scale with sequential token names. Do not leave
number gaps in the public spacing API.

Approved spacing tokens:

```scss
--nx-space-1: 0.25rem; // 4px
--nx-space-2: 0.5rem;  // 8px
--nx-space-3: 0.75rem; // 12px
--nx-space-4: 1rem;    // 16px
--nx-space-5: 1.25rem; // 20px
--nx-space-6: 1.5rem;  // 24px
--nx-space-7: 2rem;    // 32px
--nx-space-8: 3rem;    // 48px
```

Legacy mapping:

```scss
old --nx-space-8  -> new --nx-space-7
old --nx-space-11 -> new --nx-space-8
```

Remove these legacy spacing tokens during migration:

```scss
old --nx-space-7;  // 1.75rem
old --nx-space-10; // 2.5rem
old --nx-space-12; // 4rem
old --nx-space-13; // 5rem
```

Do not create semantic spacing aliases such as `--nx-card-padding`,
`--nx-section-gap`, or `--nx-row-gap` in this phase. Use the spacing scale
directly unless a future audit decision introduces semantic spacing tokens.

### Gap Tokens

Use semantic gap tokens to reduce layout variation. Approved gap tokens:

```scss
--nx-gap-null: 0;
--nx-gap-xs: var(--nx-space-1);
--nx-gap-sm: var(--nx-space-2);
--nx-gap-md: var(--nx-space-4);
--nx-gap-lg: var(--nx-space-7);
```

Gap migration rules:

```scss
gap: 0;                                            -> gap: var(--nx-gap-null);
gap: var(--nx-space-1);                            -> gap: var(--nx-gap-xs);
gap: var(--nx-space-2);                            -> gap: var(--nx-gap-sm);
gap: var(--nx-space-3);                            -> gap: var(--nx-gap-sm);
gap: var(--nx-space-4);                            -> gap: var(--nx-gap-md);
gap: var(--nx-space-5);                            -> gap: var(--nx-gap-lg);
gap: var(--nx-space-6);                            -> gap: var(--nx-gap-lg);
gap: var(--nx-space-7);                            -> gap: var(--nx-gap-lg);
gap: var(--nx-space-8);                            -> gap: var(--nx-gap-lg);
gap: var(--nx-profile-row-gap, var(--nx-space-4)); -> gap: var(--nx-gap-md);
```

Hardcoded `gap` migration rules:

```scss
gap: 0.1rem;   -> gap: var(--nx-gap-xs);
gap: 0.15rem;  -> gap: var(--nx-gap-xs);
gap: 0.18rem;  -> gap: var(--nx-gap-xs);
gap: 0.38rem;  -> gap: var(--nx-gap-sm);
gap: 0.45rem;  -> gap: var(--nx-gap-sm);
gap: 0.55rem;  -> gap: var(--nx-gap-sm);
gap: 10px;     -> gap: var(--nx-gap-sm);
gap: 0.875rem; -> gap: var(--nx-gap-md);
```

Two-axis gap migration:

```scss
gap: var(--nx-space-3) var(--nx-space-4);
```

becomes:

```scss
gap: var(--nx-gap-sm) var(--nx-gap-md);
```

### Padding Migration

Padding should use the approved `--nx-space-*` scale directly. Extra padding
tokens must be removed during migration. When replacing a token, remove the token
definition and all references to it; do not leave unused compatibility aliases.

Token replacement rules:

```scss
var(--nx-profile-section-padding, var(--nx-space-5)) -> var(--nx-space-5)
var(--nx-page-gutter)                                -> var(--nx-space-7)
old mobile --nx-page-gutter: 1rem                    -> var(--nx-space-4)
```

`--nx-profile-section-padding` is only used in a small number of places and
should be removed directly. `--nx-page-gutter` has wider layout usage and needs a
careful cleanup so no orphan token remains and page spacing does not drift.

Raw padding values should move to the closest approved spacing token:

```scss
0.08rem -> var(--nx-space-1)
0.12rem -> var(--nx-space-1)
0.14em  -> var(--nx-space-1)
0.18rem -> var(--nx-space-1)
0.2rem  -> var(--nx-space-1)
0.34rem -> var(--nx-space-1)
0.36rem -> var(--nx-space-1)
0.42rem -> var(--nx-space-2)
0.48rem -> var(--nx-space-2)
0.58rem -> var(--nx-space-2)
0.65rem -> var(--nx-space-3)
1.9rem  -> var(--nx-space-7)
2rem    -> var(--nx-space-7)
```

Special padding cases need local context before migration:

```scss
padding-inline-end: 10rem;
padding-inline: calc(2rem + var(--nx-space-2));
padding-right: calc(var(--nx-space-4) + 2.4rem);
```

These are likely layout reservations or icon/action offsets, not ordinary
spacing. Do not convert them blindly to spacing tokens.

### Margin Migration

Margins already using `0`, `auto`, or the approved `--nx-space-*` scale can stay
as they are during spacing cleanup.

Extra margin tokens must be replaced by their `--nx-space-*` value and then
removed from token definitions:

```scss
var(--nx-profile-section-gap, var(--nx-space-5)) -> var(--nx-space-5)
```

Raw margin values should move to the closest approved spacing token:

```scss
0.12rem -> var(--nx-space-1)
0.24em  -> var(--nx-space-1)
0.4rem  -> var(--nx-space-2)
0.48rem -> var(--nx-space-2)
```

Do not migrate these special cases without local layout review:

```scss
margin-inline: calc(var(--nx-space-3) * -1);
margin-right: calc(var(--nx-space-4) * -1);
```

These are note/block layout alignment rules, not ordinary spacing.

### Offset And Inset Migration

Offset and inset cleanup covers:

```scss
top;
right;
bottom;
left;
inset;
scroll-margin;
```

Do not change structural positioning tokens or positional values:

```scss
var(--nx-window-titlebar-height);
var(--nx-topbar-height);
50%;
100%;
auto;
calc(100% + var(--nx-space-*));
calc(var(--nx-topbar-height) + var(--nx-space-*));
```

Remove `--nx-page-gutter` from offsets by replacing it with the approved
`--nx-space-*` value chosen for page gutter cleanup.

Raw positive offsets should move to the closest approved spacing token:

```scss
0.42rem -> var(--nx-space-2)
0.45rem -> var(--nx-space-2)
0.55rem -> var(--nx-space-2)
0.65rem -> var(--nx-space-3)
1rem    -> var(--nx-space-4)
```

Raw negative offsets should move to the closest approved spacing token multiplied
by `-1`:

```scss
-0.12rem       -> calc(var(--nx-space-1) * -1)
-0.45rem       -> calc(var(--nx-space-2) * -1)
-1rem          -> calc(var(--nx-space-4) * -1)
calc(2rem * -1) -> calc(var(--nx-space-7) * -1)
```

## Border Radius Rules

NoteX uses one normal radius token and one pill radius token:

```scss
--nx-radius: 0.5rem;
--nx-radius-pill: 999px;
```

Use `--nx-radius` for normal rounded UI surfaces, controls, cards, inputs,
menus, modals, chips that are not full pills, and editor/content blocks. Use
`--nx-radius-pill` only for full pill shapes.

Radius token migration:

```scss
var(--nx-radius-sm)   -> var(--nx-radius)
var(--nx-radius-md)   -> var(--nx-radius)
var(--nx-radius-card) -> var(--nx-radius)
var(--nx-radius-lg)   -> var(--nx-radius)
```

Raw radius migration:

```scss
0.13rem -> var(--nx-radius)
0.18rem -> var(--nx-radius)
0.22rem -> var(--nx-radius)
0.23rem -> var(--nx-radius)
0.25rem -> var(--nx-radius)
0.28rem -> var(--nx-radius)
0.3rem  -> var(--nx-radius)
0.31rem -> var(--nx-radius)
0.32rem -> var(--nx-radius)
0.35rem -> var(--nx-radius)
0.37rem -> var(--nx-radius)
0.43rem -> var(--nx-radius)
999px   -> var(--nx-radius-pill)
```

Do not remove intentional square corners. Partial radius rules with `0` stay
partial, but their rounded sides should use `--nx-radius`:

```scss
border-radius: var(--nx-radius) 0 0 var(--nx-radius);
border-radius: 0 var(--nx-radius) var(--nx-radius) 0;

border-top-left-radius: 0;
border-top-right-radius: 0;
border-bottom-left-radius: 0;
border-bottom-right-radius: 0;
```

## Z-Index Rules

NoteX uses a small global z-index map. Do not add one layer per component.

Approved z-index layers:

```scss
$z-index: (
  "local": 1,
  "local-raised": 2,
  "dropdown": 50,
  "modal": 60,
  "system": 70,
);
```

Use layers by role, not by the old numeric value:

```scss
z("local");
```

Use for local overlays inside the same component, such as link overlays inside
cards or rows.

```scss
z("local-raised");
```

Use for local actions that must sit above local overlays, such as card buttons or
row actions.

```scss
z("dropdown");
```

Use for menus, popovers, dropdowns, search results, color picker, custom select,
floating editor menus, and similar UI that must sit above page content.

```scss
z("modal");
```

Use for modal overlay/backdrop and modal content. NoteX expects one modal stack
at a time.

```scss
z("system");
```

Use for app chrome and system UI that must sit above normal UI, such as the
window titlebar, toast, updater, or system banners.

Do not convert z-index values blindly by number. Convert by selector/function.
The same old number may represent different roles.

Example conversions:

```scss
z-index: 1;   -> z("local")
z-index: 2;   -> z("local-raised")

menus/dropdowns/popovers/search/color-picker/custom-select
floating-menu/note-row-menu/filter popovers/editor popovers
-> z("dropdown")

modal/backdrop/modal overlay/mobile drawer overlay
-> z("modal")

window titlebar/toast/updater/system chrome
-> z("system")
```

Old numeric reference table:

```scss
15, 20, 25, 30, 40 -> inspect selector role before migration
45, 50, 60, 65, 70, 75, 80, 85 -> usually z("dropdown")
90 -> z("dropdown") or z("system"), depending on selector
95 -> z("system") when tooltip/updater/toast-like, otherwise inspect selector
100, 130 -> usually z("system")
110 -> usually z("dropdown")
120 -> z("modal"), z("system"), or z("dropdown"), depending on selector
```

Allowed exception:

```scss
z-index: #{25 - $index};
```

This is specific tag-chain stacking logic and should not be migrated to the
global z-index map.

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

NoteX uses one typography token set for the app UI and the note editor/content.
Selector ownership still stays separate: UI rules belong to UI owners, and
editor/content rules belong to editor/content owners. The shared contract is the
token scale, not selector placement.

Landing-page or marketing typography is out of scope for NoteX app styles.

### Font Size

Use only these font-size tokens in NoteX app styles:

```scss
--nx-font-size-caption;
--nx-font-size-small;
--nx-font-size-body;
--nx-font-size-title-sm;
--nx-font-size-title-md;
--nx-font-size-title-lg;
--nx-font-size-metric;
```

Use them as follows:

- `--nx-font-size-caption`: metadata, timestamps, helper text, very compact
  secondary text.
- `--nx-font-size-small`: secondary labels, badges, compact card text, row
  supporting text.
- `--nx-font-size-body`: normal UI text and normal note/editor body text.
- `--nx-font-size-title-sm`: card titles, panel headings, block titles, smaller
  note headings.
- `--nx-font-size-title-md`: section titles, modal titles, stronger in-page
  headings.
- `--nx-font-size-title-lg`: page titles, main note title, top-level note
  heading.
- `--nx-font-size-metric`: dashboard/statistic numbers and other numeric metric
  displays.

Do not create separate editor/content font-size aliases. Map editor/content to
the same seven tokens:

- editor body: `--nx-font-size-body`
- editor headings: `--nx-font-size-title-sm`,
  `--nx-font-size-title-md`, or `--nx-font-size-title-lg`
- editor title: `--nx-font-size-title-lg`
- block title: `--nx-font-size-title-sm`

### Font Weight

Use only these font-weight tokens:

```scss
--nx-font-weight-regular; // 400
--nx-font-weight-medium;  // 500
--nx-font-weight-bold;    // 700
```

Use them as follows:

- `--nx-font-weight-regular`: normal body text and low-emphasis text.
- `--nx-font-weight-medium`: labels, controls, navigation, row titles where
  bold would be too strong.
- `--nx-font-weight-bold`: page titles, modal titles, section headings, strong
  card titles, and important values.

Do not add intermediate weights such as `600`, `650`, `720`, `740`, `750`,
`760`, or `780` unless a future audit decision changes this contract.

### Line Height

Use only these line-height tokens:

```scss
--nx-line-height-tight;
--nx-line-height-heading;
--nx-line-height-compact;
--nx-line-height-body;
--nx-line-height-reading;
```

Use them as follows:

- `--nx-line-height-tight`: large titles or short single-line heading contexts.
- `--nx-line-height-heading`: headings, modal titles, card titles, and compact
  title blocks.
- `--nx-line-height-compact`: labels, buttons, dense rows, badges, and compact
  UI text.
- `--nx-line-height-body`: normal UI paragraphs and descriptive text.
- `--nx-line-height-reading`: note/editor body text, long-form content, and
  readable multi-line content.

`line-height: 1` is allowed only for tightly controlled icon/chip/control
internals where text centering depends on the control height.

### Letter Spacing

Use only these letter-spacing tokens:

```scss
--nx-letter-spacing-default;
--nx-letter-spacing-label;
```

Use `--nx-letter-spacing-default` for normal text. Use
`--nx-letter-spacing-label` only with compact uppercase UI labels such as
sidebar group labels or small metadata labels. Do not use uppercase label
treatment for normal body text, primary buttons, page titles, or modal titles.

### Font Family

Use only these font-family tokens:

```scss
--nx-font-family-sans;
--nx-font-family-mono;
```

Use `--nx-font-family-sans` for normal UI and content text. Use
`--nx-font-family-mono` only for code, file paths, technical IDs, snippets,
keyboard-command text where monospacing is intentional, and similar technical
content.

### Typography Mixins

Use typography mixins to apply repeated typography roles without adding new TSX
classes during the SCSS refactor.

Approved typography mixins:

```scss
@include nx-type-caption;
@include nx-type-body;
@include nx-type-title-sm;
@include nx-type-title-md;
@include nx-type-title-lg;
@include nx-type-metric;
```

Implement them with the approved typography tokens:

```scss
@mixin nx-type-caption {
  font-size: var(--nx-font-size-caption);
  font-weight: var(--nx-font-weight-regular);
  line-height: var(--nx-line-height-compact);
}

@mixin nx-type-body {
  font-size: var(--nx-font-size-body);
  font-weight: var(--nx-font-weight-regular);
  line-height: var(--nx-line-height-body);
}

@mixin nx-type-title-sm {
  font-size: var(--nx-font-size-title-sm);
  font-weight: var(--nx-font-weight-bold);
  line-height: var(--nx-line-height-heading);
}

@mixin nx-type-title-md {
  font-size: var(--nx-font-size-title-md);
  font-weight: var(--nx-font-weight-bold);
  line-height: var(--nx-line-height-heading);
}

@mixin nx-type-title-lg {
  font-size: var(--nx-font-size-title-lg);
  font-weight: var(--nx-font-weight-bold);
  line-height: var(--nx-line-height-tight);
}

@mixin nx-type-metric {
  font-size: var(--nx-font-size-metric);
  font-weight: var(--nx-font-weight-bold);
  line-height: var(--nx-line-height-tight);
}
```

Use these mixins for repeated role-based typography. Do not create extra
typography mixins unless the approved token set changes.

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
