# Functions And Mixins Audit

## Estado

- Estado: Visto
- Data: 2026-06-05
- Ficheiros analisados:
  - `src/styles/abstracts/_functions.scss`
  - `src/styles/abstracts/_mixins.scss`
  - `src/styles/abstracts/_z-index.scss`
  - `src/styles/abstracts/_breakpoints.scss`
  - `src/styles/abstracts/_variables.scss`
  - `src/styles/themes/_index.scss`
  - restantes SCSS via pesquisa de `@include`, `@function`, focus, truncation, cards, hover e `z-index`

## Findings

- `_functions.scss` define:
  - `token($name)`
  - `color-token($name)`
  - `space($step)`
  - `radius($name)`
- `_mixins.scss` define:
  - `emit-css-vars($tokens)`
  - `focus-ring($color: var(--nx-color-accent))`
  - `icon-size($size)`
  - `media-down($width)`
- `_z-index.scss` define:
  - `z($name)`
- `_breakpoints.scss` define:
  - `breakpoint($name)`
- O unico mixin usado na app e `emit-css-vars()`, em `themes/_index.scss`.
- Foram encontrados apenas 3 `@include` reais, todos para emitir tokens:
  - `@include emit-css-vars($base-tokens)`
  - `@include emit-css-vars(dark.$theme)`
  - `@include emit-css-vars(light.$theme)`
- `focus-ring()`, `icon-size()` e `media-down()` nao estao a ser usados.
- `token()`, `color-token()`, `space()`, `radius()`, `z()` e `breakpoint()` nao estao a ser usados fora dos seus proprios ficheiros.
- `main.scss` faz `@use` de `functions`, `mixins`, `breakpoints` e `z-index`, mas isso nao disponibiliza esses helpers automaticamente dentro dos outros modules SCSS. Com Sass modules, cada ficheiro que quiser usar um helper precisa de fazer o seu proprio `@use`.
- A app usa diretamente CSS custom properties (`var(--nx-space-4)`, `var(--nx-color-border)`, etc.) em vez das functions Sass. Isto e consistente com runtime themes e nao e necessariamente um problema.
- As functions `space()` e `radius()` reduzem pouco ruido face a `var(--nx-space-4)` / `var(--nx-radius-card)`, mas acrescentam imports Sass a cada ficheiro. Sem validacao ou uma convencao forte, o beneficio e baixo.
- Existem 50 ocorrencias de `focus-visible` em SCSS.
- Existem muitos padroes manuais de focus:
  - `outline: none`
  - `outline: 2px solid color-mix(...)`
  - `outline-offset: 3px`
  - variacoes de intensidade entre `55%` e `64%`
- Existem 75 ocorrencias associadas a truncation:
  - `overflow: hidden`
  - `text-overflow: ellipsis`
  - `white-space: nowrap`
- Existem 126 ocorrencias associadas a cards/surfaces/hover patterns:
  - `border: 1px solid var(--nx-color-border)`
  - `border-radius: var(--nx-radius-card)`
  - `background: var(--nx-color-surface)`
  - `transition: ... transform ...`
  - `transform: translateY(-1px)`
- Existem 47 ocorrencias de `z-index:`. A app tem `$z-index` e `z($name)`, mas a maior parte dos valores continua hardcoded (`1`, `2`, `20`, `45`, `50`, `60`, `65`, `70`, `75`, `80`, `85`, `90`, `95`, `100`, `110`, `120`, `130`).
- O map `$z-index` atual so tem:
  - `sidebar`: `20`
  - `popover`: `50`
  - `modal`: `60`
  - `toast`: `100`
  Isto nao cobre a realidade atual da app.
- Ha repeticao clara entre `tag-card`, `collection-card`, `quick-pin-card`, `stat-card` e outros surfaces. No entanto, isto parece mais candidato a component primitives/classes do que a mixins genericos.
- `icon-size($size)` pode ser util, mas os usos atuais de `svg { width/height }` estao muito ligados a componentes especificos. Migrar isto agora teria pouco impacto.
- `media-down($width)` deve ser revisto em conjunto com o ponto 4. Neste momento aceita qualquer width e nao tira partido do map `$breakpoints`.

## Recomendacoes

- Manter `emit-css-vars()` como helper valido. E o unico helper atualmente usado e resolve bem a emissao de tokens/theme vars.
- Nao migrar a app inteira para `space()`, `radius()` e `color-token()` por agora. O estilo atual com `var(--nx-...)` e claro, funciona bem com themes runtime e evita imports Sass em todos os ficheiros.
- Decidir o destino de `_functions.scss`:
  - ou remover helpers nao usados numa fase futura,
  - ou manter apenas se forem expandidos com valor real, por exemplo validacao, fallback ou convencao muito clara.
- Melhorar `focus-ring()` antes de usar:

```scss
@mixin focus-ring($color: var(--nx-color-accent), $strength: 55%) {
  outline: 2px solid color-mix(in srgb, #{$color} #{$strength}, transparent);
  outline-offset: 3px;
}
```

- Depois migrar apenas os casos em que existe focus ring real. Nao usar o mixin para estados que fazem `outline: none` sem ring visivel.
- Criar um mixin pequeno para truncation pode valer a pena:

```scss
@mixin truncate-one-line {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- Para cards/surfaces, preferir component primitives em vez de mixins:
  - `.surface-card`
  - `.interactive-card`
  - `.list-surface`
  - `.card-link-overlay`
  Isto evita copiar CSS compilado por muitos selectors e torna o HTML/CSS mais legivel.
- Para hover lift, preferir token + primitive:
  - `--nx-interactive-lift: -1px`
  - `.interactive-card:hover { transform: translateY(var(--nx-interactive-lift)); }`
- Rever `$z-index` como parte de uma camada de stacking real:
  - `base`
  - `overlay`
  - `sticky`
  - `dropdown`
  - `toolbar`
  - `popover`
  - `modal`
  - `toast`
  - `titlebar`
  - `tooltip`
- So depois disso usar `z($name)`. Migrar para `z()` sem expandir o map primeiro nao resolve o problema.
- Atualizar `media-down()` depois da decisao do ponto 4, para aceitar nomes do map:

```scss
@mixin down($name) {
  @media (max-width: breakpoint($name)) {
    @content;
  }
}
```

- Evitar helpers demasiado genericos para tudo. O criterio deve ser:
  - ha repeticao real?
  - o helper reduz erro?
  - o nome descreve comportamento?
  - a migracao nao esconde estilos que precisam de continuar visiveis?

## Risco

- Medio.
- Criar mixins demais pode esconder CSS simples e dificultar debugging.
- Migrar cards/surfaces para mixins pode aumentar CSS compilado e manter a duplicacao invisivel. Para esses casos, primitives/classes parecem melhores.
- Migrar focus ring tem risco baixo a medio, porque pode alterar acessibilidade visual. Deve ser feito com validacao manual dos estados de teclado.
- Migrar z-index tem risco medio, porque a app tem varias camadas sobrepostas: sidebar, topbar, modals, popovers, editor toolbar, menus, toast e titlebar.

## Proxima Acao

- Avancar para `Audit/06_themes_audit.md`.
- Antes de implementar este ponto, decidir:
  - manter ou remover `_functions.scss`;
  - expandir `focus-ring()` e criar `truncate-one-line`;
  - tratar cards como component primitives em vez de mixins;
  - redesenhar `$z-index` antes de usar `z($name)`.
