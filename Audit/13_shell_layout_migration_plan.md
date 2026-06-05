# Shell/Layout Migration Plan

## Estado

- Estado: Visto
- Data: 2026-06-05
- Ficheiros analisados:
  - `Audit/08_shell_styles_audit.md`
  - `Audit/11_foundation_implementation_plan.md`
  - `Audit/12_component_primitives_plan.md`
  - `src/styles/layout/_shell.scss`
  - `src/styles/main.scss`
  - `src/styles/components/_forms.scss`
  - `src/styles/components/_filters.scss`
  - `src/styles/components/_menus.scss`
  - `src/styles/components/_toast.scss`
  - `src/styles/responsive/_responsive.scss`
  - `src/styles/abstracts/_variables.scss`
  - `src/styles/abstracts/_breakpoints.scss`
  - `src/styles/abstracts/_z-index.scss`
  - `src/components/layout/AppShell.tsx`
  - `src/components/layout/Sidebar.tsx`
  - `src/components/layout/TopBar.tsx`
  - `src/components/layout/WindowTitleBar.tsx`
  - `src/components/ui/SearchBox.tsx`
  - ocorrencias TSX/SCSS de shell, sidebar, topbar, search, menus, `.nav-item`, `.icon-button`, `.avatar`

## Objetivo

- Separar o shell global da app em ficheiros com ownership claro.
- Remover primitives globais de `layout/_shell.scss` e mover para `components`.
- Tirar styles de shell de ficheiros errados como `_forms.scss`, `_filters.scss` e `_toast.scss`.
- Preparar responsive desktop/tablet sem espalhar media queries globais por ficheiros sem dono.
- Fazer a migracao sem mudar visualmente a app numa primeira fase.

## Findings

- O ownership React esta claro:
  - `AppShell.tsx` controla `.app-frame`, `.app-shell`, `.main-shell`, titlebar opcional e sidebar mobile.
  - `Sidebar.tsx` controla brand, primary action, nav, collections, legal links, version e backdrop.
  - `TopBar.tsx` controla search, mobile menu, theme action, avatar/account menu.
  - `WindowTitleBar.tsx` controla a custom titlebar Tauri.
  - `SearchBox.tsx` controla input, keyboard hint e popover de resultados.

- O ownership CSS ainda nao esta claro. `layout/_shell.scss` mistura:
  - app frame
  - custom titlebar
  - sidebar
  - brand/logo
  - primary sidebar action
  - nav item
  - global `.icon-button`
  - avatar/account button
  - topbar
  - search box
  - search results
  - legacy storage/user footer styles
  - uma regra de profile: `.profile-avatar img`

- Existem styles de shell fora do ficheiro de shell:
  - `_forms.scss`: `.search-box input`, `.kbd`, `.topbar__actions`, `.page-content`, `.page-title`, `.page-subtitle`, legal page styles.
  - `_filters.scss`: `.floating-menu`, `.topbar-menu`, `.account-menu`, `.sidebar-new-menu`, `.note-row-menu`.
  - `_toast.scss`: `.mobile-menu-button`, `.sidebar-backdrop`.
  - `_responsive.scss`: responsive da app frame/sidebar/topbar/search/avatar misturado com dashboard, profile, notes, tags e collections.

- `.icon-button` e uma primitive global real, nao uma classe de shell. Esta usada em:
  - topbar
  - note detail document actions
  - exemplos/files/linked notes/tags no note detail
  - editor Tiptap
  - NoteRow
  - LabelManager
  - Profile
  - PatchNotesModal
  - ToastViewport

- `.nav-item` esta erradamente partilhada entre sidebar e note detail. E usada na sidebar, mas tambem em `NoteDetailPage.tsx` para botoes de expandir exemplos, links e tags. Isto cria dependencia visual entre uma pagina de conteudo e o layout global.

- `.floating-menu` e uma primitive global, mas vive em `_filters.scss`. O mesmo bloco cobre menus de topbar/account, sidebar new menu e note row menu, por isso deve ser movido para `_menus.scss` e separado entre primitive base e posicionadores.

- `_menus.scss` existe, mas hoje contem styles de inline pickers/document menu, nao a primitive real de menu flutuante.

- A topbar desktop usa `padding-inline-end: 10rem` em `.topbar__search-area` e posiciona `.topbar__actions` com `position: absolute`. Em tablet isto e revertido em `_responsive.scss`. Funciona hoje, mas e fragil para idiomas maiores, mais acoes no header e viewports intermediarios.

- O shell depende de z-index hardcoded:
  - titlebar `120`
  - titlebar tooltip `130`
  - sidebar `20`
  - topbar `90`
  - search popover `45`
  - sidebar backdrop `15`
  - account menu `110`
  - note row menu `120`

- O mapa `$z-index` atual nao cobre estas camadas reais. Antes de migrar z-index no shell, o ponto 11 deve expandir tokens como `backdrop`, `sidebar`, `search-popover`, `topbar`, `account-menu`, `titlebar`, `tooltip`, `modal` e `toast`.

- O responsive do shell deve sair de `responsive/_responsive.scss` quando houver estrutura de ficheiros nova. As regras de `.app-shell`, `.sidebar`, `.sidebar.open`, `.sidebar-backdrop`, `.mobile-menu-button`, `.topbar`, `.topbar__search-area`, `.topbar__actions`, `.search-box` e `.topbar__actions .avatar` pertencem ao shell/topbar/sidebar.

- Ha candidatos a legacy/unused dentro do shell:
  - `.logo-mark`
  - `.primary-action-side`
  - `.inline-icon-button`
  - `.storage-card`
  - `.storage-title`
  - `.storage-track`
  - `.storage-bar`
  - `.storage-meta`
  - `.user-footer`
  - `.user-meta`
  - `.user-name`
  - `.user-email`

- A regra `.avatar img, .profile-avatar img` cruza shell com profile. Deve ser separada: `.avatar img` fica com avatar/topbar, `.profile-avatar img` fica no profile/entity page migration.

- Existe uma pequena irregularidade de formatacao em `_shell.scss` perto de `.topbar__account-chevron`: o seletor `.avatar-button[aria-expanded="true"] .topbar__account-chevron` esta indentado como se fosse nested, mas nao esta. Deve ser corrigido numa migration pequena.

## Target Structure Recomendada

### Layout

- `src/styles/layout/_app-frame.scss`
  - `.app-frame`
  - `.app-frame--custom-titlebar`
  - `.app-shell`
  - `.main-shell`

- `src/styles/layout/_window-titlebar.scss`
  - `.window-titlebar`
  - `.window-titlebar__drag-region`
  - `.window-titlebar__logo`
  - `.window-titlebar__controls`
  - `.window-titlebar__control`
  - `.window-titlebar__tooltip`

- `src/styles/layout/_sidebar.scss`
  - `.sidebar`
  - `.sidebar.open`
  - `.sidebar-backdrop`
  - `.sidebar-header`
  - `.brand`
  - `.logo-image`
  - `.primary-action`
  - `.primary-action-main`
  - `.sidebar-section`
  - `.sidebar-section-title`
  - `.sidebar-section-title-link`
  - `.sidebar-nav-item` ou alias temporario para `.nav-item`
  - `.sidebar-spacer`
  - `.sidebar-legal-links`
  - `.sidebar-legal-link`
  - `.sidebar-version`

- `src/styles/layout/_topbar.scss`
  - `.topbar`
  - `.topbar--with-search`
  - `.topbar__search-area`
  - `.topbar__actions`
  - `.mobile-menu-button`
  - `.avatar`
  - `.avatar-placeholder`
  - `.avatar-button`
  - `.topbar__account-chevron`
  - topbar-specific responsive rules

### Components

- `src/styles/components/_buttons.scss`
  - `.icon-button`
  - `.icon-button.danger`
  - possivel `.inline-icon-button`, se ainda for usado

- `src/styles/components/_search.scss`
  - `.search-box-shell`
  - `.search-box`
  - `.search-box input`
  - `.kbd`, se o uso continuar exclusivo do search
  - `.search-results-popover`
  - `.search-result-row`
  - `.search-result-copy`
  - `.search-result-meta`
  - `.search-result-match`
  - `.search-result-empty`

- `src/styles/components/_menus.scss`
  - `.floating-menu`
  - `.floating-menu strong`
  - `.floating-menu .menu-muted`
  - `.floating-menu button`
  - `.floating-menu a`
  - `.topbar-menu`
  - `.account-menu`
  - `.note-row-menu`
  - `.sidebar-new-menu`, apenas se ainda existir uso real
  - `.document-menu`, mantendo o que ja existe

- `src/styles/components/_page.scss` ou `src/styles/layout/_page.scss`
  - `.page-content`
  - legal page layout, se nao for criado um ficheiro `pages/_legal.scss`

- `src/styles/base/_typography.scss`
  - `.page-title`
  - `.page-subtitle`
  - `.page-subtitle.empty`

## Ordem De Migracao Recomendada

### Fase 0 - Foundations Primeiro

- Aplicar o ponto 11 antes de mexer no shell:
  - adicionar `space-7`
  - adicionar tokens semanticos de spacing/control/card
  - adicionar tokens de typography
  - adicionar theme tokens minimos para inverse/backdrop/shadow/chips
  - expandir `$z-index`
  - expandir `$breakpoints`

### Fase 1 - Extrair Primitives Sem Mudar Markup

- Mover `.icon-button` de `_shell.scss` para `components/_buttons.scss`.
- Mover `.icon-button.danger` de `_labels.scss` para `_buttons.scss`.
- Mover `.floating-menu` e posicionadores de `_filters.scss` para `_menus.scss`.
- Mover `.search-box*`, `.search-results-*` e `.kbd` para `components/_search.scss`.
- Mover `.page-content` para page/layout primitive e `.page-title`/`.page-subtitle` para typography.
- Manter a ordem de imports para que o visual nao mude.

### Fase 2 - Partir `_shell.scss` Em Ficheiros De Layout

- Criar ficheiros separados para app frame, window titlebar, sidebar e topbar.
- Deixar `layout/_shell.scss` como agregador temporario com `@use` dos novos ficheiros, ou atualizar `main.scss` diretamente.
- Mover blocos por owner React:
  - primeiro app frame/main shell
  - depois window titlebar
  - depois sidebar
  - depois topbar/avatar
- Corrigir a formatacao de `.topbar__account-chevron` nesta fase.

### Fase 3 - Corrigir `.nav-item`

- Criar uma classe scoped para sidebar, por exemplo `.sidebar-nav-item`.
- Atualizar `Sidebar.tsx` para usar `.sidebar-nav-item`.
- Manter `.nav-item` como alias temporario apenas se for necessario para evitar uma mudanca grande no mesmo commit.
- Criar/usar uma classe propria para as actions laterais do note detail, por exemplo `.side-list-toggle` ou outra primitive definida no ponto 16.
- Remover `.nav-item` do shell quando os usos fora da sidebar forem migrados.

### Fase 4 - Responsive Ownership

- Mover de `responsive/_responsive.scss` para ficheiros donos:
  - regras de app shell/sidebar/backdrop/mobile menu para `_sidebar.scss` ou `_app-frame.scss`
  - regras de topbar/search/avatar para `_topbar.scss`
  - regras de page grids ficam para os pontos 14, 15 e 17
- Trocar `@media (max-width: 900px)` por helper/nome vindo do ponto 11, por exemplo `down(tablet)`.
- Manter o breakpoint de sidebar off-canvas em `900px` por agora. O objetivo e mover ownership primeiro; mudar comportamento responsive deve ser uma decisao separada.

### Fase 5 - Topbar Layout

- Substituir gradualmente o pad/absolute da topbar por uma grid mais robusta.
- Objetivo provavel:
  - mobile/tablet: `auto minmax(0, 1fr) auto`
  - desktop: search ocupa o centro e actions ficam numa coluna real, nao absolute
- Validar com textos PT/EN, avatar visivel/escondido, search popover aberto e viewports tablet/desktop.

### Fase 6 - Legacy Cleanup

- Validar por `rg` e inspeccao visual antes de remover:
  - `.logo-mark`
  - `.primary-action-side`
  - `.inline-icon-button`
  - `.storage-*`
  - `.user-footer`
  - `.user-meta`
  - `.user-name`
  - `.user-email`
- Remover apenas depois de confirmar que nao ha uso TSX nem dependencia de estados dinamicos.

## Import Order Proposta

Depois dos pontos 11 e 12, uma ordem mais clara seria:

```scss
@use "abstracts/functions";
@use "abstracts/variables";
@use "abstracts/mixins";
@use "abstracts/breakpoints";
@use "abstracts/z-index";
@use "themes";
@use "base/reset";
@use "base/typography";
@use "layout/app-frame";
@use "layout/window-titlebar";
@use "layout/sidebar";
@use "layout/topbar";
@use "components/page";
@use "components/buttons";
@use "components/search";
@use "components/menus";
@use "components/modals";
@use "components/forms";
@use "components/custom-select";
@use "components/color-picker";
@use "components/sortable-tags";
@use "components/loading";
@use "components/notes";
@use "components/labels";
@use "components/editor";
@use "components/updater";
@use "components/toast";
@use "pages/dashboard";
@use "pages/note-detail";
@use "pages/note";
@use "pages/profile";
@use "pages/tags";
@use "responsive/responsive";
```

- `responsive/responsive` pode ficar temporariamente no fim durante a migracao.
- O objetivo final e reduzir esse ficheiro a overrides verdadeiramente globais ou elimina-lo por ownership.

## Recomendacoes

- Nao fazer redesign do shell nesta fase. Primeiro mover ownership e primitives mantendo os valores atuais.
- Nao mudar comportamento responsive no mesmo passo em que se movem ficheiros.
- Tratar `.icon-button`, `.floating-menu` e `search` antes de partir `_shell.scss`; sao dependencias transversais e reduzem o tamanho real do shell.
- Tratar `.nav-item` com cuidado porque exige mudanca TSX em Sidebar e NoteDetail.
- Usar `z()` apenas depois de expandir `$z-index`; hoje o map nao cobre as camadas existentes.
- Usar breakpoints nomeados apenas depois de atualizar o map do ponto 11; hoje `wide/tablet/mobile` e insuficiente para a estrategia desktop/tablet.
- Separar `profile-avatar` do shell quando o ponto 14 tratar entity pages.

## Risco

- Medio.
- Mover ficheiros sem mudar seletores tem risco baixo/medio, desde que a ordem de imports seja preservada.
- `.nav-item` tem risco medio porque cruza sidebar e note detail.
- Topbar tem risco medio/alto se mexermos no layout desktop/absolute sem validar search, account menu e idiomas.
- Responsive ownership tem risco medio porque `responsive/_responsive.scss` mistura varias paginas.

## Validacao Recomendada

- Apos cada fase:
  - `npm run build`
  - validar Dashboard
  - validar Notes list e grid
  - validar NoteDetail/editor
  - validar Profile
  - validar Tags/Collections
  - validar modals import/export

- Viewports minimos quando shell/responsive forem tocados:
  - `900x768`
  - `1024x768`
  - `1180x820`
  - `1366x768`
  - `1920x1080`
  - `2560x1440`

- Estados especificos:
  - app em Tauri com custom titlebar
  - app no browser sem custom titlebar
  - sidebar desktop sticky
  - sidebar tablet off-canvas aberta/fechada
  - search popover aberto
  - account menu aberto
  - theme switch
  - avatar com imagem e placeholder
  - PT e EN

## Proxima Acao

- Seguir para o ponto 14: Entity pages migration plan.
- Esse ponto deve assumir que `page`, `surfaces`, `buttons`, `menus` e `search` vao existir como primitives, e deve concentrar-se em Profile, Settings/Legal, Tags e Collections.
