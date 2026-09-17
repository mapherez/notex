# NoteX: janela desktop de meia largura, tablet e avaliação mobile

Estado: plano de implementação; implementação não iniciada.
Data: 2026-09-17.

Este documento regista a análise do código e as decisões acordadas na conversa.
Não constitui autorização para implementar todas as propostas visuais: as
decisões pendentes estão identificadas abaixo. O trabalho deve avançar em etapas
pequenas e completas, com explicação prévia e validação focada.

Documentação relacionada: [layout](LAYOUT.md), [páginas](PAGES.md),
[restrições de arquitetura](ARCHITECTURE_CONSTRAINTS.md).

## 1. Objetivo, prioridades e âmbito

Preservar o aspeto geométrico, alinhado e arrumado do NoteX, adaptando os mesmos
componentes ao espaço disponível e melhorando as interações touch.

| Ambiente | Âmbito desta iniciativa |
| --- | --- |
| Desktop amplo | Preservar a experiência atual e validar regressões a 1920×1080 e acima. |
| Desktop com meia janela | Suportar largura útil a partir de 960 px, com a altura disponível na app Windows/macOS ou browser. Não suportar janelas desktop inferiores a este mínimo nesta fase. |
| Tablet | Priorizar Safari no iPad e Chrome no Android, portrait, landscape, split view e teclado virtual. |
| Mobile | Avaliar depois do tablet; aprovar separadamente a experiência antes de implementar adaptações específicas ou limitações funcionais. |

- A resolução física do monitor não determina o espaço útil da aplicação. Para
  medição e testes, usar pixels CSS do viewport; 960 px úteis é o pressuposto
  inicial para o mínimo desktop, sujeito a confirmação em escala/DPI reais.
- Manter suporte desktop a rato e teclado, incluindo os atalhos existentes.
- O pedido inicial incluía validação de dispositivos híbridos. A decisão posterior
  excluiu, por agora, a adaptação e validação específica de rato/teclado físico em
  tablet/mobile. Não remover os comportamentos existentes do código partilhado.
- Não acrescentar funcionalidades, preferências ou mudanças de produto por
  iniciativa própria. As alternativas explícitas à reordenação por arrasto foram
  aprovadas como adaptação da operação existente.
- Preservar rotas, dados, formatos de backup, preferências atuais e diferenças
  funcionais já existentes entre browser e desktop.

## 2. Estado atual e problemas identificados

A análise foi estática, por leitura dos componentes, estilos e serviços. Não houve
validação visual ou testes em dispositivos. Os problemas abaixo resultam do
código; a sua manifestação e severidade precisam de confirmação na Etapa 0.

| Área | Evidência | Problema a resolver |
| --- | --- | --- |
| Breakpoints | Mapa com 1180, 900 e 680 px, regras literais adicionais a 1020 px e 42 rem. | Transições dispersas, dependentes da janela inteira, sem considerar sempre a largura restante após sidebar e gutters. |
| Sidebar | Largura de 14 rem, altura `100vh`, sem scroll próprio explícito; drawer fechado deslocado por `transform`. | Conteúdo pode exceder a altura disponível; elementos fora do ecrã podem continuar focáveis. |
| Topbar | Ações posicionadas absolutamente e reserva de 10 rem no espaço da pesquisa. | Dimensionamento por compensação, sujeito a colisões quando o conteúdo deixa de caber. |
| Home | Estatísticas e quick pins em cinco colunas; estatísticas passam para uma coluna aos 900 px e voltam a duas aos 680 px. | Compressão antes da transição e comportamento inconsistente entre larguras menores. |
| Lista de notas | Várias colunas automáticas; tags sobrepostas e reveladas por hover/foco; abaixo de 680 px escondem-se badges e botões de menu na vista List. | Menos espaço para o título; informação e operações desaparecem ou dependem de hover. |
| Tags/collections | Painéis laterais de 19–24 rem; cards com mínimo de 17 rem. | Mínimos rígidos podem comprimir o conteúdo principal antes do breakpoint global. |
| Editor | Índice de 2,75 rem, documento e lateral de 20 rem; padding interno de 2 rem; offsets sticky parcialmente fixos. | Pouco espaço útil e cabeçalhos que podem consumir demasiada altura ou desalinhar com o conteúdo. |
| Índice e ações dos blocos | Índice revelado por hover/foco; ações pequenas e parcialmente fora dos blocos; algumas ações só aparecem em hover/foco. | Descoberta e operação touch frágeis. |
| Reordenação | Blocos tratam `pointercancel` pelo caminho de conclusão; tags usam `pointerenter`; notas fixadas não tratam explicitamente cancelamento. | Interrupções podem confirmar ordem provisória; scroll e arrasto competem. |
| Profile | Até três colunas segundo a largura global; estatísticas em cinco colunas e gestão da base de dados em três. | Módulos e controlos internos podem ficar demasiado estreitos. |
| Overlays e teclado | Vários menus absolutos e mínimos próprios; alturas frequentemente em `vh`; ausência de integração com `VisualViewport`. | Menus e banners podem ficar cortados ou ocupar a área de edição quando abre o teclado. |

Principais fontes no código:

- Shell: `src/components/layout/` e `src/styles/layout/_shell.scss`.
- Responsividade: `src/styles/responsive/_responsive.scss` e mapa em
  `src/styles/abstracts/_variables.scss`.
- Ecrãs: `src/pages/` e respetivos estilos em `src/styles/pages/`.
- Lista: `NoteRow`, `NotesFilterRow` e `src/styles/components/_notes.scss`.
- Editor: `NoteDetailPage`, `NoteTiptapEditor`, `TextStyleToolbar` e
  `src/styles/pages/_note.scss`.
- Overlays: `AppModal`, `CustomSelect`, hooks de foco e notificação global.

Base existente a reutilizar:

- `NoteRow` é utilizado nas listas e grids; não assumir que precisa de ser duplicado.
- `AppModal` já aplica `inert` ao fundo, gere foco, bloqueia scroll e restaura foco.
- `CustomSelect` e menus já usam hooks de foco e navegação por teclado.
- O clique fora usa Pointer Events; não é exclusivamente baseado em rato.
- Anexos já têm seleção/importação/abertura/exportação no browser.
- Floating UI já está instalado, embora os menus analisados usem posicionamento
  absoluto próprio.

## 3. Princípios de implementação

- Escolher transições quando o conteúdo deixa de caber, sem identificar tablets
  pela diagonal de 8 ou 10 polegadas nem assumir um layout por orientação.
- Usar Grid/Flexbox e dimensionamento intrínseco; container queries para a largura
  útil dos componentes e media queries para shell, altura e capacidades de entrada.
- Centralizar tokens, mínimos e regras nos estilos SCSS existentes. Evitar estilos
  visuais inline e dependências novas sem necessidade demonstrada.
- Preservar a ordem DOM e a correspondência com a ordem visual/de teclado.
- Não mascarar problemas de layout com clipping global ou ocultação de operações.
- Scroll horizontal deve ser local e intencional: tags, toolbar e conteúdo largo.
- Preservar estado ao redimensionar: filtros, seleção, preferência List/Grid,
  drafts, seleção do editor e histórico de undo.
- Hover pode complementar a interação desktop; não deve ser o único acesso touch.
- Todo o texto novo de interface deve existir nos locales pt/en.

## 4. Etapas de implementação

### Etapa 0 — Medição e referências visuais

1. Registar o comportamento atual nos ecrãs prioritários, com conteúdo vazio e
   exigente: títulos compridos, muitas tags, nomes longos e notas extensas.
2. Medir os mínimos de cada composição com controlos touch confortáveis.
3. Definir a tabela de transições de shell, Home, notas, Profile e editor. Não
   substituir os breakpoints atuais por outra lista arbitrária de dispositivos.
4. Medir a altura útil de edição depois dos cabeçalhos e teclado; propor o limiar
   concreto que ativa a toolbar inferior por falta de altura.
5. Preparar referências visuais para revisão, especialmente lista compacta,
   índice, ações dos blocos e toolbar.

Saída: diagnóstico visual, tabela de limiares e propostas revistas pelo utilizador.
Não alterar comportamento de produto para preparar esta etapa.

### Etapa 1 — Shell, sidebar e topbar

- Manter sidebar completa enquanto couber com o conteúdo. Quando necessário,
  reutilizar o drawer existente; não introduzir um rail intermédio de ícones.
- Dar scroll ao conteúdo da sidebar, fecho explícito, Escape, gestão/restauro de
  foco e bloqueio de interação/scroll do fundo enquanto o drawer está aberto.
- Retirar o drawer fechado da navegação por teclado. Limpar o estado sobreposto
  quando se regressa ao layout com sidebar permanente.
- Organizar pesquisa e ações da topbar em tracks de Grid reais, evitando a reserva
  fixa e o posicionamento absoluto usados para compensar as ações.
- Preservar acesso à conta, tema, pesquisa, nova nota e restantes destinos.
- Limitar os resultados de pesquisa à área visível; considerar a titlebar Tauri
  nos offsets desktop.
- Aplicar desde esta etapa os mínimos touch aos controlos alterados, sem aguardar
  pela revisão transversal da Etapa 5.

Conclusão: navegação e pesquisa utilizáveis a 960 px no desktop e em tablet, sem
links ocultos focáveis nem destinos inacessíveis.

### Etapa 2 — Home, notas, filtros, tags e collections

Home:

- Reduzir progressivamente as colunas de estatísticas e quick pins conforme os
  mínimos medidos. Corrigir a transição contraditória das estatísticas.
- Mover módulos laterais para baixo quando não cabem; preservar módulos, ordem e
  ações. Não transformar a Home num ecrã com funcionalidades diferentes.

Listas e grids:

- Tentar adaptar `NoteRow` para uma composição compacta próxima dos cards, com
  título/preview, collection por baixo e uma faixa própria para tags.
- Em falta de espaço, usar scroll horizontal local por swipe nas tags, sem
  sobreposição. Preservar os links e trazer a tag focada para a área visível.
- Manter seleção, favorito, fixação, menu e reordenação acessíveis. Não esconder
  botões de operação para resolver largura.
- Adaptar a quantidade de colunas da vista Grid e preservar a preferência
  List/Grid; não acrescentar um terceiro modo.
- A reutilização é a primeira abordagem, não um motivo para aceitar um layout
  fraco. Se falhar, apresentar a composição alternativa e os custos ao utilizador
  antes de duplicar layouts ou unificar as duas vistas em larguras pequenas.

Filtros, tags e collections:

- Distribuir filtros e ações em lote por linhas alinhadas conforme os mínimos dos
  controlos; preservar filtros ativos, ordenação e seleção ao redimensionar.
- Empilhar os painéis de criação/preferências depois das listas quando deixam de
  caber lateralmente; adaptar formulários e ações também dentro dos cards.
- Limitar menus à área disponível, usando a infraestrutura da Etapa 5.

Conclusão: operações atuais disponíveis na composição compacta. Rever visualmente
o equilíbrio entre densidade, altura das notas e swipe das tags antes de finalizar.

### Etapa 3 — Profile

- Fazer os módulos passarem de três para duas e depois uma coluna conforme os
  mínimos reais, sem depender exclusivamente da largura total da janela.
- Preservar a ordem atual: conta, preferências, gestão de dados, módulos específicos
  de desktop e estatísticas.
- Adaptar separadamente as grelhas internas, divisórias e spans dos módulos.
- Colocar controlos abaixo das descrições quando a linha completa não cabe.
- Preservar diferenças browser/desktop, incluindo MCP, base de dados e atualizações.
- Não introduzir tabs, accordions ou nova organização funcional dos módulos.

Conclusão: módulos legíveis e utilizáveis, com alinhamentos consistentes e sem
colunas internas artificialmente estreitas.

### Etapa 4 — Editor, toolbar e teclado virtual

Documento e módulos:

- Manter índice e módulos laterais enquanto couberem com o texto.
- Em espaço reduzido, disponibilizar o índice por botão explícito e colocar
  metadados, anexos e notas ligadas depois do documento.
- Reduzir gutters/padding antes de comprimir o texto. Manter ações dos blocos dentro
  da área utilizável e acessíveis por toque.
- Conter tabelas e código largos em scroll local; adaptar imagens e cards de anexos
  sem modificar os atributos ou o conteúdo guardado apenas por mudar de viewport.

Toolbar por ambiente:

| Ambiente/condição | Comportamento acordado |
| --- | --- |
| Desktop amplo | Toolbar superior, sem esconder ferramentas. |
| Desktop a partir de 960 px | Toolbar superior e acessível; permitir quebra de linhas ou scroll local conforme necessário. Não aplicar a ocultação touch ao desktop. |
| Tablet com espaço | Toolbar superior, no mínimo de linhas possível, até duas linhas. |
| Tablet em que exige mais de duas linhas ou falta altura útil | Durante edição com teclado virtual, uma linha com scroll horizontal diretamente acima do teclado. |
| Tablet nesse modo compacto, teclado virtual fechado | Barra inferior escondida, conforme decidido pelo utilizador. |
| Mobile, avaliação posterior | Proposta inicial: uma linha acima do teclado durante edição, escondida quando o teclado fecha. |

- Reutilizar a mesma toolbar e os mesmos comandos; mudar posição sem remontar os
  editores ou perder draft, seleção ou undo.
- A posição depende do espaço disponível, não de polegadas. Um tablet pode manter
  a barra superior em landscape e precisar da inferior em portrait.
- Acompanhar a área visível com `VisualViewport`, quando disponível. Não assumir
  que `dvh` por si só resolve o teclado virtual.
- Validar conjuntamente foco de edição, alterações de viewport, zoom, rotação e
  interface do browser. Uma redução de altura isolada não prova abertura do teclado.
- Preservar a seleção ao tocar nas ferramentas; não depender apenas de handlers
  `onMouseDown` para esse comportamento.
- Reposicionar menus da toolbar dentro da área disponível, incluindo quando a
  barra está acima do teclado. Coordenar scroll do cursor e cabeçalhos sticky.
- Validar teclado dividido/flutuante no iPad: a margem inferior do viewport pode
  não representar a margem superior desse teclado. Confirmar suporte ou apresentar
  a limitação antes de prometer uma posição equivalente à do teclado normal.
- Não impor dependência da VirtualKeyboard API nem desativar zoom. Se o browser não
  fornecer geometria suficiente para cumprir o comportamento, apresentar uma
  alternativa ao utilizador antes de a adotar.

Conclusão: escrever, selecionar e formatar sem cursor ou comandos tapados, com a
transição superior/inferior demonstrada em iPad e Android reais.

### Etapa 5 — Touch, reordenação, modais, dropdowns e banners

Touch e reordenação:

- Usar áreas touch de pelo menos 48×48 px nos controlos isolados alterados, mantendo
  o desenho dos ícones e evitando áreas invisíveis sobrepostas.
- Disponibilizar operações por toque explícito, preservando hover/foco desktop.
- Reordenar pela pega; preservar scroll e seleção fora dela. Nas tags, separar o
  gesto de navegação/scroll do gesto de reordenação.
- Tratar `pointercancel`, perda de captura e interrupção sem persistir a ordem
  provisória. Confirmar apenas na conclusão válida do gesto.
- Permitir scroll junto às margens durante arrasto de listas/blocos extensos.
- Disponibilizar alternativas aprovadas: acima/abaixo nos blocos e notas fixadas;
  anterior/seguinte nas tags ordenáveis. Reutilizar as ações dos stores e manter
  os comandos de teclado existentes.

Overlays e notificações:

- Uniformizar o posicionamento dos dropdowns com o Floating UI já instalado:
  reposicionamento nas margens, largura/altura disponíveis e scroll interno.
- Preservar navegação por setas, Escape e restauro de foco. Se forem usados portals,
  adaptar clique fora e gestão de foco para reconhecer trigger e conteúdo portado.
- Manter `AppModal` e as regras atuais de fecho, incluindo modais não dismissíveis
  e a ausência de fecho pelo backdrop; não mudar essas regras por responsividade.
- Limitar altura dos modais e permitir alcançar conteúdo e ações em landscape e
  com teclado. Rever ajuda de atalhos, patch notes, login, confirmação e configuração.
- Ajustar backup, atualizações e toasts à área visível e às safe areas. Manter
  detalhes/ações alcançáveis, sem ocultar erros ou conflitos.
- Coordenar a região global de notificações com a toolbar inferior, reservando
  espaço suficiente para não tapar permanentemente o cursor ou as ações.

Conclusão: gestos interrompidos, menus nas margens e overlays simultâneos não
deixam a interface bloqueada, cortada ou com alterações de ordem inesperadas.

### Etapa 6 — Avaliação mobile e decisão de produto

- Só iniciar depois de concluir e validar desktop de meia largura e tablet.
- Avaliar os componentes adaptados em larguras pequenas, incluindo leitura,
  captura, edição, seleção, filtros, anexos e reordenação.
- Usar como proposta inicial a toolbar acima do teclado durante edição, escondida
  quando este fecha; validar também menus de seleção nativos.
- Apresentar o que funciona, o que exige outra composição e os custos de adaptação.
- Não inferir que mobile deve ser apenas leitura nem desativar operações para
  contornar problemas de layout. Limitações funcionais precisam de aprovação.

Saída: proposta mobile revista e aprovada, antes de implementar a experiência final.

## 5. Interfaces, dados e compatibilidade

- Sem alterações previstas a APIs de dados, rotas, modelos de notas, schema local,
  ficheiros exportados ou formato de backup.
- Mudanças internas limitadas à composição de componentes, estado de apresentação
  da toolbar/índice, posicionamento de overlays e ciclo de vida de gestos.
- Os comandos de reordenação chamam as operações existentes; não criar um segundo
  modelo de ordenação ou persistência.
- A preferência List/Grid mantém-se. Não persistir classificações de dispositivo
  nem estado transitório de teclado/viewport nas settings.
- Preservar temas e locales pt/en; seguir os tokens e a arquitetura SCSS existentes.
- Não alterar suporte Tauri/browser ou introduzir distribuição mobile nativa como
  consequência desta iniciativa.

## 6. Plano de validação

Cada etapa exige revisão dos ecrãs afetados, critérios de aceitação cumpridos e
registo das limitações reais antes de avançar. Não declarar validação em dispositivos
reais a partir de emulação.

Matriz mínima:

- Desktop amplo a 1920×1080 e janela com 960 px úteis, incluindo menor altura,
  browser e titlebar Tauri; confirmar impacto de escala/DPI.
- iPad/Safari e Android/Chrome, portrait/landscape e split view.
- Teclado virtual aberto/fechado, rotação durante edição, zoom e menus nativos de
  seleção. Confirmar teclado flutuante/dividido como caso separado no iPad.
- Temas claro/escuro e locales pt/en, incluindo labels compridas.
- Conteúdo vazio, títulos/subtítulos longos, muitas tags, nomes longos, notas
  extensas, blocos altos, tabelas, código, imagens e anexos.

Critérios comuns:

- Sem scroll horizontal global; scroll local apenas onde é intencional.
- Todas as operações atuais continuam acessíveis no ambiente suportado.
- Scroll touch não inicia navegação, seleção ou reordenação acidental.
- Links, seleção, favoritos, fixação e menu não são intercetados pelo overlay da nota.
- Filtros, seleção e preferência List/Grid mantêm-se após mudanças de largura.
- Reordenação válida persiste corretamente; cancelamento mantém a ordem original.
- Cursor, seleção e ações ficam visíveis com teclado; toolbar não perde o target.
- Drafts e undo mantêm-se após mudança de posição/layout da toolbar.
- Drawer/modal não deixam foco no fundo; fecho restaura foco corretamente.
- No desktop: validar Tab/Shift+Tab, setas, Home/End, Enter/Space, Escape, atalhos
  globais, atalhos do editor e comandos de reordenação já existentes.

Verificações técnicas:

- Reutilizar os testes existentes de `AppModal`, `CustomSelect` e editor.
- Acrescentar testes comportamentais focados para drawer/foco, cancelamento de
  arrasto e transições da toolbar; não criar testes que apenas reproduzam o CSS.
- Executar typecheck e verificações de estilos nas etapas afetadas; correr os
  testes relevantes para alterações de interação.
- Usar browser real para geometria e overflow; jsdom não valida layout.
- Confirmar teclado virtual e seleção em iPad/Android reais; emulação ajuda a
  explorar dimensões, mas não substitui essa confirmação.

## 7. Decisões acordadas e aprovações pendentes

### Acordado

- Desktop suporta meia janela com mínimo inicial de 960 px úteis; toolbar desktop
  permanece superior e acessível.
- Tablet prioritário: iPad e Android web, com foco em touch e teclado virtual.
- Reutilizar o drawer existente, sem rail intermédio de ícones.
- Módulos laterais do editor passam para depois do documento quando não cabem.
- Reordenação mantém arrasto e ganha alternativas explícitas por comando.
- Tablet mantém toolbar superior até duas linhas; em falta de espaço passa para
  uma linha com scroll acima do teclado. No modo compacto, desaparece quando este fecha.
- Lista compacta deve aproximar-se dos cards, com collection/tags por baixo do
  título e tags acessíveis por swipe, sem a sobreposição desktop.
- Tentar reutilizar componentes; a qualidade da experiência prevalece sobre uma
  reutilização que produza um layout inadequado.
- Mobile é a última etapa e não há aprovação para limitar funcionalidades.

### Rever antes da implementação correspondente

- Limiares medidos e referências visuais da Etapa 0, incluindo definição prática
  de pouca altura útil para edição.
- Composição exata da lista compacta, densidade das linhas e indicação do scroll
  da faixa de tags; alternativa caso `NoteRow` não se adapte satisfatoriamente.
- Apresentação do botão/painel do índice e ações touch dos blocos.
- Transição da toolbar, tratamento de foco/teclado fechado e comportamento em
  teclados flutuantes/divididos ou browsers com geometria insuficiente.
- Ajustes visuais relevantes a modais/banners que impliquem outra interação.
- Experiência mobile final e qualquer limitação funcional proposta.

Não implementar automaticamente uma alternativa que altere estas decisões.
Explicar o problema concreto e apresentar o resultado proposto para revisão.

## 8. Referências técnicas

- [CSS container queries — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries).
- [VisualViewport e área visível com teclado — MDN](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport).
- [Pointer Events, captura e cancelamento — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events).
- [Alternativas a movimentos de arrasto — W3C](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html).

Estas referências fundamentam mecanismos técnicos e critérios de interação; não
substituem a medição do NoteX nem aprovam mudanças de produto.
