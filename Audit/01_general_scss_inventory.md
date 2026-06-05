# General SCSS Inventory

## Estado

- Estado: Visto
- Data: 2026-06-05
- Ficheiros analisados: 31 ficheiros em `src/styles`

## Scope

Este primeiro audit e apenas inventario geral. Nao decide ainda a nova arquitetura SCSS final; identifica onde existe hardcoding, repeticao e responsabilidade mal colocada para orientar os audits seguintes.

## Dados Recolhidos

### Ficheiros SCSS

Foram encontrados 31 ficheiros SCSS:

- `src/styles/abstracts`: 5 ficheiros
- `src/styles/base`: 2 ficheiros
- `src/styles/components`: 12 ficheiros
- `src/styles/layout`: 1 ficheiro
- `src/styles/pages`: 5 ficheiros
- `src/styles/responsive`: 1 ficheiro
- `src/styles/themes`: 3 ficheiros
- `src/styles/main.scss`

### Cores Hardcoded Fora De Variables/Themes

Padrao usado: `#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(`, excluindo `abstracts/_variables.scss` e `themes/*.scss`.

Total encontrado: 54 ocorrencias.

Por ficheiro:

- `components/_notes.scss`: 27
- `layout/_shell.scss`: 11
- `pages/_profile.scss`: 5
- `components/_labels.scss`: 3
- `pages/_dashboard.scss`: 2
- `pages/_note-detail.scss`: 2
- `components/_modals.scss`: 1
- `components/_updater.scss`: 1
- `pages/_tags.scss`: 1
- `responsive/_responsive.scss`: 1

Notas:

- Nem todas as cores hardcoded sao necessariamente erradas. Em `components/_notes.scss`, muitas fazem parte dos thumbnails gerados por CSS (`purple`, `paper`, `terminal`, etc.), que funcionam quase como mini-assets.
- `#fff`, `rgba(0, 0, 0, ...)`, overlays e bases de `color-mix` aparecem em varios ficheiros e devem ser revistos para tokens/theme quando forem UI estrutural.
- `pages/_dashboard.scss` ainda define `icon-badge` com `#f4f5f7` e `#0d0f13`; isto devia provavelmente depender de theme/token, especialmente se a app vai ganhar mais themes.

### Dimensoes Hardcoded

Padrao usado: valores `px`, `rem`, `em`, `vh`, `vw`.

Total encontrado: 705 ocorrencias.

Top ficheiros:

- `pages/_note.scss`: 83
- `layout/_shell.scss`: 74
- `pages/_note-detail.scss`: 70
- `components/_notes.scss`: 66
- `components/_filters.scss`: 59
- `components/_editor.scss`: 57
- `pages/_profile.scss`: 51
- `pages/_dashboard.scss`: 47
- `components/_modals.scss`: 35
- `components/_color-picker.scss`: 27
- `pages/_tags.scss`: 26
- `responsive/_responsive.scss`: 22

Notas:

- Alguns valores sao estruturais e podem continuar locais: widths de thumbnails, grid tracks especificas, alturas de inputs ou offsets muito contextuais.
- Mas ha repeticao clara de card padding, row gap, min-height de botoes, radius pequenos, focus offsets, font sizes compactos e widths de popovers.
- O objetivo nao deve ser eliminar todos os valores numericos, mas sim centralizar os valores que representam linguagem visual reutilizavel.

### Tipografia Espalhada

Padrao usado: `font-size`, `font-weight`, `line-height`, `letter-spacing`.

Total encontrado: 199 declaracoes.

Top ficheiros:

- `layout/_shell.scss`: 26
- `pages/_note-detail.scss`: 24
- `pages/_profile.scss`: 23
- `components/_editor.scss`: 19
- `components/_modals.scss`: 19
- `pages/_note.scss`: 19
- `components/_filters.scss`: 17
- `pages/_dashboard.scss`: 12
- `components/_notes.scss`: 12
- `pages/_tags.scss`: 8
- `components/_forms.scss`: 7

Problema principal:

- `src/styles/base/_typography.scss` tem apenas:

```scss
.page-title {
  letter-spacing: 0;
}
```

Isto confirma que a escala tipografica esta praticamente toda espalhada pelos ficheiros de pagina/componente.

### Uso De Abstracts

Ficheiros existentes:

- `abstracts/_variables.scss`: contem tokens base, palette colors, breakpoints e z-index.
- `abstracts/_functions.scss`: `token`, `color-token`, `space`, `radius`.
- `abstracts/_mixins.scss`: `emit-css-vars`, `focus-ring`, `icon-size`, `media-down`.
- `abstracts/_breakpoints.scss`: funcao `breakpoint`.

Uso atual:

- `emit-css-vars` e usado em `themes/_index.scss`.
- `focus-ring`, `icon-size`, `media-down`, `space`, `radius`, `breakpoint` nao aparecem a ser usados nos estilos da app.
- `main.scss` importa functions/mixins/breakpoints, mas isso nao significa que os ficheiros de pagina/componentes usem essas ferramentas.

### Repeticao De Primitives

Padroes repetidos encontrados:

- Card base: `border: 1px solid var(--nx-color-border)`, `border-radius: var(--nx-radius-card)`, `background: var(--nx-color-surface)`.
- Hover de card: `border-color`, `background`, `transform: translateY(-1px)`.
- Focus ring: `outline: 2px solid color-mix(...)`, `outline-offset: 3px`.
- Compact text: valores recorrentes como `0.78rem`, `0.82rem`, `0.86rem`, `0.88rem`, `0.92rem`.
- Section titles: `font-size: 1.2rem`, `font-weight: 760`.
- Button/control heights: `2.35rem`, `2.45rem`, `2.65rem`, `2.75rem`.

Exemplos:

- `pages/_dashboard.scss` define `.panel`, `.panel-title`, `.panel-header`, `.icon-badge`, `.profile-card`, `.settings-card`.
- `pages/_profile.scss` agora tem `profile-section`, mas mantem aliases para `settings-card/settings-title` usados por outras paginas.
- `components/_notes.scss` contem estilos de Dashboard (`quick-capture`, `activity-row`) e Tags (`tag-popular-row`), o que mistura responsabilidades.
- `pages/_note-detail.scss` define `.meta-list`, mas essa classe e usada tambem na Profile.

## Findings

- A app ja tem tokens, themes, functions e mixins, mas a maioria dos estilos ainda usa valores diretamente nos ficheiros finais.
- A maior fonte de risco nao e o hardcoding isolado; e a repeticao de padroes visuais com nomes diferentes.
- `_dashboard.scss` esta a funcionar como ficheiro de primitives globais, o que e uma responsabilidade errada para uma page stylesheet.
- `_typography.scss` esta praticamente vazio e nao representa a realidade tipografica da app.
- `_breakpoints.scss` existe, mas os breakpoints sao usados diretamente em `_responsive.scss` e em algumas paginas.
- Varias classes partilhadas vivem no ficheiro errado:
  - `.panel*` em `_dashboard.scss`
  - `.icon-badge` em `_dashboard.scss`
  - `.meta-list` em `_note-detail.scss`
  - `.quick-capture` e `.activity-row` em `_notes.scss`
  - `.tag-popular-row` em `_notes.scss`, apesar de tambem ser usado em Tags
- Existem muitos valores de layout que provavelmente devem virar tokens semanticos: card padding, section gap, row gap, compact font size, label font weight, control height, popover radius.

## Recomendacoes

- Criar primeiro uma camada de foundations antes de refatorar paginas:
  - typography scale
  - component/card spacing tokens
  - control sizing tokens
  - breakpoints tablet/desktop
  - focus/interactive-card mixins
- Mover primitives globais para componentes/base:
  - `components/_panel.scss`
  - `components/_badges.scss`
  - `components/_cards.scss`
  - possivelmente `components/_rows.scss`
- Evitar uma limpeza massiva num unico PR/turn. A ordem mais segura:
  1. Variables/foundations
  2. Typography
  3. Breakpoints/mixins
  4. Component primitives
  5. Page migrations
- Manter exceptions documentadas para hardcoded values que fazem sentido:
  - mini thumbnails/placeholder art
  - offsets muito contextuais
  - widths intrinsecos de componentes especificos

## Risco

- Risco: Medio

Motivo:

- Ha bastante repeticao, mas os estilos atuais funcionam.
- Refatorar sem criar primeiro tokens/primitives comuns pode causar regressao visual.
- O maior risco esta em mover selectors globais para novos ficheiros sem respeitar ordem de import em `main.scss`.

## Proxima Acao

- Avancar para `Audit/02_variables_audit.md`.
- Antes de mudar estilos, rever `abstracts/_variables.scss` e decidir quais tokens semanticos devem existir para card, rows, typography e controls.
