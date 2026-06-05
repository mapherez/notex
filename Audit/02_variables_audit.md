# Variables Audit

## Estado

- Estado: Visto
- Data: 2026-06-05
- Ficheiros analisados:
  - `src/styles/abstracts/_variables.scss`
  - `src/styles/abstracts/_functions.scss`
  - `src/styles/abstracts/_mixins.scss`
  - `src/styles/abstracts/_breakpoints.scss`
  - `src/styles/abstracts/_z-index.scss`
  - `src/styles/themes/_dark.scss`
  - `src/styles/themes/_light.scss`
  - usos de `var(--nx-...)` em `src/styles/**/*.scss`

## Scope

Este audit revê se `_variables.scss` tem tokens suficientes e bem organizados para suportar a limpeza geral da app. O foco nao e ainda alterar valores, mas identificar lacunas e prioridades.

## Inventario Atual

### Base Tokens

`_variables.scss` define:

- Fonte: `font-sans`
- Layout global: `sidebar-width`, `window-titlebar-height`, `topbar-height`, `content-max`, `page-gutter`
- Radius: `radius-sm`, `radius-md`, `radius-card`, `radius-lg`
- Shadow: `shadow-soft`
- Spacing: `space-1`, `space-2`, `space-3`, `space-4`, `space-5`, `space-6`, `space-8`, `space-10`, `space-11`, `space-12`, `space-13`
- Accent/status/palette colors: `color-accent`, `color-danger`, `color-warning`, `color-success`, `color-blue`, etc.

Tambem define:

- `$palette-colors`
- `$breakpoints`
- `$z-index`

### Theme Tokens

`_dark.scss` e `_light.scss` definem apenas tokens semanticos de surface/text:

- `color-canvas`
- `color-canvas-muted`
- `color-sidebar`
- `color-surface`
- `color-surface-elevated`
- `color-surface-subtle`
- `color-border`
- `color-border-strong`
- `color-text`
- `color-text-muted`
- `color-text-soft`
- `color-input`
- `color-chip`
- `color-chip-solid`
- `color-hover`

Nota importante: `color-chip` e `color-chip-solid` existem nos themes, mas nao foram encontrados usos de `var(--nx-color-chip)` ou `var(--nx-color-chip-solid)` nos SCSS.

## Dados Recolhidos

### Undefined Tokens

Comparando tokens usados com tokens definidos em variables/themes:

Tokens usados mas nao definidos globalmente:

- `space-7`
- `badge-hue`
- `chip-hue`
- `profile-row-gap`
- `profile-section-gap`
- `profile-section-padding`
- `tag-chain-step`
- `tag-hover-lift`

Classificacao:

- `space-7`: problema real. E usado em `src/styles/pages/_note.scss:4`, mas nao existe em `_variables.scss`.
- `badge-hue`, `chip-hue`, `tag-chain-step`, `tag-hover-lift`: custom properties locais de componente. Aceitavel, embora `badge/chip` possam virar primitives depois.
- `profile-row-gap`, `profile-section-gap`, `profile-section-padding`: custom properties locais criadas na limpeza inicial da Profile. Aceitavel temporariamente, mas estes conceitos provavelmente devem virar tokens globais se forem usados noutros cards/sections.

### Spacing Tokens

Os tokens de spacing sao muito usados, mas a escala tem buracos:

- Existe `space-1` a `space-6`
- Nao existe `space-7`
- Existe `space-8`
- Nao existe `space-9`
- Existe `space-10`, `space-11`, `space-12`, `space-13`

Isto nao e necessariamente errado, mas neste caso `space-7` ja esta a ser usado. A escala deve ser normalizada ou o uso deve ser corrigido.

Uso de spacing por ficheiro:

- `pages/_note-detail.scss`: 63
- `pages/_profile.scss`: 53
- `pages/_note.scss`: 51
- `components/_filters.scss`: 44
- `layout/_shell.scss`: 35
- `components/_modals.scss`: 31
- `pages/_tags.scss`: 27
- `pages/_dashboard.scss`: 22
- `components/_editor.scss`: 22
- `components/_notes.scss`: 14

### Radius Tokens

Radius tokens sao usados em quase toda a app:

- `radius-sm`
- `radius-md`
- `radius-card`
- `radius-lg`

Problema:

- Ainda existem muitos radius hardcoded fora da escala (`0.28rem`, `0.31rem`, `0.32rem`, `0.35rem`, `999px`, etc.).
- `999px` faz sentido para pills/circles, mas deveria existir um token semantico tipo `radius-pill` para consistencia.
- Falta um token semantico para control radius vs card radius. Hoje alguns controls usam `radius-sm`, outros usam valores diretos.

### Shadow Tokens

Existe apenas `shadow-soft`.

Uso por ficheiro:

- `layout/_shell.scss`: 2
- `pages/_note.scss`: 3
- `pages/_note-detail.scss`: 2
- `components/_filters.scss`: 3
- `components/_editor.scss`: 3
- varios componentes com 1 uso cada

Problema:

- Alguns box-shadows continuam hardcoded (`pages/_note-detail.scss`, `components/_color-picker.scss`, etc.).
- Uma unica shadow global nao cobre popovers, modals, elevated cards, hover/focus rings.

### Breakpoints

`_variables.scss` define:

- `wide`: `1180px`
- `tablet`: `900px`
- `mobile`: `680px`

Mas o uso atual e hardcoded:

- `responsive/_responsive.scss`: `1180px`, `900px`, `680px`
- `pages/_note.scss`: `1020px`, `680px`
- `components/_modals.scss`: `42rem`

`breakpoint($name)` e `media-down($width)` existem, mas nao sao usados nos ficheiros de app.

Problema:

- Os breakpoints existem como dados, mas nao governam realmente o responsive.
- Faltam nomes/valores pensados para desktop moderno e tablet, como foi definido no objetivo do audit:
  - FullHD
  - 1440p
  - 4K
  - tablet widths 1024/1180/1366

### Z-Index

`_variables.scss` define:

- `sidebar`: 20
- `popover`: 50
- `modal`: 60
- `toast`: 100

`_z-index.scss` define `z($name)`, mas nao ha uso real de `z(...)` nos estilos da app.

Foram encontradas 46 declaracoes CSS de `z-index:` fora do mapa.

Top ficheiros:

- `components/_notes.scss`: 9
- `components/_filters.scss`: 8
- `layout/_shell.scss`: 5
- `pages/_tags.scss`: 4
- `components/_editor.scss`: 3
- `pages/_note-detail.scss`: 3
- `pages/_note.scss`: 3
- `pages/_profile.scss`: 3

Problema:

- O mapa existe, mas a camada real de stacking esta espalhada.
- Os valores no mapa nao cobrem valores que aparecem na app (`15`, `25`, `30`, `45`, `65`, `70`, `75`, `80`, `85`, `90`, `95`, `110`, `120`, `130`).
- Isto aumenta risco de bugs de dropdown/modal/floating-menu quando novos overlays forem adicionados.

### Theme/Accent Readiness

Problema estrutural:

- Accent/status/palette colors vivem em `$base-tokens`, nao nos theme maps.
- Isto significa que dark/light mudam surfaces/text/borders, mas nao mudam accent palette.
- Para futuros accents/themes, isto pode limitar bastante a flexibilidade.

Exemplos:

- `color-accent`, `color-accent-strong`, `color-accent-soft` sao muito usados.
- `color-blue`, `color-green`, `color-amber`, etc. sao usados por badges/chips/status.
- Como estes tokens sao globais, qualquer tema novo herda a mesma palette a menos que overrides sejam adicionados manualmente.

## Findings

- `_variables.scss` ja tem uma base boa, mas ainda e uma escala tecnica, nao uma camada semantica de design system.
- Existe pelo menos um token usado e nao definido: `--nx-space-7`.
- Ha tokens existentes mas subutilizados ou nao usados:
  - `color-chip`
  - `color-chip-solid`
  - `$breakpoints`
  - `$z-index`
  - helpers `space()`, `radius()`, `breakpoint()`, `z()`
- Faltam tokens semanticos para os padroes que estao repetidos na app:
  - card padding
  - compact card padding
  - section gap
  - row gap
  - control height
  - control radius
  - icon button size
  - section title font
  - label/caption/body font sizes
  - focus outline
  - popover width/shadow/radius
  - pill radius
- Breakpoints e z-index estao definidos em maps, mas a app continua a usar valores hardcoded.
- A escala de spacing tem gaps e formatacao inconsistente em `space-11`, `space-12`, `space-13`.
- Themes estao preparados para surfaces/text, mas nao para accent variations.

## Recomendacoes

### Curto Prazo

- Corrigir `--nx-space-7`:
  - ou adicionar `"space-7": 1.75rem`
  - ou substituir o uso em `_note.scss` por um token existente.
- Normalizar a formatacao de `_variables.scss`.
- Adicionar tokens semanticos globais antes de migrar paginas:

```scss
"card-padding": var(--nx-space-5),
"card-padding-compact": var(--nx-space-4),
"section-gap": var(--nx-space-5),
"row-gap": var(--nx-space-4),
"control-height": 2.75rem,
"control-height-sm": 2.35rem,
"control-radius": var(--nx-radius-sm),
"radius-pill": 999px,
"interactive-lift": -1px,
```

Nota: valores exatos devem ser decididos no audit de variables/foundation antes de implementacao.

### Medio Prazo

- Mover `color-accent`, `color-accent-strong`, `color-accent-soft` para uma estrategia que permita themes/accent sets.
- Rever se status/palette colors devem continuar globais ou ser theme-aware.
- Criar tokens para tipografia no audit seguinte:
  - `font-size-caption`
  - `font-size-meta`
  - `font-size-body`
  - `font-size-section-title`
  - `font-weight-label`
  - `line-height-body`
- Expandir `$z-index` para cobrir layers reais:
  - base
  - overlay
  - sticky
  - dropdown
  - popover
  - editor-toolbar
  - modal
  - toast
  - titlebar
- Usar `z($name)` nos SCSS em vez de numeros soltos.

### Longo Prazo

- Fazer themes emitirem tambem tokens de accent quando houver suporte a novos accents.
- Substituir media queries hardcoded por mixins com nomes de breakpoint.
- Separar tokens de layout global de tokens de componente.

## Risco

- Risco: Medio

Motivo:

- Mudar variables afeta a app inteira.
- A cor/accent strategy precisa de decisao antes de alterar themes.
- Adicionar tokens e migrar gradualmente tem baixo risco; trocar valores existentes em massa tem risco alto.

## Proxima Acao

- Avancar para `Audit/03_typography_audit.md`.
- Antes de implementar qualquer refactor, decidir se `--nx-space-7` deve ser adicionado ou removido.
- No futuro, tratar variables como uma mudanca separada antes de migrar Dashboard/Profile/Notes.
