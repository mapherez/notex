# Spacing / Size Scale Audit

## Estado

- Estado: Novo
- Data: 2026-06-06
- Tipo: levantamento operacional
- Escopo: `src/styles/**/*.scss`
- Objetivo: mapear valores literais de escala visual que devem ser normalizados para tokens antes de continuar o refactor CSS.

## Porque Este Audit Existe

O refactor CSS criou tokens de spacing, typography, control sizes, radius, z-index e theme colors, mas muitos ficheiros continuam a usar valores literais ligeiramente diferentes.

Isto cria exatamente o problema que o refactor devia resolver:

- componentes visualmente parecidos usam `gap`, `padding`, `height`, `font-size` ou `font-weight` diferentes;
- pequenas variacoes como `0.86rem`, `0.88rem`, `0.9rem`, `0.92rem` aparecem em contextos semelhantes;
- control heights usam `2.35rem`, `2.4rem`, `2.45rem`, `2.55rem`, `2.65rem`, `2.75rem`, `3rem`;
- radius usa tokens em alguns sitios, mas tambem `0.23rem`, `0.28rem`, `0.31rem`, `0.32rem`, etc.;
- z-index tem map definido, mas muitos selectors continuam com numeros crus;
- cores e color mixes hardcoded continuam espalhados.

Este ficheiro deve ser usado antes de Phase 5. A proxima passagem de CSS deve ser uma normalizacao de tokens nos ficheiros ja mexidos e nos owners existentes, nao outra migration.

## Metodo De Extracao

Foram pesquisadas declaracoes SCSS com propriedades de escala:

- spacing: `gap`, `row-gap`, `column-gap`, `padding*`, `margin*`, `inset`, `top`, `right`, `bottom`, `left`
- dimensions: `width`, `height`, `min-width`, `max-width`, `min-height`, `max-height`, `flex-basis`
- typography: `font-size`, `font-weight`, `line-height`, `letter-spacing`
- shape: `border-radius`, `border`, `outline`, `box-shadow`
- layers/breakpoints/colors: `z-index`, `@media`, hex, rgb/rgba, `color-mix`

Os numeros abaixo sao do estado atual do working tree em 2026-06-06.

## Tokens Atuais Relevantes

### Spacing

| Token | Valor |
| --- | --- |
| `--nx-space-1` | `0.25rem` |
| `--nx-space-2` | `0.5rem` |
| `--nx-space-3` | `0.75rem` |
| `--nx-space-4` | `1rem` |
| `--nx-space-5` | `1.25rem` |
| `--nx-space-6` | `1.5rem` |
| `--nx-space-7` | `1.75rem` |
| `--nx-space-8` | `2rem` |
| `--nx-space-10` | `2.5rem` |
| `--nx-space-11` | `3rem` |
| `--nx-space-12` | `4rem` |
| `--nx-space-13` | `5rem` |

Semantic spacing tokens already exist:

- `--nx-card-padding`
- `--nx-card-padding-compact`
- `--nx-section-gap`
- `--nx-section-gap-compact`
- `--nx-row-gap`
- `--nx-row-gap-compact`
- `--nx-page-gutter`

Problem: many files still use raw values or direct `--nx-space-*` where a semantic token would be clearer.

### Control / Component Sizes

| Token | Valor |
| --- | --- |
| `--nx-control-height` | `2.75rem` |
| `--nx-control-height-compact` | `2.35rem` |
| `--nx-icon-button-size` | `2.25rem` |
| `--nx-popover-width` | `22rem` |
| `--nx-topbar-height` | `5.5rem` |
| `--nx-sidebar-width` | `14rem` |
| `--nx-window-titlebar-height` | `38px` |

Problem: controls use many nearby values that are not tokens.

### Typography

| Token | Valor |
| --- | --- |
| `--nx-font-size-caption` | `0.78rem` |
| `--nx-font-size-meta` | `0.82rem` |
| `--nx-font-size-control` | `0.86rem` |
| `--nx-font-size-description` | `0.88rem` |
| `--nx-font-size-row` | `0.92rem` |
| `--nx-font-size-body` | `1rem` |
| `--nx-font-size-section-title` | `1.2rem` |
| `--nx-font-size-modal-title` | `1.35rem` |
| `--nx-font-size-page-title` | `clamp(1.65rem, 2.3vw, 2rem)` |
| `--nx-font-size-document-title` | `clamp(1.8rem, 3vw, 2.25rem)` |

| Token | Valor |
| --- | --- |
| `--nx-font-weight-regular` | `560` |
| `--nx-font-weight-medium` | `650` |
| `--nx-font-weight-label` | `700` |
| `--nx-font-weight-strong` | `760` |
| `--nx-font-weight-heading` | `780` |

| Token | Valor |
| --- | --- |
| `--nx-line-height-tight` | `1.15` |
| `--nx-line-height-heading` | `1.25` |
| `--nx-line-height-compact` | `1.45` |
| `--nx-line-height-body` | `1.65` |
| `--nx-line-height-reading` | `1.75` |
| `--nx-letter-spacing-label` | `0.04em` |

Problem: the tokens exist, but most declarations still use raw numbers.

### Radius

| Token | Valor |
| --- | --- |
| `--nx-radius-sm` | `0.25rem` |
| `--nx-radius-md` | `0.37rem` |
| `--nx-radius-card` | `0.48rem` |
| `--nx-radius-lg` | `0.6rem` |
| `--nx-radius-pill` | `999px` |

Problem: raw radius values are still common.

### Z-Index

The z-index map already contains:

- `base: 0`
- `raised: 1`
- `sticky: 15`
- `backdrop: 20`
- `sidebar: 30`
- `mobile-sidebar: 40`
- `dropdown: 50`
- `menu: 60`
- `note-row-menu: 65`
- `search-popover: 70`
- `popover: 80`
- `editor-toolbar: 90`
- `topbar: 100`
- `account-menu: 110`
- `titlebar: 120`
- `modal: 130`
- `toast: 140`
- `tooltip: 150`

Problem: many selectors still use raw numbers instead of `z("...")` or CSS vars backed by the map.

## Summary Stats

| Property | Unique values | Total declarations | Top values |
| --- | ---: | ---: | --- |
| `gap` | 19 | 199 | `--nx-space-2` 69, `--nx-space-3` 45, `--nx-space-4` 35 |
| `padding` | 36 | 155 | `0` 21, `--nx-space-3` 20, `--nx-space-4` 18 |
| `width` | 58 | 136 | `100%` 40, `1rem` 9, `2.25rem` 5 |
| `height` | 48 | 101 | `100%` 18, `1rem` 7, `2.75rem` 6 |
| `min-height` | 38 | 82 | `0` 18, `30px` 5, `2.35rem` 5 |
| `font-size` | 32 | 84 | `0.78rem` 13, `0.92rem` 12, `0.88rem` 10 |
| `font-weight` | 11 | 65 | `700` 13, `760` 12, `650` 9, `740` 9 |
| `line-height` | 14 | 33 | `1.15` 5, `1.45` 4, `1.7` 4, `1.75` 4 |
| `border-radius` | 20 | 149 | `--nx-radius-sm` 50, `--nx-radius-md` 25, `999px` 17 |
| `z-index` | 22 | 43 | `80` 5, `1` 4, `120` 3, `2` 3 |

Interpretation:

- The app already uses tokens in many places, but the scale is not enforced.
- Typography is the clearest failure: the token set exists, but raw values dominate.
- Control sizing is inconsistent: there are too many values clustered around the same visual role.
- Radius is partially tokenized, but still has many local values that should collapse.
- z-index token map exists, but raw z-index usage remains high.

## Typography Values Found

### Font Size

| Value | Count | Example |
| --- | ---: | --- |
| `0.68rem` | 1 | `src/styles/components/_editor.scss:181` |
| `0.74rem` | 1 | `src/styles/layout/_sidebar.scss:211` |
| `0.78rem` | 13 | `src/styles/components/_editor.scss:174` |
| `0.8rem` | 1 | `src/styles/components/_search.scss:96` |
| `0.82rem` | 4 | `src/styles/components/_modals.scss:71` |
| `0.85rem` | 1 | `src/styles/components/_notes.scss:250` |
| `0.86rem` | 8 | `src/styles/components/_chips.scss:16` |
| `0.88rem` | 10 | `src/styles/components/_entity.scss:189` |
| `0.9rem` | 5 | `src/styles/components/_modals.scss:85` |
| `0.92rem` | 12 | `src/styles/components/_editor.scss:383` |
| `0.98rem` | 1 | `src/styles/layout/_sidebar.scss:144` |
| `1rem` | 1 | `src/styles/components/_updater.scss:40` |
| `1.02rem` | 1 | `src/styles/pages/_note.scss:186` |
| `1.04rem` | 1 | `src/styles/components/_filters.scss:449` |
| `1.05rem` | 3 | `src/styles/layout/_sidebar.scss:69` |
| `1.1rem` | 1 | `src/styles/pages/_note.scss:293` |
| `1.12rem` | 1 | `src/styles/components/_editor.scss:276` |
| `1.125rem` | 1 | `src/styles/components/_loading.scss:26` |
| `1.2rem` | 2 | `src/styles/components/_surfaces.scss:21` |
| `1.3rem` | 1 | `src/styles/components/_editor.scss:272` |
| `1.35rem` | 1 | `src/styles/components/_modals.scss:45` |
| `1.4rem` | 1 | `src/styles/pages/_note.scss:402` |
| `1.5rem` | 1 | `src/styles/layout/_sidebar.scss:35` |
| `1.6rem` | 1 | `src/styles/components/_editor.scss:268` |
| `1.65rem` | 1 | `src/styles/pages/_dashboard.scss:60` |
| `2rem` | 1 | `src/styles/pages/_profile.scss:80` |
| `clamp(1.8rem, 3vw, 2.25rem)` | 3 | `src/styles/pages/_note-detail.scss:317` |
| `0.9em` | 1 | `src/styles/components/_editor.scss:321` |
| `0.92em` | 1 | `src/styles/pages/_note.scss:462` |
| `inherit` | 2 | `src/styles/components/_filters.scss:468` |
| `var(--nx-font-size-body)` | 1 | `src/styles/base/_typography.scss:12` |
| `var(--nx-font-size-page-title)` | 1 | `src/styles/base/_typography.scss:3` |

Required correction:

- `0.78rem`, `0.82rem`, `0.86rem`, `0.88rem`, `0.92rem`, `1rem`, `1.2rem`, `1.35rem`, and document title clamp already have tokens and should use them.
- `0.85rem`, `0.9rem`, `0.98rem`, `1.02rem`, `1.04rem`, `1.05rem`, `1.1rem`, `1.12rem`, `1.125rem`, `1.3rem`, `1.4rem`, `1.5rem`, `1.6rem`, `1.65rem`, `2rem` need either mapping to existing tokens or explicit new semantic tokens.
- Editor/content typography must be reviewed separately from UI typography, but still needs a defined content scale.

### Font Weight

| Value | Count | Token status |
| --- | ---: | --- |
| `560` | 2 | token exists as `--nx-font-weight-regular`, but raw usage remains |
| `650` | 9 | token exists as `--nx-font-weight-medium`, but raw usage remains |
| `700` | 13 | token exists as `--nx-font-weight-label`, but raw usage remains |
| `720` | 6 | no token |
| `740` | 9 | no token |
| `750` | 3 | no token |
| `760` | 12 | token exists as `--nx-font-weight-strong`, but raw usage remains |
| `780` | 7 | token exists as `--nx-font-weight-heading`, but raw usage remains |
| `800` | 2 | no token |
| `850` | 1 | no token |
| `var(--nx-font-weight-heading)` | 1 | token usage |

Required correction:

- Replace raw `560`, `650`, `700`, `760`, `780` with existing tokens.
- Decide if `720`, `740`, `750`, `800`, `850` are needed. Current evidence suggests most should collapse to existing tokens.
- Do not keep both `740` and `750` unless there is a documented visual role.

### Line Height

| Value | Count | Token status |
| --- | ---: | --- |
| `1` | 2 | likely icon/compact exception |
| `1.1` | 1 | no token |
| `1.15` | 5 | token exists as `--nx-line-height-tight` |
| `1.2` | 2 | no token |
| `1.25` | 1 | token exists as `--nx-line-height-heading` |
| `1.35` | 2 | no token |
| `1.4` | 1 | no token |
| `1.45` | 4 | token exists as `--nx-line-height-compact` |
| `1.55` | 2 | no token |
| `1.65` | 2 | token exists as `--nx-line-height-body` |
| `1.7` | 4 | no token |
| `1.75` | 4 | token exists as `--nx-line-height-reading` |
| `inherit` | 2 | acceptable context-dependent |
| `var(--nx-line-height-tight)` | 1 | token usage |

Required correction:

- Replace exact matches with existing tokens.
- Decide whether `1.7` should collapse to `1.75` or whether editor/content needs its own token.
- Decide whether modal/body copy `1.55` should become a token or collapse to `1.65`.

## Spacing Literals Outside The Current Space Scale

These values are not `--nx-space-*` and are not obvious zero/full-size layout values.

| Property | Value | Count | Example |
| --- | --- | ---: | --- |
| `gap` | `0.1rem` | 2 | `src/styles/components/_notes.scss:111` |
| `gap` | `0.15rem` | 7 | `src/styles/components/_custom-select.scss:67` |
| `gap` | `0.18rem` | 3 | `src/styles/components/_editor.scss:154` |
| `gap` | `0.38rem` | 1 | `src/styles/components/_chips.scss:51` |
| `gap` | `0.45rem` | 1 | `src/styles/pages/_note.scss:499` |
| `gap` | `0.55rem` | 1 | `src/styles/pages/_note.scss:29` |
| `gap` | `0.875rem` | 1 | `src/styles/components/_loading.scss:12` |
| `gap` | `10px` | 1 | `src/styles/pages/_note.scss:283` |
| `padding` | `0.08rem` | 1 | `src/styles/components/_color-picker.scss:127` |
| `padding` | `0.12rem 0.34rem` | 1 | `src/styles/pages/_note.scss:460` |
| `padding` | `0.12rem 0.36rem` | 1 | `src/styles/components/_editor.scss:319` |
| `padding` | `0.18rem` | 1 | `src/styles/components/_filters.scss:96` |
| `padding` | `0.18rem 0.48rem` | 1 | `src/styles/components/_search.scss:31` |
| `padding` | `0.2rem 0.65rem` | 2 | `src/styles/components/_chips.scss:15` |
| `padding` | `0.42rem 0.58rem` | 2 | `src/styles/components/_editor.scss:161` |
| `padding` | `2rem` | 1 | `src/styles/pages/_note.scss:142` |
| `padding-left` | `1.9rem` | 1 | `src/styles/components/_notes.scss:239` |
| `margin-top` | `0.12rem` | 1 | `src/styles/components/_notes.scss:401` |
| `margin-left` | `0.24em` | 1 | `src/styles/pages/_note.scss:329` |
| `margin-left` | `0.48rem` | 1 | `src/styles/components/_notes.scss:290` |
| `top` | `0.55rem` | 1 | `src/styles/pages/_dashboard.scss:122` |
| `right` | `0.55rem` | 1 | `src/styles/pages/_dashboard.scss:123` |
| `top` | `calc(100% + 0.42rem)` | 1 | `src/styles/layout/_window-titlebar.scss:51` |
| `top` | `calc(100% + 0.45rem)` | 1 | `src/styles/components/_editor.scss:150` |
| `right` | `-0.12rem` | 1 | `src/styles/components/_color-picker.scss:120` |
| `bottom` | `-0.12rem` | 1 | `src/styles/components/_color-picker.scss:121` |
| `right` | `-0.45rem` | 1 | `src/styles/pages/_note-detail.scss:209` |
| `bottom` | `-0.45rem` | 1 | `src/styles/pages/_note-detail.scss:210` |
| `right` | `-1rem` | 1 | `src/styles/pages/_note.scss:244` |
| `left` | `calc(2rem * -1)` | 1 | `src/styles/pages/_note.scss:238` |
| `inset` | `0.65rem` | 1 | `src/styles/components/_thumbnail.scss:47` |
| `inset` | `1rem 0.55rem` | 1 | `src/styles/components/_thumbnail.scss:33` |

Interpretation:

- Some micro-values may be legitimate artwork or editor caret offsets.
- Many are UI spacing values and should collapse to `--nx-space-1` or `--nx-space-2`.
- Values such as `0.42rem`, `0.45rem`, `0.48rem`, `0.55rem`, `0.58rem`, `0.65rem` show the scale is not being enforced.

## Dimension / Control Size Values

### Repeated Control Heights

| Value | Count | Current status |
| --- | ---: | --- |
| `2.35rem` | 5 | token exists as compact control height |
| `2.4rem` | 4 | no token, very close to compact control |
| `2.45rem` | 3 | no token |
| `2.5rem` | 2 | no token, maps to `--nx-space-10` if spacing, but not control |
| `2.55rem` | 1 | no token |
| `2.65rem` | 6 total via height/min-height | no token, heavily used in entity/labels create inputs/actions |
| `2.75rem` | 9 total via height/min-height | token exists as standard control height |
| `3rem` | 3 | token exists as `--nx-space-11`, but used as control/search height |

Required correction:

- Decide if `2.65rem` deserves `--nx-control-height-comfortable` or should become `--nx-control-height`.
- Collapse `2.4rem`, `2.45rem`, `2.5rem`, `2.55rem` unless there is a documented component-specific reason.
- Replace direct `2.35rem`, `2.75rem`, `2.25rem` with existing semantic tokens.

### Icon / Small Size Values

| Value | Count | Example |
| --- | ---: | --- |
| `1rem` width | 9 | `src/styles/components/_chips.scss:76` |
| `1rem` height | 7 | `src/styles/components/_chips.scss:77` |
| `1.05rem` width/height | 6 total | `src/styles/components/_color-picker.scss:111` |
| `1.125rem` width/height | 4 total | `src/styles/base/_reset.scss:64` |
| `1.35rem` width/height | 4 total | `src/styles/layout/_window-titlebar.scss:25` |
| `1.45rem` width/height | 4 total | `src/styles/components/_notes.scss:108` |
| `1.75rem` width/height | 7 total | `src/styles/components/_editor.scss:78` |
| `1.8rem` width/height | 6 total | `src/styles/pages/_dashboard.scss:126` |
| `2rem` width/height | 5 total | `src/styles/pages/_note-detail.scss:282` |
| `2.25rem` width/height | 9 total | `src/styles/components/_buttons.scss:3` |
| `2.4rem` width/height | 4 total | `src/styles/layout/_topbar.scss:3` |
| `2.45rem` width/height | 2 total | `src/styles/components/_updater.scss:20` |
| `2.55rem` width | 1 | `src/styles/layout/_sidebar.scss:53` |
| `2.6rem` width | 1 | `src/styles/components/_search.scss:71` |
| `2.75rem` width/height | 9 total | `src/styles/pages/_note.scss:20` |
| `2.875rem` width | 1 | `src/styles/layout/_window-titlebar.scss:40` |
| `2.9rem` width | 1 | `src/styles/pages/_note-detail.scss:239` |
| `3rem` width | 2 | `src/styles/pages/_dashboard.scss:151` |
| `3.25rem` width | 1 | `src/styles/layout/_sidebar.scss:85` |
| `3.35rem` width/height | 2 total | `src/styles/components/_badges.scss:7` |
| `3.5rem` width/height | 2 total | `src/styles/pages/_profile.scss:85` |
| `3.7rem` width/height | 2 total | `src/styles/components/_thumbnail.scss:3` |
| `5rem` width/height | 2 total | `src/styles/pages/_note-detail.scss:202` |
| `8.5rem` width/height | 2 total | `src/styles/pages/_profile.scss:71` |

Required correction:

- Define icon size tokens or semantic component tokens for: icon, icon-lg, icon-button, badge, thumbnail, avatar.
- Do not keep arbitrary neighboring sizes without role names.
- Some values can remain component-intrinsic, but must be documented.

### Layout Widths / Max Widths

Observed examples:

- `min(100%, 58rem)` in Legal and NoteDetail reading layouts
- `min(100%, 78rem)` in NoteDetail
- `min(100%, 88rem)` in Note page
- `min(100%, var(--nx-content-max))` in page/topbar
- modal widths: `26rem`, `32rem`, `43rem`, `68rem`
- menu widths: `13rem`, `17rem`, `18rem`, `22rem`, `28rem`
- note/tag limits: `9rem`, `11rem`, `clamp(14rem, 32vw, 34rem)`, `min(48%, 30rem)`

Required correction:

- Keep document/content widths as semantic tokens.
- Create modal width tokens if modal widths remain repeated.
- Create menu/popover width tokens and stop using raw `13rem`, `17rem`, `18rem`, `22rem`, `28rem` directly.

## Radius Values Found

| Value | Count | Status |
| --- | ---: | --- |
| `var(--nx-radius-sm)` | 50 | token |
| `var(--nx-radius-md)` | 25 | token |
| `999px` | 17 | should use `--nx-radius-pill` |
| `var(--nx-radius-card)` | 9 | token |
| `inherit` | 9 | acceptable contextual |
| `0.28rem` | 10 | no token, close to `--nx-radius-sm` |
| `0.32rem` | 7 | no token |
| `0.31rem` | 3 | no token |
| `0.23rem` | 3 | no token |
| `0.13rem` | 2 | no token |
| `0.22rem` | 2 | no token |
| `0.25rem` | 2 | token value, but raw |
| `0.35rem` | 2 | no token |
| `0.37rem` | 2 | token value, but raw |
| `0.18rem` | 1 | no token |
| `0.3rem` | 1 | no token |
| `0.43rem` | 1 | no token |
| `var(--nx-radius-lg)` | 1 | token |
| `var(--nx-radius-sm) 0 0 var(--nx-radius-sm)` | 1 | acceptable composed token |
| `0 var(--nx-radius-sm) var(--nx-radius-sm) 0` | 1 | acceptable composed token |

Required correction:

- Replace `999px` with `var(--nx-radius-pill)`.
- Replace raw token-equivalent values (`0.25rem`, `0.37rem`) with tokens.
- Collapse `0.28rem`, `0.31rem`, `0.32rem`, `0.35rem`, `0.43rem` to existing tokens unless a component-specific radius token is introduced.
- Tiny radii like `0.13rem`, `0.18rem`, `0.22rem`, `0.23rem` need explicit review; many look like local micro-styling.

## Z-Index Values Found

| Value | Count | Example |
| --- | ---: | --- |
| `1` | 4 | `src/styles/components/_chips.scss:19` |
| `2` | 3 | `src/styles/components/_entity.scss:173` |
| `15` | 1 | `src/styles/layout/_sidebar.scss:316` |
| `20` | 2 | `src/styles/components/_notes.scss:267` |
| `25` | 1 | `src/styles/components/_filters.scss:217` |
| `30` | 2 | `src/styles/components/_filters.scss:3` |
| `40` | 1 | `src/styles/pages/_note.scss:19` |
| `45` | 2 | `src/styles/components/_search.scss:42` |
| `50` | 2 | `src/styles/components/_chips.scss:28` |
| `60` | 2 | `src/styles/components/_notes.scss:317` |
| `65` | 2 | `src/styles/components/_editor.scss:29` |
| `70` | 1 | `src/styles/pages/_note-detail.scss:78` |
| `75` | 2 | `src/styles/components/_filters.scss:137` |
| `80` | 5 | `src/styles/components/_color-picker.scss:61` |
| `85` | 2 | `src/styles/components/_entity.scss:71` |
| `90` | 2 | `src/styles/components/_menus.scss:11` |
| `95` | 2 | `src/styles/components/_editor.scss:170` |
| `100` | 1 | `src/styles/components/_toast.scss:7` |
| `110` | 1 | `src/styles/components/_menus.scss:60` |
| `120` | 3 | `src/styles/components/_menus.scss:66` |
| `130` | 1 | `src/styles/layout/_window-titlebar.scss:53` |
| `#{25 - $index}` | 1 | `src/styles/components/_notes.scss:311` |

Required correction:

- Replace raw layer values with z-index helper/map usage.
- Values `25`, `45`, `75`, `85`, `95`, `100` do not cleanly map to current names and need either new names or collapse.
- Dynamic `#{25 - $index}` is intentional stacking logic for tag chain; keep or document.

## Breakpoints Found

Raw media query values still appear:

- `1180px` in `src/styles/responsive/_responsive.scss`
- `900px` in `src/styles/layout/_app-frame.scss`, `src/styles/layout/_sidebar.scss`, `src/styles/layout/_topbar.scss`, `src/styles/responsive/_responsive.scss`
- `680px` in `src/styles/layout/_topbar.scss`, `src/styles/pages/_note.scss`, `src/styles/responsive/_responsive.scss`
- `1020px` in `src/styles/pages/_note.scss`
- `42rem` in `src/styles/components/_modals.scss`

Tokens/helpers exist in `src/styles/abstracts/_breakpoints.scss`, but usage is inconsistent.

Required correction:

- Replace raw `900px`, `680px`, `1180px` with `bp.down(...)` where owner files already use `@use "../abstracts/breakpoints" as bp;`.
- Decide whether `1020px` is `tablet-wide` or `note-document-collapse`.
- Decide whether `42rem` becomes `modal-stack` or maps to `mobile`.
- Do not alter responsive behavior during conversion.

## Colors / Theme Values

Expected token-owned files:

- `src/styles/abstracts/_variables.scss`
- `src/styles/themes/_dark.scss`
- `src/styles/themes/_light.scss`
- `src/styles/components/_thumbnail.scss` for artwork-like thumbnails, if documented as artwork.

Problematic raw UI color examples:

| Value / Pattern | Example |
| --- | --- |
| `#fff` | `src/styles/components/_entity.scss:161`, `src/styles/components/_labels.scss:42`, `src/styles/layout/_sidebar.scss:47`, `src/styles/layout/_topbar.scss:12`, `src/styles/pages/_profile.scss:79` |
| `rgba(0, 0, 0, 0.48)` modal backdrop | `src/styles/components/_modals.scss:6` |
| `rgba(0, 0, 0, 0.56)` mobile sidebar backdrop | `src/styles/layout/_sidebar.scss:315` |
| chip hardcoded light mixes `#f4f5f7`, `#101216`, rgba borders | `src/styles/components/_chips.scss` |
| brand/sidebar gradients with raw colors | `src/styles/layout/_sidebar.scss:46`, `src/styles/layout/_topbar.scss:10` |
| profile avatar gradient | `src/styles/pages/_profile.scss:77` |

Likely artwork exceptions:

- thumbnail gradients in `src/styles/components/_thumbnail.scss`
- intrinsic image/card artwork colors

Required correction:

- Replace UI `#fff` with `var(--nx-color-text-inverse)`.
- Use `var(--nx-color-backdrop)` / `var(--nx-color-overlay)` where applicable.
- Decide whether chip mixes use theme chip tokens or remain palette-derived.
- Document thumbnail colors as artwork if they stay hardcoded.

## File Hotspots

### Highest Priority UI Token Cleanup

These are not necessarily the largest files, but they are reusable owners and should be corrected before more migrations:

- `src/styles/components/_entity.scss`
  - hardcoded font weights `750`, `740`
  - hardcoded `2.65rem`, `2.35rem`
  - hardcoded `#fff`
  - raw z-index `85`, `1`, `2`

- `src/styles/pages/_tags.scss`
  - hardcoded `0.86rem`, `740`
  - hardcoded favorite picker z-index `80`
  - `2.45rem`, `2.4rem`, `2.65rem`

- `src/styles/pages/_profile.scss`
  - hardcoded `1.2rem`, `2rem`, `0.9rem`, `0.86rem`, `0.88rem`, `0.78rem`
  - hardcoded weights `760`, `780`, `650`, `720`
  - hardcoded avatar sizes `8.5rem`, `3.5rem`
  - hardcoded `#fff`

- `src/styles/components/_buttons.scss`
  - `2.25rem` should use icon button token
  - `2.55rem` needs control token decision
  - `740` should map to token or be removed

- `src/styles/components/_chips.scss`
  - `1.85rem`, `0.2rem 0.65rem`, `0.31rem`, `0.86rem`, `650`
  - hardcoded chip color mixes and rgba borders

- `src/styles/components/_filters.scss`
  - many control sizes and z-index values
  - repeated picker/menu patterns that should share tokens with Tags/ColorPicker/CustomSelect

- `src/styles/components/_modals.scss`
  - raw modal widths, line heights, backdrop color, breakpoint `42rem`

- `src/styles/layout/_sidebar.scss`, `src/styles/layout/_topbar.scss`, `src/styles/layout/_window-titlebar.scss`
  - raw sizes, raw z-index, raw gradients, raw brand colors

### Editor / Content Cleanup Needs Separate Pass

These files contain many values but should not be bulk-normalized with UI tokens:

- `src/styles/pages/_note.scss`
- `src/styles/pages/_note-detail.scss`
- `src/styles/components/_editor.scss`

Reason:

- editor/content typography and ProseMirror layout need their own scale;
- `30px`, em-based sizing, image width loops, block handles and content offsets may be runtime/editor-specific;
- this area is high-risk and already has a separate migration plan.

Still, these values must be audited later. They should not remain ungoverned.

## Classification Rules For Remediation

Every literal value should be classified as one of:

1. Token equivalent exists
   - Replace immediately with token.
   - Example: `0.88rem` -> `var(--nx-font-size-description)`.

2. Repeated value with clear semantic role
   - Add semantic token first, then replace.
   - Example: repeated `2.65rem` create/input/action height may become a comfortable control token.

3. Component intrinsic value
   - Keep local, but document in owner.
   - Example: thumbnail dimensions or avatar size.

4. Artwork value
   - Keep hardcoded only in artwork owner and document it.
   - Example: thumbnail gradients.

5. Contextual offset
   - Keep only when tied to a specific geometry interaction.
   - Example: a picker arrow offset or drag handle overlap.

6. Editor/content runtime value
   - Defer to NoteDetail/editor migration and document.

## Recommended Remediation Order

Do not continue Phase 5 until this pass is done for already-touched owners.

1. Replace exact token equivalents in non-editor UI files.
   - typography tokens
   - radius tokens
   - control height/icon button tokens
   - z-index map/helper where obvious
   - `#fff` -> text inverse token

2. Normalize Tags/Collections/Profile/Button/PopularTags first.
   - These were touched in Phase 4 and should be corrected before moving on.

3. Normalize shell owners.
   - Topbar/sidebar/window-titlebar still contain raw sizes, colors, breakpoints and z-index.

4. Normalize shared components.
   - chips, filters, modals, custom-select, color-picker, menus.

5. Only then continue Notes list/grid.
   - Otherwise Phase 5 will duplicate the same hardcoded-value problem.

6. Editor/content values stay for the dedicated editor phase.
   - But the report must track them as known debt, not ignore them.

## Proposed Token Decisions To Close

These decisions are needed before remediation can be clean:

### Typography

- Decide whether `720`, `740`, `750` collapse to `700`/`760` or get a new token.
- Decide whether `800`/`850` are allowed for brand/logo only.
- Decide UI title scale above section title:
  - `1.05rem`
  - `1.125rem`
  - `1.5rem`
  - `1.65rem`
  - `2rem`

### Controls

- Decide fate of `2.65rem`:
  - new semantic token, or
  - collapse to `--nx-control-height`.
- Decide whether `2.4rem` / `2.45rem` are compact picker/menu row values or should collapse.
- Decide whether `2.55rem` danger/action button should collapse.

### Radius

- Decide whether raw `0.28rem`, `0.31rem`, `0.32rem`, `0.35rem` all collapse to existing radius tokens.
- Decide whether tiny radii `0.13rem`, `0.18rem`, `0.22rem`, `0.23rem` are editor/content exceptions.

### Z-Index

- Map current raw values to named layers.
- Add missing names only if a real layer exists.
- Do not keep arbitrary intermediate numbers.

### Colors

- Replace inverse text hardcodes.
- Use overlay/backdrop tokens.
- Decide chip color token strategy.
- Document artwork exceptions.

## Gate Before Continuing CSS Refactor

Before starting Phase 5:

- hardcoded typography in non-editor owners should be tokenized;
- hardcoded control heights in Tags/Collections/Profile/shared controls should be tokenized;
- radius raw values in non-editor shared components should be tokenized or documented;
- z-index raw values in shell/entity/shared menus should be mapped;
- `#fff` UI usage should be replaced with theme token;
- remaining hardcoded values should have an explicit classification.

## Definition Of Done For Remediation

This audit is complete when:

- every non-editor UI `font-size`, `font-weight`, `line-height` uses an existing token or has an approved new token;
- every non-editor UI spacing/control size uses a space/control/component token or is documented as intrinsic/contextual;
- every non-editor UI radius uses a radius token or is documented;
- every raw z-index maps to the z-index system or is documented dynamic stacking;
- raw color values only remain in theme/token/artwork files or documented contextual exceptions;
- `npm run check:styles` and `npm run build` pass after each batch.
