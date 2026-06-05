# Entity Pages Migration Plan

## Estado

- Estado: Visto
- Data: 2026-06-05
- Ficheiros analisados:
  - `Audit/09_pages_styles_audit.md`
  - `Audit/11_foundation_implementation_plan.md`
  - `Audit/12_component_primitives_plan.md`
  - `Audit/13_shell_layout_migration_plan.md`
  - `src/styles/pages/_profile.scss`
  - `src/styles/pages/_tags.scss`
  - `src/styles/pages/_dashboard.scss`
  - `src/styles/components/_forms.scss`
  - `src/styles/components/_labels.scss`
  - `src/styles/components/_notes.scss`
  - `src/styles/components/_modals.scss`
  - `src/styles/responsive/_responsive.scss`
  - `src/pages/ProfilePage.tsx`
  - `src/pages/TagsPage.tsx`
  - `src/pages/NotesListPage.tsx`
  - `src/pages/LegalPage.tsx`
  - `src/components/ui/Panel.tsx`
  - `src/components/ui/IconBadge.tsx`
  - `src/components/ui/LabelManager.tsx`
  - ocorrencias TSX/SCSS de `settings-card`, `profile-section`, `tag-card`, `collection-card`, `legal-card`, `meta-list`, `panel`, rows e actions

## Objetivo

- Unificar estilos de Profile, Legal, Tags e Collections onde existe repeticao real.
- Separar Collections de `_profile.scss`, porque a pagina ja existe logicamente como entity page propria.
- Reduzir duplicacao entre Tags e Collections sem criar uma abstracao generica demais.
- Mover surfaces, rows, form controls e action buttons comuns para primitives/component styles.
- Remover dependencia de entity pages em styles definidos no Dashboard ou NoteDetail.

## Findings

- `CollectionsPage` existe dentro de `src/pages/NotesListPage.tsx`, nao num ficheiro proprio. Isto nao e obrigatoriamente errado do ponto de vista runtime, mas atrapalha ownership: a pagina de collections nao vive num ficheiro chamado collections e os seus styles vivem em `_profile.scss`.

- `_profile.scss` contem duas areas grandes:
  - Profile/settings/database/statistics.
  - Collections: `.collections-page`, `.collections-layout`, `.collection-grid`, `.collection-card`, `.collection-create-card`, `.collection-preference-card`, `.collection-action-button`, etc.

- `_tags.scss` e Collections sao quase clones estruturais:
  - `.tags-layout` vs `.collections-layout`
  - `.tag-grid` vs `.collection-grid`
  - `.tag-card` vs `.collection-card`
  - `.tag-card-header` vs `.collection-card-header`
  - `.tag-card-main` vs `.collection-card-main`
  - `.tag-card-link-overlay` vs `.collection-card-link-overlay`
  - `.tag-edit-form` vs `.collection-edit-form`
  - `.tag-create-card` vs `.collection-create-card`
  - `.tag-create-actions` vs `.collection-create-actions`
  - `.tag-action-button` vs `.collection-action-button`
  - side panels com `minmax(19rem, 24rem)`

- A diferenca principal entre Tags e Collections e conteudo/behavior, nao layout:
  - Tags tem favorite tags, popular tags e picker.
  - Collections tem primary collection preference.
  - O card base, edit form, create form, side panel, action row e overlay sao praticamente iguais.

- `.settings-card` esta fragmentada:
  - base visual em `pages/_dashboard.scss`
  - padding e title spacing em `pages/_profile.scss`
  - uso em Profile, Tags, Collections e Legal
  - isto obriga paginas de settings/entity a dependerem do Dashboard e do Profile para terem card completo.

- `.profile-section` e `.settings-card` sao duas surfaces muito parecidas:
  - ambas sao cards com border/radius/background/padding.
  - `ProfileSection` em `ProfilePage.tsx` ja funciona como componente local de section.
  - O ideal e `profile-section` virar uma variante/alias temporaria de uma primitive de surface, nao uma surface separada para sempre.

- `.profile-section-title`, `.settings-title` e `.panel-title` representam o mesmo nivel visual em varios sitios. Hoje vivem em ficheiros diferentes e usam valores locais repetidos.

- `.profile-row`, `.settings-row`, `.database-path-row`, `.profile-action-row`, `.tag-action-button`, `.collection-action-button`, `.tags-action-button` e `label-create-row` repetem a mesma familia de padroes:
  - icon + text + optional control/action
  - input/form row com altura `2.65rem`
  - action button com `min-height: 2.35rem` ou `2.65rem`
  - text muted/description com `0.82rem` ou `0.88rem`

- `.meta-list` e usado no Profile (`profile-stat-grid`) mas definido em `pages/_note-detail.scss`. Isto e uma dependencia cruzada clara e deve sair para `components/_meta.scss` no plano de primitives.

- `LegalPage` usa `.settings-card legal-card`, mas os styles de legal page vivem em `components/_forms.scss`. Legal nao e form. Deve ir para `pages/_legal.scss` ou para uma page/content primitive.

- `.page-content`, `.page-title`, `.page-subtitle` ainda vivem em `_forms.scss` e sao usados em todas estas pages. Isto deve ser resolvido antes ou junto da migracao entity, conforme o ponto 12.

- `Panel.tsx` e `IconBadge.tsx` sao components UI, mas os seus styles vivem em `pages/_dashboard.scss`. Tags usa `panel` e `IconBadge`; Profile usa `IconBadge`; Collections usa `IconBadge`. Isto reforca que surfaces e badges devem sair do dashboard antes da migracao de entity pages.

- `TagChip`, `.tag-list` e `.tag-popular-row` usados pela area de Tags vivem em `components/_notes.scss`. Chips sao primitives, mas `tag-list`/`tag-popular-row` sao dashboard/tags UI e nao deveriam estar no ficheiro de notes.

- `LabelManager` tem estilos proximos de Tags:
  - create row
  - label rows
  - input + color picker + save/delete actions
  - usa `TagChip`
  - `icon-button.danger` ainda vive em `_labels.scss`, mas deve ir para buttons no ponto 12/13.

- Existem candidatos a styles legacy ou sem uso direto:
  - em `_profile.scss`: `.security-row`, `.plan-row`, `.plan-card`, `.plan-heading`, `.plan-name`, `.plan-badge`, `.upgrade-button`, `.mini-note-shell`, `.mini-note`, `.mini-remove`, `.settings-row`, `.settings-label`
  - em `_responsive.scss`: `.tags-action-row`, `.tags-edit-actions`, `.tag-summary-card`
  - `danger-action-button` e usado em `NotesListViewPage.tsx`, logo nao e entity-only e deve sair de `_profile.scss`.

- Ha valores que deviam usar tokens semanticos antes de uma migracao grande:
  - profile sidebar width `15.3rem`
  - profile top side `minmax(20rem, 24.5rem)`
  - entity side panel `minmax(19rem, 24rem)`
  - entity card min width `17rem`
  - card/action heights `2.35rem`, `2.55rem`, `2.65rem`
  - entity card min height `5.5rem`
  - interactive lift `translateY(-1px)`
  - z-index `85` para cards com color picker aberto
  - favorite picker z-index `80`

- Ha cores hardcoded/candidatas a theme tokens:
  - `#fff` em profile avatar, upgrade/create buttons e label buttons
  - profile avatar gradient hardcoded
  - plan card gradient hardcoded
  - chip hover hardcoded em `_labels.scss`
  - modal backdrop hardcoded em `_modals.scss`, embora seja modal global e nao entity-only

- Responsive de entity pages esta misturado em `responsive/_responsive.scss`:
  - `profile-layout`, `profile-left`, `profile-top-row`
  - `profile-stat-grid`
  - `database-management-grid`
  - `collections-layout`, `collection-grid`
  - `tags-layout`, `tag-grid`
  - `collection-card-actions`, `tag-card-actions`
  - `tag-create-actions`, `tag-edit-form`
  - `profile-row`, `settings-row`

## Target Structure Recomendada

### Components/Primitives Necessarias

- `src/styles/components/_surfaces.scss`
  - `.panel`
  - `.panel.flush`
  - `.panel-header`
  - `.panel-title`
  - `.settings-card`
  - alias temporario de `.profile-section`, se for util para migracao sem mudar markup

- `src/styles/components/_rows.scss`
  - `.settings-row` ou `.info-row`
  - `.action-row`
  - `.path-row`
  - labels/descriptions comuns, se for decidido padronizar nomes

- `src/styles/components/_forms.scss`
  - apenas form controls reais
  - input base, create row, inline/edit form patterns, se fizer sentido
  - deve deixar de conter page/legal/search/topbar

- `src/styles/components/_entity.scss`
  - `.entity-layout`
  - `.entity-main-section`
  - `.entity-side-panel`
  - `.entity-grid`
  - `.entity-card`
  - `.entity-card-header`
  - `.entity-card-main`
  - `.entity-card-link-overlay`
  - `.entity-card-actions`
  - `.entity-action-button`
  - `.entity-create-card`
  - `.entity-edit-form`
  - `.entity-create-actions`

- `src/styles/components/_badges.scss`
  - `.icon-badge` e variantes de cor

- `src/styles/components/_chips.scss`
  - `.tag-chip`
  - `.collection-chip`
  - `.tag-remove`
  - variantes de cor

- `src/styles/components/_meta.scss`
  - `.meta-list`
  - `.meta-row`
  - `.meta-value`

- `src/styles/components/_page.scss` e `src/styles/base/_typography.scss`
  - `.page-content`
  - `.list-page-grid`
  - `.page-title`
  - `.page-subtitle`

### Pages

- `src/styles/pages/_profile.scss`
  - apenas layout profile/settings/database/statistics especifico.
  - manter avatar local, se nao for criado avatar primitive.
  - remover collections.

- `src/styles/pages/_collections.scss`
  - overrides especificos de collections, se existirem depois de `entity`.
  - pode ser pequeno ou quase vazio se `entity` cobrir bem.

- `src/styles/pages/_tags.scss`
  - apenas especificos de tags:
    - favorite tags side card
    - favorite picker
    - popular tags card/list se nao for movido para component dedicado
    - tags keyboard/quick access specifics

- `src/styles/pages/_legal.scss`
  - `.legal-page`
  - `.legal-card`
  - `.legal-copy`

## Ordem De Migracao Recomendada

### Fase 0 - Prerequisitos

- Aplicar foundations do ponto 11:
  - card padding
  - section gap
  - row gap
  - control height
  - interactive lift
  - z-index real
  - typography tokens
  - theme token para text inverse

- Aplicar primitives base do ponto 12:
  - page/typography
  - surfaces
  - buttons
  - badges
  - chips
  - meta

### Fase 1 - Corrigir Ownership Sem Mudar Visual

- Mover `.settings-card`, `.panel`, `.panel-header`, `.panel-title` de `_dashboard.scss`/`_profile.scss` para `components/_surfaces.scss`.
- Mover `.page-content`, `.list-page-grid` e legal/page layout para ficheiros corretos.
- Mover `.meta-list` para `components/_meta.scss`, mantendo Profile e NoteDetail iguais.
- Mover `.icon-badge` para `components/_badges.scss`.
- Mover chips para `components/_chips.scss`.

### Fase 2 - Separar Collections De Profile

- Criar `src/styles/pages/_collections.scss`.
- Mover de `_profile.scss` para `_collections.scss`:
  - `.collections-page`
  - `.collections-layout`
  - `.collections-main-section`
  - `.collections-side-panel`
  - `.collection-grid`
  - `.collection-preference-card`
  - `.collection-create-card`
  - `.collection-card`
  - `.collection-card-*`
  - `.collection-create-actions`
  - `.collection-edit-form`
  - `.collection-action-button`
- Atualizar `main.scss` para importar `pages/collections`.
- Opcional mas recomendado: mover `CollectionsPage` de `NotesListPage.tsx` para `src/pages/CollectionsPage.tsx` e deixar `NotesListPage.tsx` apenas com NotesList. Isto e uma mudanca TSX pequena, mas deve ser feita num passo separado do CSS se quisermos reduzir risco.

### Fase 3 - Criar Entity Primitive Para Tags/Collections

- Depois de Collections estar isolado, extrair o que for igual entre `_tags.scss` e `_collections.scss` para `components/_entity.scss`.
- Mudar markup progressivamente para compor classes:
  - `className="entity-layout tags-layout"`
  - `className="entity-grid tag-grid"`
  - `className="entity-card tag-card"`
  - `className="entity-card-header tag-card-header"`
  - `className="entity-card-main tag-card-main"`
  - `className="entity-card-actions tag-card-actions"`
  - `className="entity-action-button tag-action-button"`
- Manter classes domain-specific durante a transicao para nao fazer um big bang.
- Quando Tags e Collections estiverem estaveis, remover duplicacao dos ficheiros de page.

### Fase 4 - Padronizar Rows/Form Actions

- Unificar create/edit form patterns:
  - tag/collection create input
  - tag/collection edit input
  - label manager create row
  - common submit button height
- Criar action button primitive se fizer sentido:
  - `entity-action-button`
  - `danger-action-button` deve sair de `_profile.scss` porque e usado por Notes trash page.
- Rever `profile-action-row`, `settings-row`, `database-path-row` e `label-row` depois de entity cards estarem estaveis. Estes sao semelhantes, mas nao devem ser forçados todos para a mesma class se isso piorar a leitura.

### Fase 5 - Profile Cleanup

- Manter `ProfileSection` como componente local ou transformalo numa composition de `Panel`/surface.
- Alinhar:
  - `.profile-section-title`
  - `.settings-title`
  - `.panel-title`
  com typography tokens.
- Remover de `_profile.scss` classes sem uso confirmado:
  - `.security-row*`
  - `.plan-row`
  - `.plan-card`
  - `.plan-heading`
  - `.plan-name`
  - `.plan-badge`
  - `.upgrade-button`
  - `.mini-note*`
  - `.settings-row`/`.settings-label`, se apos pesquisa continuarem sem uso.
- Separar `.profile-avatar img` do shell, como indicado no ponto 13.

### Fase 6 - Tags-Specific Cleanup

- Manter em `_tags.scss` apenas:
  - favorite tags quick access
  - favorite picker
  - popular tags card/list
  - tags-specific empty states
- Mover favorite picker para uma floating menu/search primitive se o mesmo padrao aparecer noutros pickers.
- Mover `tag-list`/`tag-popular-row` de `_notes.scss` para `_tags.scss` ou para um component dedicado, porque nao e NoteRow.

### Fase 7 - Responsive Ownership

- Mover responsive das entity pages para ficheiros donos:
  - Profile responsive para `_profile.scss`
  - Tags responsive para `_tags.scss`
  - Collections responsive para `_collections.scss`
  - entity generic responsive para `_entity.scss`
- Deixar `responsive/_responsive.scss` apenas com overrides temporarios enquanto a migracao decorre.
- Usar breakpoints nomeados do ponto 11 quando existirem.

## Recomendacoes

- Nao comecar por uma renomeacao total de classes. Primeiro mover styles para ownership correto mantendo visual e markup quase iguais.
- Separar Collections de `_profile.scss` antes de tentar abstrair Tags/Collections. Isto torna a comparacao limpa e reduz risco.
- Criar `entity-*` como primitive especifica para Tags/Collections, nao uma `.card` universal.
- Manter Profile separado de Tags/Collections. Profile usa rows/settings/stat sections; Tags/Collections usam entity cards/grid/side panel.
- Nao mexer em NoteRow ou editor neste ponto. `TagChip` pode ser movido para chips primitive, mas list/grid de notas fica para o ponto 15.
- Fazer cleanup de unused CSS com `rg` antes de apagar. Ha classes que parecem sobras de funcionalidades futuras, mas devem ser removidas apenas quando confirmado.

## Risco

- Medio.
- Separar ficheiros sem alterar seletores tem risco baixo/medio.
- Extrair `entity-*` tem risco medio porque exige markup TSX ou composition de classes.
- Profile cleanup tem risco medio se remover classes sem confirmar uso futuro.
- Responsive tem risco medio porque tags/collections/profile estao misturados no ficheiro global e precisam de validacao em tablet.

## Validacao Recomendada

- Build/typecheck depois de cada fase.
- Validacao visual:
  - Profile
  - Profile import/export modals
  - Shortcut help modal
  - Legal privacy/terms
  - Tags: create, edit, delete, favorite picker, reorder favorite tags, popular tags
  - Collections: create, edit, delete, primary collection select
  - Notes trash page, por causa de `danger-action-button`
  - Dashboard, porque `panel`, `settings-card`, `IconBadge` e chips saem de `_dashboard.scss`

- Viewports:
  - `900x768`
  - `1024x768`
  - `1180x820`
  - `1366x768`
  - `1920x1080`
  - `2560x1440`

- Estados especificos:
  - color picker aberto dentro de tag/collection card
  - tag favorite picker aberto
  - cards hover/focus
  - empty states
  - PT e EN
  - dark/light

## Proxima Acao

- Seguir para o ponto 15: Notes list/grid migration plan.
- O ponto 15 deve assumir que `chips`, `buttons`, `menus`, `badges`, `surfaces` e talvez `entity` existem ou estao planeados, mas nao deve puxar Tags/Collections de volta para notes.
