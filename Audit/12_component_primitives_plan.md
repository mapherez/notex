# Component Primitives Plan

## Estado

- Estado: Visto
- Data: 2026-06-05
- Ficheiros analisados:
  - `Audit/07_components_styles_audit.md`
  - `Audit/09_pages_styles_audit.md`
  - `Audit/11_foundation_implementation_plan.md`
  - `src/components/ui/Panel.tsx`
  - `src/components/ui/IconBadge.tsx`
  - `src/components/ui/EmptyState.tsx`
  - `src/components/ui/TagChip.tsx`
  - `src/components/ui/NoteThumbnail.tsx`
  - `src/styles/pages/_dashboard.scss`
  - `src/styles/pages/_profile.scss`
  - `src/styles/pages/_note-detail.scss`
  - `src/styles/pages/_note.scss`
  - `src/styles/components/_forms.scss`
  - `src/styles/components/_filters.scss`
  - `src/styles/components/_notes.scss`
  - `src/styles/components/_labels.scss`
  - `src/styles/components/_menus.scss`
  - `src/styles/layout/_shell.scss`
  - `src/styles/main.scss`
  - TSX usages em `src/pages` e `src/components`

## Objetivo

- Definir as primitives CSS/component que devem existir antes das migrations de shell, entity pages, notes e dashboard.
- Remover dependencias cruzadas como componentes UI a dependerem de styles definidos em page files.
- Evitar criar uma `.card` generica demais que vire outro ponto de confusao.

## Findings

- Existem componentes React que ja sao primitives, mas os styles vivem no sitio errado:
  - `Panel.tsx` usa `.panel`, `.panel-header`, `.panel-title`, mas os styles estao em `pages/_dashboard.scss`.
  - `IconBadge.tsx` usa `.icon-badge`, mas o style esta em `pages/_dashboard.scss`.
  - `EmptyState.tsx` usa `.panel` e `.page-subtitle.empty`, dependendo de dashboard/forms.
  - `TagChip.tsx` usa `.tag-chip`, `.tag-chip-link`, `.tag-remove`, mas os styles vivem em `components/_notes.scss`.
  - `NoteThumbnail.tsx` usa `.note-thumb`, mas os styles vivem em `components/_notes.scss`.

- Ha primitives CSS globais espalhadas:
  - `.page-content`, `.page-title`, `.page-subtitle`, `.kbd` em `components/_forms.scss`.
  - `.icon-button` em `layout/_shell.scss`.
  - `.icon-button.danger` em `components/_labels.scss`.
  - `.floating-menu`, `.topbar-menu`, `.account-menu`, `.note-row-menu`, `.sidebar-new-menu` em `components/_filters.scss`.
  - `.meta-list`, `.meta-row`, `.meta-value`, `.side-list` em `pages/_note-detail.scss`.

- `pages/_dashboard.scss` define a base visual de `.panel`, `.settings-card`, `.profile-card`, `.note-card`, `.stat-card`. Isto torna o dashboard dono de surfaces usadas por Profile, Legal, Tags, Collections e componentes UI.

- `.settings-card` esta dividida:
  - border/radius/background em `_dashboard.scss`
  - padding em `_profile.scss`
  - uso em Profile, Legal, Tags e Collections

- `.profile-section` e `.settings-card` sao conceitos muito parecidos. Hoje um esta orientado para profile e outro virou card generico por acidente. Devem ser normalizados por uma primitive de surface/card.

- `.tag-card` e `.collection-card` sao quase clones, mas devem ser tratados no ponto 14 (`Entity pages migration plan`). Aqui basta reservar primitives de card/actions para suportar essa migracao.

- `NoteRow` e `notes-grid` sao complexos e devem ficar para o ponto 15. Eles podem usar primitives como `icon-button`, `floating-menu`, `chips` e `note-thumb`, mas a grid/list migration nao deve entrar neste ponto.

- `Note detail/editor` tem primitives candidatas (`meta-list`, `side-list`, `tip-box`, `usage-table`), mas a parte editor/Tiptap deve ficar para o ponto 16.

## Primitives Propostas

### 1. Page Primitive

Ficheiro recomendado:

- `src/styles/components/_page.scss` ou `src/styles/layout/_page.scss`

Classes:

- `.page-content`
- `.list-page-grid`
- possivelmente `.legal-page` depois, se nao for criado `pages/_legal.scss`

Notas:

- `.page-title` e `.page-subtitle` devem ir para `base/_typography.scss`, como definido no ponto 11.
- `.page-content` e layout, nao form. Deve sair de `_forms.scss`.

### 2. Surface/Panel Primitive

Ficheiro recomendado:

- `src/styles/components/_surfaces.scss`

Classes:

- `.panel`
- `.panel.flush`
- `.panel-header`
- `.panel-title`
- `.settings-card`
- `.profile-section` como alias temporario ou migracao progressiva

Possiveis tokens de suporte:

- `--nx-card-padding`
- `--nx-card-padding-compact`
- `--nx-section-gap`
- `--nx-interactive-lift`

Notas:

- Nao criar uma `.card` generica para tudo de imediato.
- Melhor ter primitives semanticas:
  - `.surface-card`
  - `.panel`
  - `.settings-card`
  - `.interactive-card`
- `.stat-card`, `.quick-pin-card`, `.tag-card`, `.collection-card` devem continuar page/domain-specific ate as migrations correspondentes.

### 3. Button Primitive

Ficheiro recomendado:

- `src/styles/components/_buttons.scss`

Classes:

- `.icon-button`
- `.icon-button.danger`
- possivelmente `.inline-icon-button`, se continuar em uso depois de validar

Notas:

- `.icon-button` e usada em TopBar, NoteDetail, Profile, NoteRow, LabelManager, PatchNotesModal, ToastViewport e editor.
- Deve sair de `layout/_shell.scss`.
- `.icon-button.danger` deve sair de `components/_labels.scss`.
- Botoes grandes de entidade (`tag-action-button`, `collection-action-button`, `profile-action-row`) nao entram aqui ainda; ficam para entity pages.

### 4. Badge/Icon Primitive

Ficheiro recomendado:

- `src/styles/components/_badges.scss`

Classes:

- `.icon-badge`
- `.icon-badge.{color}`

Notas:

- `IconBadge.tsx` ja existe e deve ser o owner React.
- O loop `$palette-colors` para `.icon-badge` deve sair de `_dashboard.scss`.
- O fallback hardcoded `#f4f5f7`/`#0d0f13` deve ser revisto depois dos theme tokens do ponto 11.

### 5. Chips Primitive

Ficheiro recomendado:

- `src/styles/components/_chips.scss`

Classes:

- `.tag-chip`
- `.tag-chip-link`
- `.tag-remove`
- `.collection-chip`
- `.collection-chip--empty`
- color variants geradas por `$palette-colors`

Notas:

- `TagChip.tsx` ja existe.
- `collection-chip` ainda nao tem componente React dedicado; pode continuar como class ate haver necessidade.
- Os chips sao usados em NoteRow, Tags, Dashboard, LabelManager, SortableTagList e NoteDetail.
- Devem sair de `components/_notes.scss` e do loop em `_dashboard.scss`.

### 6. Thumbnail Primitive

Ficheiro recomendado:

- `src/styles/components/_thumbnail.scss`

Classes:

- `.note-thumb`
- `.note-thumb.{variant}`

Notas:

- `NoteThumbnail.tsx` ja existe.
- As cores/gradients das variants podem continuar como artwork local, nao precisam virar theme tokens agora.
- Deve sair de `components/_notes.scss`, porque thumbnail e usado em Dashboard, SearchBox, NoteRow e NoteDetail.

### 7. Floating Menu Primitive

Ficheiro recomendado:

- reaproveitar `src/styles/components/_menus.scss`, ou criar `src/styles/components/_floating-menu.scss`

Classes:

- `.floating-menu`
- `.floating-menu strong`
- `.floating-menu .menu-muted`
- `.floating-menu button`
- `.floating-menu a`
- posicionadores:
  - `.topbar-menu`
  - `.account-menu`
  - `.note-row-menu`
  - `.sidebar-new-menu`

Notas:

- `_menus.scss` existe, mas hoje nao contem a primitive real.
- `floating-menu` deve sair de `_filters.scss`.
- Posicionadores podem ficar junto da primitive inicialmente, mas depois alguns podem migrar para shell/notes se fizer sentido.

### 8. Meta/List Primitive

Ficheiro recomendado:

- `src/styles/components/_meta.scss`

Classes candidatas:

- `.meta-list`
- `.meta-row`
- `.meta-value`

Classes a adiar:

- `.side-list`
- `.side-edit-row`
- `.linked-row`
- `.linked-row-shell`

Notas:

- `.meta-list` e usada em NoteDetail e Profile.
- `.side-list` parece mais document/note-detail-specific e pode ficar para o ponto 16, a menos que apareca uso noutros dominios.

### 9. Content Preview Primitive

Ficheiro recomendado:

- manter em `components/_editor.scss` por agora, ou separar depois para `components/_content.scss`

Classes:

- `.markdown-preview`

Notas:

- Usado em `PatchNotesModal` e note grid preview.
- Nao e prioridade antes de panels/buttons/chips/menus.
- Deve ser tratado com note detail/editor migration, para nao misturar content typography com UI primitives.

## Ficheiros Novos Recomendados

Opção mais clara:

```scss
@use "components/page";
@use "components/surfaces";
@use "components/buttons";
@use "components/badges";
@use "components/chips";
@use "components/thumbnail";
@use "components/menus";
@use "components/meta";
```

Ou, se quisermos menos ficheiros no inicio:

```scss
@use "components/primitives";
```

Recomendacao:

- usar ficheiros separados. A app ja tem ficheiros grandes demais; um `_primitives.scss` unico vai crescer rapido e repetir o problema.

## Ordem De Extração Recomendada

1. Foundations do ponto 11.
2. `page` + typography:
   - mover `.page-content` para page/layout primitive.
   - mover `.page-title`, `.page-subtitle`, `.page-subtitle.empty` para `_typography.scss`.
3. `surfaces`:
   - mover `.panel`, `.panel-header`, `.panel-title`.
   - mover base de `.settings-card`.
   - manter `.profile-section` temporariamente, mas alinhar tokens/padding.
4. `buttons`:
   - mover `.icon-button`.
   - mover `.icon-button.danger`.
   - atualizar imports sem mudar markup.
5. `badges`:
   - mover `.icon-badge`.
   - mover color variants do loop `$palette-colors`.
6. `chips`:
   - mover `.tag-chip`, `.tag-chip-link`, `.tag-remove`, `.collection-chip`.
   - mover color variants do loop `$palette-colors`.
7. `thumbnail`:
   - mover `.note-thumb` e variants.
8. `menus`:
   - mover `.floating-menu` e posicionadores.
   - validar `.document-menu` antes de remover.
9. `meta`:
   - mover `.meta-list`, `.meta-row`, `.meta-value`.
   - deixar side-list/link rows para note detail/editor plan.

## O Que Nao Deve Entrar Neste Ponto

- Refactor de `NoteRow`/`notes-grid`.
- Refactor de Tiptap/ProseMirror/editor content.
- Unificacao completa de Tags/Collections.
- Rework completo de Profile sections.
- Remocao agressiva de CSS unused.
- Mudancas visuais de design.

## Risco

- Medio.
- Mover classes globais entre ficheiros e de baixo risco se a ordem de imports for preservada.
- O risco aumenta em chips, menus e note thumbnails porque sao usados em varios fluxos.
- O risco maior e mudar comportamento visual por acidente ao transformar styles page-specific em primitives globais.

## Validacao Recomendada

- Depois de cada extração:
  - `npm run build` ou typecheck/build equivalente.
  - validar visualmente Dashboard, Notes list/grid, NoteDetail, Profile, Tags/Collections, modals.
- Para primitives globais:
  - testar dark/light.
  - testar keyboard focus em buttons, chips e menus.
  - testar viewport tablet depois de mover responsive rules relacionadas.

## Proxima Acao

- Seguir para o ponto 13: Shell/layout migration plan.
- Esse plano deve consumir as primitives de `buttons`, `menus`, `page/search` e definir o que sai de `_shell.scss`, `_forms.scss`, `_toast.scss` e `_filters.scss`.
