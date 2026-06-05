# Responsive Styles Audit

## Estado

- Estado: Visto
- Data: 2026-06-05
- Ficheiros analisados:
  - `src/styles/responsive/_responsive.scss`
  - `src/styles/abstracts/_breakpoints.scss`
  - `src/styles/abstracts/_mixins.scss`
  - `src/styles/abstracts/_variables.scss`
  - `src/styles/pages/_note.scss`
  - `src/styles/pages/_note-detail.scss`
  - `src/styles/pages/_dashboard.scss`
  - `src/styles/pages/_profile.scss`
  - `src/styles/pages/_tags.scss`
  - `src/styles/components/_notes.scss`
  - `src/styles/components/_filters.scss`
  - `src/styles/components/_modals.scss`
  - `src/styles/components/_labels.scss`
  - `src/styles/components/_updater.scss`
  - `src/styles/components/_loading.scss`
  - `Audit/04_breakpoints_audit.md`

## Snapshot

- `src/styles/responsive/_responsive.scss` tem 349 linhas fisicas.
- Media queries de layout encontradas:
  - `@media (max-width: 1180px)` em `_responsive.scss`
  - `@media (max-width: 900px)` em `_responsive.scss`
  - `@media (max-width: 680px)` em `_responsive.scss`
  - `@media (max-width: 1020px)` em `pages/_note.scss`
  - `@media (max-width: 680px)` em `pages/_note.scss`
  - `@media (max-width: 42rem)` em `components/_modals.scss`
- Media query nao-layout encontrada:
  - `@media (prefers-reduced-motion: reduce)` em `components/_loading.scss`
- Helpers existentes mas nao usados:
  - `breakpoint($name)` em `_breakpoints.scss`
  - `media-down($width)` em `_mixins.scss`
- Breakpoint tokens existentes em `_variables.scss`:
  - `wide`: `1180px`
  - `tablet`: `900px`
  - `mobile`: `680px`

## Findings

- `_responsive.scss` funciona como um ficheiro catch-all. Mistura shell/sidebar/topbar, dashboard, profile, database management, collections, tags, note list, note detail, labels e updater banner no mesmo ficheiro.

- As media queries usam valores hardcoded. Mesmo os valores que existem no map de breakpoints (`1180px`, `900px`, `680px`) nao usam `breakpoint()` nem `media-down()`.

- Existem breakpoints locais fora do map:
  - `1020px` para `.note-document-shell` em `_note.scss`
  - `42rem` para patch notes/shortcut modal em `_modals.scss`

- `42rem` e praticamente o mesmo threshold do mobile (`42rem` costuma ser `672px`, muito perto de `680px`). Devia usar o mesmo token ou ter um nome semantico de modal, se a diferenca for intencional.

- O breakpoint de nota em `1020px` merece atencao. A sidebar global so vira overlay aos `900px`, por isso em `1024px` a app ainda tem sidebar fixa mas a pagina de nota ainda nao colapsou. Em tablets 1024px isto pode deixar a area de conteudo demasiado apertada.

- `1180px` colapsa layouts de pagina (`dashboard-layout`, `document-shell`, `profile-layout`) antes do shell colapsar a sidebar (`900px`). Esta zona `901px`-`1180px` pode ser valida, mas deve ser tratada como uma decisao explicita de "content collapse", nao como desktop real.

- Ha regras responsive provavelmente antigas/sem uso real. Estes seletores aparecem no responsive mas nao apareceram em TSX/base styles:
  - `.note-edit-toolbar__actions-divider`
  - `.tags-action-row`
  - `.tags-edit-actions`
  - `.tag-summary-card`
  - `.tag-edit-row`
  - `.document-heading-row`
  - `.document-heading-side`

- Ha duplicacao forte nas regras de `note-row`:
  - base list row em `components/_notes.scss`
  - grid view em `components/_filters.scss`
  - mobile overrides em `responsive/_responsive.scss`
  - varias variantes repetidas: selectable, pinned, drag handle, grid mode, mobile mode

- `stats-grid` continua com comportamento nao monotono:
  - desktop: 5 colunas
  - `max-width: 900px`: 1 coluna
  - `max-width: 680px`: 2 colunas
  Isto pode ser intencional, mas visualmente e uma regra estranha para manter.

- Tags e Collections ja usam uma estrategia boa em alguns pontos:
  - `tag-grid`: `repeat(auto-fit, minmax(17rem, 1fr))`
  - `collection-grid`: `repeat(auto-fit, minmax(17rem, 1fr))`
  Mas `_responsive.scss` ainda forca ambos para `1fr` aos `900px`, o que pode ou nao ser necessario se o auto-fit ja resolver o problema.

- Existem outros grids fixos que podem precisar de token ou responsive proprio:
  - dashboard stats/quick pins: `repeat(5, minmax(0, 1fr))`
  - profile stats: `repeat(4, minmax(0, 1fr))`
  - database management: `repeat(3, minmax(0, 1fr))`
  - notes grid: `repeat(2, minmax(0, 1fr))`
  - color picker/editor controls: fixed columns, provavelmente correto por serem controles de formato fixo

- A app ja usa bons constraints em alguns sitios:
  - `--nx-content-max`
  - `--nx-page-gutter`
  - `width: min(...)`
  - `clamp(...)`
  - `repeat(auto-fit, minmax(...))`
  Estes devem ser preservados e usados mais consistentemente.

- `:root { --nx-page-gutter: 1rem; }` em `max-width: 680px` overrideia o token global. Isto e aceitavel, mas deve ficar documentado como regra mobile global, porque afeta todas as paginas.

- `_modals.scss` tem um bloco `@media (max-width: 42rem)` com indentacao desalinhada para `.patch-notes-modal__layout` e `.patch-notes-modal__versions`. Nao deve quebrar CSS, mas e ruido de manutencao.

- Desktop largo/4K esta protegido por `content-max`, mas nao ha regras explicitas para aproveitar 1440p/4K com mais colunas onde fizer sentido. Isto e aceitavel por agora; o principal e garantir que os layouts nao esticam demais.

## Recomendacoes

- Usar o plano de breakpoints do ponto 4 como base e transformar os valores atuais em nomes semanticos antes de mudar layout:
  - `680px` -> `mobile`
  - `900px` -> `tablet`
  - `1020px` -> `tablet-wide` ou `note-document-collapse`
  - `1180px` -> `content-collapse`
  - `42rem` -> `mobile` ou `modal-stack`

- Atualizar os helpers para aceitarem nomes do map, por exemplo `down("tablet")`, e migrar uma media query de cada vez. Evitar trocar todos os breakpoints e refatorar layout no mesmo passo.

- Decidir a organizacao responsive antes da implementacao:
  - opcao A: manter `_responsive.scss`, mas dividir por secoes claras (`shell`, `page layouts`, `notes`, `profile`, `tags/collections`, `modals`)
  - opcao B: mover regras para perto do dono (`_shell.scss`, `_notes.scss`, `_profile.scss`, `_tags.scss`, `_modals.scss`)
  A opcao B tende a escalar melhor depois das primitives existirem.

- Remover ou validar os seletores responsive aparentemente stale antes de migrar breakpoints. Isto e uma limpeza pequena e reduz ruido.

- Rever especificamente `note-document-shell` em 1024px. Como a sidebar ainda esta fixa ate `900px`, o breakpoint da nota devia talvez colapsar aos `1024px` ou depender de um token de content/container, nao apenas viewport.

- Rever `stats-grid`. Se a intencao e 2 colunas em mobile, provavelmente tambem pode ser 2 colunas em tablet pequeno em vez de 1 coluna aos `900px`.

- Centralizar as variantes de `note-row` antes de mexer muito nos breakpoints. Hoje a mesma row tem grids em tres ficheiros, o que torna regressao provavel.

- Manter `auto-fit/minmax` para Tags/Collections e avaliar se o override global para `1fr` aos `900px` ainda e necessario.

- Validar visualmente depois das migracoes nestes viewports:
  - `1024x768`
  - `1180x820`
  - `1366x768`
  - `1920x1080`
  - `2560x1440`
  - `3840x2160`

## Risco

- Medio.
- A remocao de regras stale e risco baixo se confirmada por pesquisa.
- A mudanca de breakpoints e risco medio/alto porque afeta shell, sidebar, notes list, profile, dashboard, tags/collections, modals e note editor.
- O maior risco pratico e a zona tablet/desktop pequeno, sobretudo `1024px`, porque a sidebar e os layouts internos colapsam em thresholds diferentes.

## Proxima Acao

- Seguir para o ponto 11: plano de component primitives.
- Antes de implementar responsive, fechar primeiro nomes de breakpoints e primitives de cards/rows/buttons, para evitar migrar regras que depois vao mudar de ficheiro outra vez.
