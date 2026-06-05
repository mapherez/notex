# Components Styles Audit

## Estado

- Estado: Visto
- Data: 2026-06-05
- Ficheiros analisados:
  - `src/styles/components/_color-picker.scss`
  - `src/styles/components/_custom-select.scss`
  - `src/styles/components/_editor.scss`
  - `src/styles/components/_filters.scss`
  - `src/styles/components/_forms.scss`
  - `src/styles/components/_labels.scss`
  - `src/styles/components/_loading.scss`
  - `src/styles/components/_menus.scss`
  - `src/styles/components/_modals.scss`
  - `src/styles/components/_notes.scss`
  - `src/styles/components/_sortable-tags.scss`
  - `src/styles/components/_toast.scss`
  - `src/styles/components/_updater.scss`
  - `src/styles/main.scss`
  - `src/components`
  - `src/pages`

## Findings

- Existem 13 ficheiros SCSS em `src/styles/components`.
- Todos os ficheiros de `components` estao importados em `main.scss`.
- Tamanho por ficheiro:
  - `_filters.scss`: 502 linhas
  - `_notes.scss`: 481 linhas
  - `_editor.scss`: 351 linhas
  - `_modals.scss`: 275 linhas
  - `_color-picker.scss`: 119 linhas
  - `_labels.scss`: 122 linhas
  - `_updater.scss`: 117 linhas
  - `_custom-select.scss`: 95 linhas
  - `_forms.scss`: 62 linhas
  - `_menus.scss`: 50 linhas
  - `_loading.scss`: 41 linhas
  - `_toast.scss`: 32 linhas
  - `_sortable-tags.scss`: 31 linhas
- Ficheiros com mais selectors top-level:
  - `_notes.scss`: 109
  - `_filters.scss`: 89
  - `_editor.scss`: 67
  - `_modals.scss`: 46
  - `_labels.scss`: 27
- `_color-picker.scss`, `_custom-select.scss`, `_loading.scss`, `_sortable-tags.scss`, `_updater.scss` e `_toast.scss` correspondem bem a componentes React especificos.
- `_filters.scss` mistura varias responsabilidades:
  - filtros de notas;
  - bulk actions;
  - grid view de notas (`.notes-grid ...`);
  - `.note-row-actions`;
  - `.floating-menu`;
  - `.sidebar-new-menu`;
  - `.topbar-menu`;
  - `.account-menu`;
  - `.note-row-menu`.
- `_forms.scss` tambem mistura responsabilidades:
  - `.search-box input`, que pertence ao shell/search;
  - `.topbar__actions`, que pertence ao shell/topbar;
  - `.page-content`, `.page-title`, `.page-subtitle`, que sao base/page primitives;
  - `.legal-page`, `.legal-card`, `.legal-copy`, que pertencem a pagina legal;
  - `.kbd`, que e uma primitive util mas nao e form-specific.
- `_toast.scss` contem `.mobile-menu-button` e `.sidebar-backdrop`, que pertencem ao shell/responsive, nao ao toast.
- `_notes.scss` mistura note row/list/chips com blocos de dashboard:
  - `.quick-capture`
  - `.capture-box`
  - `.capture-actions`
  - `.capture-tools`
  - `.submit-button`
  - `.tag-list`
  - `.activity-list`
  - `.tag-popular-row`
  - `.activity-row`
  Estes selectors estao em uso, mas deviam sair de `_notes.scss` porque nao pertencem ao componente de notas.
- `Panel.tsx`, `IconBadge.tsx` e `EmptyState.tsx` sao componentes React em `src/components/ui`, mas os estilos de `.panel`, `.panel-title`, `.panel-header` e `.icon-badge` estao definidos em `pages/_dashboard.scss`.
- `.settings-card`, `.profile-card`, `.note-card` e `.panel` sao agrupados em `pages/_dashboard.scss`, mas sao usados fora do dashboard. Isto confirma que primitives globais estao no sitio errado.
- `.note-card` aparece na definicao CSS agrupada, mas nao apareceu no markup atual. Parece legado ou preparacao nao usada.
- `.document-menu` em `_menus.scss` tambem nao apareceu no markup atual. Parece candidato a remocao, mas deve ser validado antes de apagar.
- Ha 20 ocorrencias de `clsx(...)` em TSX, por isso deteccao automatica de unused CSS por string search tem risco de falsos negativos. A auditoria de unused deve ser conservadora.
- Existem padroes de surface/input/control muito repetidos dentro dos ficheiros components:
  - `border: 1px solid var(--nx-color-border)`
  - `background: var(--nx-color-surface)`
  - `background: var(--nx-color-input)`
  - `background: var(--nx-color-surface-elevated)`
  - `border-radius: var(--nx-radius-*)`
- Existem padroes repetidos de control sizing:
  - `height: 2.75rem`
  - `height: 2.65rem`
  - `min-height: 2.4rem`
  - `min-height: 1.85rem`
  - `padding: 0 var(--nx-space-3/4)`
- `custom-select`, `color-picker`, `notes-filter-trigger` e `bulk-tags-trigger` partilham estrutura visual semelhante: trigger, chevron, menu, option, empty state.
- `.floating-menu`, `.custom-select__menu`, `.color-picker__menu`, `.notes-filter-menu` e `.bulk-tags-menu` partilham surface/dropdown behavior, mas cada um declara border/background/shadow/z-index separadamente.
- `.tag-chip` e `.collection-chip` vivem em `_notes.scss`, mas sao usados fora da lista de notas:
  - `TagChip.tsx`
  - `TagsPage.tsx`
  - `DashboardPage.tsx`
  - `LabelManager.tsx`
  Isto indica que chips devem ser componente/primitives proprias.
- `markdown-preview` vive em `_editor.scss`, mas e usado tambem em `PatchNotesModal.tsx` e na preview de note row grid. Faz sentido existir como content primitive, mas talvez deva ser separado do editor toolbar.
- `_modals.scss` tem uma boa base comum (`choice-modal`, actions, status, summary, shortcut modal, patch notes modal), mas ja cresceu para varios tipos de modal. Vale a pena manter, mas organizar por bloco.

## Recomendacoes

- Criar ou mover primitives globais para ficheiros certos antes de mexer em estilos de pagina:
  - `components/_panel.scss` ou `components/_surface.scss` para `.panel`, `.panel-header`, `.panel-title`.
  - `components/_icon-badge.scss` para `.icon-badge`.
  - `components/_chips.scss` para `.tag-chip`, `.collection-chip`, `.tag-chip-link`, `.tag-remove`.
  - `components/_floating-menu.scss` para `.floating-menu`, `.topbar-menu`, `.account-menu`, `.note-row-menu`, `.sidebar-new-menu`.
- Mover `.page-content`, `.page-title`, `.page-subtitle` para `base/_typography.scss` ou um novo base/layout primitive, em linha com o ponto 3.
- Mover `.topbar__actions`, `.search-box input`, `.mobile-menu-button` e `.sidebar-backdrop` para `layout/_shell.scss`.
- Mover `.legal-*` para `pages/_legal.scss` ou para o ficheiro de pagina correspondente se for criado.
- Mover quick capture/activity/tag popular styles de `_notes.scss` para dashboard ou para components dedicados:
  - `_quick-capture.scss`
  - `_activity-list.scss`
  - `_tag-summary.scss`
- Separar `_filters.scss` em blocos mais claros:
  - notes filters;
  - bulk actions;
  - notes grid layout;
  - floating menus.
  Mesmo que continue num ficheiro por agora, estes blocos devem ser comentados/ordenados e depois migrados.
- Criar tokens ou primitives para controls:
  - `--nx-control-height`
  - `--nx-control-height-sm`
  - `--nx-control-radius`
  - `--nx-control-padding-x`
  - `--nx-menu-min-width`
- Reusar uma primitive de dropdown/menu surface para selects, pickers, filter menus e floating menus.
- Validar e remover candidatos a unused apenas depois de uma pesquisa final:
  - `.document-menu`
  - `.note-card`
- Manter `_editor.scss` separado, mas considerar extrair:
  - toolbar controls;
  - markdown preview/content;
  - table menu;
  - confirm box.
- Nao tentar resolver tudo num so commit. A migracao deve seguir esta ordem:
  - primitives globais (`panel`, `icon-badge`, `chips`, `floating-menu`);
  - responsabilidades claramente erradas (`forms`, `toast`, `notes` dashboard blocks);
  - splits de ficheiros grandes (`filters`, `notes`, `editor`, `modals`);
  - tokenizacao de controls/dropdowns.

## Risco

- Medio.
- Mover styles entre ficheiros tem baixo risco se a ordem de imports continuar correta, mas estes selectors sao globais e dependem da ordem atual em `main.scss`.
- O maior risco esta em extrair chips, note grid e floating menus, porque sao usados em varias paginas e estados.
- Remover unused CSS tem risco medio por causa de classes dinamicas com `clsx` e classes geradas por loops Sass.

## Proxima Acao

- Avancar para `Audit/08_shell_styles_audit.md`.
- Antes de implementar mudancas deste ponto, decidir:
  - nome/local dos ficheiros de primitives;
  - se `notes-grid` fica junto de `NoteRow` ou junto da pagina de notes;
  - se `floating-menu` vira component primitive comum;
  - confirmar remocao de `.document-menu` e `.note-card`.
