# CSS Audit Spec

Este documento e a pasta `Audit` servem para acompanhar a limpeza geral de CSS/SCSS da app. Cada item deve ser analisado separadamente. Quando um item for visto, criar o ficheiro de resultados indicado na coluna `Resultado` e atualizar o estado aqui.

## Estados

- `[ ]` Nao visto
- `[~]` Em analise
- `[x]` Visto
- `[!]` Bloqueado ou precisa decisao

## Objetivo

Reduzir CSS repetido, remover estilos hardcoded quando fizer sentido, centralizar tokens reutilizaveis, melhorar responsive desktop/tablet, e preparar a app para novos accents/themes sem tornar cada pagina dificil de manter.

## Checklist

Nota apos os pontos 1-10: os itens finais foram revistos depois do audit geral. A ordem antiga ainda apontava para areas importantes, mas faltava um plano de foundations antes das migrations, e alguns pontos estavam demasiado misturados.

| Estado | Area | Resultado |
| --- | --- | --- |
| `[x]` | Audit geral dos SCSS: cores hardcoded, spacing hardcoded, font sizes/weights espalhados, estilos duplicados, classes globais no sitio errado | `Audit/01_general_scss_inventory.md` |
| `[x]` | `src/styles/abstracts/_variables.scss`: verificar tokens existentes, lacunas, nomes, card paddings, section gaps, row gaps, radius, shadows, z-index e escalas reutilizaveis | `Audit/02_variables_audit.md` |
| `[x]` | `src/styles/base/_typography.scss`: rever falta de uso, definir escala tipografica pratica para titulos, labels, body, muted text, captions e valores compactos | `Audit/03_typography_audit.md` |
| `[x]` | `src/styles/abstracts/_breakpoints.scss`: rever breakpoints atuais e preparar desktop/tablet: FullHD, 1440p, 4K, tablets 1024/1180/1366 | `Audit/04_breakpoints_audit.md` |
| `[x]` | `src/styles/abstracts/_functions.scss` e `_mixins.scss`: identificar mixins/functions existentes e novos casos uteis para cards, rows, focus, truncation, responsive grids e hover states | `Audit/05_functions_mixins_audit.md` |
| `[x]` | Themes `src/styles/themes/_dark.scss` e `_light.scss`: rever variaveis de theme, cores hardcoded que devem virar tokens, e preparacao para futuros accents/themes | `Audit/06_themes_audit.md` |
| `[x]` | `src/styles/components`: verificar estilos usados/nao usados, repetidos, ficheiros com responsabilidade errada, e componentes que precisam primitives comuns | `Audit/07_components_styles_audit.md` |
| `[x]` | `src/styles/layout/_shell.scss`: rever spacing, cores, layout tokens, responsive assumptions, hardcoded values e estilos candidatos a primitives | `Audit/08_shell_styles_audit.md` |
| `[x]` | `src/styles/pages`: verificar repeticao entre paginas, classes globais em ficheiros de pagina, hardcoded values, naming inconsistente e estilos que devem virar componentes | `Audit/09_pages_styles_audit.md` |
| `[x]` | `src/styles/responsive`: rever regras existentes, duplicacao, breakpoints manuais, tablet readiness e grids que podem usar `auto-fit/minmax` | `Audit/10_responsive_styles_audit.md` |
| `[x]` | Foundation implementation plan: consolidar tokens, typography, z-index, breakpoints, theme vars, mixins/helpers e ordem de imports antes de mexer nas migrations | `Audit/11_foundation_implementation_plan.md` |
| `[x]` | Component primitives plan: planear extracao de `.panel`, `.settings-card`, `.icon-button`, `.icon-badge`, `.floating-menu`, `.page-content`, `.meta-list`, card base, rows/list rows e interactive cards | `Audit/12_component_primitives_plan.md` |
| `[x]` | Shell/layout migration plan: separar app frame, titlebar, sidebar, topbar, search, menus globais, responsive ownership e styles de shell espalhados por outros ficheiros | `Audit/13_shell_layout_migration_plan.md` |
| `[x]` | Entity pages migration plan: unificar Profile, Settings, Legal, Tags e Collections onde partilham cards, titles, rows, forms, actions, side panels e entity cards | `Audit/14_entity_pages_migration_plan.md` |
| `[x]` | Notes list/grid migration plan: rever `NoteRow`, `notes-grid`, filters, bulk actions, badges, chips, menus e responsive list/grid antes de mexer no editor | `Audit/15_notes_list_grid_migration_plan.md` |
| `[x]` | Note detail/editor migration plan: separar document layout, side panels/meta lists, note blocks, Tiptap/ProseMirror, node views, toolbar e editor responsive | `Audit/16_note_detail_editor_migration_plan.md` |
| `[x]` | Dashboard migration plan: mover primitives para ficheiros certos, devolver dashboard-only styles ao dashboard, e definir mudancas concretas para `_dashboard.scss` e `DashboardPage.tsx` | `Audit/17_dashboard_migration_plan.md` |
| `[x]` | Decision log final: consolidar recomendacoes, ordem de implementacao, riscos e decisoes que precisam aprovacao | `Audit/99_css_audit_decision_log.md` |

## Template Para Ficheiros De Resultado

Cada ficheiro de resultado deve usar esta estrutura:

```md
# [Nome Da Area]

## Estado

- Estado: Nao visto | Em analise | Visto | Bloqueado
- Data:
- Ficheiros analisados:

## Findings

- 

## Recomendacoes

- 

## Risco

- Baixo | Medio | Alto

## Proxima Acao

- 
```
