# Breakpoints Audit

## Estado

- Estado: Visto
- Data: 2026-06-05
- Ficheiros analisados:
  - `src/styles/abstracts/_breakpoints.scss`
  - `src/styles/abstracts/_variables.scss`
  - `src/styles/abstracts/_mixins.scss`
  - `src/styles/responsive/_responsive.scss`
  - `src/styles/layout/_shell.scss`
  - `src/styles/pages/_dashboard.scss`
  - `src/styles/pages/_profile.scss`
  - `src/styles/pages/_note.scss`
  - `src/styles/pages/_note-detail.scss`
  - `src/styles/pages/_tags.scss`
  - restantes SCSS via pesquisa de `@media`, grids e widths

## Findings

- Existem tokens de breakpoint em `src/styles/abstracts/_variables.scss`:
  - `wide`: `1180px`
  - `tablet`: `900px`
  - `mobile`: `680px`
- `src/styles/abstracts/_breakpoints.scss` so expoe uma funcao `breakpoint($name)`.
- `src/styles/abstracts/_mixins.scss` tem um mixin `media-down($width)`.
- A funcao `breakpoint()` e o mixin `media-down()` nao estao a ser usados em ficheiros de pagina/componente.
- Foram encontradas 6 media queries responsive reais:
  - `@media (max-width: 1180px)` em `responsive/_responsive.scss`
  - `@media (max-width: 900px)` em `responsive/_responsive.scss`
  - `@media (max-width: 680px)` em `responsive/_responsive.scss`
  - `@media (max-width: 1020px)` em `pages/_note.scss`
  - `@media (max-width: 680px)` em `pages/_note.scss`
  - `@media (max-width: 42rem)` em `components/_modals.scss`
- Existe tambem `@media (prefers-reduced-motion: reduce)` em `components/_loading.scss`, que nao e um breakpoint de layout.
- Os breakpoints principais estao hardcoded nas media queries. Mesmo os valores que existem no map (`1180px`, `900px`, `680px`) nao usam `breakpoint()`.
- O breakpoint local `1020px` em `pages/_note.scss` nao existe no map.
- O breakpoint local `42rem` em `components/_modals.scss` e praticamente equivalente ao mobile (`42rem` costuma ser `672px`), mas usa unidade diferente de `680px`.
- Nao existem breakpoints explicitos para:
  - `1024px`
  - `1180px` como tablet-landscape nomeado
  - `1366px`
  - `FullHD` (`1920x1080`)
  - `1440p` (`2560x1440`)
  - `4K` (`3840x2160`)
- Neste audit, `1440p` deve ser entendido como a resolucao `2560x1440`, nao como `1440px` de largura.
- O valor `1180px` nao deve ser tratado como desktop real. E mais provavel que faca sentido como threshold interno de layout, por exemplo quando uma pagina deixa de ter espaco suficiente para duas colunas confortaveis.
- Se `1180px` continuar a existir, o nome deve comunicar comportamento (`compact-desktop`, `content-collapse`, `tablet-landscape`) em vez de sugerir um tamanho comum de desktop.
- O layout desktop tem uma protecao global razoavel atraves de:
  - `--nx-content-max: 92rem`
  - `--nx-page-gutter: clamp(1rem, 3vw, 2rem)`
  - wrappers com `width: min(100%, var(--nx-content-max))`
- Algumas paginas usam larguras proprias fora do token global:
  - `note`: `width: min(100%, 88rem)`
  - `note-detail`: `width: min(100%, 78rem)`
  - `document-shell.single-column`: `width: min(100%, 58rem)`
  - `form-shell`: `width: min(100%, 58rem)`
  Estas larguras podem fazer sentido por contexto, mas deviam ser tokens semanticos se forem intencionais.
- `responsive/_responsive.scss` tem 281 linhas e mistura responsabilidades de varias areas:
  - shell/sidebar/topbar
  - dashboard
  - profile
  - database management
  - collections/tags
  - notes list/grid
  - document heading/actions
  - updater banner
- O breakpoint `1180px` muda layouts de pagina para uma coluna:
  - `.dashboard-layout`
  - `.document-shell`
  - `.profile-layout`
  Mas o shell principal so muda a sidebar para overlay aos `900px`.
- Isto cria uma zona intermedia entre `901px` e `1180px` onde a sidebar continua fixa, mas varias paginas ja colapsam internamente. Esta zona pode ser util para tablet/desktop pequeno, mas devia ser assumida explicitamente.
- `stats-grid` tem comportamento nao monotono:
  - desktop: `repeat(5, minmax(0, 1fr))`
  - `max-width: 900px`: `1fr`
  - `max-width: 680px`: `repeat(2, minmax(0, 1fr))`
  Isto pode ser intencional, mas e estranho porque um viewport menor volta a ganhar mais colunas.
- Ha uso positivo de responsive grid nativo em alguns pontos:
  - `repeat(auto-fit, minmax(17rem, 1fr))` em tags/profile collection grid
  - `width: min(...)` em popovers, shell, forms e toasts
  - `clamp(...)` em gutter e alguns tamanhos de titulo
- A app esta relativamente protegida em desktop largo/4K por `content-max`, mas nao existe uma estrategia documentada para o que deve expandir e o que deve ficar contido.
- A readiness para tablet existe parcialmente, mas esta concentrada em dois thresholds (`1180px` e `900px`) e nao cobre explicitamente tablets comuns como `1024px`, `1180px` e `1366px`.

## Recomendacoes

- Transformar os breakpoints em tokens mais semanticos e preparados para desktop/tablet:

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

- Rever os nomes antes de implementar. O importante e que o nome descreva o comportamento, nao so o device.
- Questionar se `1180px` deve mesmo viver no map global. Pode fazer mais sentido como token especifico de layout, porque nao representa um tamanho de ecran comum.
- Mesma coisa para `laptop`, visto que hoje em dia praticamente não há laptops com essa resolução.
- Evitar criar `1440px` como breakpoint desktop. Quando falarmos em `1440p`, o alvo deve ser `2560px` de largura.
- Alterar `media-down($width)` para aceitar nomes do map, ou criar mixins claros:

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

- Depois migrar as media queries existentes para tokens:
  - `1180px` -> `compact-desktop` ou `tablet-landscape`
  - `900px` -> `tablet`
  - `680px` / `42rem` -> `mobile`
  - `1020px` -> `tablet-wide` ou um token especifico para document layout
- Definir tokens para larguras de conteudo se forem intencionais:
  - `content-max`: `92rem`
  - `content-max-note`: `88rem`
  - `content-max-document`: `78rem`
  - `content-max-reading`: `58rem`
- Separar gradualmente `responsive/_responsive.scss` por responsabilidade, ou pelo menos reorganizar por breakpoint com comentarios claros:
  - Shell/topbar/sidebar
  - Page layouts
  - Notes
  - Profile/database
  - Tags/collections
- Nao criar uma camada desktop/4K so para existir. Para 1440p/FullHD/4K, a primeira decisao deve ser:
  - quais areas ficam limitadas por `content-max`
  - quais areas podem ganhar colunas
  - quais areas nunca devem esticar por legibilidade
- Rever especificamente `stats-grid`, porque o salto de 1 coluna em tablet para 2 colunas em mobile pode causar UX inconsistente.
- Quando forem feitas alteracoes, validar pelo menos estes viewports:
  - `1024x768`
  - `1180x820`
  - `1366x768`
  - `1920x1080`
  - `2560x1440`
  - `3840x2160`

## Risco

- Medio.
- Os breakpoints tocam no shell, na sidebar, em grids de notas, profile, dashboard, tags/collections e modals.
- O maior risco e alterar thresholds globais e criar regressao visual em layouts que hoje dependem da zona intermedia `901px`-`1180px`.
- A migracao deve ser token-first e depois query-by-query, sem redesenhar layouts ao mesmo tempo.

## Proxima Acao

- Avancar para `Audit/05_functions_mixins_audit.md`.
- Antes de implementar breakpoints, decidir os nomes finais dos tokens e se `responsive/_responsive.scss` deve continuar centralizado ou ser dividido por area.
