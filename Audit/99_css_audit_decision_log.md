# CSS Audit Implementation Playbook

## Estado

- Estado: Visto
- Data: 2026-06-05
- Tipo: plano operacional final
- Substitui: versao resumida inicial do `99_css_audit_decision_log.md`
- Ficheiros base:
  - `Audit/css_audit_spec.md`
  - `Audit/01_general_scss_inventory.md`
  - `Audit/02_variables_audit.md`
  - `Audit/03_typography_audit.md`
  - `Audit/04_breakpoints_audit.md`
  - `Audit/05_functions_mixins_audit.md`
  - `Audit/06_themes_audit.md`
  - `Audit/07_components_styles_audit.md`
  - `Audit/08_shell_styles_audit.md`
  - `Audit/09_pages_styles_audit.md`
  - `Audit/10_responsive_styles_audit.md`
  - `Audit/11_foundation_implementation_plan.md`
  - `Audit/12_component_primitives_plan.md`
  - `Audit/13_shell_layout_migration_plan.md`
  - `Audit/14_entity_pages_migration_plan.md`
  - `Audit/15_notes_list_grid_migration_plan.md`
  - `Audit/16_note_detail_editor_migration_plan.md`
  - `Audit/17_dashboard_migration_plan.md`

## Como Usar Este Documento

Este ficheiro e o plano mestre de execucao do refactor CSS. Ele nao deve ser tratado como um resumo opcional. A partir daqui:

- este ficheiro define a ordem real de implementacao;
- este ficheiro define gates, validacao e regras de seguranca;
- os ficheiros `01` a `17` continuam a ser obrigatorios como fonte de detalhe e evidencia;
- cada fase abaixo indica quais audits devem ser lidos antes de implementar;
- se uma fase precisar de detalhe de classes, ficheiros ou risco, usar o audit referenciado, nao improvisar;
- se houver conflito entre uma recomendacao antiga e este documento, este documento manda na ordem, mas o audit especifico manda no detalhe tecnico da area.

Regra pratica:

- `99` responde "o que fazer, em que ordem, com que gates".
- `01` a `17` respondem "porque, onde esta o problema, quais classes/ficheiros estao envolvidos".

Isto evita voltar a gastar tempo em planeamento sempre que uma fase comecar.

## Objetivo Final

O objetivo nao e apenas remover CSS repetido. O objetivo e criar um sistema de estilos que continue limpo quando forem adicionadas novas paginas, componentes, themes, accents e futuros refactors de UI/codigo.

A app deve acabar com estas propriedades:

- cada classe tem um owner claro;
- cada ficheiro SCSS tem uma responsabilidade previsivel;
- primitives globais vivem em `components` ou `base`, nunca em page files;
- pages compoem primitives, nao as definem;
- responsive vive perto do dono do layout sempre que possivel;
- tokens/theme vars governam spacing, typography, colors, z-index e breakpoints onde isso fizer sentido;
- hardcoded values existem apenas quando forem intencionais e documentados;
- editor/content typography fica separada da UI typography;
- futuras AIs e humanos seguem guidelines permanentes antes de criar CSS novo.

## Resumo Do Diagnostico

Os 17 audits mostram um problema estrutural de ownership.

- A app ja tem `variables`, `themes`, `functions`, `mixins`, `breakpoints` e `z-index`, mas eles estao subutilizados.
- `_typography.scss` esta praticamente vazio apesar de haver muitas declaracoes tipograficas espalhadas.
- `_responsive.scss` funciona como catch-all para shell, dashboard, profile, tags, collections, notes, modals e editor.
- `_dashboard.scss` define primitives globais como `.panel`, `.panel-title`, `.settings-card`, `.icon-badge` e color variants.
- `_notes.scss` define primitives globais como `.tag-chip`, `.collection-chip`, `.note-thumb` e tambem widgets que nao sao notes list.
- `_filters.scss` mistura filtros, bulk actions, notes grid e menus flutuantes globais.
- `_forms.scss` contem page primitives e legal page styles.
- `_note-detail.scss` contem `.meta-list` usada no Profile e varias possiveis classes legacy.
- `_note.scss` concentra document layout, TOC, block editor, ProseMirror, toolbar, bubble toolbar e node views.

O risco principal nao e "um valor hardcoded aqui e ali". O risco principal e nao haver fronteiras claras.

## Source Traceability

| Area | Audit fonte | Papel no refactor |
| --- | --- | --- |
| Inventario geral | `01_general_scss_inventory.md` | mostra escala do problema, hardcoded values, typografia espalhada e primitives no sitio errado |
| Variables/tokens | `02_variables_audit.md` | define lacunas de tokens, `space-7`, semantic tokens, z-index e breakpoint readiness |
| Typography | `03_typography_audit.md` | define tokens tipograficos e separacao UI vs editor/content |
| Breakpoints | `04_breakpoints_audit.md` | corrige entendimento de FullHD, 1440p, 4K, tablet e `1180px` |
| Functions/mixins | `05_functions_mixins_audit.md` | define uso limitado de Sass helpers, `z()`, `down()`/`up()` e focus helpers |
| Themes | `06_themes_audit.md` | define theme tokens, accent readiness e hardcoded colors que devem virar tokens |
| Components | `07_components_styles_audit.md` | identifica components/primitives com styles em ficheiros errados |
| Shell | `08_shell_styles_audit.md` | diagnostica shell, topbar, sidebar, search, menus, `.icon-button`, `.nav-item` |
| Pages | `09_pages_styles_audit.md` | mostra repeticao entre page styles e dependencies cruzadas |
| Responsive | `10_responsive_styles_audit.md` | mostra catch-all responsive e riscos em tablet/content collapse |
| Foundations plan | `11_foundation_implementation_plan.md` | primeira fase real de implementacao |
| Primitives plan | `12_component_primitives_plan.md` | define primitives e ficheiros alvo |
| Shell migration | `13_shell_layout_migration_plan.md` | define split do shell e gates para `.nav-item`, menus e search |
| Entity pages | `14_entity_pages_migration_plan.md` | define Profile/Tags/Collections/Legal migration |
| Notes list/grid | `15_notes_list_grid_migration_plan.md` | define NoteRow, notes grid, filters, bulk actions e chips/thumb/menu dependencies |
| Note detail/editor | `16_note_detail_editor_migration_plan.md` | define migration de maior risco |
| Dashboard | `17_dashboard_migration_plan.md` | define dashboard cleanup e shared popular tags |

## Decisoes Fechadas

- CSS custom properties continuam a ser a API principal do styling.
- Sass helpers devem ser usados so quando reduzem erro real.
- Nao migrar a app inteira para `token()`, `space()` ou `radius()` agora.
- Foundations entram antes de qualquer migration grande.
- Primitives globais ficam em `src/styles/components` ou `src/styles/base`.
- Page files nao podem ser donos de primitives globais.
- `_responsive.scss` pode ficar temporariamente no fim do import order, mas o objetivo e reduzir ou eliminar o catch-all por ownership.
- Mover selectors mantendo nomes vem antes de renomear classes.
- Renomear modifiers vem depois de ownership estar estavel.
- Cleanup de legacy exige `rg` + validacao visual.
- Note detail/editor fica para fase tardia.
- UI typography e editor/content typography ficam separados.
- `1440p` significa `2560x1440`, nao `1440px`.
- Desktop base: `1920x1080`, depois `2560x1440`, depois `3840x2160`.
- `1180px` nao e desktop real; se continuar, deve ser tratado como `content-collapse` ou decisao equivalente.

## Decisoes Pendentes Antes De Implementar

Estas decisoes nao bloqueiam escrever guidelines, mas bloqueiam fases especificas.

### Breakpoints

Fechar nomes finais:

- `680px` -> provavelmente `mobile`;
- `900px` -> provavelmente `tablet`;
- `1020px` -> `tablet-wide` ou `note-document-collapse`;
- `1180px` -> `content-collapse`, `compact-desktop` ou token local;
- `1366px` -> tablet/desktop pequeno para validacao, nao necessariamente breakpoint;
- `1920px` -> desktop baseline para validacao;
- `2560px` -> `desktop-1440p` para validacao/possiveis layout enhancements;
- `3840px` -> `desktop-4k` para validacao/possiveis layout enhancements.

Pendente: decidir se `1180px` fica no map global ou vira token de layout.

### Themes/Accents

Fechar estrategia minima:

- manter accent/status palette global por agora;
- adicionar apenas theme tokens minimos necessarios;
- adiar `[data-accent]` ate haver UX definida;
- documentar thumbnail colors como artwork se continuarem hardcoded.

Pendente: decidir se `color-chip` / `color-chip-solid` passam a ser usados ou se sao substituidos por nomes melhores.

### Popular Tags

Dashboard e Tags duplicam markup de popular tags.

Pendente:

- criar `PopularTagList` / `PopularTagRow` partilhado agora;
- ou mover apenas CSS para `components/_popular-tags.scss` e adiar TSX extraction.

Recomendacao: CSS shared primeiro; TSX extraction so se o componente continuar duplicado depois.

### Dashboard Stats Grid

O comportamento atual e nao monotono:

- desktop: 5 colunas;
- abaixo de `900px`: 1 coluna;
- abaixo de `680px`: 2 colunas.

Pendente: decidir se isto e intencional. Nao alterar durante ownership migration.

### Legacy Removal

Varias classes parecem legacy. Nao remover em massa.

Pendente: criar checklist de legacy por fase e remover so com pesquisa + validacao visual.

## Regras Globais De Implementacao

Estas regras aplicam-se a todas as fases.

- Nao fazer big bang.
- Nao misturar redesign com ownership cleanup.
- Nao alterar comportamento responsive no mesmo passo em que se movem ficheiros.
- Nao renomear classes no primeiro passo de uma area complexa.
- Nao apagar CSS apenas porque parece unused.
- Nao criar uma `.card` universal.
- Nao criar um `_primitives.scss` gigante.
- Nao mover editor/Tiptap cedo.
- Nao promover styles page-specific para global sem pelo menos dois usos reais.
- Nao criar tokens para todos os valores locais; criar tokens para regras do sistema.
- Hardcoded values sao aceitaveis quando forem artwork, fallback visual, offsets contextuais ou dimensoes intrinsecas.
- Cada migration deve ter uma area dona e uma lista de validacao.
- Depois de mover selectors, validar antes de trocar tokens.
- Depois de trocar tokens, validar antes de remover legacy.

## Ordem Canonica De Implementacao

Esta e a ordem a seguir, mesmo que a ordem dos audits originais tenha sido diferente.

1. Guidelines permanentes.
2. Foundations.
3. Component primitives.
4. Shell/layout.
5. Entity pages.
6. Notes list/grid.
7. Dashboard.
8. Responsive ownership pass.
9. Note detail/editor.
10. Legacy cleanup e renames.

Motivo da ordem:

- foundations reduzem retrabalho;
- primitives desbloqueiam shell/entity/notes/dashboard;
- shell precisa de buttons, menus, search, page primitive e z-index;
- entity pages validam surfaces, badges, chips, rows e page typography;
- notes list/grid precisa de chips, thumbnail, menus e buttons;
- dashboard valida muitas primitives e NoteRow, mas e menos arriscado que editor;
- responsive global so deve ser limpo depois dos owners estarem claros;
- editor e o ultimo grande bloco por causa de Tiptap/ProseMirror/DOM queries.

## Phase 0 - Guidelines Permanentes

Fonte:

- todos os audits;
- especialmente `11_foundation_implementation_plan.md`, `12_component_primitives_plan.md`, `13_shell_layout_migration_plan.md`, `16_note_detail_editor_migration_plan.md`.

Objetivo:

- impedir que o problema volte depois do refactor;
- garantir que humanos e AIs sabem onde colocar estilos novos;
- transformar regras deste audit em pratica permanente.

Ficheiros a criar:

- `AGENTS.md`
- `Documentation/style_system_guidelines.md`

`AGENTS.md` deve ser curto e obrigatorio:

- ownership rules;
- tokens/theme rules;
- responsive rules;
- hardcoded exception rules;
- validation minimums;
- regra de nao criar primitives em page files;
- regra de nao mexer em editor/Tiptap sem ler o audit 16.

`Documentation/style_system_guidelines.md` deve ser detalhado:

- estrutura de `src/styles`;
- exemplos de onde colocar novos styles;
- quando criar token;
- quando criar primitive;
- quando deixar style local;
- quando usar theme var;
- como lidar com responsive;
- checklist para novas paginas;
- checklist para novos componentes;
- checklist para refactors CSS;
- exemplos de anti-patterns encontrados neste audit.

Gate de saida:

- guidelines criadas;
- guidelines referenciam explicitamente este audit;
- nenhuma migration CSS real comeca antes disto.

Validacao:

- documentacao revista manualmente;
- sem build necessario se apenas docs forem alterados.

## Phase 1 - Foundations

Fonte obrigatoria:

- `02_variables_audit.md`
- `03_typography_audit.md`
- `04_breakpoints_audit.md`
- `05_functions_mixins_audit.md`
- `06_themes_audit.md`
- `11_foundation_implementation_plan.md`

Objetivo:

- preparar tokens, typography, z-index, breakpoints, helpers, theme vars e import order antes de mover CSS.

Ficheiros principais:

- `src/styles/abstracts/_variables.scss`
- `src/styles/abstracts/_functions.scss`
- `src/styles/abstracts/_mixins.scss`
- `src/styles/abstracts/_breakpoints.scss`
- `src/styles/abstracts/_z-index.scss`
- `src/styles/base/_typography.scss`
- `src/styles/themes/_dark.scss`
- `src/styles/themes/_light.scss`
- `src/styles/themes/_index.scss`
- `src/styles/main.scss`

### Phase 1.1 - Variables Hygiene

Acoes:

- normalizar formatacao de `_variables.scss`;
- adicionar `space-7`;
- valor recomendado: `1.75rem`;
- nao adicionar `space-9` sem uso real;
- corrigir qualquer token usado mas nao definido;
- nao migrar usos ainda.

Gate:

- `--nx-space-7` existe ou o uso foi removido;
- nenhuma mudanca visual intencional.

### Phase 1.2 - Semantic Tokens

Adicionar tokens semanticos base para:

- card padding;
- compact card padding;
- section gap;
- row gap;
- control height;
- compact control height;
- icon button size;
- pill radius;
- focus ring;
- popover width;
- popover radius;
- popover shadow;
- interactive lift;
- content widths se ja existirem padroes claros.

Regra:

- adicionar tokens primeiro;
- migrar uso apenas quando a primitive dona for criada.

### Phase 1.3 - Typography Tokens

Adicionar tokens recomendados:

- `font-size-caption`;
- `font-size-meta`;
- `font-size-control`;
- `font-size-description`;
- `font-size-row`;
- `font-size-body`;
- `font-size-section-title`;
- `font-size-modal-title`;
- `font-size-page-title`;
- `font-size-document-title`;
- `font-weight-regular`;
- `font-weight-medium`;
- `font-weight-label`;
- `font-weight-strong`;
- `font-weight-heading`.

Mover para `_typography.scss`:

- `.page-title`;
- `.page-subtitle`;
- `.page-subtitle.empty`.

Nao mover para `_typography.scss`:

- ProseMirror content;
- editor document body;
- markdown/content preview sem plano especifico;
- node view typography.

### Phase 1.4 - Theme Tokens

Adicionar theme tokens minimos:

- inverse/on-accent text;
- backdrop/overlay;
- elevated surface/popover background se necessario;
- popover shadow if theme-dependent;
- chip base e chip solid, se a estrategia for usar os tokens existentes.

Migrar gradualmente:

- `#fff` de UI para text inverse;
- hardcoded backdrops para backdrop token;
- chip fallback colors para theme-aware token se fizer sentido.

Nao fazer agora:

- full accent system;
- multiplos themes novos;
- migrar thumbnail artwork para theme tokens.

### Phase 1.5 - Z-Index Map

Expandir z-index para cobrir camadas reais:

- base;
- raised;
- sticky;
- backdrop;
- sidebar;
- mobile-sidebar;
- search-popover;
- dropdown;
- menu;
- note-row-menu;
- editor-toolbar;
- topbar;
- account-menu;
- titlebar;
- modal;
- toast;
- tooltip.

Regra:

- expandir map primeiro;
- migrar por area;
- comecar por shell/topbar/sidebar/menus;
- nao trocar todos os `z-index` num passo unico.

### Phase 1.6 - Breakpoints And Helpers

Atualizar map de breakpoints com nomes semanticos.

Valores candidatos:

```scss
$breakpoints: (
  "mobile": 680px,
  "tablet": 900px,
  "tablet-wide": 1024px,
  "content-collapse": 1180px,
  "desktop-small": 1366px,
  "desktop": 1920px,
  "desktop-1440p": 2560px,
  "desktop-4k": 3840px,
);
```

Notas:

- estes nomes ainda precisam aprovacao antes da migration responsive;
- `1180px` pode ficar fora do map global se for token especifico de layout;
- `1020px` atual deve virar `tablet-wide` ou `note-document-collapse`;
- `42rem` deve virar `mobile` ou `modal-stack`;
- `1440p` nunca deve virar `1440px`.

Helpers:

- manter `emit-css-vars()`;
- rever `media-down($width)`;
- criar ou ajustar `down($name)` / `up($name)`;
- usar helpers por ficheiro com `@use` correto.

### Phase 1.7 - Import Order

Preparar `main.scss` para importar primitives antes de pages.

Regra:

- abstracts primeiro;
- base depois;
- layout;
- component primitives;
- page styles;
- responsive temporario no fim.

Gate de saida da Phase 1:

- foundations criadas;
- `space-7` resolvido;
- typography global minima criada;
- theme tokens minimos criados;
- z-index map expandido;
- breakpoints/helpers preparados;
- import order preparado;
- sem migration visual grande.

Validacao:

- build/typecheck;
- smoke visual em Dashboard, Profile, Notes list/grid, NoteDetail;
- dark/light;
- viewports quando breakpoints forem tocados: `1024x768`, `1180x820`, `1366x768`, `1920x1080`, `2560x1440`, `3840x2160`.

Risco:

- baixo para adicionar tokens sem migrar;
- medio para typography/z-index;
- medio/alto para breakpoints se comportamento mudar.

## Phase 2 - Component Primitives

Fonte obrigatoria:

- `07_components_styles_audit.md`
- `08_shell_styles_audit.md`
- `09_pages_styles_audit.md`
- `12_component_primitives_plan.md`

Objetivo:

- tirar primitives globais de ficheiros errados;
- criar ficheiros pequenos por responsabilidade;
- manter selectors e visual no primeiro passo.

Ficheiros novos recomendados:

- `src/styles/components/_page.scss` ou `src/styles/layout/_page.scss`
- `src/styles/components/_surfaces.scss`
- `src/styles/components/_buttons.scss`
- `src/styles/components/_badges.scss`
- `src/styles/components/_chips.scss`
- `src/styles/components/_thumbnail.scss`
- `src/styles/components/_menus.scss`
- `src/styles/components/_meta.scss`
- `src/styles/components/_color-dot.scss`
- `src/styles/components/_popular-tags.scss` mais tarde, se necessario

### Ownership Map - Primitives

| Selector/conceito | Origem atual | Destino alvo | Notas |
| --- | --- | --- | --- |
| `.page-content` | `_forms.scss` | `_page.scss` ou layout page | layout, nao form |
| `.page-title` | `_forms.scss`/base minima | `_typography.scss` | UI typography |
| `.page-subtitle` | `_forms.scss` | `_typography.scss` | UI typography |
| `.panel` | `_dashboard.scss` | `_surfaces.scss` | `Panel.tsx` ja existe |
| `.panel.flush` | `_dashboard.scss` | `_surfaces.scss` | manter selector |
| `.panel-header` | `_dashboard.scss` | `_surfaces.scss` | global |
| `.panel-title` | `_dashboard.scss` | `_surfaces.scss` ou typography variant | decidir durante migration |
| `.settings-card` | `_dashboard.scss`/`_profile.scss` | `_surfaces.scss` | usada fora do dashboard |
| `.profile-section` | `_profile.scss` | `_surfaces.scss` alias temporario ou page composition | nao forcar cedo |
| `.icon-button` | `_shell.scss` | `_buttons.scss` | usada em varias areas |
| `.icon-button.danger` | `_labels.scss` | `_buttons.scss` | variant global |
| `.icon-badge` | `_dashboard.scss` | `_badges.scss` | `IconBadge.tsx` ja existe |
| `.tag-chip` | `_notes.scss` | `_chips.scss` | usada fora notes |
| `.tag-chip-link` | `_notes.scss` | `_chips.scss` | chips primitive |
| `.tag-remove` | `_notes.scss` | `_chips.scss` | chips/action |
| `.collection-chip` | `_notes.scss` | `_chips.scss` | usada fora notes |
| `.collection-chip--empty` | `_notes.scss` | `_chips.scss` | variant |
| chip color variants | `_dashboard.scss` | `_chips.scss` | via palette/theme strategy |
| `.note-thumb` | `_notes.scss` | `_thumbnail.scss` | `NoteThumbnail.tsx` ja existe |
| `.note-thumb.{variant}` | `_notes.scss` | `_thumbnail.scss` | artwork/fallback, nao theme |
| `.floating-menu` | `_filters.scss` | `_menus.scss` | primitive global |
| `.topbar-menu` | `_filters.scss` | `_menus.scss`/topbar positioning | base vs posicionador |
| `.account-menu` | `_filters.scss` | `_menus.scss`/topbar positioning | base vs posicionador |
| `.sidebar-new-menu` | `_filters.scss` | `_menus.scss`/sidebar positioning | base vs posicionador |
| `.note-row-menu` | `_filters.scss` | `_menus.scss` or note-row owner | acompanha NoteRow |
| `.meta-list` | `_note-detail.scss` | `_meta.scss` | usada em NoteDetail e Profile |
| `.meta-row` | `_note-detail.scss` | `_meta.scss` | global meta primitive |
| `.meta-value` | `_note-detail.scss` | `_meta.scss` | global meta primitive |
| `.markdown-preview` | `_editor.scss`/notes usage | manter por agora | tratar com editor/content |

### Ordem Interna Da Phase 2

1. Criar ficheiros vazios/pequenos e adicionar imports.
2. Mover page primitive e typography global.
3. Mover surfaces/panels.
4. Mover buttons/icon buttons.
5. Mover badges/icon badges.
6. Mover chips e variants.
7. Mover thumbnail.
8. Mover floating menus.
9. Mover meta list.
10. Validar cada extracao antes da seguinte.

Nao entra nesta fase:

- NoteRow/list/grid refactor;
- Tiptap/ProseMirror/editor content;
- unificacao completa Tags/Collections;
- rework completo Profile;
- remocao agressiva de unused CSS;
- mudancas visuais de design.

Gate de saida:

- primitives globais ja nao vivem em page files principais;
- Dashboard deixa de ser dono de `Panel`, `IconBadge`, chips e settings surface;
- `_forms.scss` deixa de ser dono de page primitives;
- `_filters.scss` deixa de ser dono da primitive global `.floating-menu`;
- visual preservado.

Validacao:

- build/typecheck depois de cada grupo;
- Dashboard;
- Notes list/grid;
- NoteDetail;
- Profile;
- Tags/Collections;
- modals;
- dark/light;
- keyboard focus em buttons, chips e menus.

## Phase 3 - Shell/Layout

Fonte obrigatoria:

- `08_shell_styles_audit.md`
- `13_shell_layout_migration_plan.md`
- detalhes de primitives do `12_component_primitives_plan.md`

Objetivo:

- separar shell global em owners claros;
- tirar primitives globais do shell;
- tirar shell styles de `_forms.scss`, `_filters.scss`, `_toast.scss`;
- manter visual e comportamento primeiro.

Ficheiros alvo:

- `src/styles/layout/_app-frame.scss`
- `src/styles/layout/_window-titlebar.scss`
- `src/styles/layout/_sidebar.scss`
- `src/styles/layout/_topbar.scss`
- `src/styles/components/_search.scss`
- `src/styles/components/_menus.scss`
- `src/styles/components/_buttons.scss`
- `src/styles/components/_page.scss` ou layout page
- `src/styles/base/_typography.scss`

### Shell Ownership Map

| Area | Origem atual | Destino alvo |
| --- | --- | --- |
| app frame / app shell | `_shell.scss` | `_app-frame.scss` |
| custom titlebar | `_shell.scss` | `_window-titlebar.scss` |
| sidebar nav/layout | `_shell.scss` | `_sidebar.scss` |
| mobile sidebar/backdrop | `_toast.scss` / `_responsive.scss` | `_sidebar.scss` |
| topbar layout/actions | `_shell.scss` / `_forms.scss` | `_topbar.scss` |
| search box/results | `_shell.scss` / `_forms.scss` | `_search.scss` |
| account/topbar menus | `_filters.scss` | `_menus.scss` + positioning owner |
| `.icon-button` | `_shell.scss` | `_buttons.scss` |
| `.nav-item` | `_shell.scss` | `.sidebar-nav-item` in `_sidebar.scss` |
| NoteDetail side actions | `.nav-item nav-item--spaced` | note side panel action in phase 8 |
| `.profile-avatar img` | `_shell.scss` combined rule | `_profile.scss` or entity page |

### Ordem Interna Da Phase 3

1. Garantir Phase 1 e Phase 2 aplicadas.
2. Mover `.icon-button` e `.icon-button.danger`.
3. Mover `.floating-menu` base e posicionadores globais.
4. Mover search para `_search.scss`.
5. Mover page/typography para owners corretos se ainda faltar.
6. Partir `_shell.scss` em app frame, titlebar, sidebar, topbar.
7. Corrigir irregularidade de formatacao perto de `.topbar__account-chevron`.
8. Criar `.sidebar-nav-item`.
9. Atualizar `Sidebar.tsx`.
10. Manter `.nav-item` como alias temporario se necessario.
11. Criar ou preparar classe propria para NoteDetail side actions.
12. Mover responsive shell de `_responsive.scss`.
13. Rever topbar layout apenas depois de ownership estar estavel.
14. Validar legacy antes de remover.

Nao fazer:

- redesign do shell;
- mudar breakpoint da sidebar;
- remover `.nav-item` antes do NoteDetail deixar de usar;
- trocar todos os z-index sem map pronto;
- resolver Profile avatar junto com shell se ainda nao estiver na fase entity.

Gate de saida:

- shell split feito;
- search tem owner proprio;
- menus globais nao vivem em `_filters.scss`;
- `.icon-button` nao vive em shell;
- `.nav-item` esta scoped ou tem alias temporario controlado;
- responsive shell saiu do catch-all ou esta marcado como temporario.

Validacao:

- Dashboard;
- Notes list/grid;
- NoteDetail/editor;
- Profile;
- Tags/Collections;
- sidebar open/closed;
- search popover aberto;
- account menu aberto;
- theme switch;
- avatar imagem/placeholder;
- PT e EN;
- viewports `900x768`, `1024x768`, `1180x820`, `1366x768`, `1920x1080`.

Risco:

- medio;
- `.nav-item` e risco medio por cruzar Sidebar e NoteDetail;
- topbar e risco medio/alto por layout desktop/tablet/search/actions.

## Phase 4 - Entity Pages

Fonte obrigatoria:

- `09_pages_styles_audit.md`
- `14_entity_pages_migration_plan.md`
- primitives do `12_component_primitives_plan.md`

Objetivo:

- separar Profile, Tags, Collections e Legal por ownership correto;
- criar primitives so onde ha repeticao real;
- remover dependencias de Dashboard e NoteDetail.

Ficheiros alvo:

- `src/styles/pages/_profile.scss`
- `src/styles/pages/_collections.scss`
- `src/styles/pages/_tags.scss`
- `src/styles/pages/_legal.scss`
- `src/styles/components/_entity.scss`
- `src/styles/components/_surfaces.scss`
- `src/styles/components/_rows.scss`
- `src/styles/components/_forms.scss`
- `src/styles/components/_badges.scss`
- `src/styles/components/_chips.scss`
- `src/styles/components/_meta.scss`
- `src/styles/components/_page.scss`

### Entity Ownership Map

| Area | Origem atual | Destino alvo |
| --- | --- | --- |
| Profile layout | `_profile.scss` | `_profile.scss` |
| Collections styles | `_profile.scss` | `_collections.scss` |
| Tags styles | `_tags.scss` | `_tags.scss` + `_entity.scss` shared |
| Legal page | `_forms.scss` / `.settings-card legal-card` | `_legal.scss` + surfaces |
| `.settings-card` | dashboard/profile split | `_surfaces.scss` |
| `.profile-section` | `_profile.scss` | profile local or surface composition |
| `.profile-section-title` | `_profile.scss` | typography/surface variant |
| `.settings-title` | mixed | typography/surface variant |
| `.panel-title` | dashboard | surface/typography variant |
| `.meta-list` | `_note-detail.scss` | `_meta.scss` |
| `tag-list`/`tag-popular-row` | `_notes.scss` | `_popular-tags.scss` or `_tags.scss` temporarily |
| LabelManager similar forms | `_labels.scss` | forms/rows primitives only if real shared use |

### Ordem Interna Da Phase 4

1. Garantir surfaces, badges, chips, meta, page primitive existem.
2. Mover `.settings-card`, `.panel`, `.panel-header`, `.panel-title` para surfaces se ainda faltar.
3. Mover `.page-content`, `.list-page-grid`, legal/page layout para owners corretos.
4. Mover `.meta-list` para `_meta.scss`.
5. Mover `.icon-badge` para badges.
6. Mover chips para `_chips.scss`.
7. Criar `_collections.scss`.
8. Mover Collections styles de `_profile.scss` para `_collections.scss`.
9. Adicionar import em `main.scss`.
10. Opcional separado: mover `CollectionsPage` para `src/pages/CollectionsPage.tsx`.
11. Comparar `_tags.scss` e `_collections.scss`.
12. Extrair shared `entity-*` para `_entity.scss`.
13. Padronizar create/edit forms e action rows.
14. Limpar Profile mantendo comportamento.
15. Resolver `tag-list`/`tag-popular-row` como shared ou tags/dashboard owner.
16. Migrar responsive entity para owners.

Nao fazer:

- nao misturar NoteRow/editor aqui;
- nao criar `.card` universal;
- nao forcar Profile e Tags/Collections para a mesma abstraction;
- nao remover possible legacy sem `rg`.

Gate de saida:

- Collections ja nao depende de `_profile.scss`;
- Legal ja nao vive em `_forms.scss`;
- Profile nao depende de `.meta-list` definida em NoteDetail;
- Tags/Collections partilham entity primitive quando faz sentido;
- Dashboard ja nao e source de surfaces/badges usadas aqui.

Validacao:

- build/typecheck;
- Profile;
- Profile import/export modals;
- Shortcut help modal;
- Patch notes modal;
- Tags list/detail/create/edit/favorite;
- Collections list/detail/create/edit;
- Legal;
- LabelManager;
- viewports `900x768`, `1024x768`, `1180x820`, `1366x768`, `1920x1080`;
- PT/EN;
- dark/light;
- empty states;
- cards hover/focus;
- favorite picker aberto.

Risco:

- medio;
- markup TSX pode ser necessario para `entity-*`;
- Profile cleanup tem risco medio se remover classes futuras/legacy sem confirmacao.

## Phase 5 - Notes List/Grid

Fonte obrigatoria:

- `07_components_styles_audit.md`
- `10_responsive_styles_audit.md`
- `15_notes_list_grid_migration_plan.md`

Objetivo:

- separar note list, note row, grid layout, filters, bulk actions, chips, thumbnails e menus;
- preservar comportamento de list/grid/mobile;
- nao mexer no editor.

Ficheiros alvo:

- `src/styles/components/_note-list.scss`
- `src/styles/components/_note-row.scss`
- `src/styles/components/_note-filters.scss`
- `src/styles/components/_bulk-actions.scss`
- `src/styles/components/_chips.scss`
- `src/styles/components/_thumbnail.scss`
- `src/styles/components/_color-dot.scss`
- `src/styles/components/_menus.scss`
- `src/styles/components/_buttons.scss`

### Notes Ownership Map

| Area | Origem atual | Destino alvo |
| --- | --- | --- |
| `.note-list` / list wrappers | `_notes.scss` | `_note-list.scss` |
| `.note-row` | `_notes.scss` | `_note-row.scss` |
| `.note-row__*` | `_notes.scss` | `_note-row.scss` |
| `.note-row__tag-chain*` | `_notes.scss` | `_note-row.scss` |
| `.notes-grid` | `_filters.scss` | `_note-list.scss` or `_note-row.scss` |
| `.notes-grid .note-row...` | `_filters.scss` | `_note-row.scss` with context or container strategy |
| filters | `_filters.scss` | `_note-filters.scss` |
| bulk actions | `_filters.scss` | `_bulk-actions.scss` |
| `.notes-filter-dot` | `_dashboard.scss` variants / filters | `_color-dot.scss` or badges |
| `.tag-chip` | `_notes.scss` | `_chips.scss` |
| `.collection-chip` | `_notes.scss` | `_chips.scss` |
| `.note-thumb` | `_notes.scss` | `_thumbnail.scss` |
| `.floating-menu` | `_filters.scss` | `_menus.scss` |
| `.note-row-menu` | `_filters.scss` | `_menus.scss` + note row positioning |
| quick capture/activity | `_notes.scss` | `_dashboard.scss` in Phase 6 |
| `tag-list`/`tag-popular-row` | `_notes.scss` | `_popular-tags.scss` or tags/dashboard shared |

### Ordem Interna Da Phase 5

1. Garantir chips, thumbnail, menus, buttons e z-index map existem.
2. Mover chip classes para `_chips.scss`.
3. Mover color variants para `_chips.scss`/`_color-dot.scss`.
4. Mover `.note-thumb` para `_thumbnail.scss`.
5. Mover `.floating-menu` e `.note-row-menu`.
6. Mover `.danger-action-button` se for primitive/action button.
7. Criar `_note-list.scss` e `_note-row.scss`.
8. Mover `.note-row`, `.note-row__*`, tag chain e note list wrappers.
9. Mover `.notes-grid` e context selectors de `_filters.scss`.
10. Criar `_note-filters.scss`.
11. Criar `_bulk-actions.scss`.
12. Mover filter e bulk selectors respetivamente.
13. Limpar `_notes.scss` de dashboard-only e tags-shared.
14. Rever row/grid duplication apenas depois de ficheiros estarem corretos.
15. Migrar responsive de notes para owners.
16. Cleanup seguro.

Preservar explicitamente:

- list mode;
- grid mode;
- compact mobile behavior;
- pinned reorder;
- drag handle;
- selection;
- menus;
- dashboard recent notes;
- tag hover lift validado anteriormente.

Possivel legacy a validar:

- `.note-row__summary-preview.is-overflowing`;
- `.notes-grid .note-row__summary-preview .markdown-preview`;
- `.note-card`;
- `.note-thumb.{variant}` fallback backgrounds;
- `.note-row__drag-handle.is-disabled`.

Nao fazer:

- nao mexer em Tiptap/ProseMirror;
- nao renomear todos os modifiers no primeiro passo;
- nao alterar row/grid visual junto com file moves;
- nao remover thumbnail fallbacks antes de validar assets;
- nao centralizar responsive antes de separar row/grid/filter/bulk owners.

Gate de saida:

- `_notes.scss` deixa de ser guarda-chuva;
- `_filters.scss` deixa de ser dono de notes grid e menus globais;
- chips/thumb/menu primitives nao dependem de notes;
- NoteRow/list/grid tem owner proprio;
- filters e bulk actions separados.

Validacao:

- build/typecheck;
- Notes all/favorites/recent/trash;
- list mode;
- grid mode;
- sort;
- filter por tag;
- filter por collection;
- selection mode;
- bulk actions;
- drag/reorder pinned;
- context menus;
- Dashboard recent notes;
- SearchBox results;
- LabelManager/SortableTagList;
- NoteDetail chips/thumb still render;
- viewports `900x768`, `1024x768`, `1180x820`, `1366x768`, `1920x1080`;
- long titles;
- long tags/collections;
- many overlapping tags;
- no collection;
- menu near end of list.

Risco:

- medio/alto;
- NoteRow list/grid e uma das areas mais sensiveis fora do editor.

## Phase 6 - Dashboard

Fonte obrigatoria:

- `12_component_primitives_plan.md`
- `15_notes_list_grid_migration_plan.md`
- `17_dashboard_migration_plan.md`

Objetivo:

- deixar `_dashboard.scss` dono apenas do dashboard;
- remover primitives globais do dashboard;
- devolver widgets dashboard-only que vivem em `_notes.scss`;
- resolver popular tags como shared.

Ficheiros alvo:

- `src/styles/pages/_dashboard.scss`
- `src/styles/components/_surfaces.scss`
- `src/styles/components/_badges.scss`
- `src/styles/components/_chips.scss`
- `src/styles/components/_thumbnail.scss`
- `src/styles/components/_color-dot.scss`
- `src/styles/components/_popular-tags.scss`
- `src/styles/components/_note-list.scss`
- `src/styles/components/_note-row.scss`

### Dashboard Ownership Map

| Area | Origem atual | Destino alvo |
| --- | --- | --- |
| `.dashboard-layout` | `_dashboard.scss` | `_dashboard.scss` |
| `.dashboard-side` | `_dashboard.scss` | `_dashboard.scss` |
| `.stats-grid` | `_dashboard.scss` | `_dashboard.scss`, possible rename later |
| `.stat-card` | `_dashboard.scss` | `_dashboard.scss` |
| `.quick-pin-*` | `_dashboard.scss` | `_dashboard.scss` |
| `.quick-capture` | `_notes.scss` | `_dashboard.scss` |
| `.capture-box` | `_notes.scss` | `_dashboard.scss` |
| `.capture-actions` | `_notes.scss` | `_dashboard.scss` |
| `.capture-tools` | `_notes.scss` | validate then cleanup/move |
| `.submit-button` | `_notes.scss` | `_dashboard.scss` or button primitive if repeated |
| `.activity-list` | `_notes.scss` | `_dashboard.scss` |
| `.activity-row` | `_notes.scss` | `_dashboard.scss` |
| `.activity-copy` | `_notes.scss` | `_dashboard.scss` |
| `.panel*` | `_dashboard.scss` | `_surfaces.scss` |
| `.settings-card` | `_dashboard.scss` | `_surfaces.scss` |
| `.icon-badge` | `_dashboard.scss` | `_badges.scss` |
| chip variants | `_dashboard.scss` | `_chips.scss` |
| `.notes-filter-dot` variants | `_dashboard.scss` | `_color-dot.scss` |
| `.tag-list`/`.tag-popular-row` | `_notes.scss` | `_popular-tags.scss` |
| `.note-card` | `_dashboard.scss` | validate legacy |

### Ordem Interna Da Phase 6

1. Garantir surfaces, badges, chips, thumbnail, color-dot, note-row/list existem.
2. Mover `_dashboard.scss` primitives para component files se ainda faltar.
3. Validar Dashboard, Tags, Profile, Legal, Collections, EmptyState.
4. Mover dashboard-only widgets de `_notes.scss` para `_dashboard.scss`.
5. Validar/remover `capture-tools`.
6. Criar `_popular-tags.scss`.
7. Mover `tag-list`/`tag-popular-row` para shared CSS.
8. Opcional: extrair `PopularTagList`/`PopularTagRow` TSX partilhado.
9. Limpar `_dashboard.scss` para conter apenas dashboard layout/widgets.
10. Validar/remover `.note-card`.
11. Mover responsive dashboard de `_responsive.scss` para `_dashboard.scss`.
12. Trocar hardcoded breakpoints por nomes depois da Phase 1.
13. Rever `stats-grid` e `quick-pin-row` behavior sem alterar durante ownership move.
14. TSX cleanup opcional em passo separado.

Nao fazer:

- nao redesenhar dashboard;
- nao forcar quick-pin picker para primitive antes de menus/search/popover estarem organizados;
- nao mover popular tags para dashboard se Tags continuar a usar;
- nao extrair TSX se CSS ownership ainda estiver instavel.

Gate de saida:

- `_dashboard.scss` nao define primitives globais;
- `_notes.scss` nao contem dashboard-only widgets;
- popular tags tem owner shared;
- dashboard responsive tem owner;
- quick-pin picker ainda funciona.

Validacao:

- build/typecheck;
- clicar em cada stat card;
- shortcuts de stats por digitos;
- abrir quick pin existente;
- adicionar/remover quick pin;
- quick pin picker focus/click outside/keyboard;
- quick capture submit;
- quick capture shortcut;
- activity list;
- popular tags;
- recent notes;
- cross validation em Tags/Profile/Legal/Collections/EmptyState;
- viewports `900x768`, `1024x768`, `1180x820`, `1366x768`, `1920x1080`, `2560x1440`;
- empty dashboard states;
- long quick pin titles;
- long tags/collections in recent notes.

Risco:

- medio;
- primitives extraction afeta muitas paginas;
- dashboard TSX tem keyboard/focus interactions.

## Phase 7 - Responsive Ownership Pass

Fonte obrigatoria:

- `04_breakpoints_audit.md`
- `10_responsive_styles_audit.md`
- responsive sections dos audits `13`, `14`, `15`, `16`, `17`

Objetivo:

- deixar responsive perto do owner real;
- reduzir `_responsive.scss`;
- substituir hardcoded breakpoints por nomes;
- validar tablet/desktop moderno.

Pre-condicoes:

- Phase 1 aplicada;
- shell/entity/notes/dashboard ownership aplicado;
- editor ainda pode estar pendente, mas as regras que pertencem a editor devem ser marcadas claramente se ficarem temporarias.

Ordem:

1. Listar todas as regras restantes em `_responsive.scss`.
2. Classificar por owner:
   - shell/sidebar/topbar/search;
   - dashboard;
   - profile;
   - tags;
   - collections;
   - notes list/grid;
   - note detail/editor;
   - labels;
   - modals;
   - updater/loading.
3. Mover regras para ficheiro dono quando o owner ja existir.
4. Manter temporariamente o que ainda nao tem owner pronto.
5. Trocar `1180px`, `900px`, `680px`, `1020px`, `42rem` por helpers/names.
6. Rever `1180px` como content collapse.
7. Rever `1020px` em note document layout.
8. Rever `stats-grid` behavior.
9. Rever tags/collections auto-fit vs forced `1fr`.
10. Validar viewports.

Nao fazer:

- nao alterar comportamento responsivo durante file moves;
- nao criar breakpoints desktop/4K "so porque sim";
- nao remover mobile rules sem testar;
- nao mexer no editor responsive sem fase editor.

Gate de saida:

- `_responsive.scss` fica pequeno, organizado e temporario, ou vazio;
- media queries usam nomes/helper;
- owners principais contem o seu responsive;
- tablet/content collapse documentado.

Validacao obrigatoria:

- `900x768`;
- `1024x768`;
- `1180x820`;
- `1366x768`;
- `1920x1080`;
- `2560x1440`;
- `3840x2160`;
- Dashboard;
- Notes list/grid;
- Profile;
- Tags/Collections;
- NoteDetail;
- modals;
- sidebar/topbar/search.

Risco:

- medio/alto;
- maior risco na zona `901px`-`1180px`;
- especial cuidado em `1024px`.

## Phase 8 - Note Detail/Editor

Fonte obrigatoria:

- `09_pages_styles_audit.md`
- `15_notes_list_grid_migration_plan.md`
- `16_note_detail_editor_migration_plan.md`

Objetivo:

- separar NoteDetail page layout de editor runtime;
- nao quebrar Tiptap/ProseMirror;
- nao quebrar TOC DOM queries;
- remover dependencias erradas de shell/profile/labels.

Pre-condicoes:

- foundations aplicadas;
- buttons, menus, chips, thumbnail, panel/surface, meta existem;
- NoteRow/list/grid ja esta isolado;
- shell `.nav-item` ja esta scoped ou tem plano de substituicao;
- import order suporta primitives antes de pages.

Ficheiros alvo:

- `src/styles/pages/_note-detail.scss`
- `src/styles/components/_note-toc.scss`
- `src/styles/components/_note-blocks.scss`
- `src/styles/components/_note-editor.scss`
- `src/styles/components/_note-editor-toolbar.scss`
- `src/styles/components/_note-node-views.scss`
- `src/styles/components/_note-side-panel.scss`
- `src/styles/components/_meta.scss`
- `src/styles/components/_thumbnail-picker.scss`
- `src/styles/components/_inline-form.scss` ou `_forms.scss`

### Note Detail Ownership Map

| Area | Origem atual | Destino alvo |
| --- | --- | --- |
| document/page shell | `_note.scss` / `_note-detail.scss` | `_note-detail.scss` |
| sticky document top | `_note-detail.scss`/`_note.scss` | `_note-detail.scss` |
| TOC | `_note.scss` | `_note-toc.scss` |
| note block list/layout | `_note.scss` | `_note-blocks.scss` |
| ProseMirror content | `_note.scss` | `_note-editor.scss` |
| inline editor | `_note.scss` | `_note-editor.scss` or `_note-blocks.scss` depending ownership |
| toolbar | `_note.scss` + `_editor.scss` | `_note-editor-toolbar.scss` |
| bubble toolbar | `_note.scss` | `_note-editor-toolbar.scss` |
| markdown tool buttons | `_editor.scss` | `_note-editor-toolbar.scss` or editor toolbar primitive |
| tip/file/image node views | `_note.scss` | `_note-node-views.scss` |
| `.note-image-size-*` | `_note.scss` | `_note-node-views.scss` | preserve |
| side panel rows/pickers | `_note.scss`/`_note-detail.scss` | `_note-side-panel.scss` |
| `.meta-list` | `_note-detail.scss` | `_meta.scss` |
| thumbnail picker | `_note-detail.scss` | `_thumbnail-picker.scss` |
| `.inline-form`/`.inline-picker` | `_menus.scss` / `_labels.scss` | `_inline-form.scss` or forms owner |
| `.nav-item nav-item--spaced` | shell class used in NoteDetail | `.side-panel-action` or `.side-list-toggle` |

### Ordem Interna Da Phase 8

1. Confirmar legacy com `rg` e app aberta.
2. Remover ou isolar legacy apenas se confirmado.
3. Mover `.meta-list`, `.meta-row`, `.meta-value` para `_meta.scss`.
4. Mover thumbnail picker mantendo `.note-thumb`.
5. Mover inline forms/pickers para owner proprio.
6. Criar `.side-panel-action` e substituir `.nav-item nav-item--spaced`.
7. Consolidar page layout em `_note-detail.scss`.
8. Mover TOC para `_note-toc.scss`.
9. Mover block editor layout para `_note-blocks.scss`.
10. Mover ProseMirror content para `_note-editor.scss`.
11. Mover toolbar/bubble toolbar/tool buttons para `_note-editor-toolbar.scss`.
12. Mover node views para `_note-node-views.scss`.
13. Mover side panel rows/pickers para `_note-side-panel.scss`.
14. Mover responsive note detail para owners.
15. Migrar z-index para tokens depois de map existir.
16. So depois considerar renomes.

Classes/queries a preservar:

- `.note-block-list`;
- `[data-note-block-id]`;
- `.note-block-title`;
- `.note-tiptap-prosemirror h1/h2/h3`;
- `.document-title-input note-title-input note-inline-prosemirror`;
- `.note-block-title note-inline-prosemirror`;
- `.note-image-size-*` enquanto TSX usar `quantizeImageWidth`.

Possivel legacy a validar:

- `.document-shell`;
- `.document-main`;
- `.note-edit-toolbar-shell`;
- `.content-section`;
- `.usage-table`;
- `.document-title-editor`;
- `.document-intro-editor`;
- `.copy-row-button`;
- `.document-footer-stats`;
- `.note-panel-toggle-list`;
- `.note-example-side-list`;
- `.note-linked-list`;
- `.tag-chip-button`;
- `.new-note-menu`;
- `.document-menu`.

Nao fazer:

- nao comecar por ProseMirror;
- nao renomear editor classes no primeiro passo;
- nao alterar DOM/nesting sem validar TOC;
- nao juntar editor/content typography em `_typography.scss`;
- nao remover `note-image-size-*`;
- nao trocar toolbar naming sem fase dedicada;
- nao mexer visual e ownership ao mesmo tempo.

Gate de saida:

- page layout e editor runtime separados;
- TOC tem owner proprio;
- blocks tem owner proprio;
- editor/prosemirror tem owner proprio;
- toolbar tem owner proprio;
- node views tem owner proprio;
- side panels tem owner proprio;
- NoteDetail nao depende de `.nav-item`;
- Profile usa apenas `.meta-list`, nao side-list.

Validacao funcional:

- abrir nota existente;
- criar nota nova;
- editar titulo/subtitulo;
- editar blocos;
- criar/remover/reordenar blocos;
- drag handles;
- toolbar sticky;
- bubble toolbar;
- marks bold/italic/link/etc.;
- tables;
- tips;
- files;
- images;
- image resize/alignment/wrap;
- local file placeholders;
- side panels examples/links/files/tags;
- backlinks;
- collection picker;
- tag picker;
- note links;
- TOC com h1/h2/h3 e scroll para heading.

Validacao visual:

- note vazia;
- note longa;
- note com muitos headings;
- note com imagens/files;
- note com side panels abertos;
- note sem thumbnail;
- note com thumbnail;
- dark/light;
- PT/EN;
- viewports `900x768`, `1024x768`, `1180x820`, `1366x768`, `1920x1080`, `2560x1440`, `3840x2160`.

Risco:

- alto;
- renomear classes ou alterar nesting pode quebrar TOC, toolbar target, editor content, node views ou drag handles.

## Phase 9 - Legacy Cleanup And Renames

Fonte obrigatoria:

- todos os audits;
- listas de possible legacy nas phases anteriores.

Objetivo:

- remover CSS sem uso confirmado;
- remover aliases temporarios;
- aplicar renomes claros onde ainda fizer sentido;
- reduzir leftovers de `_responsive.scss`, `_notes.scss`, `_dashboard.scss`, `_shell.scss`, `_note.scss`.

Pre-condicoes:

- phases principais concluidas;
- app validada em dark/light e viewports principais;
- todos os owners estao claros.

Ordem:

1. Criar lista final de selectors suspeitos.
2. Pesquisar com `rg`.
3. Confirmar uso dinamico/TSX/classnames compostos.
4. Validar visualmente fluxos onde selector podia aparecer.
5. Remover em pequenos grupos por owner.
6. Remover aliases temporarios.
7. Renomear modifiers se necessario.
8. Atualizar guidelines com regras aprendidas.

Renomes candidatos apenas depois de tudo estar estavel:

- `selectable` -> `note-row--selectable`;
- `with-pin-indicator` -> `note-row--with-pin-indicator`;
- `with-drag-handle` -> `note-row--with-drag-handle`;
- `is-dragging` -> `note-row--dragging`;
- `.stats-grid` -> `.dashboard-stats-grid`;
- `.quick-pin-row` -> `.dashboard-quick-pin-row`;
- `.nav-item` -> `.sidebar-nav-item`, se alias ainda existir.

Nao fazer:

- nao remover leftovers em massa;
- nao renomear classes sem validar TSX e tests visuais;
- nao apagar artwork/fallbacks sem decidir se ainda sao necessarios.

Gate de saida:

- aliases temporarios removidos ou documentados;
- `_responsive.scss` reduzido/eliminado;
- ficheiros page nao contem primitives globais;
- ficheiros components nao contem page-only widgets;
- guidelines atualizadas.

## Global Validation Matrix

### Comandos

- `npm run build`;
- `npm run typecheck`, se existir e nao estiver incluido no build;
- lint/test especifico se o projeto tiver e a fase tocar TSX.

### Paginas

- Dashboard;
- Notes list;
- Notes grid;
- Favorites;
- Recent;
- Trash;
- Note detail;
- Note editor;
- Profile;
- Tags;
- Collections;
- Legal.

### Componentes/Fluxos

- sidebar;
- topbar;
- search box;
- account menu;
- theme switcher;
- shortcuts modal;
- patch notes modal;
- import/export modals;
- toast viewport;
- color picker;
- LabelManager;
- SortableTagList;
- quick pin picker;
- note row menus;
- filters;
- bulk actions.

### Estados

- dark theme;
- light theme;
- PT;
- EN;
- empty states;
- long note titles;
- long tag names;
- long collection names;
- many overlapping tags;
- note without collection;
- menus near viewport edge;
- keyboard focus;
- popovers open;
- modals open;
- sidebar open/closed;
- quick pins empty/full;
- notes with files/images;
- editor with headings.

### Viewports

- `900x768`;
- `1024x768`;
- `1180x820`;
- `1366x768`;
- `1920x1080`;
- `2560x1440`;
- `3840x2160`.

## Risk Register

### Alto

- Note detail/editor;
- Tiptap/ProseMirror selectors;
- TOC DOM queries;
- NoteRow list/grid interactions;
- responsive migration around `1024px` and `1180px`.

### Medio/Alto

- notes list/grid ownership;
- global primitives extraction;
- breakpoint map changes;
- topbar layout change;
- z-index migration across menus/modals/editor.

### Medio

- shell split;
- entity pages migration;
- dashboard cleanup;
- theme token migration;
- popular tags shared extraction.

### Baixo/Medio

- adding tokens without migrating usage;
- moving selectors while preserving names and import order;
- adding docs/guidelines;
- removing legacy only after `rg` and visual validation.

## Definition Of Done

O refactor CSS so deve ser considerado fechado quando:

- `AGENTS.md` e style guidelines existem;
- foundations estao criadas e documentadas;
- primitives globais vivem em owners corretos;
- Dashboard ja nao define primitives globais;
- `_notes.scss` ja nao e ficheiro guarda-chuva para chips/thumb/dashboard/widgets;
- `_filters.scss` ja nao e dono de grid/list/menu global;
- `_forms.scss` ja nao contem page primitives/legal page;
- Collections ja nao vive em `_profile.scss`;
- Legal tem owner proprio;
- `_responsive.scss` esta reduzido ou eliminado por ownership;
- NoteDetail/editor esta separado por owners;
- `.nav-item` nao e usado fora da sidebar;
- `.meta-list` vive em `_meta.scss`;
- typography global existe e editor typography esta separada;
- z-index usa nomes por area onde ja foi migrado;
- breakpoints usam nomes/helper onde ja foi migrado;
- hardcoded values restantes estao justificados;
- validation matrix foi executada nas fases que tocaram visual/layout.

## Primeiro Batch Real Recomendado

Depois deste documento, o primeiro batch de trabalho deve ser:

1. Criar `AGENTS.md`.
2. Criar `Documentation/style_system_guidelines.md`.
3. Aplicar Phase 1.1 a 1.3:
   - formatacao de `_variables.scss`;
   - `space-7`;
   - semantic tokens base;
   - typography tokens;
   - mover `.page-title`/`.page-subtitle`.
4. Nao mover component primitives ainda.
5. Build/typecheck.
6. Validacao visual minima.

Motivo:

- cria regras permanentes;
- reduz retrabalho;
- resolve token ausente real;
- nao aumenta o risco com migrations globais logo no primeiro passo.

## Proxima Acao

- Criar as guidelines permanentes.
- Depois executar Phase 1 em batches pequenos.
- Nao iniciar Phase 2 enquanto Phase 1 e guidelines nao estiverem fechadas.
