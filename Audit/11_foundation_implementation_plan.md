# Foundation Implementation Plan

## Estado

- Estado: Visto
- Data: 2026-06-05
- Ficheiros analisados:
  - `Audit/02_variables_audit.md`
  - `Audit/03_typography_audit.md`
  - `Audit/04_breakpoints_audit.md`
  - `Audit/05_functions_mixins_audit.md`
  - `Audit/06_themes_audit.md`
  - `Audit/10_responsive_styles_audit.md`
  - `src/styles/abstracts/_variables.scss`
  - `src/styles/abstracts/_breakpoints.scss`
  - `src/styles/abstracts/_functions.scss`
  - `src/styles/abstracts/_mixins.scss`
  - `src/styles/abstracts/_z-index.scss`
  - `src/styles/base/_typography.scss`
  - `src/styles/base/_reset.scss`
  - `src/styles/themes/_dark.scss`
  - `src/styles/themes/_light.scss`
  - `src/styles/themes/_index.scss`
  - `src/styles/main.scss`

## Objetivo

- Criar uma base estavel antes das migrations de components/pages.
- Evitar mover CSS para primitives enquanto tokens, typography, z-index, breakpoints e theme vars ainda estao incompletos.
- Reduzir o risco de refazer trabalho quando comecarmos a extrair `.panel`, `.settings-card`, `.icon-button`, menus, rows e cards.

## Findings

- A estrutura base existe, mas esta subutilizada:
  - `$base-tokens`
  - `$breakpoints`
  - `$z-index`
  - `breakpoint($name)`
  - `z($name)`
  - `focus-ring()`
  - `media-down()`
  - `_typography.scss`

- O unico helper Sass realmente usado hoje e `emit-css-vars()`, em `themes/_index.scss`.

- A app usa bem CSS custom properties runtime (`var(--nx-...)`). Isto deve continuar. Nao vale a pena migrar tudo para Sass functions como `space()` ou `radius()` porque isso exige imports em todos os ficheiros e nao ajuda themes runtime.

- Existe pelo menos um token usado e nao definido:
  - `--nx-space-7`, usado em `src/styles/pages/_note.scss`.

- A escala de spacing tem buracos e formatacao inconsistente:
  - existe `space-1` a `space-6`
  - falta `space-7`
  - existe `space-8`
  - falta `space-9`
  - existe `space-10`, `space-11`, `space-12`, `space-13`

- A app precisa de tokens semanticos antes de extrair primitives:
  - card padding
  - compact card padding
  - section gap
  - row gap
  - control heights
  - icon button size
  - pill radius
  - interactive lift
  - content widths
  - focus outline

- Typography esta espalhada: 199 declaracoes tipograficas, enquanto `_typography.scss` so tem `.page-title { letter-spacing: 0; }`.

- Os theme maps dark/light estao consistentes, mas cobrem apenas surfaces/text/borders/input/chip/hover. Falta theme layer para:
  - inverse text
  - backdrop/overlay
  - chip base real
  - brand colors
  - shadows/elevation

- Accent/status/palette colors ainda vivem em `$base-tokens`. Isto e aceitavel agora, mas nao prepara bem futuros accents.

- O mapa de z-index nao cobre a app real. Existem valores hardcoded como `15`, `25`, `30`, `45`, `70`, `75`, `80`, `85`, `90`, `110`, `120`, `130`.

- Breakpoints existem como map, mas as media queries usam valores hardcoded. Tambem ha thresholds locais fora do map: `1020px` e `42rem`.

- A ordem atual de imports em `main.scss` faz sentido para a app atual, mas vai precisar de uma camada de primitives antes de pages quando comecarmos a extrair styles globais.

## Decisoes Recomendadas

- Manter CSS variables como API principal de styling.
- Usar Sass helpers apenas onde eles reduzem erro real:
  - `emit-css-vars()`
  - `z()`, depois de expandir o map
  - `down()`/`up()`, depois de expandir breakpoints
  - `focus-ring()` e `truncate-one-line()`, com uso seletivo

- Nao migrar a app inteira para `token()`, `space()` ou `radius()` nesta fase.

- Separar tokens em dois grupos mentais:
  - base/layout tokens emitidos em `:root`
  - theme tokens emitidos por `[data-theme]`

- Adiar `[data-accent]` ate haver decisao de UX para accents. Mas preparar os nomes para nao bloquear essa mudanca.

## Plano De Implementacao

### Fase 1 - Hygiene Sem Mudanca Visual

- Normalizar formatacao de `_variables.scss`.
- Corrigir o token ausente:
  - adicionar `"space-7": 1.75rem`, se queremos manter a escala atual;
  - ou substituir o uso atual por `space-8`, se esse gap nao fizer sentido.
- Recomendacao: adicionar `space-7`. O uso existe e o valor natural entre `space-6` e `space-8` e `1.75rem`.
- Nao adicionar `space-9` ainda, a menos que surja uso real.

### Fase 2 - Tokens Semanticos Base

Adicionar tokens em `$base-tokens` sem migrar tudo imediatamente:

```scss
"card-padding": var(--nx-space-5),
"card-padding-compact": var(--nx-space-4),
"section-gap": var(--nx-space-5),
"section-gap-compact": var(--nx-space-4),
"row-gap": var(--nx-space-4),
"control-height": 2.75rem,
"control-height-sm": 2.35rem,
"icon-button-size": 2.25rem,
"radius-pill": 999px,
"interactive-lift": -1px,
"content-max-reading": 58rem,
"content-max-document": 78rem,
"content-max-note": 88rem,
```

- Estes tokens devem entrar antes de extrair cards/rows/buttons.
- A migracao de uso deve ser gradual, por primitive ou pagina.

### Fase 3 - Typography Tokens E Primitives

Adicionar tokens tipograficos em `$base-tokens`:

```scss
"font-size-caption": 0.78rem,
"font-size-meta": 0.82rem,
"font-size-control": 0.86rem,
"font-size-description": 0.88rem,
"font-size-row": 0.92rem,
"font-size-body": 1rem,
"font-size-section-title": 1.2rem,
"font-size-modal-title": 1.35rem,
"font-size-page-title": clamp(1.65rem, 2.3vw, 2rem),
"font-size-document-title": clamp(1.8rem, 3vw, 2.25rem),
"font-weight-regular": 560,
"font-weight-medium": 650,
"font-weight-label": 700,
"font-weight-strong": 760,
"font-weight-heading": 780,
"line-height-tight": 1.15,
"line-height-heading": 1.25,
"line-height-compact": 1.45,
"line-height-body": 1.65,
"line-height-reading": 1.75,
"letter-spacing-label": 0.04em,
```

Mover para `base/_typography.scss`:

- `.page-title`
- `.page-subtitle`
- `.page-subtitle.empty`
- depois, quando primitives existirem, `.panel-title`/section title variants

Manter separado:

- UI typography
- document/editor content typography

### Fase 4 - Theme Tokens Minimos

Adicionar aos themes dark/light antes de migrar chips/overlays:

```scss
"color-text-inverse": #fff,
"color-backdrop": rgba(...),
"color-overlay": rgba(...),
"color-chip-bg": ...,
"color-chip-bg-hover": ...,
"color-chip-text": ...,
"color-chip-border": ...,
"color-brand-start": ...,
"color-brand-end": ...,
"shadow-popover": ...,
"shadow-floating": ...,
```

- `color-chip` e `color-chip-solid` ja existem, mas estao sem uso. Ou passam a ser usados, ou devem ser substituidos pelos nomes acima.
- Thumbnail/artwork colors podem continuar fora do theme se forem tratadas como asset/artwork, nao UI.
- Migrar `#fff` de UI para `var(--nx-color-text-inverse)`.
- Migrar backdrops hardcoded para `var(--nx-color-backdrop)`.

### Fase 5 - Z-Index Real

Expandir `$z-index` antes de usar `z()`:

```scss
$z-index: (
  "base": 0,
  "raised": 1,
  "content-overlay": 2,
  "backdrop": 15,
  "sidebar": 20,
  "dropdown": 30,
  "popover": 50,
  "editor-toolbar": 60,
  "sticky": 70,
  "floating": 80,
  "topbar": 90,
  "toast": 100,
  "account-menu": 110,
  "titlebar": 120,
  "tooltip": 130,
  "modal": 140,
);
```

- Valores finais podem mudar, mas os nomes devem cobrir as camadas reais.
- Migrar z-index por area, nao tudo de uma vez.
- Comecar por shell/topbar/sidebar/menus, porque sao os casos mais globais.

### Fase 6 - Breakpoints E Helpers

Atualizar `$breakpoints` com nomes semanticos:

```scss
$breakpoints: (
  "mobile": 680px,
  "tablet": 900px,
  "tablet-wide": 1024px,
  "content-collapse": 1180px,
  "laptop": 1366px,
  "desktop": 1920px,
  "desktop-1440p": 2560px,
  "desktop-4k": 3840px,
);
```

Atualizar helpers:

```scss
@mixin down($name) {
  @media (max-width: breakpoint($name)) {
    @content;
  }
}

@mixin up($name) {
  @media (min-width: breakpoint($name)) {
    @content;
  }
}
```

- Manter `media-down($width)` temporariamente se for preciso compatibilidade.
- Migrar media queries uma a uma.
- `1020px` deve virar `tablet-wide` ou token especifico `note-document-collapse`.
- `42rem` deve virar `mobile` ou `modal-stack`.

### Fase 7 - Import Order Para Primitives

Preparar `main.scss` para uma camada de primitives antes de pages:

```scss
@use "themes";
@use "base/reset";
@use "base/typography";
@use "layout/shell";
@use "components/primitives";
@use "components/...";
@use "pages/...";
@use "responsive/responsive";
```

Ou, se primitives forem separadas:

```scss
@use "components/buttons";
@use "components/surfaces";
@use "components/menus";
@use "components/page";
@use "components/meta";
```

- O ponto importante e que primitives globais sejam importadas antes de pages.
- Pages devem poder compor primitives, nao defini-las.

## Ordem Recomendada De Execucao

1. Corrigir `_variables.scss`: formatacao, `space-7`, tokens semanticos base.
2. Adicionar typography tokens e mover `.page-title`/`.page-subtitle` para `_typography.scss`.
3. Adicionar theme tokens minimos (`text-inverse`, backdrop, chip base, shadow/popover).
4. Expandir `$z-index` e migrar shell/menus primeiro.
5. Expandir `$breakpoints` e criar `down()`/`up()`, sem mudar layouts ainda.
6. So depois criar component primitives no ponto 12.

## Guardrails

- Nao alterar valores visuais em massa sem necessidade.
- Adicionar tokens primeiro, migrar usos depois.
- Cada migration deve ter uma area dona clara.
- Evitar criar mixins para tudo. Cards, rows e buttons devem ser primitives/classes, nao mixins genericos.
- Separar UI typography de editor/content typography.
- Nao resolver accents/themes completos agora. Preparar nomes, mas deixar a feature para uma decisao propria.

## Validacao Recomendada

- Build/typecheck apos primeiras mudancas SCSS.
- Validacao visual minima depois de cada fase:
  - Dashboard
  - Profile
  - Notes list em list/grid
  - Note detail/editor
  - Tags/Collections
  - Import/export modals
- Viewports a usar quando breakpoints forem tocados:
  - `1024x768`
  - `1180x820`
  - `1366x768`
  - `1920x1080`
  - `2560x1440`
  - `3840x2160`

## Risco

- Medio.
- Adicionar tokens sem migrar usos tem risco baixo.
- Typography e z-index tem risco medio por impacto visual e stacking.
- Breakpoints tem risco medio/alto em tablet, especialmente perto de `1024px`.
- Theme tokens tem risco medio se chips/overlays forem migrados sem validar contraste.

## Proxima Acao

- Seguir para o ponto 12: Component primitives plan.
- Esse ponto deve assumir que foundations existem ou vao existir primeiro, e nao deve voltar a inventar tokens locais para cards/buttons/rows.
