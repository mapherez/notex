# Pages Styles Audit

## Estado

- Estado: Visto
- Data: 2026-06-05
- Ficheiros analisados:
  - `src/styles/pages/_dashboard.scss`
  - `src/styles/pages/_note-detail.scss`
  - `src/styles/pages/_note.scss`
  - `src/styles/pages/_profile.scss`
  - `src/styles/pages/_tags.scss`
  - `src/styles/components/_notes.scss`
  - `src/styles/components/_forms.scss`
  - `src/styles/components/_editor.scss`
  - `src/styles/responsive/_responsive.scss`
  - `src/pages/DashboardPage.tsx`
  - `src/pages/NoteDetailPage.tsx`
  - `src/pages/NotesListPage.tsx`
  - `src/pages/NotesListViewPage.tsx`
  - `src/pages/ProfilePage.tsx`
  - `src/pages/TagsPage.tsx`
  - `src/pages/LegalPage.tsx`

## Snapshot

| Ficheiro | Linhas | Seletores top-level | Cores refs | Tipografia refs | Media queries |
| --- | ---: | ---: | ---: | ---: | ---: |
| `_dashboard.scss` | 284 | 53 | 4 | 12 | 0 |
| `_note-detail.scss` | 609 | 125 | 8 | 24 | 0 |
| `_note.scss` | 675 | 157 | 1 | 19 | 2 |
| `_profile.scss` | 512 | 115 | 10 | 23 | 0 |
| `_tags.scss` | 268 | 51 | 2 | 8 | 0 |

## Findings

- A pasta `pages` tem cerca de 2.348 linhas de SCSS. O maior risco nao e so o tamanho; e a mistura de responsabilidades entre page layout, component primitives, editor primitives e styles globais.

- `_dashboard.scss` define primitives globais:
  - `.panel`, `.panel-title`, `.panel-header`
  - `.icon-badge`
  - base surface de `.note-card`, `.profile-card`, `.settings-card`
  - cor de `.tag-chip`, `.collection-chip`, `.notes-filter-dot` via `@each`

- Isto e uma dependencia errada porque `Panel.tsx`, `EmptyState.tsx`, `IconBadge.tsx`, `TagsPage`, `LegalPage`, `ProfilePage`, Collections e filtros dependem de styles definidos no ficheiro do dashboard.

- `.settings-card` esta particularmente fragmentado:
  - `_dashboard.scss` da border/radius/background.
  - `_profile.scss` da padding.
  - `LegalPage`, `TagsPage`, `NotesListPage` e `ProfilePage` usam a classe.
  - Resultado: um card generico depende de dois ficheiros de pagina sem isso estar explicito no nome.

- `_profile.scss` nao e so Profile. Tambem contem quase toda a pagina de Collections:
  - `.collections-page`
  - `.collections-layout`
  - `.collection-grid`
  - `.collection-card`
  - `.collection-create-card`
  - `.collection-action-button`
  - `.collection-preference-card`

- `_tags.scss` duplica quase a mesma estrutura da area Collections:
  - `tags-layout` e `collections-layout`
  - `tag-card` e `collection-card`
  - card overlay/focus/hover
  - create/edit forms
  - create action row
  - action buttons
  - disabled states
  - side panel width `minmax(19rem, 24rem)`

- Esta duplicacao e um bom candidato para primitives como `entity-layout`, `entity-grid`, `entity-card`, `entity-card-actions`, `entity-create-card`, ou componentes React/SCSS mais especificos para Tags/Collections.

- `_note.scss` mistura page layout com editor implementation:
  - `note-document-shell`, `note-toc`, `note-document-main`
  - block editor layout
  - inline ProseMirror styles
  - Tiptap toolbar/bubble toolbar
  - code/pre/table/task list styles
  - file node/image node/tip node styles
  - side panels

- Muitos seletores de `_note.scss` pertencem mais a `components/_editor.scss` ou a um futuro `components/_note-editor.scss` do que a `pages/_note.scss`: `.note-tiptap-editor`, `.note-tiptap-prosemirror`, `.note-inline-prosemirror`, `.note-file-card`, `.note-image-node`, `.note-tip-box`, `.note-bubble-toolbar`, `.note-tiptap-toolbar`.

- `_note-detail.scss` tambem mistura document page layout com primitives reutilizaveis:
  - `.meta-list`, `.meta-row`, `.meta-value`
  - `.side-list`, `.side-edit-form`, `.linked-row`, `.linked-row-shell`
  - `.tip-box`
  - `.usage-table`
  - `.thumbnail-picker`
  - `.note-link-picker`

- `ProfilePage` usa `.meta-list profile-stat-grid`, enquanto `.meta-list` esta definido em `_note-detail.scss`. Isto e outra dependencia cruzada clara.

- Ha styles de pagina fora de `pages`:
  - `_components/_notes.scss`: `.quick-capture`, `.capture-box`, `.capture-actions`, `.capture-tools`, `.submit-button`, `.tag-list`, `.activity-list`, `.tag-popular-row`, `.activity-row`. Estes sao usados no dashboard/tags, nao no componente `NoteRow`.
  - `_components/_forms.scss`: `.page-content`, `.page-title`, `.page-subtitle`, `.legal-page`, `.legal-card`, `.legal-copy`.

- `base/_typography.scss` ainda tem `.page-title`, mas o estilo real de `.page-title`/`.page-subtitle` vive em `_forms.scss`. Isto reforca o problema do ponto 3.

- Ha valores hardcoded ou tokens em falta:
  - `_note.scss:4` usa `--nx-space-7`, que nao existe em `_variables.scss`.
  - `_note.scss` tem `gap: 10px`, `min-height: 30px`, `padding: 2rem`.
  - content widths hardcoded: `58rem`, `78rem`, `88rem`.
  - side columns hardcoded: `20rem`, `22rem`, `minmax(19rem, 24rem)`, `minmax(20rem, 24.5rem)`.
  - muitos radius locais: `0.23rem`, `0.28rem`, `0.3rem`, `0.32rem`, `0.35rem`, `0.37rem`.

- Ha z-index locais em pages: dashboard quick-pin picker `45`, note toolbar `80`, document top `70`, thumbnail menu `30`, note toc `40`, note toolbar `60`, new note menu `50`, tag/collection card elevated state `85`, tag favorite menu `80`. Isto devia passar pelo plano de z-index do ponto 5/8.

- Ha hardcoded colors ainda justificaveis mas a rever:
  - `_profile.scss`: avatar gradient, plan card gradient, `#fff`.
  - `_dashboard.scss`: `#f4f5f7` e `#0d0f13` dentro de `.icon-badge`.
  - `_note-detail.scss`: shadows locais com `rgba(0,0,0,...)`.
  - `_tags.scss` e `_profile.scss`: action buttons com `#fff`.

- A responsividade esta fragmentada:
  - `_note.scss` tem media queries proprias em `1020px` e `680px`.
  - `_responsive.scss` tambem tem regras para note/detail/profile/tags/collections em `1180px`, `900px`, `680px`.
  - Isto torna mais dificil perceber se uma mudanca de layout vive perto da pagina ou no ficheiro global responsive.

- `_note.scss` e `_note-detail.scss` tem alguma higiene de formatacao a corrigir em futura passagem. Exemplos: indentacao desalinhada em `.note-toc`, `.note-toc-link`, `.note-block-body`, `.note-block-title`, `.note-tiptap-editor`, e `.document-title-input`.

- `.note-card` parece nao ter uso TSX atual. Esta apenas no selector base de `_dashboard.scss`. Deve ser validada antes de remover.

## Recomendacoes

- Nao comecar por `_note.scss`. E o ficheiro com mais superficie e mistura editor/layout. O risco e maior.

- Primeira migracao recomendada: extrair primitives globais que hoje vivem em pages:
  - `.panel`, `.panel-title`, `.panel-header`
  - `.icon-badge`
  - `.settings-card`, `.settings-title`, `.settings-description`
  - `.page-content`, `.page-title`, `.page-subtitle`
  - `.meta-list`, `.meta-row`, `.meta-value`

- Segunda migracao recomendada: separar Collections de `_profile.scss`. Criar um ficheiro de page proprio, por exemplo `pages/_collections.scss`, ou criar uma primitive comum com Tags.

- Terceira migracao recomendada: unificar Tags/Collections com uma primitive de entity cards/forms. Isto deve reduzir bastante repeticao sem mexer em comportamento.

- Quarta migracao recomendada: mover dashboard-only styles de `_components/_notes.scss` para `_dashboard.scss` ou para primitives corretas:
  - quick capture
  - activity list/row
  - popular tag row

- Quinta migracao recomendada: separar `_note.scss` em:
  - page/layout da nota
  - table of contents
  - block editor layout
  - Tiptap/ProseMirror content styles
  - node views/files/images/tip

- Criar tokens antes de migrar dimensoes muito repetidas:
  - card padding
  - side panel width min/max
  - document content max widths
  - row/action button heights
  - interactive lift amount
  - focus outline
  - z-index layers

- Corrigir `--nx-space-7` antes ou durante a primeira passagem de tokens, porque hoje e uma variable inexistente.

## Risco

- Medio/Alto. A parte Profile/Tags/Collections e relativamente segura se for feita por primitives pequenas. A parte Note/Editor e de maior risco porque envolve Tiptap, sticky layout, node views, drag/drop, responsive e side panels.

## Proxima Acao

- Seguir para o ponto 10: `src/styles/responsive`.
- Guardar a implementacao para depois do decision log, com prioridade em primitives globais e Tags/Collections antes de mexer no editor.
