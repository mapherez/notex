# Dashboard Migration Plan

## Estado

- Estado: Visto
- Data: 2026-06-05
- Ficheiros analisados:
  - `Audit/10_responsive_styles_audit.md`
  - `Audit/11_foundation_implementation_plan.md`
  - `Audit/12_component_primitives_plan.md`
  - `Audit/14_entity_pages_migration_plan.md`
  - `Audit/15_notes_list_grid_migration_plan.md`
  - `Audit/16_note_detail_editor_migration_plan.md`
  - `src/pages/DashboardPage.tsx`
  - `src/pages/TagsPage.tsx`
  - `src/components/ui/Panel.tsx`
  - `src/components/ui/IconBadge.tsx`
  - `src/components/ui/NoteThumbnail.tsx`
  - `src/components/notes/NoteRow.tsx`
  - `src/styles/pages/_dashboard.scss`
  - `src/styles/components/_notes.scss`
  - `src/styles/pages/_tags.scss`
  - `src/styles/pages/_profile.scss`
  - `src/styles/responsive/_responsive.scss`
  - `src/styles/main.scss`
  - ocorrencias TSX/SCSS de `dashboard-*`, `stats-grid`, `stat-card`, `quick-pin-*`, `quick-capture`, `capture-*`, `activity-*`, `tag-list`, `tag-popular-row`, `panel`, `icon-badge`, `settings-card`, `profile-card`, `note-card`, `link-accent`

## Objetivo

- Deixar `_dashboard.scss` dono apenas do layout e widgets especificos do dashboard.
- Mover primitives globais que hoje vivem no dashboard para ficheiros/componentes certos.
- Devolver ao dashboard os estilos dashboard-only que hoje vivem em `_notes.scss`.
- Isolar os casos partilhados com Tags, Notes list e Profile sem criar abstracoes demasiado genericas.
- Definir a ordem segura para mexer no dashboard depois das foundations/primitives.

## Findings

- O ownership React do dashboard esta claro:
  - `DashboardPage.tsx` monta stats, quick pins, recent notes, quick capture, popular tags e recent activity.
  - `Panel.tsx` e usado na sidebar do dashboard.
  - `IconBadge.tsx` e usado pelos stats cards.
  - `NoteThumbnail.tsx` e usado pelos quick pins e pelo quick-pin picker.
  - `NoteRow.tsx` e usado em recent notes.

- O ownership SCSS nao acompanha o TSX:
  - `_dashboard.scss` contem dashboard layout, stats e quick pins.
  - `_dashboard.scss` tambem contem primitives globais: `.panel`, `.panel-header`, `.panel-title`, `.icon-badge`, `.settings-card`, `.profile-card`, `.note-card`, color variants de `.tag-chip`, `.collection-chip` e `.notes-filter-dot`.
  - `_notes.scss` contem widgets dashboard/tags: `.quick-capture`, `.capture-box`, `.capture-actions`, `.capture-tools`, `.submit-button`, `.tag-list`, `.tag-popular-row`, `.activity-list`, `.activity-row`, `.activity-copy`.

- A ordem atual de imports reforca esta dependencia errada:
  - `pages/dashboard` vem antes de `components/notes`, `pages/profile` e `pages/tags`.
  - Isto permite que Dashboard forneca styles globais para componentes e paginas posteriores.
  - Depois das primitives, components globais devem vir antes de pages, e pages nao devem definir primitives usadas por outras pages.

- `Panel.tsx` e `IconBadge.tsx` sao components UI reais, mas os seus styles vivem em `_dashboard.scss`.
  - `Panel` tambem e usado em Tags e EmptyState.
  - `IconBadge` e usado fora do dashboard em Profile/Tags/Collections flows.
  - Estes styles devem sair para `components/_surfaces.scss` e `components/_badges.scss`.

- `.settings-card` e `.profile-card` sao superficies globais/entity/profile, mas a base visual esta no Dashboard.
  - `.settings-card` e usado em Legal, Tags e Collections.
  - `.profile-card` e usado no Profile.
  - `.note-card` nao apareceu em uso TSX atual e deve ser validado antes de manter ou remover.

- O loop `$palette-colors` em `_dashboard.scss` mistura responsabilidades:
  - `.icon-badge.#{$name}` pertence a badges.
  - `.tag-chip.#{$name}` e `.collection-chip.#{$name}` pertencem a chips.
  - `.notes-filter-dot.#{$name}` deve virar `color-dot` ou primitive de badges/markers, conforme ponto 15.

- `DashboardPage.tsx` usa `NoteRow` em list mode. Isto faz com que a migration de NoteRow/list/grid precise validar o dashboard, mesmo que o dashboard em si nao seja dono da row.

- `DashboardPage.tsx` usa `NoteThumbnail` nos quick pins e picker. A migration de thumbnail primitive tambem precisa validar dashboard, SearchBox, NoteRow e NoteDetail.

- `quick-pin-picker` e um popover searchable local:
  - input com icone
  - lista de opcoes com thumbnail e copy
  - keyboard navigation via `useKeyboardListNavigation`
  - click outside
  - z-index `45`
  Este padrao e parecido com search/filter/link pickers, mas nao deve ser extraido antes de menus/search-popover primitives existirem.

- `PopularTagRow` esta duplicado em `DashboardPage.tsx` e `TagsPage.tsx` com markup praticamente igual.
  - Ambos usam `.tag-list` e `.tag-popular-row`.
  - Estes styles vivem em `_notes.scss`, mas nao sao note-list nem NoteRow.
  - O melhor destino e um component/style partilhado, por exemplo `components/_popular-tags.scss`, ou uma decisao no entity/tags plano. Nao deve ir cegamente para `_dashboard.scss` porque Tags tambem usa.

- `quick-capture`, `capture-box`, `submit-button`, `activity-list`, `activity-row` e `activity-copy` aparecem apenas no dashboard atual.
  - Estes podem voltar para `_dashboard.scss` numa primeira migration.
  - `capture-tools` aparece sem uso TSX atual; validar antes de manter.

- `.link-accent` apareceu apenas no dashboard, mas e semanticamente uma action/link pequena usada em headers de panels.
  - Pode ficar em `_dashboard.scss` por agora.
  - Se aparecer noutras paginas, deve virar primitive de link/action, nao continuar dependente do dashboard.

- `stats-grid` e `quick-pin-row` usam 5 colunas fixas no desktop.
  - Isto faz sentido porque ha 5 stats e 5 quick pins.
  - Em desktop largo/4K, o `page-content`/content max protege contra esticar infinito, mas os cards ainda devem ser validados em 2560/3840.

- O responsive do dashboard esta no catch-all `_responsive.scss`:
  - aos `1180px`, `.dashboard-layout` vira uma coluna e `.dashboard-side` vira 2 colunas.
  - aos `900px`, `.stats-grid`, `.dashboard-side` e `.quick-pin-row` viram 1 coluna.
  - aos `680px`, `.stats-grid` volta a 2 colunas e `.quick-pin-picker` limita `min-width`.
  Isto cria comportamento nao monotono: stats desktop 5 colunas -> tablet 1 coluna -> mobile 2 colunas. Pode ser intencional para poupar altura em mobile, mas deve ser explicitado ou revisto.

- O dashboard tem varios valores dimensionais locais que deviam ser tokens ou custom properties por widget:
  - side column `22rem`
  - stat card min-height `12.6rem`
  - quick pin min-height `5.8rem`
  - quick pin thumbnail `3rem`
  - quick pin edit button `1.8rem`
  - quick pin picker `18rem`
  - picker option thumbnail `2.4rem`
  - capture box min-height `10rem`
  - submit button `2.25rem`

- Existem cores hardcoded/candidatas a theme tokens:
  - `.icon-badge` mistura com `#f4f5f7` e `#0d0f13`.
  - `.submit-button` usa `#fff`.
  - chip colors hardcoded vivem em `_notes.scss`, mas os color variants sao gerados em `_dashboard.scss`.
  Estes devem ser tratados depois dos theme tokens do ponto 11 (`color-text-inverse`, chip tokens, shadow/popover).

- Existem z-index locais:
  - `quick-pin-picker`: `45`.
  - `note-row`/menus/z-index relacionados vem de `_notes.scss`/`_filters.scss` e afetam recent notes indiretamente.
  O quick-pin picker deve mapear para `popover`/`dropdown` quando o z-index map for expandido.

- A UX do dashboard tem fluxos de teclado que devem ser considerados em validacao:
  - shortcuts de stats por digitos.
  - quick pins por `Shift + digito`.
  - typing direto para quick capture quando o foco nao esta num input.
  - quick capture submit/cancel por shortcuts.
  - quick-pin picker com keyboard navigation e Escape.
  Mudancas de CSS nao devem quebrar foco, overflow ou popover positioning.

## Target Structure Recomendada

### Dashboard Page

- `src/styles/pages/_dashboard.scss`
  - `.dashboard-layout`
  - `.dashboard-main`
  - `.dashboard-side`
  - `.stats-grid`
  - `.stat-card`
  - `.stat-label`
  - `.stat-value`
  - `.stat-delta`
  - `.dashboard-quick-pins`
  - `.quick-pin-row`
  - `.quick-pin-slot`
  - `.quick-pin-card`
  - `.quick-pin-edit`
  - `.quick-pin-copy`
  - `.quick-pin-picker`
  - `.quick-pin-search`
  - `.quick-pin-options`
  - `.quick-pin-clear`
  - `.quick-capture`
  - `.capture-box`
  - `.capture-actions`
  - `.activity-list`
  - `.activity-row`
  - `.activity-copy`
  - `.link-accent`, temporariamente se continuar dashboard-only

### Components/Primitives

- `src/styles/components/_surfaces.scss`
  - `.panel`
  - `.panel.flush`
  - `.panel-header`
  - `.panel-title`
  - `.settings-card`
  - surface aliases temporarios se forem necessarios para Profile/Legal/Tags/Collections

- `src/styles/components/_badges.scss`
  - `.icon-badge`
  - `.icon-badge.{color}`

- `src/styles/components/_chips.scss`
  - `.tag-chip`
  - `.tag-chip-link`
  - `.tag-remove`
  - `.collection-chip`
  - `.collection-chip--empty`
  - color variants de chips

- `src/styles/components/_thumbnail.scss`
  - `.note-thumb`
  - thumbnail image sizing e fallback/artwork validado

- `src/styles/components/_color-dot.scss` ou `components/_badges.scss`
  - `.color-dot`
  - alias temporario `.notes-filter-dot`

- `src/styles/components/_popular-tags.scss`
  - `.tag-list`
  - `.tag-popular-row`
  - possivel componente React partilhado `PopularTagList`/`PopularTagRow`

- `src/styles/components/_note-list.scss` e `_note-row.scss`
  - donos de `.note-list` e `NoteRow`.
  - Dashboard apenas consome.

### TSX Components

- Manter inicialmente:
  - `DashboardPage.tsx`
  - `PopularTagRow` local, ate haver migration partilhada.

- Considerar extrair depois:
  - `DashboardStatsGrid`
  - `QuickPins`
  - `QuickCapture`
  - `DashboardActivityList`
  - `PopularTagList` partilhado com Tags.

- Nao fazer esta extracao TSX antes de corrigir ownership CSS, a menos que a pagina comece a ficar dificil de testar.

## Ordem De Migracao Recomendada

### Fase 0 - Prerequisitos

- Aplicar foundations do ponto 11:
  - tokens de card padding/section gap/control heights/icon button size
  - typography tokens
  - `color-text-inverse`
  - chip/theme tokens
  - z-index map
  - breakpoints nomeados

- Aplicar primitives do ponto 12/13/15:
  - surfaces
  - badges
  - chips
  - thumbnail
  - buttons
  - menus/popovers, se forem usados pelo quick-pin picker mais tarde

### Fase 1 - Extrair Primitives Que Hoje Vivem No Dashboard

- Mover de `_dashboard.scss` para `components/_surfaces.scss`:
  - `.panel`
  - `.panel.flush`
  - `.panel-header`
  - `.panel-title`
  - base de `.settings-card`
  - avaliar se `.profile-card` deve ficar como profile-specific ou alias de surface.

- Mover de `_dashboard.scss` para `components/_badges.scss`:
  - `.icon-badge`
  - `.icon-badge svg`
  - color variants de `.icon-badge`.

- Mover color variants:
  - `.tag-chip` e `.collection-chip` para `_chips.scss`.
  - `.notes-filter-dot` para `color-dot`/badges com alias temporario.

- Validar Dashboard, Tags, Profile, Legal, Collections e EmptyState logo apos esta fase, porque todos dependem destas primitives.

### Fase 2 - Devolver Widgets Dashboard-Only Ao Dashboard

- Mover de `_notes.scss` para `_dashboard.scss`:
  - `.quick-capture`
  - `.capture-box`
  - `.capture-actions`
  - `.submit-button`, ou melhor, renomear posteriormente para `.quick-capture-submit`
  - `.activity-list`
  - `.activity-row`
  - `.activity-copy`

- Validar `capture-tools` antes de mover. Se nao houver uso atual, marcar para cleanup em vez de transportar.

- Nao mover `.tag-list`/`.tag-popular-row` para dashboard nesta fase, porque Tags tambem usa.

### Fase 3 - Resolver Popular Tags Como Partilhado

- Criar `components/_popular-tags.scss` para:
  - `.tag-list`
  - `.tag-popular-row`

- Opcional mas recomendado:
  - extrair `PopularTagList`/`PopularTagRow` para `src/components/tags/PopularTagList.tsx` ou `src/components/ui/PopularTagList.tsx`.
  - Dashboard e Tags passam a usar o mesmo componente.

- Manter dependencia em `TagChip`/`.tag-chip`, mas nao em `_notes.scss`.

### Fase 4 - Limpar `_dashboard.scss`

- Depois das primitives sairem e os widgets voltarem, `_dashboard.scss` deve conter apenas:
  - dashboard layout
  - stats
  - quick pins
  - quick capture
  - recent activity
  - dashboard-specific link/action styles, se continuarem exclusivos

- Validar/remover `.note-card` se continuar sem uso TSX.

- Avaliar renomes apenas numa fase posterior:
  - `.stat-card` -> `.dashboard-stat-card`
  - `.stats-grid` -> `.dashboard-stats-grid`
  - `.submit-button` -> `.quick-capture-submit`
  Renomear no primeiro passo nao e necessario e aumenta risco.

### Fase 5 - Responsive Ownership

- Mover regras dashboard de `_responsive.scss` para `_dashboard.scss`:
  - `dashboard-layout` collapse
  - `dashboard-side` columns
  - `stats-grid`
  - `quick-pin-row`
  - `quick-pin-picker`

- Trocar hardcoded `1180px`, `900px`, `680px` por breakpoints nomeados depois do ponto 11.

- Rever `stats-grid`:
  - manter 5 -> 1 -> 2 se for decisao visual consciente;
  - ou mudar para `repeat(auto-fit, minmax(...))`/2 colunas tablet para comportamento mais monotono.

- Rever `quick-pin-row`:
  - como ha sempre 5 slots, pode continuar explicito;
  - mas em tablet talvez 2 colunas faca mais sentido do que 1 coluna longa.

### Fase 6 - Tokens E Theme

- Substituir gradualmente valores locais por tokens:
  - card padding
  - interactive lift
  - control heights
  - icon sizes
  - popover z-index
  - inverse text
  - badge/chip mix colors

- Usar CSS custom properties locais para widgets se forem especificos:
  - `--nx-dashboard-side-width`
  - `--nx-dashboard-stat-min-height`
  - `--nx-dashboard-quick-pin-height`
  - `--nx-dashboard-quick-pin-thumb-size`

### Fase 7 - TSX Cleanup Opcional

- Se `DashboardPage.tsx` continuar grande depois do CSS cleanup, extrair componentes locais:
  - stats
  - quick pins
  - quick capture
  - activity list
  - popular tags shared

- Fazer isto separado da migracao SCSS para manter regressao facil de localizar.

## Recomendacoes

- Nao comecar por alterar o layout visual do dashboard. Primeiro corrigir ownership de styles mantendo os seletores.

- O dashboard deve ser validado sempre que mexermos em:
  - `Panel`
  - `IconBadge`
  - `TagChip`
  - `NoteThumbnail`
  - `NoteRow`
  - `note-list`
  Mesmo que essas migrations sejam de outros pontos, o dashboard consome todas estas primitives.

- `tag-list`/`tag-popular-row` devem sair de `_notes.scss`, mas nao para `_dashboard.scss` se Tags continuar a usar. O destino mais limpo e um componente/SCSS partilhado de popular tags.

- `quick-pin-picker` pode eventualmente usar uma popover/search primitive, mas nao vale a pena forcar isso antes de menus/search/filters estarem organizados.

- `link-accent` pode ficar local enquanto for usado so no dashboard. Se virar padrao global de header actions, mover para buttons/links primitive.

- Tratar `note-card` como possivel legacy. Validar por `rg` antes de apagar.

- Evitar renomear classes no primeiro passo. Mover ficheiros e preservar import order e visual primeiro.

## Risco

- Medio.
- Extrair primitives de `_dashboard.scss` tem risco medio porque afeta Dashboard, Tags, Profile, Legal, Collections e EmptyState.
- Mover dashboard-only styles de `_notes.scss` para `_dashboard.scss` tem risco baixo/medio, desde que `tag-list`/`tag-popular-row` sejam tratados como partilhados.
- Responsive tem risco medio porque `stats-grid` e `quick-pin-row` tem comportamento atual especifico e possivelmente intencional.
- Refatorar TSX do dashboard tem risco medio por causa de keyboard shortcuts, picker focus/click outside e form shortcuts.

## Validacao Recomendada

- Build/typecheck depois de cada fase.
- Validacao funcional do Dashboard:
  - clicar em cada stat card.
  - shortcuts de stats por digitos.
  - abrir quick pin existente.
  - definir quick pin vazio.
  - alterar quick pin existente.
  - limpar quick pin.
  - quick-pin picker com pesquisa, keyboard navigation e Escape.
  - click outside no quick-pin picker.
  - quick capture com texto digitado diretamente por shortcut de letra.
  - quick capture submit.
  - quick capture Escape.
  - recent notes abrem nota correta.
  - popular tags filtram notas.
  - recent activity abre nota correta.

- Validacao cruzada:
  - Tags popular card, por causa de `tag-list`/`tag-popular-row`.
  - Profile/Legal/Tags/Collections, por causa de `settings-card`, `panel` e `icon-badge`.
  - Notes list e Dashboard recent notes, por causa de `NoteRow`.
  - SearchBox/NoteDetail quick thumbnail, por causa de `NoteThumbnail`.

- Viewports:
  - `900x768`
  - `1024x768`
  - `1180x820`
  - `1366x768`
  - `1920x1080`
  - `2560x1440`
  - `3840x2160`

- Estados especificos:
  - PT e EN.
  - dark/light.
  - sem notes.
  - sem tags populares.
  - quick pins vazios.
  - quick pins preenchidos com titulos longos.
  - notas recentes com tags/collections longas.
  - activity list longa.

## Proxima Acao

- Seguir para o ponto 99: decision log final.
- O decision log deve consolidar a ordem real de implementacao. A recomendacao provavel e: foundations -> primitives globais -> shell/entity/notes/dashboard ownership -> responsive cleanup -> editor/detail.
