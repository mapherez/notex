# Notes List/Grid Migration Plan

## Estado

- Estado: Visto
- Data: 2026-06-05
- Ficheiros analisados:
  - `Audit/09_pages_styles_audit.md`
  - `Audit/10_responsive_styles_audit.md`
  - `Audit/11_foundation_implementation_plan.md`
  - `Audit/12_component_primitives_plan.md`
  - `Audit/14_entity_pages_migration_plan.md`
  - `src/styles/components/_notes.scss`
  - `src/styles/components/_filters.scss`
  - `src/styles/components/_sortable-tags.scss`
  - `src/styles/components/_custom-select.scss`
  - `src/styles/pages/_dashboard.scss`
  - `src/styles/pages/_profile.scss`
  - `src/styles/pages/_note-detail.scss`
  - `src/styles/pages/_note.scss`
  - `src/styles/layout/_shell.scss`
  - `src/styles/responsive/_responsive.scss`
  - `src/styles/main.scss`
  - `src/pages/NotesListViewPage.tsx`
  - `src/pages/DashboardPage.tsx`
  - `src/components/notes/NoteRow.tsx`
  - `src/components/ui/NotesFilterRow.tsx`
  - `src/components/ui/TagChip.tsx`
  - `src/components/ui/NoteThumbnail.tsx`
  - `src/components/ui/CustomSelect.tsx`
  - `src/components/ui/EmptyState.tsx`
  - `src/core/models/models.ts`
  - `src/config/settings.json`
  - ocorrencias TSX/SCSS de `note-row`, `note-list`, `notes-grid`, `notes-filter-*`, `bulk-*`, `tag-chip`, `collection-chip`, `note-thumb`, `notes-filter-dot`, `note-row-menu`

## Objetivo

- Separar a listagem de notas em owners claros: note row/list, grid layout, filters, bulk actions, chips, thumbnails e menus.
- Reduzir duplicacao entre list/grid/mobile sem mexer no editor.
- Preparar responsive tablet/desktop de notes list/grid sem depender de um catch-all global.
- Remover styles que vivem em ficheiros errados, especialmente dashboard-only styles dentro de `_notes.scss` e grid/menu styles dentro de `_filters.scss`.

## Findings

- O ownership TSX esta parcialmente claro:
  - `NotesListViewPage.tsx` controla filtros, bulk actions, pinned split lists, reorder pinned notes, trash confirm e composição da lista.
  - `NoteRow.tsx` controla a row/card de nota, thumbnails, collection chip, tag chain, pin/favorite/status, checkbox e menu.
  - `NotesFilterRow.tsx` controla filtros de sort/tag/collection/layout.
  - `TagChip.tsx` e `NoteThumbnail.tsx` ja sao primitives React.

- O ownership SCSS nao acompanha o TSX:
  - `_notes.scss` contem note list/row, thumbnails, tag chips, collection chips, note row tag chain, quick capture, activity list e popular tag rows.
  - `_filters.scss` contem notes filters, bulk actions, notes grid overrides, note row actions e a primitive global `.floating-menu`.
  - `_responsive.scss` contem mobile overrides de note row, notes grid, filters e bulk actions.
  - `_dashboard.scss` contem variantes de cor de `.tag-chip`, `.collection-chip` e `.notes-filter-dot`.
  - `_profile.scss` contem `.danger-action-button`, que e usado por `NotesListViewPage.tsx` no trash page.

- `NoteRow` e usado em pelo menos dois contextos:
  - `NotesListViewPage.tsx`, com list/grid e pinned/reorder/selection.
  - `DashboardPage.tsx`, para recent notes em list mode.
  Qualquer migration de `NoteRow` precisa validar dashboard tambem, mesmo que o dashboard migration seja ponto 17.

- A grid de notas vive em `_filters.scss`, apesar de nao ser filtro. `notes-grid` e layout da note list, logo deve viver junto de `note-list`/`note-row`.

- A variante grid depende de selectors contextuais `.notes-grid .note-row...`. O componente `NoteRow` tambem recebe `layout`, mas esse prop hoje so decide se o subtitle usa `.note-row__summary-preview` ou `.note-row__intro`. A estrutura visual grid/list fica controlada pelo container `.notes-grid`.

- A combinacao de estados da row esta repetida em varios sitios:
  - base list em `_notes.scss`
  - grid em `_filters.scss`
  - mobile em `_responsive.scss`
  - estados: `selectable`, `with-pin-indicator`, `with-drag-handle`, `is-dragging`
  - os mesmos grid-template-columns aparecem com pequenas variacoes.

- As classes modificadoras de `NoteRow` sao genericas (`selectable`, `with-pin-indicator`, `with-drag-handle`) e nao BEM/scoped. Funcionam porque estao sempre em `.note-row`, mas aumentam risco de colisao e tornam grep menos preciso. Um futuro rename para `note-row--selectable`, `note-row--with-pin-indicator`, etc. seria mais claro.

- `NoteRow` gera `note-row__drag-handle is-disabled`, mas o CSS atual trata principalmente `:disabled`; `is-disabled` parece redundante ou sem estilo proprio.

- `note-row__summary-preview.is-overflowing` existe em SCSS, mas nao apareceu uso TSX. Pode ser legacy de uma medicao de overflow anterior.

- `_filters.scss` tem selectors para `.notes-grid .note-row__summary-preview .markdown-preview`, mas `NoteRow` renderiza `InlineFormattedText`, nao `.markdown-preview`. Isto parece legacy.

- `.note-card` aparece no selector base de `_dashboard.scss`, mas nao apareceu uso TSX atual. Deve ser validada antes de remover.

- `notes-filter-dot` e usado por:
  - `NotesFilterRow`
  - `BulkTagCheckbox`
  - `CustomSelect`
  - variantes de cor definidas em `_dashboard.scss`
  O nome diz "notes filter", mas o uso real e um color dot genérico. Deve virar primitive, por exemplo `.color-dot`.

- `.tag-chip` e `.collection-chip` sao primitives globais, mas vivem em `_notes.scss` e recebem color variants de `_dashboard.scss`. Sao usados em NoteRow, Tags, Dashboard, LabelManager, SortableTagList e NoteDetail.

- `.note-thumb` e primitive global, mas vive em `_notes.scss`. E usado em NoteRow, Dashboard quick pins, SearchBox e NoteDetail thumbnail picker.

- `NoteThumbnail` renderiza sempre um `img` com asset vindo de `settings.json`. Os estilos de background antigos para `.note-thumb.purple`, `.paper`, `.terminal`, `.landscape`, `.book`, `.text` continuam no SCSS, mas `correct` e `wrong` nao têm estilos equivalentes. Como o asset e renderizado, estes backgrounds podem ser fallback/legacy; devem ser avaliados antes de remover ou simplificar.

- `_notes.scss` contem estilos que nao pertencem a notes list/grid:
  - `.quick-capture`
  - `.capture-box`
  - `.capture-actions`
  - `.capture-tools`
  - `.submit-button`
  - `.tag-list`
  - `.tag-popular-row`
  - `.activity-list`
  - `.activity-row`
  Estes sao dashboard/tags UI, nao NoteRow.

- `.floating-menu`, `.topbar-menu`, `.account-menu`, `.sidebar-new-menu` e `.note-row-menu` vivem em `_filters.scss`. Esta primitive global ja foi identificada no ponto 13; neste ponto importa apenas garantir que `note-row-menu` acompanha a migration de menus.

- Bulk actions vivem dentro de `NotesListViewPage.tsx` como componente local e em `_filters.scss` como CSS. A UI e suficientemente grande para justificar um componente próprio se a pagina continuar a crescer:
  - `BulkNoteActionsRow`
  - `BulkTagCheckbox`
  - classes `bulk-*`

- `NotesFilterRow` e um componente próprio, mas os styles vivem no mesmo ficheiro que bulk actions, grid e menus. Merece ficheiro proprio.

- `notes-filter-menu` e `bulk-tags-menu` repetem estrutura de popover searchable:
  - width `min(22rem, calc(100vw - gutter))`
  - border/radius/background/padding/shadow
  - option rows com `2.4rem`
  Pode usar uma menu/search-popover primitive depois de `floating-menu` e forms existirem.

- Ha z-index locais em note list/grid:
  - `.notes-filter-row`: `30`
  - `.bulk-note-actions-row`: `25`
  - `.notes-filter-menu`/`.bulk-tags-menu`: `75`
  - `.note-row:has(.note-row-menu)`: `85`
  - `.note-row-actions`: `80`
  - `.floating-menu`: `90`
  - `.note-row-menu`: `120`
  - chips/tag chain: `20`, `50`, `60`, generated `25 - index`
  Devem mapear para tokens de z-index antes da migration visual.

- Ha varios valores dimensionais locais:
  - note row columns `1.45rem`, `2rem`, `3.7rem`
  - note row min height `5.4rem`, grid card min height `11rem`
  - mobile note row `3rem`, `1.35rem`, `4.8rem`
  - chip heights `1.85rem`, collection chip max `11rem`, tag max `9rem`
  - filter controls `2.75rem`, `2.45rem`, `2.35rem`
  - popovers `22rem`, `15rem`, `18rem`
  - notes grid `repeat(2, minmax(0, 1fr))`

- Ha colors/hardcoded a rever:
  - chip borders/backgrounds/text usam `rgba(7, 8, 10, ...)`, `#f4f5f7`, `#101216`, `#f8f9fb`
  - thumbnail fallback/artwork tem varios hex/rgba
  - `.submit-button` usa `#fff`
  - esses valores devem ser tratados por chips/theme tokens ou mantidos explicitamente como artwork quando for thumbnail.

- Responsive de notes list/grid esta espalhado:
  - aos `900px`: filtros recebem flex sizing.
  - aos `680px`: row list muda columns, badges/chips/icon-button sao escondidos no list mode, grid passa a uma coluna e reativa badges/chips/icon-button.
  - mobile overrides repetem combinacoes de `selectable`, `with-pin-indicator` e `with-drag-handle`.

- O comportamento mobile atual diferencia list vs grid:
  - list mode esconde badges, tags e actions para compactar.
  - grid mode reexibe badges, tags e action button.
  Isto deve ser preservado se a migration mexer nas regras.

- O tag hover lift corrigido anteriormente vive na tag chain:
  - `--nx-tag-hover-lift`
  - pseudo-element em `.note-row__tag-chain-item::after`
  - `transform` no chip
  Este comportamento esta validado pelo utilizador e deve ser preservado.

## Target Structure Recomendada

### Components

- `src/styles/components/_note-list.scss`
  - `.note-list`
  - `.note-list-stack`
  - `.pin-list`
  - `.unpinned-list`
  - `.notes-grid`

- `src/styles/components/_note-row.scss`
  - `.note-row`
  - `.note-row__*`
  - note row state/modifier classes
  - list/grid row layout rules, se nao ficarem em `_note-list.scss`

- `src/styles/components/_note-filters.scss`
  - `.notes-filter-row`
  - `.notes-filter-control`
  - `.notes-filter-trigger`
  - `.notes-filter-menu`
  - `.notes-filter-search`
  - `.notes-filter-options`
  - `.notes-filter-clear`
  - `.notes-filter-toggle`
  - `.notes-filter-view-button`

- `src/styles/components/_bulk-actions.scss`
  - `.bulk-note-actions-row`
  - `.bulk-selection-*`
  - `.bulk-field`
  - `.bulk-tags-*`
  - `.bulk-clear-button`

- `src/styles/components/_chips.scss`
  - `.tag-chip`
  - `.tag-chip-link`
  - `.tag-remove`
  - `.collection-chip`
  - `.collection-chip--empty`
  - tag chain internals can stay in `_note-row.scss` if they are NoteRow-specific.

- `src/styles/components/_thumbnail.scss`
  - `.note-thumb`
  - image sizing
  - any asset fallback/variant styles that remain needed

- `src/styles/components/_color-dot.scss` or part of `_badges.scss`
  - `.color-dot`
  - color variants from `$palette-colors`
  - temporary alias `.notes-filter-dot` during migration

- `src/styles/components/_menus.scss`
  - `.floating-menu`
  - `.note-row-menu`
  - shared menu item styles

- `src/styles/components/_buttons.scss`
  - `.danger-action-button`
  - `.icon-button` and danger variant, per previous points

### TSX Components

- Keep:
  - `src/components/notes/NoteRow.tsx`
  - `src/components/ui/NotesFilterRow.tsx`
  - `src/components/ui/TagChip.tsx`
  - `src/components/ui/NoteThumbnail.tsx`

- Consider extracting:
  - `BulkNoteActionsRow` from `NotesListViewPage.tsx` to `src/components/notes/BulkNoteActionsRow.tsx` or `src/components/ui/BulkNoteActionsRow.tsx`
  - `BulkTagCheckbox` with it

- Consider renaming modifiers later:
  - `selectable` -> `note-row--selectable`
  - `with-pin-indicator` -> `note-row--with-pin-indicator`
  - `with-drag-handle` -> `note-row--with-drag-handle`
  - `is-dragging` -> `note-row--dragging`

## Ordem De Migracao Recomendada

### Fase 0 - Prerequisitos

- Aplicar foundations do ponto 11:
  - control heights
  - icon button size
  - row/card padding
  - z-index map
  - breakpoints nomeados
  - typography tokens
  - chip/theme tokens

- Aplicar primitives base do ponto 12/13:
  - buttons
  - menus
  - chips
  - thumbnail
  - page/surfaces

### Fase 1 - Extrair Primitives Sem Mudar Markup

- Mover `.tag-chip`, `.tag-chip-link`, `.tag-remove`, `.collection-chip` para `_chips.scss`.
- Mover color variants de `_dashboard.scss` para `_chips.scss` ou `_color-dot.scss`, conforme o caso.
- Mover `.note-thumb` para `_thumbnail.scss`.
- Mover `.floating-menu` e `.note-row-menu` para `_menus.scss`.
- Mover `.danger-action-button` para `_buttons.scss` ou action primitive.
- Manter aliases temporarios quando nomes forem alterados.

### Fase 2 - Separar Note List/Row De `_notes.scss` E `_filters.scss`

- Criar `_note-list.scss` e `_note-row.scss`.
- Mover de `_notes.scss`:
  - `.note-list`
  - `.note-list-stack`
  - `.pin-list`
  - `.unpinned-list`
  - `.note-row`
  - `.note-row__*`
  - `.note-row__tag-chain*`
- Mover de `_filters.scss`:
  - `.notes-grid`
  - todos os `.notes-grid .note-row...`
  - `.note-row-actions`
- Preservar ordem de imports para nao alterar visual.

### Fase 3 - Separar Filters E Bulk Actions

- Criar `_note-filters.scss` para `NotesFilterRow`.
- Criar `_bulk-actions.scss` para `BulkNoteActionsRow`.
- Mover `notes-filter-*` e `bulk-*` respetivamente.
- Avaliar se `notes-filter-menu` e `bulk-tags-menu` devem usar uma searchable-popover primitive depois da migration de menus/forms.

### Fase 4 - Limpar `_notes.scss`

- Depois das extracoes, `_notes.scss` deve deixar de ser um ficheiro guarda-chuva.
- Mover dashboard-only styles para o ponto 17 ou para `_dashboard.scss`:
  - quick capture
  - activity list/row
  - dashboard popular tag rows
- Mover tags-specific `tag-list`/`tag-popular-row` para `_tags.scss` ou component dedicado, conforme ponto 14.
- Se nao sobrar ownership claro, remover `_notes.scss` ou transforma-lo num agregador temporario.

### Fase 5 - Reduzir Duplicacao De Layout Row/Grid

- Depois de mover ficheiros, rever a estrutura de `.note-row`:
  - manter container-driven grid (`.notes-grid .note-row`) se for mais simples;
  - ou adicionar modifier de layout no componente (`note-row--grid`) para reduzir dependência contextual.
- Evitar mudar a estrutura visual no mesmo passo que se move ficheiros.
- Se for feita refactor visual, considerar CSS custom properties para colunas:
  - status width
  - select width
  - thumbnail size
  - drag handle width
  - action width
- Rever se `note-row__content { display: contents; }` em grid continua necessário e seguro.

### Fase 6 - Responsive Ownership

- Mover responsive de notes list/grid para os ficheiros donos:
  - note row/list mobile para `_note-row.scss`/`_note-list.scss`
  - notes grid mobile para `_note-list.scss`
  - filters mobile para `_note-filters.scss`
  - bulk mobile para `_bulk-actions.scss`
- Trocar breakpoints hardcoded por nomes quando o ponto 11 estiver aplicado.
- Preservar explicitamente:
  - list mobile compacta sem badges/chips/actions
  - grid mobile com badges/chips/actions visiveis
  - tag hover lift com pseudo-element para evitar flicker

### Fase 7 - Cleanup Seguro

- Validar antes de remover:
  - `.note-row__summary-preview.is-overflowing`
  - `.notes-grid .note-row__summary-preview .markdown-preview`
  - `.note-card`
  - `.note-thumb.{variant}` fallback backgrounds
  - `.note-row__drag-handle.is-disabled`
- Remover apenas depois de `rg` e validacao visual.

## Recomendacoes

- Nao mexer no editor/Tiptap neste ponto. `NoteDetail` usa `TagChip` e `NoteThumbnail`, mas document/editor migration fica para o ponto 16.
- Nao renomear todas as classes de `NoteRow` no primeiro passo. Primeiro mover ownership mantendo markup igual.
- Tratar `chips`, `thumbnail`, `menus` e `buttons` antes de tocar no layout da row. Isto reduz dependencias globais.
- Separar `filters` e `bulk actions` antes de refatorar responsive; hoje ambos partilham `_filters.scss`, mas sao workflows diferentes.
- Criar uma primitive de `color-dot` porque `notes-filter-dot` ja e usada fora dos filtros.
- Manter o comportamento validado das tags sobrepostas com hover lift.

## Risco

- Medio/Alto.
- Mover ficheiros mantendo seletores tem risco medio, por causa da ordem de imports e overrides contextuais.
- Refatorar list/grid de `NoteRow` tem risco alto relativo porque envolve seleção, pinned reorder, hover/focus, menus, mobile compact mode e Dashboard.
- Extrair chips/thumbnail tem risco medio porque estes componentes sao usados em Dashboard, SearchBox, NoteDetail, Tags e LabelManager.
- Responsive tem risco medio/alto em tablet/mobile, especialmente na transicao entre list e grid.

## Validacao Recomendada

- Build/typecheck depois de cada fase.
- Validacao visual/funcional:
  - Notes all/favorites/recent/trash
  - list mode e grid mode
  - filtro por tag, collection e sort
  - clear filters
  - bulk selection: select all, move collection, assign/remove tags, delete selected
  - pinned notes split list
  - pinned reorder drag/cancel
  - note row menu open/duplicate/trash/restore/delete forever
  - collection chip e tag chain hover
  - empty state
  - dashboard recent notes
  - dashboard quick pins, SearchBox results e NoteDetail thumbnail picker, por causa de `note-thumb`
  - Tags/LabelManager/SortableTagList, por causa de `tag-chip`

- Viewports:
  - `900x768`
  - `1024x768`
  - `1180x820`
  - `1366x768`
  - `1920x1080`
  - `2560x1440`

- Estados especificos:
  - PT e EN
  - dark/light
  - notas com titulo longo
  - tags/collections longas
  - sem collection
  - muitas tags sobrepostas
  - menu da note row aberto perto do fim da lista
  - grid com pinned + unpinned lists

## Proxima Acao

- Seguir para o ponto 16: Note detail/editor migration plan.
- O ponto 16 deve consumir as primitives `chips`, `thumbnail`, `buttons`, `menus` e `meta`, mas deixar a list/grid de notas isolada.
