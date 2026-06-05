# Shell Styles Audit

## Estado

- Estado: Visto
- Data: 2026-06-05
- Ficheiros analisados:
  - `src/styles/layout/_shell.scss`
  - `src/styles/responsive/_responsive.scss`
  - `src/styles/components/_forms.scss`
  - `src/styles/components/_filters.scss`
  - `src/styles/components/_toast.scss`
  - `src/styles/components/_menus.scss`
  - `src/styles/abstracts/_variables.scss`
  - `src/components/layout/AppShell.tsx`
  - `src/components/layout/Sidebar.tsx`
  - `src/components/layout/TopBar.tsx`
  - `src/components/layout/WindowTitleBar.tsx`
  - `src/components/ui/SearchBox.tsx`

## Findings

- `_shell.scss` tem responsabilidades misturadas. O ficheiro cobre app frame, custom titlebar, sidebar, topbar, search box, search results, avatar/account UI, botao primario, `.icon-button`, `.nav-item`, storage/user footer legacy e alguns estilos partilhados com profile.

- O shell ja usa alguns tokens bons: `--nx-sidebar-width`, `--nx-window-titlebar-height`, `--nx-topbar-height`, `--nx-content-max`, `--nx-page-gutter`, `--nx-color-sidebar`, `--nx-color-canvas`, `--nx-color-border`, `--nx-color-input`. Esta parte deve ser preservada.

- Ha z-index hardcoded espalhados:
  - `_shell.scss`: titlebar `120`, tooltip `130`, sidebar `20`, topbar `90`, search popover `45`.
  - `_responsive.scss`: sidebar backdrop `15`.
  - `_filters.scss`: menus usam `80`, `90`, `110`, `120`, alem de outros popovers `25`, `30`, `75`.
  - `_variables.scss` tem `$z-index` com apenas `sidebar`, `popover`, `modal`, `toast`, mas a app quase nao usa esta escala.

- Ha cores hardcoded/candidatas a theme tokens:
  - `_shell.scss`: `#fff` em close/brand/primary/avatar, logo gradient `#7d9acb -> #3f5f9c`, borders `rgba(255, 255, 255, 0.08)`, divider `rgba(0, 0, 0, 0.18)`, storage backgrounds `rgba(255, 255, 255, 0.025/0.1)`, avatar gradient hardcoded.
  - `_responsive.scss`: sidebar backdrop `rgba(0, 0, 0, 0.56)`.
  - Algumas cores podem continuar ligadas a branding, mas devem ter nomes semanticos ou theme-aware.

- Ha muitos valores dimensionais locais dentro do shell: titlebar control `2.875rem`, logo `1.35rem/2.55rem`, icon button `2.25rem`, primary action `3.125rem/3.25rem`, nav item `2.95rem`, avatar `2.4rem`, search input `3rem`, search result thumb `2.6rem`, popover `26rem`, e varios radius locais.

- A topbar desktop reserva espaco com `padding-inline-end: 10rem` e posiciona `.topbar__actions` em absolute. Isto funciona hoje, mas e uma assuncao fragil para idiomas mais longos, tablet, novos botoes, ou futuras acoes no header.

- Tipografia continua local ao ficheiro: font sizes `0.74rem`, `0.78rem`, `0.8rem`, `0.82rem`, `0.88rem`, `0.9rem`, `0.92rem`, `0.98rem`, `1.05rem`, `1.5rem`; weights `560`, `650`, `700`, `750`, `760`, `850`. Isto confirma o problema visto no audit de typography.

- Alguns estilos de shell estao fora do ficheiro de shell:
  - `_forms.scss`: `.search-box input`, `.kbd`, `.topbar__actions`, `.page-content`, `.page-title`, `.page-subtitle`.
  - `_toast.scss`: `.mobile-menu-button`, `.sidebar-backdrop`.
  - `_filters.scss`: `.floating-menu`, `.sidebar-new-menu`, `.topbar-menu`, `.account-menu`, e tambem `.note-row-menu`.
  - `_menus.scss` existe, mas nao centraliza estes menus.

- `.icon-button` e uma primitive global real, mas vive em `_shell.scss`. E usada em TopBar, NoteDetail, LabelManager, Profile, NoteRow, PatchNotesModal, ToastViewport e editor. Deve sair do shell para um ficheiro de buttons/primitives.

- `.nav-item` e estilo de sidebar, mas esta a ser usado em `NoteDetailPage.tsx` para botoes dentro da pagina. Isto cria dependencia visual entre note detail e sidebar. O ideal e separar `sidebar-nav-item` de uma primitive de side-list/action row.

- Ha seletores em `_shell.scss` que parecem legacy ou sem uso TSX direto: `.logo-mark`, `.primary-action-side`, `.inline-icon-button`, `.storage-card`, `.user-footer`, `.user-meta`, `.user-name`, `.user-email`. Devem ser validados antes de remover, mas sao bons candidatos a limpeza.

- `_shell.scss` tambem estiliza `.profile-avatar img`, que pertence ao profile e nao ao shell. Isto cria uma dependencia cruzada desnecessaria.

- Existe um problema de formatacao em `_shell.scss` perto de `.topbar__account-chevron`: o seletor `.avatar-button[aria-expanded="true"] .topbar__account-chevron` esta indentado como se fosse aninhado, mas nao esta. Nao parece quebrar comportamento, mas deve ser corrigido numa passagem de limpeza.

## Recomendacoes

- Nao fazer esta migracao toda de uma vez. O shell toca no layout global da app, por isso a extracao deve ser feita em passos pequenos e testaveis.

- Primeiro separar responsabilidades mantendo a mesma ordem visual:
  - `layout/_app-frame.scss`
  - `layout/_window-titlebar.scss`
  - `layout/_sidebar.scss`
  - `layout/_topbar.scss`
  - `components/_buttons.scss` ou `components/_icon-button.scss`
  - `components/_search.scss`
  - `components/_floating-menu.scss`

- Mover `.icon-button` para uma primitive propria. Depois disso, os overrides `.icon-button.danger`, `.note-row .icon-button`, `.side-list-actions .icon-button`, etc. ficam mais faceis de auditar.

- Renomear/scopar `.nav-item` para sidebar, por exemplo `.sidebar-nav-item`, e criar outro estilo para os botoes do `NoteDetailPage`. Isto remove uma dependencia errada entre pagina e layout.

- Expandir `$z-index` antes de usar `z()`:
  - `backdrop`
  - `sidebar`
  - `sidebar-overlay`
  - `search-popover`
  - `floating-menu`
  - `topbar`
  - `account-menu`
  - `titlebar`
  - `tooltip`
  - `toast`
  - `modal`

- Criar tokens/theme vars para:
  - text inverse/on accent
  - backdrop/overlay
  - brand logo gradient
  - primary action divider/border
  - sidebar subtle surface
  - storage track
  - avatar fallback gradient

- Rever a topbar para evitar `padding-inline-end: 10rem` e absolute positioning como regra principal. Uma grid consistente `auto minmax(0, 1fr) auto`, com search a ocupar o centro e actions no fim, parece mais robusta para desktop/tablet.

- Mover `.page-content`, `.page-title`, `.page-subtitle` para um ficheiro de layout/page primitives ou typography, nao `_forms.scss`.

- Mover `.mobile-menu-button` e `.sidebar-backdrop` para shell/sidebar responsive. Estes estilos nao pertencem a toast.

- Mover `.floating-menu`, `.topbar-menu`, `.account-menu`, `.sidebar-new-menu` para o ficheiro real de menus ou para uma primitive de floating menu. `_filters.scss` nao deve ser dono dos menus globais.

- Validar e remover os seletores legacy sem uso depois de uma pesquisa final. Nao remover automaticamente sem testar porque alguns podem ser usados por estados dinamicos ou componentes em evolucao.

## Risco

- Medio. O shell afeta todas as paginas, a navegacao, sticky headers, off-canvas sidebar, search popover, menus, titlebar Tauri e responsividade tablet. A limpeza e justificavel, mas deve ser incremental.

## Proxima Acao

- Seguir para o ponto 9: `src/styles/pages`.
- Guardar a extracao do shell para o plano final, ou fazer mais tarde em pequenas PRs/commits: primeiro primitives (`icon-button`, `floating-menu`, `page-content`), depois sidebar/topbar, depois z-index/theme tokens.
