# Note Detail/Editor Migration Plan

## Estado

- Estado: Visto
- Data: 2026-06-05
- Ficheiros analisados:
  - `Audit/09_pages_styles_audit.md`
  - `Audit/10_responsive_styles_audit.md`
  - `Audit/11_foundation_implementation_plan.md`
  - `Audit/12_component_primitives_plan.md`
  - `Audit/13_shell_layout_migration_plan.md`
  - `Audit/15_notes_list_grid_migration_plan.md`
  - `src/styles/pages/_note-detail.scss`
  - `src/styles/pages/_note.scss`
  - `src/styles/components/_editor.scss`
  - `src/styles/components/_menus.scss`
  - `src/styles/components/_labels.scss`
  - `src/styles/responsive/_responsive.scss`
  - `src/styles/main.scss`
  - `src/pages/NoteDetailPage.tsx`
  - `src/components/notes/NoteTiptapEditor.tsx`
  - `src/components/editing/TextStyleToolbar.tsx`
  - ocorrencias TSX/SCSS de document layout, TOC, blocks, Tiptap/ProseMirror, toolbar, node views, side lists, meta lists, thumbnail picker e inline forms

## Objetivo

- Separar o detalhe da nota em owners claros:
  - layout/sticky header da pagina
  - document shell/TOC/main/asides
  - header da nota, collection field e thumbnail picker
  - block editor
  - Tiptap/ProseMirror content
  - editor toolbar/bubble toolbar/text style/table menu
  - node views de tip, file e image
  - side panels, meta rows, linked rows e pickers
- Reduzir dependencia cruzada com shell, labels, menus, dashboard/profile e responsive global.
- Planear a migracao sem mexer no comportamento do editor no mesmo passo.

## Findings

- O ownership React esta concentrado em dois ficheiros principais:
  - `NoteDetailPage.tsx` monta `document-top`, `note-document-shell`, TOC, main document, note header, block list e aside panels.
  - `NoteTiptapEditor.tsx` monta `NoteTiptapEditor`, `NoteInlineTiptapEditor`, `NoteTiptapToolbar`, bubble menu e node views de tip/file/image.

- `NoteDetailPage.tsx` tambem contem varios componentes locais com estilos proprios:
  - `NoteHeader`
  - `ThumbnailPicker`
  - `BlockEditor`
  - `TagEditor`
  - `LinkedNoteRow`
  - `RelatedLinkRow`
  Estes componentes sao suficientemente grandes para justificar owners CSS claros, mesmo que continuem no mesmo TSX por agora.

- O ownership SCSS esta dividido de forma pouco intuitiva:
  - `_note-detail.scss` contem page/detail layout, sticky top bar, toolbar shell, document headings, thumbnail picker, collection field, old document content sections, usage table, meta list, side list, link picker e backlinks.
  - `_note.scss` contem o layout atual da nota (`note-document-shell`), TOC, blocks, inline editor, Tiptap/ProseMirror content, toolbar visual, bubble toolbar, node views, side-panel list variants e alguns menus/actions.
  - `_editor.scss` contem text style toolbar, markdown tool button/tooltip, table menu, markdown preview/table styles e confirm box.
  - `_menus.scss` contem inline pickers/forms/document menu, mas nao a primitive real de floating menu, que foi identificada noutros pontos.

- A separacao atual entre `_note-detail.scss` e `_note.scss` nao segue o fluxo atual da UI. O ficheiro `_note-detail.scss` soa como o dono da pagina atual, mas uma parte importante da experiencia atual esta em `_note.scss`.

- `_note-detail.scss` parece manter uma camada antiga de document/detail styles que nao apareceu no TSX atual:
  - `.document-shell`
  - `.document-main`
  - `.note-edit-toolbar-shell`
  - `.document-title`, `.document-title-editor`, `.document-intro`, `.document-intro-editor`
  - `.content-section`, `.section-copy`
  - `.usage-table`, `.usage-editor-*`, `.copy-row-button`
  - `.document-footer-stats`
  Estes seletores devem ser validados antes de remover. O mais provavel e que tenham ficado de uma versao anterior do detalhe da nota.

- Existem responsive rules aparentemente stale em `_responsive.scss`:
  - `.note-edit-toolbar-shell`
  - `.note-edit-toolbar__actions-divider`
  - `.note-edit-toolbar__actions`
  - `.document-heading-row`
  - `.document-heading-side`
  - `.document-edit-actions`
  - `.usage-table`
  - `.thumbnail-picker-menu`
  Algumas ainda podem afetar classes usadas, mas varias nao aparecem no TSX atual. Devem ser confirmadas por `rg` e validacao visual antes de cleanup.

- `document-top` usa uma toolbar sticky com `NoteTiptapToolbar` no meio. O mesmo elemento recebe classes `note-edit-toolbar note-tiptap-toolbar`, o que cruza o conceito de toolbar de documento com toolbar de editor. Isto deve ser normalizado, mas so depois de a toolbar ter owner CSS proprio.

- `note-tiptap-toolbar` esta definido em `_note.scss`, enquanto os botoes internos `.markdown-tool-button`, `.toolbar-divider`, `.markdown-table-menu` e tooltips vivem em `_editor.scss`. Isto divide a toolbar por dois ficheiros sem uma fronteira clara.

- A bubble toolbar (`.note-bubble-toolbar`) vive em `_note.scss`, mas usa os mesmos `ToolbarButton`/`.markdown-tool-button` de `_editor.scss`. Deveria pertencer ao mesmo owner da toolbar do editor.

- O conteudo ProseMirror esta todo em `_note.scss`:
  - `.note-tiptap-prosemirror`
  - links e external-link icon por `mask`
  - code/pre/headings/blockquote
  - task list
  - tables
  Isto e conteudo/editor typography, nao page layout.

- `NoteInlineTiptapEditor` aplica classes compostas como `document-title-input note-title-input note-inline-prosemirror` e `note-block-title note-inline-prosemirror`. Isto torna a ordem dos selectors importante. A migration nao deve renomear estas classes no primeiro passo.

- O block editor tambem mistura layout, comportamento e editor:
  - `.note-block-list`
  - `.note-block`
  - `.note-block-handle`
  - `.note-block-delete`
  - `.note-block-zone-add`
  - `.note-block-title`
  - `.note-block-body`
  Estes styles dependem de hover/focus, drag/reorder e estados vazios; a migration deve manter markup e seletores inicialmente.

- O TOC e uma unidade propria:
  - `.note-toc`
  - `.note-toc-dashes`
  - `.note-toc-content`
  - `.note-toc-link`
  - `.note-toc-empty`
  O TSX calcula headings via DOM query em `.note-block-list`, `.note-block-title` e `.note-tiptap-prosemirror h1/h2/h3`. Alteracoes de classe aqui podem quebrar TOC, mesmo que sejam "so CSS".

- As node views de Tiptap vivem no TSX do editor, mas os estilos estao em `_note.scss`:
  - `TipNodeView`: `.tip-box`, `.note-tip-box`, `.note-tip-delete`, `.note-tip-content`
  - `FileNodeView` file: `.note-file-card`
  - `FileNodeView` image: `.note-image-node`, `.note-image-size-*`, `.note-image-placeholder`, `.note-image-controls`
  A classe `.tip-box` e uma primitive visual antiga/reutilizada; a classe `.note-tip-box` e especifica de node view. Devem ser separadas.

- A imagem no editor usa uma geracao Sass de tamanhos `.note-image-size-160` ate `.note-image-size-760`. Isto esta ligado ao comportamento do node view (`quantizeImageWidth`). Nao deve ser removido nem renomeado sem verificar a logica TSX.

- Os side panels usam `Panel`, `.meta-list`, `.side-list`, `.side-edit-row`, `.linked-row-shell`, `.linked-row`, `.note-link-picker`, `.side-row-actions`, `.side-list-actions` e `.note-file-side-list`.

- `.meta-list` e usada tambem no Profile (`profile-stat-grid`), mas esta definida em `_note-detail.scss`. Como no ponto 12, deve virar primitive em `components/_meta.scss`.

- `.side-list` e parecida com primitive, mas por agora e mais document/note-detail-specific. So deve virar primitive se aparecer uso real noutras areas depois das entity migrations.

- `NoteDetailPage.tsx` usa `.nav-item nav-item--spaced` para botoes dentro do aside (`add example`, `add link`, `add tag`). Isto e dependencia errada do shell/sidebar. O ponto 13 ja identificou isto. O ponto 16 deve criar uma action propria, por exemplo `.side-panel-action` ou `.side-list-toggle`.

- `.inline-form` e `.inline-picker` vivem em `_menus.scss`, mas sao usados dentro do note detail. Alem disso, `_labels.scss` define `.inline-form > button`, o que cria dependencia de labels para formularios inline da nota. Isto deve virar primitive de inline form/action ou mover para um owner de forms.

- `.document-menu` existe em `_menus.scss`, mas nao apareceu como uso atual em `NoteDetailPage.tsx`. Deve ser validado antes de manter.

- `.note-panel-toggle-list`, `.note-example-side-list`, `.note-linked-list`, `.tag-chip-button` e `.new-note-menu` aparecem em `_note.scss`, mas nao apareceram no TSX atual do note detail. Devem ser tratados como possivel legacy.

- `ThumbnailPicker` usa `NoteThumbnail`, mas tem styles proprios em `_note-detail.scss`. A primitive `note-thumb` deve vir do ponto 15; o picker em si deve ficar com note detail ou virar `components/_thumbnail-picker.scss`.

- Existem z-index locais relevantes:
  - text style picker `65`
  - markdown table menu `65`
  - document top `70`
  - old toolbar shell `80`
  - markdown tooltip `95`
  - thumbnail menu `30`
  - note toc `40`
  - note toolbar `60`
  - new note menu `50`
  Estes valores devem mapear para o z-index plan do ponto 11 antes de refatorar stacking.

- Ha valores hardcoded e tokens em falta:
  - `_note.scss` usa `--nx-space-7`, ainda ausente nos tokens atuais.
  - document widths `58rem`, `78rem`, `88rem`
  - aside width `20rem`
  - TOC width `2.75rem` e popup `14rem`
  - block min heights `30px`
  - toolbar/button sizes `2rem`, `2.75rem`, `3.1rem`
  - thumbnail sizes `5rem`, `2.9rem`, `2.25rem`
  - radius locais `0.13rem`, `0.18rem`, `0.22rem`, `0.23rem`, `0.3rem`, `0.32rem`, `0.35rem`

- Ha alguma formatacao desalinhada em `_note.scss` e `_note-detail.scss`. Exemplos: indentacao de `.note-toc`, `.note-toc-link`, `.note-block-body`, `.note-block-title`, `.note-tiptap-editor`, `.document-title-input`. Isto nao e funcional, mas aumenta ruido quando comecarmos a mover blocos.

- Responsive do note detail esta fragmentado:
  - `_responsive.scss` colapsa `.document-shell` e `.document-aside` aos `1180px`.
  - `_responsive.scss` mexe em toolbar/document/thumbnail aos `900px`/`680px`.
  - `_note.scss` colapsa `.note-document-shell` aos `1020px`.
  - `_note.scss` altera block handles no mobile aos `680px`.
  O breakpoint `1020px` deve virar `tablet-wide` ou `note-document-collapse`, como no ponto 10/11.

- A zona tablet e particularmente sensivel. A app global so colapsa sidebar aos `900px`, mas a nota colapsa o document shell aos `1020px`. Em 1024px, isto pode ser quase no limite e precisa validacao visual.

## Target Structure Recomendada

### Pages

- `src/styles/pages/_note-detail.scss`
  - `document-top`
  - `document-actions`
  - `back-button`, se nao virar primitive/action
  - `note-document-shell`
  - `note-document-main`
  - `note-document-aside`
  - `note-document-heading`
  - high-level page spacing/widths

- Opcao alternativa:
  - manter `_note.scss` como page atual e renomear mentalmente para document/editor page.
  - Nao recomendado a medio prazo porque o nome `_note-detail.scss` ja existe e hoje os dois ficheiros dividem a mesma pagina.

### Components

- `src/styles/components/_note-toc.scss`
  - `.note-toc`
  - `.note-toc-dashes`
  - `.note-toc-content`
  - `.note-toc-link`

- `src/styles/components/_note-blocks.scss`
  - `.note-block-list`
  - `.note-block`
  - `.note-block-body`
  - `.note-block-title`
  - `.note-block-handle`
  - `.note-block-delete`
  - `.note-block-zone-add`
  - `.note-add-block-row`

- `src/styles/components/_note-editor.scss`
  - `.note-tiptap-editor`
  - `.note-inline-editor`
  - `.note-inline-prosemirror`
  - `.note-tiptap-prosemirror`
  - editor content typography: links, code, pre, headings, blockquote, task list, tables

- `src/styles/components/_note-editor-toolbar.scss`
  - `.note-edit-toolbar`
  - `.note-edit-toolbar__tools`
  - `.note-tiptap-toolbar`
  - `.note-bubble-toolbar`
  - `.markdown-tool-button`
  - `.toolbar-divider`
  - `.markdown-tool-tooltip`
  - `.markdown-table-menu`
  - `.text-style-toolbar`
  - `.text-style-picker`

- `src/styles/components/_note-node-views.scss`
  - `.note-tip-box`
  - `.note-tip-delete`
  - `.note-tip-content`
  - `.note-file-card`
  - `.note-image-node`
  - `.note-image-size-*`
  - `.note-image-placeholder`
  - `.note-image-controls`

- `src/styles/components/_note-side-panel.scss`
  - `.side-list`
  - `.side-edit-row`
  - `.side-edit-form`
  - `.side-row-actions`
  - `.linked-row-shell`
  - `.linked-row`
  - `.note-link-picker`
  - `.backlink-section`
  - `.note-file-side-list`
  - `.side-list-actions`
  - nova `.side-panel-action` para substituir `.nav-item nav-item--spaced`

- `src/styles/components/_meta.scss`
  - `.meta-list`
  - `.meta-row`
  - `.meta-value`
  - alias temporario se for preciso para Profile

- `src/styles/components/_thumbnail-picker.scss`
  - `.thumbnail-picker`
  - `.thumbnail-picker-trigger`
  - `.thumbnail-picker-edit`
  - `.thumbnail-picker-menu`
  - `.thumbnail-option`

- `src/styles/components/_inline-form.scss` ou integrar em `_forms.scss`
  - `.inline-form`
  - `.inline-picker`
  - `.inline-help`
  - `.tag-create-form`, se continuar especifico do note detail/tag picker

## Ordem De Migracao Recomendada

### Fase 0 - Prerequisitos

- Aplicar foundations do ponto 11:
  - adicionar `space-7`
  - tokens de document widths (`content-max-reading`, `content-max-document`, `content-max-note`)
  - tokens de control/icon sizes
  - typography tokens para document title/body/meta
  - z-index map real
  - breakpoints nomeados, incluindo `tablet-wide` ou `note-document-collapse`

- Aplicar primitives do ponto 12/13/15:
  - `buttons` (`icon-button`, `icon-button.danger`)
  - `menus`
  - `chips`
  - `thumbnail`
  - `surfaces/panel`
  - `meta`

### Fase 1 - Cleanup Seguro De Legacy

- Confirmar com `rg` e com a app aberta quais seletores de `_note-detail.scss` ainda sao usados:
  - `document-shell`
  - `document-main`
  - `note-edit-toolbar-shell`
  - `content-section`
  - `usage-table`
  - `document-title-editor`
  - `document-intro-editor`
  - `copy-row-button`
  - `document-footer-stats`

- Confirmar possivel legacy em `_note.scss`:
  - `note-panel-toggle-list`
  - `note-example-side-list`
  - `note-linked-list`
  - `tag-chip-button`
  - `new-note-menu`

- Remover so depois de validar. Se houver duvida, mover para uma secao `legacy` temporaria em vez de apagar.

### Fase 2 - Mover Primitives Transversais

- Mover `.meta-list`, `.meta-row`, `.meta-value` para `components/_meta.scss`.
- Mover `.thumbnail-picker*` para `components/_thumbnail-picker.scss`, mantendo dependencia da primitive `.note-thumb`.
- Mover `.inline-form`, `.inline-picker`, `.inline-help` e `.inline-form > button` para forms/inline-form primitive. Tirar esta dependencia de `_labels.scss`.
- Criar action propria para side panels e substituir no TSX:
  - de `.nav-item nav-item--spaced`
  - para `.side-panel-action` ou `.side-list-toggle`
- Nao mudar visual no mesmo passo.

### Fase 3 - Reorganizar Page Layout

- Decidir owner final entre `_note-detail.scss` e `_note.scss`.
- Recomendacao: consolidar layout da pagina atual em `_note-detail.scss` e deixar `_note.scss` ser esvaziado gradualmente.
- Mover mantendo seletores:
  - `note-document-shell`
  - `note-document-main`
  - `note-document-aside`
  - `note-document-heading`
  - `document-top`
  - `document-actions`
  - `back-button`
- Trocar widths hardcoded por tokens apenas depois de os tokens existirem.

### Fase 4 - Separar TOC E Blocks

- Mover TOC para `_note-toc.scss`.
- Mover block editor layout para `_note-blocks.scss`.
- Preservar classes usadas por DOM query:
  - `.note-block-list`
  - `[data-note-block-id]`
  - `.note-block-title`
  - `.note-tiptap-prosemirror h1/h2/h3`
- Validar drag/reorder antes de continuar.

### Fase 5 - Separar Editor Content

- Mover ProseMirror content para `_note-editor.scss`:
  - inline editor
  - full editor
  - links
  - placeholders
  - code/pre/headings/blockquote
  - task lists
  - tables
- Separar UI typography da nota de content typography. Nao forcar estes estilos para `base/_typography.scss`; editor content tem regras proprias.

### Fase 6 - Separar Toolbars

- Consolidar toolbar styles em `_note-editor-toolbar.scss`:
  - toolbar shell visual
  - bubble toolbar
  - markdown tool buttons/tooltips
  - text style picker
  - table menu
- Avaliar se `.markdown-tool-button` deve continuar com nome markdown ou virar `editor-tool-button`. Renomear so numa fase posterior.
- Migrar z-index para tokens depois de o map do ponto 11 existir.

### Fase 7 - Separar Node Views

- Mover tip/file/image node views para `_note-node-views.scss`.
- Separar `.tip-box` primitive de `.note-tip-box` node-view-specific.
- Preservar `note-image-size-*` enquanto o TSX usar `quantizeImageWidth`.
- Validar imagens locais, placeholders, alignment, wrap left/right, controls e file cards.

### Fase 8 - Side Panels

- Mover side panel rows/pickers para `_note-side-panel.scss`.
- Depois de existir `.side-panel-action`, remover dependencia de `.nav-item`.
- Manter `.side-list` scoped a note detail inicialmente. So promover para primitive se outro dominio precisar.
- Confirmar que Profile usa apenas `.meta-list`, nao side-list.

### Fase 9 - Responsive Ownership

- Mover responsive da nota para ficheiros donos:
  - document shell collapse para `_note-detail.scss`
  - TOC responsive para `_note-toc.scss`
  - block handles mobile para `_note-blocks.scss`
  - toolbar wrapping para `_note-editor-toolbar.scss`
  - thumbnail menu mobile para `_thumbnail-picker.scss`
  - side panel layout para `_note-side-panel.scss`
- Trocar hardcoded `1020px`, `900px`, `680px`, `1180px` por breakpoints nomeados quando o ponto 11 estiver aplicado.

## Recomendacoes

- Nao comecar a implementacao por Tiptap/ProseMirror. Comecar por primitives seguras (`meta`, `thumbnail-picker`, `inline-form`, side-panel action) e por cleanup validado.

- Nao renomear classes do editor no primeiro passo. Muitas classes sao usadas por TSX, DOM queries, Tiptap attributes ou estado visual.

- Nao juntar content typography da nota ao `_typography.scss` global. O editor deve ter um ficheiro proprio, porque ProseMirror tem seletores estruturais e estados que nao sao typography generica da app.

- Tratar `NoteDetailPage.tsx` e `NoteTiptapEditor.tsx` como owners separados. O primeiro e page/composition; o segundo e editor/runtime.

- Remover dependencia de `.nav-item` no note detail assim que a primitive de side action existir. Isto desbloqueia a limpeza do shell no ponto 13.

- Antes de mexer no editor, resolver import order para components/primitives virem antes de pages e evitar que pages continuem a definir primitives globais.

- Evitar mexer em visual e ownership ao mesmo tempo. Para esta area, a ordem segura e:
  - mover classes mantendo nomes
  - validar
  - so depois trocar tokens/renomes/cleanup

## Risco

- Alto.
- A area de note detail/editor envolve Tiptap, ProseMirror, DOM queries, sticky toolbar, TOC, drag/reorder, file/image node views, side panels, inline editors e responsive.
- Mover ficheiros mantendo seletores tem risco medio se a ordem de imports for preservada.
- Renomear classes ou alterar nesting tem risco alto porque pode quebrar TOC, toolbar target, editor content, node views ou drag handles.
- Cleanup de legacy tem risco baixo/medio apenas depois de `rg` + validacao visual.

## Validacao Recomendada

- Build/typecheck depois de cada fase.
- Validacao funcional:
  - abrir nota existente
  - criar nota nova
  - editar titulo e subtitulo
  - trocar collection
  - trocar thumbnail
  - adicionar/remover/reordenar tags
  - adicionar bloco
  - editar titulo de bloco
  - editar conteudo de bloco
  - apagar bloco
  - drag/reorder de blocos
  - TOC com h1/h2/h3 e scroll para heading
  - toolbar sticky com foco em title/subtitle/block title/content
  - bubble toolbar com selecao de texto
  - bold/italic/underline/strike
  - text color/background picker
  - alignments, lists, task list, quote, code, table
  - inserir tip
  - inserir ficheiro
  - inserir imagem
  - imagem com align left/center/right e wrap left/right
  - abrir/exportar/apagar attachment
  - add/edit/delete additional examples
  - add/remove linked notes
  - add/remove external URLs
  - backlinks
  - export note button no document actions
  - trash/delete action

- Validacao visual:
  - dark/light
  - PT e EN
  - nota sem tags/sem collection/sem files
  - nota com muitas tags
  - titulo longo
  - subtitulo longo
  - headings suficientes para TOC
  - side panel com listas longas
  - toolbar com todas as ferramentas visiveis e wrapped
  - menus perto dos limites da viewport

- Viewports:
  - `900x768`
  - `1024x768`
  - `1180x820`
  - `1366x768`
  - `1920x1080`
  - `2560x1440`
  - `3840x2160`

## Proxima Acao

- Seguir para o ponto 17: Dashboard migration plan.
- A implementacao futura do note detail/editor deve acontecer depois de foundations e primitives base, e provavelmente depois de limpar shell/entity/notes list ownership, porque o editor consome `buttons`, `menus`, `chips`, `thumbnail`, `panel` e `meta`.
