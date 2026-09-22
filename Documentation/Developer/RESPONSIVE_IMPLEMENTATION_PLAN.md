# NoteX: janela desktop de meia largura, tablet e avaliação mobile

Estado: Etapas 1, 2 e 3 concluídas. O 4A foi concluído e validado em iPhone,
iPad e desktop; inclui painéis, conteúdo largo, imagens, preview, resize e
anexos. A primeira entrega de 4B foi igualmente validada nos três ambientes.
A segunda entrega de 4B, toolbar touch em linha única no cabeçalho, foi
concluída e validada em iPhone, iPad e desktop (secção 26). O 4C,
interação e reordenação de blocos, continua por implementar.
Esta aceitação não significa validação real de todos os browsers e dispositivos.
Data da última atualização: 2026-09-22.

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
| Desktop com meia janela | Suportar janelas estreitas com a altura disponível na app Windows/macOS ou browser. Rever a referência inicial de 960 px com o ensaio de toolbar a 718 px solicitado em 4B; medir largura útil após sidebar e margens. |
| Tablet | Priorizar Safari no iPad e Chrome no Android, portrait, landscape, split view e teclado virtual. |
| Mobile | Avaliar depois do tablet; aprovar separadamente a experiência antes de implementar adaptações específicas ou limitações funcionais. |

- A resolução física do monitor não determina o espaço útil da aplicação. Para
  medição e testes, usar pixels CSS do viewport; 960 px úteis era o pressuposto
  inicial desktop. A revisão de 4B inclui agora 718 px como referência de ensaio,
  sem declarar antecipadamente validação de toda a app nessa largura.
- Manter suporte desktop a rato e teclado, incluindo os atalhos existentes.
- O pedido inicial incluía validação de dispositivos híbridos. A decisão posterior
  excluiu, por agora, a adaptação e validação específica de rato/teclado físico em
  tablet/mobile. Não remover os comportamentos existentes do código partilhado.
- Não acrescentar funcionalidades, preferências ou mudanças de produto por
  iniciativa própria. As alternativas explícitas à reordenação por arrasto foram
  aprovadas como adaptação da operação existente.
- Preservar rotas, dados, formatos de backup, preferências atuais e diferenças
  funcionais já existentes entre browser e desktop.

## 2. Estado inicial e problemas identificados

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

## 9. Registo de implementação — 2026-09-17

### Etapa 0: medição inicial do shell

Referência visual desktop registada antes da alteração a 960×1080. As medições
desta entrega cobrem shell, sidebar e topbar; a medição detalhada de Home,
listas, Profile e editor continua nas etapas correspondentes.

| Viewport em px CSS | Sidebar | Pesquisa após a alteração | Altura real da topbar |
| --- | --- | --- | --- |
| 1920×1080, rato | Persistente, 224 px | 1264 px | 112 px |
| 960×1080, rato | Persistente, 224 px | 534 px | 106 px |
| 768×1024, touch emulado | Drawer, 320 px | 510 px | 94 px |
| 1024×768, touch emulado | Persistente, 224 px | 582 px | 109 px |
| 512×768, split view touch emulado | Drawer, 320 px | 268 px | 88 px |

O shell mantém o limiar existente de 900 px: ambos os lados (900 e 901 px)
foram medidos sem sobreposição entre pesquisa e ações. A 901 px, a pesquisa
mantém 479 px no contexto de rato. Este resultado valida o shell desta etapa;
não determina os limiares próprios dos módulos das páginas. A topbar tem
altura intrínseca superior ao token mínimo de 88 px em vários viewports; a
toolbar do editor deve considerar a altura efetiva na Etapa 4.

### Etapa 1: shell, sidebar e topbar

Implementado:

- A mesma sidebar mantém-se persistente ou funciona como drawer, sem duplicar
  conteúdo. Tem largura explícita no drawer, scroll vertical próprio e quebra
  de nomes longos sem comprimir os controlos.
- Drawer fechado fica `inert`. Ao abrir, recebe foco no botão de fechar,
  contém Tab/Shift+Tab, fecha com Escape, bloqueia conteúdo/notificações e
  scroll do fundo, e devolve foco ao controlo anterior quando apropriado.
  Mudanças de rota ou de modo de layout fecham o drawer e libertam o fundo.
- Links legais e notas de versão fecham o drawer antes de abrir o respetivo
  modal, evitando bloqueios de scroll ou foco acumulados.
- Pesquisa e ações ocupam colunas reais; os gutters alinham com o conteúdo.
  Pesquisa tem nome acessível explícito. Resultados e menu de conta limitam
  altura ao viewport e permitem scroll próprio.
- Controlos do shell usam alvos mínimos de 48 px quando existe um ponteiro
  coarse, incluindo dispositivos híbridos. O avatar continua visível; a dica
  de atalho da pesquisa só fica oculta com ponteiro principal coarse. Os
  atalhos desktop existentes mantêm-se; a pesquisa não tenta focar o fundo
  enquanto este está `inert`.
- SCSS continua a definir o breakpoint; o hook lê a variável CSS emitida,
  evitando um segundo valor independente em JavaScript.

Validação local concluída:

- Typecheck e `check:styles` passaram.
- 14 testes passaram: drawer, `AppModal` e pesquisa (`noteSearch`).
- Chromium isolado: geometria e screenshots nas dimensões da tabela e a
  900/901 px; sem sobreposição da topbar ou overflow horizontal nas fixtures.
- Foco, Escape, ciclo de Tab, restauração do foco, resize com drawer aberto,
  abertura de modais legais/notas de versão e desbloqueio do fundo verificados.
- Atalhos desktop de pesquisa, Profile e nova nota, e seleção de resultado por
  setas/Enter verificados no browser. As operações de criação e registo de
  abertura foram substituídas na fixture; não foi um teste de persistência.
- Contexto touch emulado: toque nos menus, alvos de 48 px, 32 collections com
  nomes longos e rodapé acessível por scroll; pesquisa com 15 resultados e
  scroll local sem sair do viewport.
- Fixtures em memória numa sessão isolada, sem usar a biblioteca nem a conta
  Google do utilizador. Screenshots locais em `output/playwright/` (ignorados
  pelo Git).

Limites da validação: não substitui Safari/iPad e Chrome/Android reais, escala
desktop/DPI nem teclado virtual. Não foi validada a janela Tauri nativa nesta
entrega. Na conclusão da Etapa 1, Home ainda comprimia os cinco atalhos rápidos
a 960 px e empilhava demasiado os indicadores em portrait; corrigido na Etapa 2.
Editor, Profile,
reordenação, modais/banners transversais e mobile mantêm as etapas previstas.

### Etapa 2: Home, listas, grids, filtros, tags e collections

Implementado:

- Indicadores e atalhos rápidos usam mínimos próprios de largura, mantendo cinco
  colunas quando cabem. Atalhos touch reservam espaço para o botão de edição de
  48 px. Os indicadores ficam menos altos em áreas reduzidas.
- Container queries medem a página e os módulos. Home, tags e collections
  colocam os painéis laterais depois do conteúdo abaixo de 70 rem úteis; os
  grids internos escolhem colunas a partir dos mínimos dos cards.
- `NoteRow` continua a servir List/Grid e Home. Abaixo de 64 rem na lista, ou
  com touch disponível, os controlos ficam numa linha, thumbnail/título/preview
  na seguinte e collection/tags abaixo. A lista mantém linhas dentro do mesmo
  painel; Grid mantém cards separados e o preview próprio. Não existe novo modo
  nem componentes de nota duplicados.
- Tags compactas têm faixa com scroll horizontal nativo e espaçamento, sem
  sobreposição ou elevação por hover. O foco revela a tag fora da área visível.
  Seleção, favorito, fixação, pega de reordenação, data e menu permanecem presentes.
- Thumbnails das notas têm caixa explícita de 3,7 rem, com `display: block`,
  evitando expansão intrínseca nas colunas automáticas.
- Filtros e ações em lote quebram por mínimos comuns de 14 rem. Cards e
  cabeçalhos permitem quebra de ações; formulários preservam a ordem atual.
- Controlos touch alterados têm mínimos de 48 px e os campos têm fonte de 16 px.
- Antecipada a infraestrutura necessária de menus da Etapa 5: helper reutilizável
  com Floating UI para ações das notas, filtros pesquisáveis e picker de atalhos.
  Reposiciona, limita tamanho e acompanha scroll/resize. Mantém os menus inline,
  os handlers atuais de clique fora e foco, e lê espaçamento dos tokens CSS.
  Os restantes overlays continuam na Etapa 5.

Mínimos de conteúdo usados: indicadores 10 rem, atalhos 12 rem (16 rem com
touch), cards de tags/collections 19 rem e notas Grid 22 rem. Em espaço inferior
ao mínimo, cada grid permite uma coluna da largura disponível.

| Viewport touch emulado | Colunas de indicadores | Colunas de atalhos |
| --- | --- | --- |
| 1920×1080 | 5 | 3 |
| 960×1080 | 3 | 2 |
| 768×1024 | 4 | 2 |
| 1024×768 | 4 | 2 |
| 512×768, split view | 2 | 1 |

Validação local concluída:

- Typecheck, `check:styles` e 5 testes existentes (`CustomSelect` e drawer) passaram.
- Chromium: Home, notas, tags e collections nas cinco dimensões acima; desktop
  com rato a 1920/960 px. Fixtures sem overflow horizontal da página.
- List/Grid distintos e preferência preservada ao redimensionar; seleção mantém-se
  após portrait/landscape; filtro ativo mantém-se depois de mudar a largura.
- Faixa de 12 tags com scroll local e revelação por foco; alvos de seleção,
  favorito, fixação, pega, menu e tags medidos com mínimo de 48 px em touch.
- Abertura por toque, limites dos menus de nota/atalho nas margens, filtros por
  teclado, Escape/restauro de foco e atalho Shift+5 verificados. Consola sem erros
  nas sessões finais; apenas avisos existentes do React Router.
- Screenshots antes/depois em `output/playwright/responsive-stage2-*`; fixtures
  em memória sem persistência, biblioteca do utilizador ou login Google.

A composição compacta está pronta para revisão visual. Confirmar densidade e
scroll/swipe em tablets reais; ainda não é validação de Safari/iPad,
Chrome/Android reais, DPI desktop ou teclado virtual. O tratamento completo de
cancelamento/reordenação touch e os comandos alternativos continuam na Etapa 5.
A Etapa 3 de Profile está registada abaixo; as decisões pendentes do editor/mobile mantêm-se.

Referências da infraestrutura de menus:
[posicionamento](https://floating-ui.com/docs/computeposition),
[limites de tamanho](https://floating-ui.com/docs/size) e
[atualização de posição](https://floating-ui.com/docs/autoupdate).

### Etapa 3: Profile

Implementado:

- O grid mede a largura útil da página, depois da navegação e dos gutters:
  uma coluna abaixo de 42 rem, duas a partir de 42 rem e três a partir de
  68 rem. No modo amplo mantém as proporções existentes: conta com 15,3 rem,
  preferências com mínimo de 24 rem e dados com 20–24,5 rem.
- Mantém a ordem DOM e de teclado: conta, preferências, dados, módulos desktop
  e estatísticas. Os módulos wide ocupam duas colunas quando disponíveis;
  estatísticas continuam a ocupar a linha completa. Sem tabs ou accordions.
- Cada módulo mede o seu conteúdo. Preferências com até 28 rem colocam os
  seletores abaixo da descrição, alinhados com o texto. Nomes, emails,
  descrições e caminhos longos permitem quebra sem expandir as colunas.
- Estatísticas usam 1/2/3/5 colunas, com transições aos 26/42/64 rem internos.
  Caminhos usam 1/2/3 colunas, aos 38/58 rem internos. Um mixin comum calcula
  separadores e padding por linha/coluna, incluindo a última linha incompleta.
- Cabeçalho e estado MCP permitem quebra; backup mantém o comportamento
  existente de passar abaixo do estado quando deixa de caber. Os seletores
  acompanham a largura disponível e o módulo focado mantém o menu visível
  acima dos módulos seguintes.
- Controlos de Profile têm mínimo de 48 px com `any-pointer: coarse`, incluindo
  seletores/opções, ações de conta e backup, atalhos, MCP e abertura de pastas.
- As condições browser/desktop e os handlers existentes não foram alterados.
  A única alteração de JSX identifica a página para limitar os estilos touch.
  Modais e posicionamento transversal dos restantes overlays continuam na Etapa 5.

| Viewport touch emulado | Colunas de módulos | Colunas de estatísticas |
| --- | --- | --- |
| 1920×1080 | 3 | 5 |
| 960×1080 | 2 | 2 |
| 768×1024 | 2 | 3 |
| 1024×768 | 2 | 3 |
| 512×768, split view | 1 | 2 |

Validação local concluída:

- Typecheck, `check:styles`, compilação completa de Sass e `git diff --check` passaram.
- Chromium touch emulado nas cinco dimensões da tabela e nos dois lados dos
  breakpoints de módulos (953/954 e 1375/1376 px de viewport nesta fixture).
  Sem overflow horizontal; separadores e alvos touch medidos.
- Menus de preferências abrem por toque e cabem horizontalmente; setas/Enter,
  Escape e restauro de foco funcionam. Tema selecionado mantém-se após resize
  portrait/landscape. Modal de atalhos abre e devolve foco ao fechar por Escape.
- Chromium com rato a 1920/960 px: seletores, idioma PT/EN e atalho desktop de
  pesquisa verificados. Sessões finais sem erros de consola, apenas os avisos
  existentes do React Router.
- Conta com nome/email longos e ação de backup verificadas em memória. MCP e
  caminhos desktop tiveram validação de geometria com markup representativo
  e classes reais, e revisão das condições no código; não foi uma execução
  dos componentes na janela Tauri nem um teste das operações nativas.
- Fixtures locais sem persistência, login Google ou backup real. Screenshots
  em `output/playwright/responsive-stage3-*`, ignorados pelo Git.

Confirmar em tablets reais e Tauri, incluindo DPI/zoom e teclado virtual.
Editor, reordenação touch, overlays transversais e mobile continuam nas etapas
previstas. Antes da Etapa 4, concretizar as decisões pendentes do índice de
blocos e da toolbar do editor para aprovação.

## 10. Etapa 4: proposta concreta para revisão

Estado: proposta, sem alterações ao código do editor. Rever e aprovar cada
entrega separadamente. O utilizador pediu começar pela revisão de 4C;
4A e 4B continuam pendentes. Não há aprovação para limitações mobile.

### Medição do editor existente

Chromium com touch emulado, nota demo em memória e 12 tags longas. Larguras
em pixels CSS; a área de texto desconta o padding do documento. Não houve
edição persistida, login ou utilização de ficheiros do utilizador.

| Viewport solicitado | Largura de texto atual | Linhas de ferramentas atuais | Linhas com toolbar em linha própria e alvos de 48 px |
| --- | --- | --- | --- |
| 1920×1080 | 980 | 1 | 1 |
| 960×1080 | 672 | 5 | 2 |
| 768×1024 | 704 | 4 | 2 |
| 1024×768 | 372 | 4 | 2 |
| 512×768 | 448 | 7 | 3 |

A última coluna é uma experiência CSS temporária no browser, removida depois
da medição; não é implementação nem validação de teclado virtual. O teste da
toolbar em linha própria usou altura de viewport de 1024 px para isolar largura.
As referências existentes estão em `output/playwright/responsive-editor-before-*`.

Problemas confirmados:

- A 1024 px, o breakpoint de 1020 px conserva índice/documento/painéis em
  colunas, apesar de a sidebar ocupar 224 px. As regras dos painéis ainda
  fazem duas colunas dentro dos 320 px laterais, comprimindo cada módulo.
- O índice tem o conteúdo oculto por `visibility: hidden`, revelado por hover
  ou `focus-within`, mas não tem trigger focável. Em touch e navegação inicial
  por teclado não existe uma forma explícita de o abrir.
- Voltar, toolbar e ações disputam a mesma linha. O cabeçalho atinge 211 px
  a 960 px e 283 px em split view, antes da área do documento.
- Nesta fixture, a página expande horizontalmente a 1067 px no viewport de
  1024 e a 637 px no de 512. Comparar scroll com a largura solicitada/clientWidth;
  `innerWidth` também pode expandir e esconder este problema na medição mobile.
- Ações e zonas vazias dos blocos dependem de hover/foco. A preservação de
  seleção das ferramentas depende de `onMouseDown`. O `pointercancel` do
  arrasto chama a conclusão normal, podendo guardar a ordem provisória.

### 4A — Documento, índice e conteúdo largo

Proposta de composição:

- Manter índice à esquerda, documento ao centro e painéis à direita quando
  existem pelo menos 64 rem úteis no editor. Mínimos de referência: índice
  3 rem, documento 32 rem, lateral 20 rem e gaps com tokens existentes.
  Confirmar o limiar com textos/anexos reais durante implementação.
- Abaixo desse espaço, retirar a coluna do índice e colocar todos os painéis
  depois do documento, na ordem DOM existente. Os painéis passam a grid
  auto-fit, com mínimo inicial de 19 rem; sem duas colunas forçadas dentro
  de um painel lateral estreito.
- Índice compacto: botão explícito «Índice» ao lado de Voltar, com alvo de
  48 px em touch. Abre um popover ancorado, até 20 rem e limitado ao viewport,
  com scroll próprio, hierarquia e indicação da entrada ativa existentes.
  Selecionar uma entrada fecha o painel e revela o destino abaixo dos headers;
  Escape/clique fora fecha e devolve foco ao trigger, sem abrir teclado.
- Em modo amplo, a coluna mantém os traços atuais e ganha um trigger real.
  Clique/toque/Enter/Space abre o mesmo painel; o hover desktop pode continuar
  como conveniência. Reutilizar a lista de entradas, sem dois índices montados.
- Reduzir padding do documento de 2 rem para 1 rem em composição compacta,
  mantendo gutters alinhados com o shell. Cabeçalho da nota, thumbnail,
  collection e tags quebram por conteúdo, preservando os campos atuais.
- Tabelas e código largos têm scroll local. Imagens e anexos respeitam a
  largura disponível; atributos de tamanho/wrap guardados não são alterados
  por resize. Botões de abrir/exportar/eliminar anexos ficam acessíveis por
  toque, preservando a confirmação e diferenças browser/desktop existentes.

Validação: cinco dimensões da tabela, pontos adjacentes ao limiar, índice
extenso, seleção por toque e teclado, Escape/restauro de foco, tabelas/código
largos, nomes de anexos longos e imagens existentes. Sem overflow da página
nem perda de conteúdo/draft ao redimensionar.

### 4B — Toolbar e teclado virtual

Proposta de comportamento:

- No desktop amplo conservar a composição atual quando cabe. Quando Voltar,
  índice, ferramentas e ações deixam de caber juntos, passar a toolbar para
  uma linha própria, sem mudar a ordem dos comandos. Manter estado de gravação
  e todas as ações da nota visíveis, com quebra quando necessário.
- Desktop Tauri e browser com ponteiro principal fine: toolbar sempre superior,
  independentemente de foco ou altura. Permitir duas linhas; se não bastarem,
  uma linha com scroll horizontal local. Disponibilidade touch aumenta os
  alvos, mas por si só não ativa ocultação nem posição inferior em híbridos.
- Tablet touch no browser, com ponteiro principal coarse: manter toolbar
  superior enquanto cabe em até duas linhas e deixa altura útil de edição.
  Em portrait de 768 px e landscape de 1024 px a medição de largura permite
  essas duas linhas; a abertura do teclado pode mudar o resultado pela altura.
- Modo compacto quando exige três linhas ou deixa menos de 16 rem livres
  entre headers/toolbar e o limite visível. Os 16 rem são um mínimo inicial
  de ensaio, a rever com escrita real. Com teclado virtual identificado,
  apresentar uma linha com swipe diretamente acima dele. Quando fecha,
  ocultar a barra nesse modo, conforme o acordo anterior.
- Identificação do teclado combina foco editável com variação da área visível,
  mantendo referências por orientação/escala. Resize, zoom ou interação
  coarse isolados não provam abertura do teclado. Não persistir esse estado.
- Não remontar os editores ou criar outra toolbar. Preservar target, seleção
  Tiptap, draft e undo; tocar/swipe nas ferramentas não deve provocar formatação
  acidental nem perda de seleção. Menus de cores/tabela são reposicionados e
  têm scroll próprio, fora da região que recorta o swipe da toolbar.
- Calcular offsets sticky pela altura efetiva da topbar e do cabeçalho, incluindo
  titlebar Tauri. A barra inferior não entra no cálculo do offset superior do
  índice. Reservar espaço para cursor e coordenar notificações/menus simultâneos.

Exceção proposta, por aprovar: quando a geometria do teclado não é fiável,
manter uma toolbar superior de uma linha com scroll, visível mesmo com teclado
fechado. Abrange a situação em que não se consegue distinguir teclado
flutuante/dividido ou obter posição suficiente. Não afirmar que o limite do
viewport corresponde ao topo desses teclados. É uma alternativa à ocultação
compacta acordada; só aplicar após aprovação.

Fundamento: `VisualViewport` dá área visível e escala, que podem mudar tanto
por zoom como pelo teclado; não constitui um indicador direto de teclado.
[MDN: VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport).
A API específica de teclado tem suporte limitado, pelo que não deve ser um
requisito para usar o editor.
[MDN: VirtualKeyboard API](https://developer.mozilla.org/en-US/docs/Web/API/VirtualKeyboard_API).
A escolha do fallback superior é uma decisão proposta para NoteX, não uma
garantia dada por estas APIs.

Validação: seleção/formatar/undo após transições, swipe sem comandos acidentais,
foco dos menus, teclado fechado com editor ainda focado, rotação e zoom. Fixtures
podem testar transições, mas a barra acima do teclado só fica validada com escrita
em Safari/iPad e Chrome/Android reais, incluindo teclado flutuante/dividido.
Não marcar 4B completa apenas com emulação Chromium.

### 4C — Ações dos blocos e conclusão dos gestos

Direção definida pelo utilizador, ainda sem implementação: retirar tanto a
barra permanente como a pega touch. Não reservar espaço para ações de bloco.
Os limites do bloco aparecem durante interação, sem fundos permanentemente
ativos. Manter o comportamento desktop nos ponteiros que o usam.

Decisão aprovada pelo utilizador: distinguir leitura de edição, seguindo o
comportamento observado no Notion mobile. A entrada imediata na escrita por
clique e navegação por teclado é um requisito obrigatório. Esta aprovação
define o comportamento; ainda não há implementação nem validação em touch real.

Limite de âmbito confirmado: estas adaptações são para tablet/mobile e, quando
o conteúdo o exigir, janelas desktop estreitas (exemplo de referência: metade
de um ecrã de 1920 px, não um breakpoint aprovado). Desktop normal conserva
o layout, a edição, a seleção, as ações dos blocos e os atalhos atuais.
Não tornar todos os editores inicialmente não editáveis de forma global.
Separar adaptação de largura da interação: uma janela desktop estreita com
rato não recebe gestos touch; a sequência leitura/hold aplica-se à experiência
touch adaptada, preservando clique e teclado em dispositivos híbridos.
Validar explicitamente o desktop normal para detetar regressões em cada passo.

- Em leitura, manter a mesma instância Tiptap não editável, mas acessível na
  ordem atual de Tab/Shift+Tab. Não criar uma segunda representação do documento.
- Clique com rato ativa edição no ponto clicado. Foco por teclado ativa edição
  imediatamente, preservando o comportamento atual do cursor e os atalhos.
  Não exigir Enter, segundo clique ou outra ação; não perder a primeira letra.
- Em touch, distinguir tap curto de pressão prolongada antes de ativar edição.
  Não ativar edição indiscriminadamente no foco provocado pelo contacto inicial.
- Durante edição, pressão prolongada no texto mantém a interação nativa de
  cursor, lupa, seleção e copiar/colar, e a formatação existente. Não iniciar
  drag do bloco a partir desse gesto. Não desenvolver lupa própria nesta direção.
- Regresso à leitura revisto pelo utilizador na secção 16: fechar teclado termina
  edição em tablet/mobile. Foco, zoom/resize e teclado físico não são indicadores
  isolados suficientes para inferir esse fecho no browser; validar identificação
  e transição sem prejudicar draft/seleção. Adaptação a teclado físico adiada.
- Suportar iOS, Android, rato, touch e teclado, incluindo dispositivos híbridos;
  não escolher o comportamento apenas pela largura ou pelo sistema operativo.

Sequência touch pretendida, começando fora de edição:

1. Entrar na nota: conteúdo normal, sem blocos em foco ou controlos de bloco.
2. Tap curto numa área do bloco: ativar edição, focar visualmente esse bloco e colocar o cursor
   no texto correspondente ao ponto tocado, sem pega nem botão de eliminar.
   O comportamento de áreas não textuais/anexos precisa de preservar as ações
   próprias desses elementos; não colocar o cursor numa posição arbitrária.
3. Pressionar em leitura durante cerca de 1 s: bloco preparado para arrasto, com feedback
   háptico quando suportado e border mais evidente ou glow leve. Aspeto final
   a rever visualmente; não mudar geometria/altura do bloco por mudar border.
   Tempo final a afinar. Movimento antes da ativação deve permitir scroll normal
   e cancelar a preparação de drag, distinguindo-o do pequeno tremor do dedo.
4. Após preparação, deslocar o dedo além da tolerância de movimento inicia
   drag, mantendo o mesmo contacto. Tremor de 5–10 px não deve indicar intenção
   de arrasto automaticamente. Valores finais a afinar com touch real.
5. Durante drag: mostrar moldura do bloco e uma linha horizontal de inserção
   no destino exato que será confirmado ao levantar o dedo. Fazer scroll automático conforme a
   posição do dedo na área visível de edição. Acelerar progressivamente junto
   às margens, com máximo controlado e independente da frequência de eventos.
   O centro deve permitir deslocação muito lenta; recomendação para revisão:
   zona central sem autoscroll, para estabilizar o destino. Recalcular destino
   enquanto o conteúdo faz scroll, mesmo com o dedo parado.
6. Proposta anterior, pendente de nova revisão neste modelo de leitura/edição:
   se continuar parado após a preparação durante cerca de mais 1 s, cancelar
   a possibilidade de iniciar drag nesse contacto e revelar as ações: mover
   acima/abaixo empilhados junto ao ponto original de toque, e eliminar ao
   centro em baixo. Segundo feedback háptico quando disponível. O menu é
   ancorado às coordenadas do toque, com ajuste apenas para evitar clipping
   e obstrução pelo dedo; não é ancorado genericamente ao topo do bloco.
7. Eliminar mantém a confirmação desktop existente. O botão inferior fica
   acima do teclado quando a geometria é conhecida; sem teclado, usa margem
   inferior generosa e safe area. Áreas de toque confortáveis, inicialmente
   48×48 px, sem exigir ícones visualmente grandes.
8. Mover acima/abaixo reutiliza a operação existente e acompanha o bloco por
   scroll, preservando o bloco alvo. Ações precisam de um novo tap deliberado:
   levantar o dedo da pressão prolongada não pode executar uma opção.
9. Drop válido confirma a ordem uma vez. Interrupção, `pointercancel` ou perda
   inesperada de captura abandonam a ordem provisória. Se libertar o dedo
   depois da primeira ativação sem arrasto/menu, não executar uma operação.

A eventual preferência de velocidade em Profile foi sugerida para discussão
posterior à implementação e teste. Não acrescentar agora.

Limitações e decisões técnicas a resolver antes da implementação completa:

- Vibração web não é garantida; Safari/iOS não suporta `navigator.vibrate`.
  O feedback visual precisa de comunicar os dois estados por si só.
  [MDN: vibração](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate),
  [MDN: compatibilidade](https://github.com/mdn/browser-compat-data/blob/main/api/Navigator.json).
- O editor atual está editável mesmo sem foco. Os handlers touch consultados
  no ProseMirror instalado não têm um temporizador de seleção de palavra após
  1 s; a origem exata do comportamento observado ainda precisa de confirmação.
  Primeiro ensaio: comparar editável sem foco, leitura e edição após tap curto.
  `editable: false` isolado não impede seleção nativa de texto em leitura.
  Validar supressão do gesto de seleção apenas onde necessário para o drag,
  sem prejudicar scroll, zoom, links, anexos ou seleção durante edição.
  [Tiptap: editable e tabindex](https://tiptap.dev/docs/editor/api/editor).
- O browser pode assumir pan/zoom e cancelar o ponteiro; mudar `touch-action`
  depois da ativação não muda o gesto já iniciado. Não resolver com bloqueio
  global de scroll/zoom ou scroll manual em toda a nota sem aprovação.
  [MDN: arbitragem de gestos](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action).
- A área visível também muda por zoom. Teclados flutuantes/divididos podem não
  fornecer a posição necessária ao botão inferior; comportamento alternativo
  ainda por decidir. Não adotar automaticamente o fallback proposto em 4B.

Validação por passos: clique e Tab/Shift+Tab com escrita imediata, primeira letra,
ordem de foco e cursor preservados; tap curto com cursor no ponto tocado e
abertura do teclado no mesmo gesto; hold em leitura versus seleção/lupa em edição;
scroll e zoom em Safari/iPhone/iPad e Chrome/Android reais, e transições entre
touch, rato e teclado físico em híbridos; tempos e tolerância;
drag/destino/autoscroll; ações contextuais com teclado aberto/fechado; comandos,
confirmação e cancelamento. Não avançar automaticamente para 4A/4B.

## 11. Primeira avaliação em tablet real — revisão das Etapas 1 a 3

Ambiente reportado pelo utilizador: iPad Air M3 de 13", Chrome. Os anexos
comparam a lista de notas e o Profile publicados com as versões de desenvolvimento.
Não generalizar esta avaliação a outros tablets, Safari, landscape, split view
ou mobile sem validação específica. Esta revisão não altera o âmbito do desktop
normal nem constitui autorização para avançar nas restantes entregas do editor.

### Etapa 1

Avaliação global positiva neste tablet. Não há correções pedidas para o shell
nesta avaliação; continuar a preservar a navegação e os controlos desktop atuais.

### Etapa 2 — listas, grelha e Home

O utilizador rejeitou a composição compacta atual por ter demasiada altura e
espaço vazio. Após comparar as referências, definiu uma nova direção: usar o
desenho dos cartões Grid existentes no desktop como base visual para as notas
em tablet/mobile, mantendo LIST com uma única coluna. Esta direção substitui
a proposta anterior de reproduzir apenas a linha horizontal original no tablet.
Desktop normal conserva tanto a lista como a grelha atuais.

Causas verificadas no código:

- `compact-notes` é aplicado a listas com largura até 64 rem e também por
  `any-pointer: coarse`, independentemente da largura. O formato muda cedo.
- O template separa ações, conteúdo, badges e data em linhas próprias; os
  badges usam grid e separam coleção de tags. Em touch os alvos têm 3 rem,
  aumentando ainda mais a altura desta composição.

Direção definida, com dimensionamento por rever visualmente antes de implementar:

- Reutilizar a composição visual Grid: miniatura, título e menu no topo,
  descrição quando existe, e coleção/tags com data/hora em baixo. No tablet,
  pega e seleção ficam à esquerda, ao lado de título e subtítulo respetivamente;
  pin e favorito ficam na zona inferior direita. Apresentar
  sempre uma nota por linha na experiência tablet/mobile, incluindo landscape.
- Rever a altura mínima e os espaços da adaptação, sem copiar automaticamente
  o mínimo desktop de 11 rem ou reservar uma linha vazia para descrição ausente.
  Manter coleção e tags juntas quando cabem e permitir quebra necessária em
  mobile; data/hora deve permanecer legível sem criar uma faixa vazia excessiva.
- Usar altura natural conforme o conteúdo de cada nota. `NoteRow` já omite
  descrições vazias e tags ausentes, mas o CSS Grid desktop mantém uma faixa
  `summary` com `minmax(0, 1fr)`, gaps e `min-height: 11rem`. Esconder elementos
  não chega: na adaptação, não reservar a faixa da descrição nem o espaço entre
  essa faixa e as restantes quando não existe descrição. Não aplicar estas
  alterações ao Grid ou List do desktop normal.
- Sem descrição, aproximar a faixa de metadados do cabeçalho com o espaçamento
  normal; com descrição, deixar o cartão crescer apenas pelo conteúdo e pelos
  espaçamentos necessários, preservando o comportamento atual do excerto.
  Sem tags, não reservar uma faixa para tags. Manter coleção, incluindo o badge
  existente «Sem coleção», e data/hora: são informação, não placeholders vazios.
- Controlos opcionais ausentes, como seleção ou pin em contextos onde não são
  apresentados, não devem deixar colunas vazias. Um favorito desativado ou uma
  checkbox não selecionada continuam a ser controlos úteis e não desaparecem.
  Preservar dimensões touch confortáveis e a ordem de navegação por teclado.
- Manter padding, alinhamento do cabeçalho e espaçamento entre secções coerentes,
  permitindo alturas diferentes nesta lista de uma coluna. Não criar componentes
  separados para cada combinação de conteúdo, nem novos controlos para expandir
  ou recolher cartões.
- Medir o espaço efetivo da lista e alvos touch; não escolher outro limiar
  arbitrário. A apresentação do desktop normal não muda por existir touch.
- Preservar seleção, favorito, pin, menus, reordenação existente e teclado.
  Tags em touch precisam de acesso sem hover ou sobreposição entre alvos.
- Reutilizar `NoteRow` na Home e nas listas; não criar versões independentes.

Decisão explícita do utilizador: retirar a escolha Lista/Grelha na experiência
tablet/mobile e apresentar sempre LIST, sem uma nova definição no Profile.
Desktop mantém o botão atual e a escolha do utilizador, com LIST como valor
inicial existente; não priorizar Grid sobre List.
Esclarecimento técnico: o botão atual chama `setPreferredLayout` e grava a
escolha internamente. Não há um segundo controlo ou setting de produto.
Na experiência tablet/mobile a vista efetiva será List, independentemente
desse valor interno, sem mudar o valor inicial ou a escolha do desktop.
Não classificar um desktop híbrido como tablet apenas por `any-pointer: coarse`.
Critério implementado nesta entrega: janelas até 64 rem, ou até 90 rem quando
o ponteiro principal é coarse. Um ponteiro secundário coarse não ativa a
adaptação num desktop largo. As quebras internas dos cartões e da Home medem
os respetivos containers; validar também tablet com rato/trackpad no ensaio real.

Home: referência visual recebida. Mostra cinco estatísticas distribuídas em
4+1 e cinco atalhos rápidos distribuídos em 2+2+1, deixando espaço vazio na
última linha de ambos os grupos. O código usa `auto-fit` com mínimos de 10 rem
nas estatísticas e 16 rem nos atalhos em touch, explicando estas quebras.
Decisão mais recente do utilizador: procurar uma composição de três cartões
na primeira linha e dois na segunda (3+2) nesta largura tablet, em vez de tentar
comprimir os cinco numa linha. Aplicar esta direção às estatísticas e aos atalhos.
Proposta de alinhamento para revisão visual: cartões com a mesma largura, com
os dois da segunda linha alinhados à esquerda nas mesmas colunas da primeira;
não esticar os dois para preencher a linha nem centrar automaticamente.
Medir o título e o controlo do atalho ocupado nesta composição, sem reduzir os
alvos touch ou tornar o título inutilmente truncado. Quando o conteúdo deixar
de caber, passar para duas colunas e depois uma, segundo o espaço efetivo.
Preservar a apresentação existente no desktop normal.
As composições finais da Home ainda precisam de revisão visual: não preencher
com conteúdo novo, esconder slots ou mudar o número de estatísticas/atalhos.

Validação focada das notas: título sem descrição, descrição presente, com/sem
tags, coleção longa e «Sem coleção», datas, e variantes de seleção/pin. Confirmar
que as secções ausentes não deixam espaços reservados, que texto e metadados
quebram legivelmente em mobile e que touch/teclado continuam a funcionar.

### Etapa 3 — preferências do Profile

O utilizador aprova a organização responsive dos módulos e, na revisão mais
recente, aceita manter o estilo novo das preferências, com dropdown abaixo.
Retirou o pedido anterior de recuperar a composição original no tablet.

Causa verificada: `@container profile-module (max-width: 28rem)` coloca os
selects abaixo do texto também nos módulos de uma coluna tablet estreita.

Direção: rever os limiares de quebra para que o empilhamento não aconteça antes
de ser necessário, mantendo a apresentação nova quando faz sentido. Medir
ícone, textos nos dois idiomas, seletor e alvos touch no espaço efetivo do módulo;
não aplicar automaticamente a mesma quebra a todo o tablet nem reverter o estilo
aprovado. Manter organização dos módulos, estatísticas e ações existentes.

Ordem da revisão: primeiro notas em List com a base visual dos cartões Grid e
disponibilidade da escolha Lista/Grelha; depois limiares das preferências do
Profile e distribuição das células da Home, com a referência agora disponível.
Validar cada entrega em portrait/landscape, largura intermédia e desktop normal,
e voltar a pedir avaliação no tablet real.

### Correções implementadas em 2026-09-18

Após aprovação do utilizador, esta entrega aplica as correções das Etapas 2 e 3.
A Etapa 1 não recebeu pedidos de alteração; o shell existente foi preservado.
Não houve implementação ou avanço das entregas do editor.

- Notas: `NoteRow` reutilizado na Home e nas listas, com altura natural,
  descrição sem faixa reservada quando ausente, metadados juntos e tags sem
  sobreposição. Controlos opcionais ausentes não geram colunas. Pin/favorito
  ficam lado a lado na adaptação para evitar altura adicional de alvos touch.
- Notas abaixo de 34 rem de largura disponível: pega/título e seleção/subtítulo
  conservam alinhamento na coluna esquerda. Miniatura passa para o rodapé para
  deixar largura para o texto. Descrição só acrescenta a sua linha quando
  presente. Alvos de 48 px no tablet e 44 px nesta composição
  mobile; ícones mantêm dimensões discretas. Sem novos controlos ou funcionalidades.
- Lista/Grelha: escolha escondida na adaptação; vista efetiva List, sem gravar
  uma preferência nova. Desktop normal mantém a escolha guardada e o default
  List existente. A grelha desktop mantém duas colunas.
- Home: três colunas na adaptação tablet, com os dois últimos cartões alinhados
  às duas primeiras colunas. Abaixo de 41 rem no container dashboard, duas
  colunas; atalhos passam a uma abaixo de 25 rem e estatísticas abaixo de 21 rem.
  Nos atalhos estreitos, título fica abaixo da miniatura e admite duas linhas,
  preservando o controlo de edição acessível. Desktop normal conserva cinco
  colunas nos dois grupos.
- Profile: limiar do módulo para colocar dropdown abaixo passou de 28 rem para
  23.5 rem. Organização dos módulos e estilo novo nas composições estreitas
  preservados; dropdowns ficam ao lado quando há largura suficiente.

Validação local concluída:

- Build de produção, Stylelint e verificação de ausência de estilos inline.
- Três testes existentes da sidebar: foco, Escape, inert e transições de largura.
- Chrome com rato em larguras 320, 390, 768, 960, 1024, 1366 e 1920 px, conforme
  o ecrã revisto; Chrome com emulação touch em 320, 390, 1024 e 1366 px.
- Notas com/sem descrição e tags, «Sem coleção», coleção e tag longas: sem
  overflow horizontal, com alturas diferentes conforme o conteúdo.
- Seleção e ações em lote; menu com ArrowDown/Escape e foco devolvido ao botão.
- Preferência Grid guardada reaparece no desktop após a vista adaptada; List
  desktop conserva linha horizontal. Home tablet confirmou três colunas iguais
  nos dois grupos. Profile confirmou módulos e dropdowns sem overflow.

Estas verificações não substituem o novo teste no iPad real, Safari/iOS,
teclado virtual ou dispositivos híbridos. Capturas e scripts de QA locais estão
em `output/playwright/` (artefactos ignorados pelo Git).

### Correção após avaliação dos cartões e do drag touch

O utilizador reportou título afastado para o meio do cartão tablet e arrasto
que fazia scroll da página. Ajuste aplicado: miniatura/título/menu no topo,
restantes controlos na faixa inferior junto aos metadados no tablet. A composição
mobile conserva a linha própria para controlos; desktop normal conserva a
posição original dos controlos e a ordem de navegação por teclado.

A pega ativa na adaptação passa a usar `touch-action: none`, limitado ao seu
alvo touch. O restante cartão mantém scroll e zoom nativos. Esta arbitragem
precisa de estar definida antes de começar o gesto, conforme
[MDN: touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action).
Não é uma implementação de long press no cartão nem altera as regras de produto:
só notas fixadas podem ser reordenadas, na lista sem filtros ativos.

O gesto acompanha o pointerId original; outros ponteiros não movem ou confirmam
a nota. `pointercancel`, contacto adicional, Escape, perda de foco da janela ou
ativação de filtros cancelam a ordem provisória. Apenas pointerup do contacto
original confirma a operação existente.

Validação de regressão no Chrome com eventos touch nativos enviados por CDP:

- Reprodução com touch-action auto: página deslocou-se 189 px e recebeu
  pointercancel. Com a correção: ordem das notas mudou, página não fez scroll
  e o gesto terminou em pointerup.
- Cancelamento depois de movimento: ordem guardada ficou intacta e o estado
  de arrasto foi limpo. Movimento fora da pega: página fez scroll normalmente.
- Capturas tablet portrait/landscape e mobile 320 px sem overflow horizontal;
  título tablet começa junto à miniatura, antes dos controlos inferiores.
- Arrasto com rato em desktop 1920 px e cancelamento por Escape passaram.
- Build e verificações de estilos passaram. Novo ensaio real no iPad pendente.

### Ensaio seguinte — pega e seleção na coluna esquerda

O utilizador confirmou que o drag touch funciona e pediu esta composição para
experimentar: pega no canto superior esquerdo com título à direita; seleção
por baixo da pega com subtítulo à direita, alinhado com o título. Pin e favorito
conservam a zona inferior direita. Este pedido substitui a posição inferior da
pega e seleção no ensaio anterior; a interação de drag não mudou nesta entrega.

Aplicado no mesmo `NoteRow`, apenas por estilos da experiência adaptada:

- Tablet: miniatura à direita no topo, junto ao menu, preservando o espaço do
  texto à direita da coluna de controlos. Rodapé conserva metadados e pin/favorito.
- Mobile: miniatura no rodapé para preservar largura útil do título e subtítulo.
- Sem subtítulo: seleção partilha a linha dos metadados em vez de criar uma
  linha vazia; cartões sem seleção/pega continuam sem reservar esses controlos.
- Desktop normal e ordem de foco existentes preservados.

Validação: alinhamento horizontal do título/subtítulo e alinhamento vertical
com os respetivos controlos em 1024, 1366, 390 e 320 px; cartões com/sem subtítulo,
sem overflow horizontal. Teste touch nativo repetido na nova posição da pega:
reordenação, cancelamento e scroll fora da pega passaram. Build e verificações
de estilos passaram. Avaliação visual deste ensaio no tablet real pendente.

Correção seguinte da Home: quando não existem seleção, pega ou pin, o rodapé
deixa de reservar a coluna da miniatura para a área de ícones. Metadados ocupam
essa largura e apenas o favorito visível usa a coluna final. Hora fica a 12 px
do controlo visível no tablet, sem espaço adicional para controlos ausentes.
Validado em Chrome touch em 1024, 1366, 390 e 320 px, sem overflow; em mobile,
hora conserva alinhamento à margem direita dos metadados. Desktop normal e
cartões com seleção/pega mantêm a composição anterior.

## 12. Fecho das Etapas 1 a 3 e altura disponível no browser

Em 2026-09-18, o utilizador considera as Etapas 1 a 3 concluídas, mantendo a
pendência de altura para a Etapa 4. Não foram implementadas correções de altura
durante esta verificação.

- Estrutura principal, reset, loading e alguns modais ainda usam `100vh`;
  sidebar e alguns limites de menus/notificações já usam `100dvh`. Uniformizar
  os limites que devem acompanhar as barras do browser, preservando scroll.
- `dvh` não garante espaço acima do teclado virtual. Rever a área visível dos
  controlos do editor em 4B e coordenar modais/banners com a Etapa 5, sem tratar
  zoom ou resize como prova isolada de teclado aberto.
- Dropdowns adaptados já usam Floating UI, cuja implementação instalada
  considera `VisualViewport`; não duplicar esse posicionamento.
- Verificação em Chrome desktop: sidebar acompanha alturas de janela testadas;
  modal de privacidade conserva margens e scroll interno com 400 px de altura.
  Estes testes não validam barras dinâmicas nem teclado virtual em dispositivos
  reais. Essa validação permanece necessária em iOS e Android.

Não avançar automaticamente para implementação de 4A, 4B ou 4C. Rever cada
entrega com o utilizador, preservando desktop normal e os comportamentos atuais
de rato e teclado.

## 13. Revisão de 4A — índice e painéis sobrepostos

Esta revisão substitui as propostas anteriores de 4A para índice e painéis.
Regista decisões e pontos por esclarecer; não houve implementação da interface.

- Tablet: conservar apresentação, localização e funcionamento atuais do índice,
  que o utilizador já experimentou. Reavaliar apenas a posição após rever a
  toolbar em 4B. Mobile: retirar o índice.
- Tablet/mobile: painéis da direita fechados por defeito; abrir sobre a nota,
  sem comprimir o documento, através de um chevron à direita à altura do índice
  ou, em mobile, aproximadamente da coleção. Confirmar alinhamento visual.
- Reutilizar metadados, tags, exemplos adicionais, links/backlinks e ficheiros.
  Manter formulários/drafts e scroll da nota durante abertura/fecho.
- Painel direito com scroll vertical e swipe para a direita para fechar; toque
  no backdrop também fecha. Tablet mantém botão de fechar. Mobile deixa uma
  faixa de background visível, substituindo a proposta fullscreen, e usa swipe
  e backdrop sem ícone de fechar. Preservar fecho acessível, Escape e foco.
- Acrescentar swipe para a esquerda para fechar o menu lateral esquerdo aberto
  pelo burger. Esta alteração autorizada do shell é separada do layout do editor
  e não altera a sidebar permanente do desktop normal.
- Distinguir direção e intenção dos gestos: scroll vertical continua nativo;
  seleção, campos editáveis e conteúdo com scroll horizontal não devem provocar
  fecho acidental. Não bloquear scroll/zoom globalmente.
- Adaptar margens à largura útil, com padding e alinhamentos coerentes. Não
  reutilizar automaticamente as margens desktop em tablet/mobile.
- Tags: retirar a lista do cabeçalho da nota em tablet/mobile; manter gestão e
  acesso no painel direito. Desktop normal conserva apresentação atual.
- Título/subtítulo mantêm comportamento atual, sem novas regras de produto ou
  limites de linhas. Garantir que conteúdo longo não alarga a página. Miniatura
  mantém-se à direita do título, alinhada à margem útil do documento.
- Coleção: o CSS atual tem `min-width: 13rem`, não largura fixa. Limitar o campo
  à largura disponível, com acesso ao nome completo no seletor.
- Tabelas/código e outros conteúdos que precisem de largura: scroll horizontal
  local, preservando swipe vertical da página/painel. Verificar nested scroll
  e gestos de fecho sem duplicar layouts nem alterar dados.
- Imagens: adaptar proporcionalmente à largura útil, sem deformar, sem ampliar
  desnecessariamente e sem alterar dimensões/wrap guardados na nota.

Informação antecipada para 4B/4C, a rever antes da entrega correspondente:

- Ações da nota acessíveis através de menu de reticências verticais (`⋮`) na
  experiência adaptada; não remover operações por as agrupar.
- Retirar exportação `.notex` em tablet/mobile, mantendo desktop. Por esclarecer:
  se esta decisão também abrange download/exportação dos anexos originais.
- O utilizador pretende retirar Voltar em mobile e usar swipe. Definir se o
  gesto será da app ou do browser e o destino quando a nota é aberta por link
  direto; não assumir que o histórico do browser tem uma página NoteX anterior.
  Ainda não há implementação de navegação por swipe.
- Anexos existem na lista lateral e também como elementos inseridos no documento.
  `originalName` é o nome do ficheiro; Abrir aciona `openNoteAttachment`. No Web,
  PDF/imagens reconhecidos são abertos numa nova aba; outros tipos seguem o
  caminho de download atual. Esconder um ícone de download não altera por si só
  esse comportamento. Não retirar anexos do documento por esta revisão.

Desktop normal continua com composição e interações atuais. Mobile final e
validação em browsers/dispositivos reais continuam dependentes das etapas
correspondentes, sem considerar esta revisão uma conclusão de 4A/4B/4C.

## 14. Revisão seguinte — coleção, anexos e ações da nota

Decisões do utilizador, ainda sem implementação:

- Aba direita em mobile semelhante ao drawer esquerdo atual: painel sobreposto,
  faixa de background visível, scroll vertical, swipe para a direita e toque no
  backdrop para fechar. Swipe para fechar não significa scroll horizontal da aba.
- Mover o seletor da coleção para um painel próprio imediatamente acima de Tags.
  Tablet/mobile usam a aba direita; desktop usa a secção de painéis existente.
  Esta é uma alteração desktop explicitamente pedida, exceção ao princípio de
  conservar a composição normal. Retirar a coleção do cabeçalho da nota.
- Preservar seleção de coleção/Sem coleção, persistência e atualizações MCP.
  Hoje coleção, título e subtítulo partilham draft/gravação em NoteHeader; separar
  a apresentação sem reenviar valores antigos, perder drafts ou ultrapassar a
  coordenação de mutações MCP. Contratos, IDs e formatos não mudam pelo layout.
  Aplicar este requisito também aos restantes campos expostos por MCP.
- Manter imagens proporcionais sem deformação. Rever legibilidade com imagens
  reais; não comprimir conteúdo da imagem para forçar dimensões mínimas nem
  alterar os atributos guardados. Preview solicitado pelo utilizador definido
  abaixo; ainda sem implementação.
- Nomes dos anexos: reutilizar ellipsis CSS da lista lateral em tablet/mobile,
  sem nova funcionalidade para mostrar o nome completo nesta entrega.
- Distinguir upload de imagens e outros ficheiros. Atualmente os comandos image
  e file chamam o mesmo insertFile. Os dados já distinguem kind=image/attachment.
  Imagens novas aparecem no documento e no painel de ficheiros; outros ficheiros
  novos aparecem apenas no painel. Preservar armazenamento, backup/sync e
  compatibilidade com documentos existentes. O utilizador confirma que não há
  anexos não imagem inseridos pelos utilizadores atuais; não é necessária uma
  entrega de migração para esta alteração. Novos anexos não imagem ficam no painel.
- Nome do ficheiro clicável aciona Abrir. Para tipos que não se abrem no browser,
  o utilizador deseja escolha do local de gravação. No Web, essa escolha não é
  garantida em todos os browsers: showSaveFilePicker tem suporte limitado e exige
  contexto seguro/interação; download convencional obedece às regras do browser.
  Fallback aprovado: onde houver seletor suportado, permitir escolher destino;
  nos restantes browsers usar o comportamento de download do browser/sistema,
  sem prometer escolha universal de pasta.
- Menu vertical de ações da nota: favorito, eliminar e controlo de participação
  no backup atualmente existente, quando aplicável. Hoje o ícone de cloud alterna
  exclusão da nota no backup; não constitui um novo comando de backup imediato.
- Tablet/mobile: esconder exportação .notex e a indicação Saved locally. Isto
  não altera persistência/sync nem elimina mensagens de erro. Desktop mantém
  Saved locally nesta entrega; retirada futura não está autorizada agora.
- Mobile: retirar Voltar do cabeçalho e usar navegação nativa do browser, conforme
  a decisão do utilizador. Não acrescentar Voltar ao menu nem swipe de navegação
  próprio. Links partilhados não estão no âmbito do produto. Validar as rotas de
  entrada existentes e a navegação real nos browsers suportados, sem bloquear os
  gestos nativos com os novos drawers ou scrolls locais.

Verificação nesta revisão: 27 testes existentes passaram em dispatcher.test.ts e
noteMutationCoordinator.test.ts. Confirma a base atual; não valida antecipadamente
a nova disposição dos campos ou todos os caminhos MCP. Quando implementado,
validar mudanças locais/remotas de coleção, título e tags com edição pendente,
painel aberto/fechado e após navegação. Não houve alterações de código da app.

### Preview de imagens solicitado pelo utilizador

Para tablet/mobile, o primeiro tap curto numa imagem mostra os controlos; outro
tap curto sobre a mesma imagem, com controlos ativos, abre o preview. Não exigir
double-tap rápido nem interpretar toque nos controlos, swipe/drag ou pinch como
o segundo tap. Ao mudar de imagem ou sair da interação, reiniciar esta sequência.
O preview ocupa a área visível da app, com imagem centrada e inicialmente ajustada
para caber inteira. Usar o ficheiro original já armazenado, sem gravar zoom/posição
nem alterar os atributos da imagem no documento.

- Pinch aumenta/reduz a imagem; após ampliar, arrastar permite explorar detalhes.
  Limitar zoom/pan para a imagem não se perder fora da área visível; ajustar
  limites com imagens reais, portrait/landscape e rotação.
- Zoom pertence ao preview, preservando zoom e scroll normais fora dele. Gestos
  no preview não reordenam blocos, fecham drawers ou alteram o conteúdo da nota.
- Propor botão de fechar visível, Escape e restauro de foco/scroll ao sair.
  Reutilizar infraestrutura de modal/foco, sem alterar regras dos outros modais.
- Integrar a sequência de taps com seleção Tiptap, controlos e 4C; um arrasto não
  termina em abertura de preview. Desktop normal mantém a interação existente,
  com as correções de limites e simplificação de controlos pedidas abaixo.

Viabilidade: browser permite pinch/pan através de Pointer Events. Exibição modal
simples; gestos e integração com editor exigem uma entrega própria de complexidade
média, com validação touch real em iOS/Android e regressão de foco/seleção Tiptap.
[MDN: pinch zoom](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Pinch_zoom_gestures).
Esta proposta não acrescenta galeria, navegação entre imagens ou novas ferramentas.

### Limites das imagens e limpeza de anexos — revisão seguinte

Decisões do utilizador, ainda sem implementação:

- Em todos os dispositivos, imagem e controlos ficam dentro da largura útil do
  respetivo container, descontando padding/bordas. Conservar proporções e evitar
  que mínimos intrínsecos do grid/figure/img alarguem o documento. O `max-width`
  já existente no figure não basta para considerar todos os casos resolvidos.
- Slider de tamanho: máximo corresponde à largura útil atual do container,
  em vez do teto fixo atual de 760 px. Rever também o mínimo/step, para caber
  em containers estreitos e permitir atingir a largura máxima. Atualizar limites
  ao redimensionar/rodar, sem gravar uma alteração de tamanho só por resize.
- Controlos: conservar alinhar esquerda/centro/direita e tamanho; retirar os dois
  botões de envolver texto. Esta simplificação e os limites são pedidos que
  abrangem também desktop. Não eliminar atributos guardados ou suporte MCP a
  documentos existentes por remover os botões. Revisão estética mais ampla fica
  para depois, conforme pedido.
- Remover imagem do corpo deve limpar a lista de ficheiros, registos, binário
  armazenado e referências temporárias pertencentes à app. Eliminar anexo no
  painel segue a mesma operação centralizada; não basta esconder o item.
- Não imagem apenas no painel: associar à nota, sem dependência de um bloco que
  possa ser apagado depois. Preservar a relação das imagens com o conteúdo.

Achados da leitura do código: Backspace/Delete com nó de ficheiro selecionado
chama deleteFile; essa ação remove referências nos blocos, registo e binário.
Eliminação de blocos também tem limpeza. Atualização genérica do documento não
faz reconciliação de anexos removidos, pelo que corte/remoção de seleção e outros
caminhos ainda precisam de verificação. No Web, o cache de object URLs só é
revogado ao trocar/fechar biblioteca; deleteBlob não revoga a URL individual.
É necessária limpeza desse cache na eliminação para libertar referências ao Blob.

Validação focada prevista: imagem grande em documento estreito, slider no máximo,
rotação/resize, controlos/preview e drag; remoção pelo painel, Backspace/Delete,
seleção/corte e eliminação do bloco, incluindo edição pendente, undo/redo e MCP.
Confirmar ausência de registos/binários órfãos após reabrir biblioteca e de URLs
em cache após eliminar ficheiros. Verificar referências repetidas e interrupções
para não apagar um ficheiro ainda usado nem esconder falhas de limpeza.

### Bug confirmado pelo utilizador — undo após eliminar imagem

O utilizador reproduziu no desktop: eliminar imagem do corpo retira-a da lista
de ficheiros; undo volta a mostrar a imagem no documento, mas não na lista.

Decisão do utilizador: eliminação de imagem/anexo é definitiva e não permite
restaurar o ficheiro por undo/redo; para o voltar a usar é necessário inserir
novamente. Preservar undo/redo normal de texto/formatação, incluindo operações
que envolvam texto e imagem. Não limpar indiscriminadamente todo o histórico.
Esta correção aplica-se também ao desktop, como pedido explícito de consistência.

Fundamento da leitura: o editor regista alterações do documento no histórico,
enquanto deleteFile remove registo e binário num caminho separado. Restaurar um
nó noteFile não restaura esses recursos. O histórico deve deixar de poder
reintroduzir referências a anexos eliminados, também através dos comandos da
toolbar, teclado/gestos nativos e alterações posteriores do documento. Definir
estratégia com testes Tiptap/ProseMirror; não considerar apenas bloquear Ctrl+Z
ou excluir a transação de eliminação do histórico como garantia suficiente.

Desktop: deleteNoteAttachment invoca notex_note_file_delete, que chama
fs::remove_file para o ficheiro da biblioteca. A URL de imagem usa caminho
convertido do Tauri, sem passar pelo Map de object URLs Web. A reaparição visual
pode ser uma referência restaurada pelo histórico com conteúdo ainda em cache
da WebView; isto é hipótese, não confirmação de que o ficheiro existe em disco.
Confirmar o caminho físico e erros da eliminação durante a reprodução; não
concluir persistência apenas porque a imagem volta a aparecer na interface.

Conclusão exigida da entrega: eliminação bem-sucedida limpa registos, binário e
referências controladas pela app, sem recuperação de nós órfãos por undo/redo.
Falhas de limpeza devem ser tratadas sem declarar conclusão; movimentos de
imagem/bloco não podem ser confundidos com eliminação. Testar painel, teclas,
seleção/corte e remoção de bloco, depois undo/redo repetidos, nova edição e
reabertura da biblioteca. Validar ficheiro físico em Tauri e Blob/cache no Web,
mais persistência/sync/MCP. Ainda não houve implementação desta correção.

## 15. Revisão de 4B — toolbar acima do teclado

Esta revisão substitui a proposta anterior de toolbar superior em tablet e a
mudança de posição por altura disponível. Ainda não houve implementação.

- Desktop normal: conservar a composição atual. Desktop estreito: Voltar,
  cloud, favorito, exportação, estado de gravação e eliminar na linha superior
  do container; ferramentas abaixo, com duas linhas e margens alinhadas. Usar
  718 px como ensaio pedido pelo utilizador, medindo espaço útil real, não como
  resultado já validado nem novo breakpoint arbitrário.
- Tablet/mobile: toolbar apenas com teclado virtual aberto, acima dele, com
  todos os comandos numa linha e scroll horizontal. Mesma regra em portrait e
  landscape. Não alternar para o topo só por faltar altura no modo normal;
  avaliar primeiro em dispositivos reais.
- A barra é a toolbar do NoteX reutilizada e reposicionada. Não existe API Web
  para injetar os seus comandos numa barra nativa do teclado. inputAccessoryView
  é uma API UIKit para apps nativas; VirtualKeyboard/VisualViewport fornecem
  controlo/medição do teclado ou área visível, não uma toolbar personalizável.
  É um elemento HTML da app dentro da área de conteúdo do browser, no limite
  inferior da área visível acima do teclado; não sobrepõe UI do browser/sistema.
- Preservar cursor, lupa, seleção e teclado nativos. A integração dos comandos
  da app deve aplicar estilos à seleção Tiptap certa e preservar foco sem criar
  outro sistema de seleção. Swipe da toolbar não executa um botão ao terminar.
- Cores mantêm os pickers atuais: abrir acima da toolbar, ancorado ao respetivo
  ícone, mantendo teclado e seleção. Não substituir teclado por uma lista de
  cores. Limitar dimensão à área visível e usar scroll interno quando necessário.
  Aplicar os mesmos limites aos menus de tabelas e restantes ferramentas.
- Reservar no scroll espaço correspondente à toolbar e uma margem confortável,
  para a última linha da nota poder ficar acima dela. Preservar scroll nativo;
  ajustar apenas obstruções de foco/seleção e offsets efetivos dos headers.
  O utilizador confirma compensar teclado e toolbar para poder ajustar a view.
  Medir área visível real em vez de assumir altura fixa do teclado ou descontar
  duas vezes o espaço que o browser já reduziu.
- Banners/notificações respeitam teclado/toolbar: ações continuam alcançáveis e
  não ficam permanentemente sobre o cursor ou os comandos. A composição exata
  de overlays simultâneos será revista com Etapa 5. Preferência proposta pelo
  utilizador: região superior em tablet/mobile. Rever antes apenas se um banner
  bloquear os testes de edição; não considerar a posição final já implementada.
- Ações da nota em menu ⋮ na experiência adaptada: favorito, eliminar e controlo
  atual de participação no backup, quando aplicável. Retirar Saved locally em
  tablet/mobile e Voltar em mobile. Preservar operações e atalhos existentes.
- Exceção aprovada para geometria de teclado não fiável, como flutuante/dividido:
  usar barra de uma linha no topo da nota durante edição, com scroll horizontal,
  posição confirmada pelo utilizador. Não tentar seguir uma posição que o browser
  não expõe.
  Foco editável, zoom ou resize isolados não provam teclado virtual aberto.
- Adaptação e validação específica de teclado físico em tablet/mobile adiadas
  pelo utilizador para uma atualização futura. Não acrescentar agora o fallback
  proposto para esse caso. Preservar atalhos/comportamentos existentes no código
  partilhado e todo o suporte atual de teclado desktop.

Referências: [Apple: inputAccessoryView](https://developer.apple.com/documentation/uikit/uiresponder/inputaccessoryview),
[MDN: VirtualKeyboard](https://developer.mozilla.org/en-US/docs/Web/API/VirtualKeyboard_API),
[MDN: VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport).
Os prints Obsidian/Notion fornecidos definem a referência de posicionamento e
comportamento; não permitem determinar a implementação interna dessas apps.

Entrega prevista por partes: composição desktop estreita e ações da nota;
posição/visibilidade da toolbar touch; preservação de seleção e scroll; pickers
e exceções de teclado. Cada parte requer explicação antes de implementar e
validação focada, incluindo Safari/iPad/iPhone e Chrome/Android reais.

## 16. Revisão de 4C — gestos, menu contextual e destinos de arrasto

Decisões revistas com o utilizador, ainda sem implementação. Esta secção
substitui as alternativas anteriores de blocos completos durante drag e
reordenação imediata ao atravessar um bloco.

Leitura, edição e preparação touch:

- Tablet/mobile: tap curto em texto entra em edição com cursor/teclado;
  fechar teclado regressa à leitura e permite hold para reordenar imediatamente.
  Não deixar Tiptap editável com seleção ativa após sair. Validar fecho pelo
  browser/sistema e eventuais comandos existentes da app; rotação, zoom ou
  resize isolados não são prova de teclado fechado.
- Em leitura, hold de 1 s prepara drag com indicação visual e um pulso curto
  de vibração onde suportado. Movimento além da tolerância inicia drag.
  Mais 1 s parado após preparação (2 s no total) abre menu e emite dois pulsos
  curtos separados por pausa, onde suportado. Feedback visual é obrigatório;
  vibração é melhoria opcional e não se promete em Safari/iOS.
- Tolerância inicial de ensaio: 10 px CSS, distância desde o contacto inicial
  para ambas as esperas. Não reiniciar temporizadores com tremor. Movimento
  além da tolerância antes de 1 s cancela hold e mantém scroll normal.
  Drag iniciado cancela espera do menu; edição preserva gestos nativos de texto.
- Tempos, tolerância, padrões de vibração e parâmetros de autoscroll deverão
  ficar em src/config/settings.json, na secção editor, consumidos pela
  configuração central existente de appSettings.ts. São parâmetros da app,
  sem nova preferência no Profile ou alteração ao modelo de UserSettings.
  Valores numéricos de ensaio podem ser ajustados durante testes reais.

Menu de mover/eliminar:

- Ações em torno do ponto de contacto: mover acima sobre o ponto, mover abaixo
  sob o ponto e eliminar à direita. Usar desenho geométrico e tokens NoteX;
  limitar grupo à área visível, ajustando nas margens sem clipping. Guardar
  posição do contacto na área visível quando o menu abre; botões permanecem
  nessa posição durante scroll e movimentos, sem seguir coordenadas do bloco.
  Ajustar apenas o necessário para caber inicialmente ou após mudança da área
  visível, como rotação; não deslocar o menu por compactar/expandir blocos.
- Libertar o dedo que abriu menu não executa opção; exigir novo tap deliberado.
  Menu permanece após mover acima/abaixo para permitir operações repetidas.
  Cada tap move imediatamente o bloco um índice na lista, com feedback visual
  da nova posição, acompanha bloco por scroll quando possível e atualiza limites
  das ações. Não esperar pelo fecho do menu para aplicar ordem. Distinguir de
  drag livre, onde só a linha indica destino e a ordem muda no drop.
- Tap fora dos três botões fecha menu. Eliminar abre confirmação existente:
  não apagar antes de confirmar; eliminação confirmada fecha menu e remove
  bloco. A transição para o modal suspende os controlos contextuais; o resultado
  de cancelar a confirmação deve ser verificado com o comportamento existente.
- Compactação/collapse também aprovada durante menu, substituindo recomendação
  anterior de blocos completos. Reutilizar a mesma moldura, título e preview de
  2–3 linhas do drag. Bloco em foco mantém indicação visual de reordenação
  ativa em ambos os modos; não depender apenas dos botões para o identificar.
- Tap fora fecha modo de mover, restaura blocos completos e tenta manter vista
  junto do bloco movido, preferindo a passagem/posição interna capturada antes
  de compactar. Usar o mesmo mecanismo de restauro visual do drop. Fechar menu
  não desfaz movimentos já efetuados nem exige confirmação adicional.

Drag visual aprovado:

- Compactação/collapse temporária escolhida pelo utilizador. No arrasto mostrar
  título do bloco, se existir, e as primeiras 2–3 linhas visuais do conteúdo,
  reutilizando a moldura existente dos blocos à volta da composição compacta.
  Não exigir mostrar conteúdo inteiro de imagens/tabelas/código; limitar também
  conteúdo não textual ao espaço de preview para não anular a compactação.
- Aplicar ao drag dos blocos em tablet/mobile e desktop conforme pedido revisto.
  Desktop conserva acesso atual por pega/rato e teclado; não recebe hold de
  edição touch. Fora do gesto, blocos mantêm apresentação desktop normal.
- Compactar quando começa o transporte efetivo, não apenas ao completar 1 s
  de preparação. Se pressão permanecer até abrir menu, compactar nessa abertura.
- Fantasma compacto acompanha dedo/ponteiro; em touch o centro vertical do
  fantasma fica à altura do dedo. Esta ancoragem refere-se à representação que
  segue o contacto, não a deslocar cada bloco da lista para o dedo.
- Os outros blocos permanecem na ordem original durante o gesto. Linha azul
  horizontal mostra a posição exata de inserção antes/depois de um alvo compacto;
  não trocar índices ou mover automaticamente os blocos ao passar o ponteiro.
  O fantasma não participa na medição de destinos nem interceta os contactos.
- Reutilizar dados e instâncias Tiptap: compactação estritamente visual, sem
  alterar documento, dimensões guardadas, ficheiros ou histórico. Não montar
  editores adicionais para o fantasma nem disparar limpeza por conteúdo oculto.
- Separar mecanismo visual de collapse da lógica de drag e do menu, com uma
  única apresentação compacta reutilizável. Ideia futura do utilizador:
  "Collapse all blocks" para visão rápida da nota. Não acrescentar agora botão,
  preferência, persistência ou modo de leitura adicional para essa ideia.
- Estabilizar scroll ao mudar alturas e manter o fantasma agarrado ao dedo.
  Escolher destino pela geometria compacta, com zona antes/depois do ponto
  médio e estabilidade na fronteira. O autoscroll recalcula destinos.
- Libertar contacto confirma uma vez o destino indicado, grava nova ordem,
  restaura automaticamente blocos completos e acompanha bloco movido.
  Não exige botão adicional de confirmação. Persistência deve continuar a
  tratar erros; não declarar gravação bem-sucedida antes da operação terminar.
- Restauro visual após drop em tablet/mobile: antes da compactação, guardar
  uma referência ao conteúdo visível (bloco e posição interna da passagem,
  preferindo a zona tocada) e à sua altura na área visível. Depois de reordenar
  e expandir, ajustar scroll para voltar a mostrar essa passagem aproximadamente
  à mesma altura, mesmo que o bloco tenha mudado de índice. Não restaurar apenas
  o antigo scrollTop nem saltar obrigatoriamente para o início do bloco.
  Este critério refina o acompanhamento acima: manter contexto de leitura.
  Limitar ajuste ao scroll disponível; testar início/fim, blocos grandes,
  imagens que carreguem depois e rotação. A técnica exata depende do ensaio,
  sem promessa de igualdade pixel a pixel. O comportamento após drop desktop
  fica para avaliação separada, conforme pedido do utilizador.
- Destino é inserção na lista, não troca exclusiva de dois IDs; preservar ordem
  relativa dos restantes e coordenação de alterações/sync/MCP existentes.

Conclusão, cancelamento e autoscroll:

- pointerup válido do contacto ativo conclui drag. pointercancel significa que
  browser/sistema interrompeu contacto, por exemplo ao assumir scroll ou mudar
  orientação. Interrupção/Escape abandona destino e mantém ordem original,
  remove fantasma/linha, restaura alturas e termina autoscroll/temporizadores.
- Escape em desktop explicitamente aprovado: cancela drag ativo e conserva
  índice original sem gravação. Restaurar contexto visual anterior quando
  possível, limpar estado do gesto e ignorar o pointerup posterior, para não
  concluir inadvertidamente o drag já cancelado. Preservar restantes atalhos.
- Corrigir caminhos separados: NoteDetailPage atualmente liga pointerup e
  pointercancel ao mesmo handlePointerEnd/finishBlockDrag, podendo gravar uma
  ordem que o utilizador não confirmou. Gesto cancelado não deve gravar.
- Aprovados para ensaio: zona central sem autoscroll, aceleração progressiva
  perto de topo/fundo e velocidade máxima inicial de 250 px CSS/s.
  Faixas de margem de cerca de 80 px CSS ajustadas à altura útil continuam
  proposta de calibração, não medida validada. Centralizar parâmetros no
  settings.json, incluindo tamanho das zonas e controlo da curva de aceleração.
- Usar tempo decorrido para velocidade consistente, limitar ao scroll real
  disponível e recalcular linha/destino com dedo parado durante autoscroll.
  Testar em dispositivos reais antes de estabilizar valores. Não acrescentar
  preferência de velocidade ao Profile nesta entrega.
- Ideia futura registada pelo utilizador: preferência de velocidade do
  autoscroll durante drag com opções Slow/Normal/Fast (nomes a rever/localizar),
  sem expor valores em píxeis. Fora do âmbito atual; não criar UI, persistência
  de preferência ou alteração de modelo para essa ideia nesta entrega.

Validação Web touch indispensável: hold sem seleção/scroll indevidos preservando
swipe normal antes da ativação; touch-action não pode ser alterado a meio do
gesto como solução. Testar leitura/edição, tempos e tolerância, ambos os padrões
de vibração onde suportados, menu persistente/repetição/margens, compactação com
conteúdo misto e imagens, centro do fantasma, autoscroll, drop/cancelamento,
rotação e persistência/MCP. Desktop valida pega/rato, linha/fantasma/compactação,
cancelamento e conservação da navegação/edição por teclado.

Referências:
[MDN: padrões de vibração](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate),
[Compatibilidade da Vibration API](https://caniuse.com/vibration),
[MDN: pointercancel](https://developer.mozilla.org/en-US/docs/Web/API/Element/pointercancel_event).

## 17. Primeira entrega de 4A — acesso aos painéis da nota

Implementação em 2026-09-18, após autorização para iniciar. Entrega delimitada:

- Reutilização dos painéis existentes numa coluna desktop ou aba sobreposta,
  sem listas/componentes de edição duplicados. Desktop normal conserva coluna,
  índice, cabeçalho e controlos existentes.
- Regra adaptada existente das Etapas 1–3: janela até 64 rem ou ponteiro primário
  coarse até 90 rem. Não tratar um ecrã touch secundário como razão suficiente
  para substituir desktop amplo. Critério mantém consistência com as notas;
  calibração adicional do espaço útil do editor depende dos ensaios de 4B.
- Tablet/mobile: painéis fechados por defeito, chevron à direita alinhado com
  referência sticky do índice, abertura sobre documento sem reduzir sua largura.
  Mobile até breakpoint central de 680 px não mostra índice. Tablet mantém
  apresentação/funcionamento existentes, com posição sticky nas larguras onde
  regra antiga o fazia perder essa posição.
- Margens de documento reduzidas na composição adaptada. Tags de cabeçalho
  ocultas nessa composição, disponíveis no painel. Coleção ainda no cabeçalho:
  movimento para painel próprio acima das tags é a próxima entrega.
- Scroll vertical nativo dentro da aba e swipe horizontal nativo para a direita
  por scroll snap. Fecho por fundo/Escape e botão no tablet; mobile conserva
  botão acessível a teclado/leitor de ecrã mas oculto visualmente até foco.
  Campos editáveis, tags e controlos não iniciam swipe horizontal da aba.
- Foco/modalidade e bloqueio do fundo apenas enquanto aberta, restauro no
  chevron sem mudar scroll. Formulários e editores permanecem montados no
  abre/fecha; mudar entre apresentação desktop e adaptada muda o contentor.
- Geometria da aba acompanha VisualViewport quando disponível, com fallback
  para viewport da janela e CSS dvh; sem altura fixa de teclado. Esta entrega
  não resolve ainda a toolbar/scroll do editor durante edição (4B).
- Nenhuma alteração a modelos, IDs, armazenamento, contratos MCP ou operações
  de painel. Atalho global de escrita inicial não atua atrás da aba modal.

Validação focada:

- Typecheck, build de produção e regras de SCSS/ausência de estilos inline
  passaram. Build conserva avisos existentes de dependências/chunks.
- Playwright CLI/Chrome: desktop 1920×1080, tablet 1024×1000, mobile 390×700
  e 320×700. Coluna desktop/tags conservadas, índice só oculto no mobile,
  aba sem comprimir nota, scroll interno, fecho/foco, conservação de rascunho
  e instâncias de editor no abre/fecha, redimensionamento para desktop.
- Touch nativo emulado via CDP a 1366×1024/coarse: swipe vertical faz scroll
  interno, swipe para direita fecha e swipe vertical na nota após fechar
  continua a fazer scroll normal. Esta evidência não substitui iPad/iPhone ou
  Android reais, incluindo teclado virtual, barra de URL e seleção de texto.
- Zoom emulado a 1,5×: aba ajustada à largura/altura da área visível e fecho
  posterior validado. Não constitui teste real de pinch/teclado em iOS.
- 27 testes existentes de dispatcher/coordenação MCP passaram. Verificam
  contratos/coordenação de base; não constituem validação real de todas as
  operações MCP em paralelo com edição nesta nova apresentação.

Avaliação inicial do utilizador em dispositivos reais após esta entrega:
iPad com resultado positivo e teste rápido em iPhone com aba direita a funcionar.
Não equivale a validar todos os casos de teclado, orientação ou browsers.

Próximas entregas de 4A: coleção no painel, concluída na secção 18;
swipe de fecho do menu esquerdo; contenção de tabelas/código/imagens e seus
controlos/preview; distinção dos uploads e limpeza permanente de anexos.
4B e 4C permanecem separados, conforme as decisões das secções 15 e 16.

## 18. Segunda entrega de 4A — coleção no painel

Implementação em 2026-09-18, após autorização para continuar:

- Coleção saiu do cabeçalho e passou para painel próprio imediatamente acima
  de Tags. Aplica-se também ao desktop, conforme exceção explicitamente
  aprovada; restantes controlos desktop conservam a apresentação existente.
- Reutilização do mesmo CustomSelect: cores, Sem coleção, opções e navegação
  por teclado. Largura limitada ao painel, nomes longos com ellipsis e opções
  de pelo menos 44 px CSS em dispositivos com ponteiro coarse. O nome na
  informação de coleção também usa ellipsis para não alargar a aba.
- Cabeçalho e seletor partilham um único rascunho, debounce e proteção MCP,
  incluindo quando a aba está fechada. Gravação envia apenas campos alterados;
  atualização de campos limpos não substitui texto local mais recente quando
  uma gravação anterior termina. Uma falha conserva o rascunho e a proteção.
- Debounce existente de 650 ms centralizado em editor.headerSaveDebounceMs
  no settings.json. Não é uma nova preferência de utilizador.
- Corrigida a atualização visual de campos Tiptap inline após perder foco:
  valores remotos adiados durante edição são aplicados ao sair do campo,
  sem emitir nova gravação. Mantém-se a proteção do cursor durante o foco.
- Sem alterações a modelos, IDs, contratos/transportes MCP ou operações de
  coleção. Não foram implementados toolbar, gestos de blocos ou anexos.

Validação focada:

- 31 testes passaram: quatro do rascunho partilhado e 27 existentes de
  dispatcher/coordenação MCP. Cobrem gravação conjunta, edição mais recente,
  atualização remota, Sem coleção e conservação da proteção após falha.
- Build de produção/typecheck e regras de estilos passaram.
- Playwright CLI/Chrome a 1920×1080 e 1024×1000: ordem dos painéis, seleção
  por teclado, persistência após reload, Escape/foco no dropdown sem fechar
  a aba e gravação da coleção mesmo após fechar a aba.
- A 390×700 e 320×700 com touch emulado: dropdown e nomes longos dentro dos
  limites do painel, sem overflow horizontal, opções de 44 px e revisão visual.
- Dispatcher MCP real da aplicação Web: alteração rejeitada enquanto existe
  rascunho local; alteração de título/coleção aceite após gravação, com UI
  sincronizada. Não constitui ensaio do transporte nativo Tauri ou de todos
  os comandos MCP, nem substitui avaliação em tablet/mobile reais.

Avaliação do utilizador após esta entrega: resultado aprovado no iPad, com
ganho de espaço no topo, e funcionamento MCP confirmado em desktop.

Próxima entrega delimitada: swipe para fechar o menu esquerdo, concluído na
secção 19. Contenção de conteúdo largo, imagens/preview e anexos continuam
por fazer dentro de 4A; 4B e 4C continuam sem implementação.

## 19. Terceira entrega de 4A — swipe de fecho do menu esquerdo

Implementação em 2026-09-18, após autorização para continuar:

- Menu aberto pelo burger acompanha o dedo e fecha com swipe para a esquerda.
  Usa scroll horizontal nativo com dois pontos de scroll snap. Scroll vertical
  da navegação continua nativo; o browser distingue o pan do tap num link.
- Mecanismo partilhado com a aba direita em useDrawerSwipe, com abertura,
  fecho, observação da posição e redimensionamento comuns aos dois lados.
  Não acrescenta bibliotecas nem deteção manual de velocidade do dedo.
- Mantidos links, ações, fecho por fundo/botão/Escape, bloqueio do fundo,
  foco modal e restauro do foco. Foco de abertura/restauro não desloca a página.
  A aba mantém a área de fundo visível e as dimensões atuais do menu.
- Regra existente do burger até 900 px preservada. Desktop com sidebar
  permanente conserva dimensões, posição sticky e navegação; os contentores
  adicionais usam display: contents nessa apresentação.
- Scroll snap, IntersectionObserver e ResizeObserver permitem o mesmo caminho
  nos browsers suportados sem exigir Popover, scroll-initial-target ou
  animações ligadas ao scroll. Reduced motion evita a animação programática.
- Sem alterações a dados, gravação, contratos MCP, toolbar, blocos ou anexos.

Validação focada:

- Três testes existentes de useSidebarDrawer passaram: foco, modalidade,
  transições entre desktop/compacto e coordenação com modais.
- Typecheck, build de produção e regras de estilos passaram.
- Playwright CLI/Chrome: desktop 1920×1080 com sidebar sticky de 224 px;
  mobile 390×700 e 320×700; tablet compacto a 820×600 e 820×900.
  Validados fundo/botão/Escape, foco, scroll da página e transição para desktop.
- Touch nativo emulado via CDP: menu acompanha o dedo durante swipe para a
  esquerda, fecha e liberta foco/scroll; swipe sobre link não navega; tap no
  link continua a navegar. Com uma lista extensa de coleções, swipe vertical
  faz scroll dentro do menu sem o fechar ou deslocar horizontalmente.
- Regressão da aba direita após partilha do mecanismo: scroll vertical,
  swipe para a direita, fundo/botão/Escape, foco, rascunhos e instâncias de
  editor preservados; passagem para desktop, scroll da nota e zoom a 1,5×.
- A emulação não substitui ensaio real em iPad/iPhone/Android, em especial
  gestos diagonais, movimento parcial e barras do browser.

Próximas entregas de 4A: contenção de tabelas/código/imagens e seus controlos,
preview de imagem e tratamento de uploads/limpeza de anexos. Implementar em
entregas delimitadas; 4B e 4C permanecem separados.

## 20. Quarta entrega de 4A — contenção de conteúdo largo

Entrega retomada após interrupção por limite de utilização e concluída em
2026-09-18. Implementação e validação automatizada concluídas; falta a avaliação
do utilizador em dispositivos reais.

Alterações aplicadas:

- Contentores de blocos/editor com tracks minmax(0, 1fr) e min-width: 0,
  para evitar crescimento pela largura intrínseca de imagens, tabelas e código.
- Scroll horizontal local no tableWrapper existente do Tiptap e código,
  sem bloquear o pan vertical da página. Código usa white-space: pre e
  overflow-wrap: normal para não quebrar as linhas longas pela regra do editor.
- Imagem limitada à largura disponível, com altura proporcional. Largura
  guardada aplicada por variável CSS de geometria, sem modificar atributos
  apenas por redimensionar a janela.
- Máximo do slider medido com ResizeObserver no contentor do node view,
  independente do tamanho atual da imagem. Configuração imageSizing no
  settings.json: largura inicial 420, mínimo 160 e passo de resize 1 px.
- Controlos reduzidos a três alinhamentos e slider; botões de envolver texto
  removidos e nomes dos alinhamentos simplificados em português/inglês.
  Atributos wrap existentes preservados; novos drops usam alinhamento sem wrap.
- Primeiro click/tap seleciona a imagem e sincroniza a seleção DOM através
  de editor.view.focus(), que preserva o scroll. Resolve o recuo da seleção
  para o parágrafo seguinte observado no checkpoint. Os controlos abrem no
  click concluído, sem bloquear pointerdown ou os gestos nativos de scroll/drag.
- Controlos limitados à largura do contentor; quebram em duas linhas quando
  necessário. Botões e slider têm área de toque mínima de 44 px com ponteiro
  coarse, incluindo dispositivos híbridos.

Estado da validação:

- Reexecutados 31 testes de extensões do editor, richTextInput e dispatcher
  MCP: passaram. Regras de estilos também passaram.
- Build de produção/typecheck reexecutado sobre o estado atual: passou.
- Script de browser em output/playwright/check-wide-content.js executado com
  imagem SVG de 3000×1500, largura guardada de 2600 px, tabelas de sete colunas,
  código longo e tabela dentro de um exemplo. Usa biblioteca isolada de QA.
- Chrome a 1920, 1366, 1024, 718, 390 e 320 px: imagem proporcional,
  imagem/controlos/slider dentro do editor, máximo do slider conforme o
  contentor e scroll local no código e nas tabelas, incluindo tabela num exemplo.
  Screenshots revistos em output/playwright/wide-image-*.png.
- Alterações de viewport não modificaram a nota guardada, a largura de 2600 px
  ou as larguras das colunas. Reduzir a imagem a 160 px não reduziu o máximo
  disponível do slider. Resize pelo teclado, três alinhamentos e gravação/reload
  passaram, mantendo o ID do ficheiro.
- Touch nativo emulado via CDP: swipe horizontal desloca apenas tabela/código;
  swipe vertical desloca a vista da nota, sem deslocamento horizontal da página.
  A medição considera VisualViewport.pageTop além de window.scrollY.
- Tap ao centro de imagem grande a 390 e 1366 px manteve os controlos abertos.
  Drag nativo de imagem em desktop continuou a iniciar e não duplicou o nó
  nem criou um novo ficheiro. Isto não valida a futura reordenação de blocos 4C.
- Não houve alterações nos contratos ou handlers MCP; testes existentes
  passaram. A regressão MCP através do transporte desktop não foi repetida.
- Em mobile, a toolbar atual continua a ocupar altura/ultrapassar a largura
  disponível e pode deslocar o viewport visual; é a pendência já prevista em 4B.
  Esta entrega contém os conteúdos do documento, sem redesenhar a toolbar.

Avaliação real: inserir uma imagem grande, tocar no centro, ajustar tamanho e
alinhamento, reabrir a nota; testar swipe horizontal e vertical sobre tabela/
código em portrait e landscape. A emulação não substitui iPad/iPhone/Safari
nem confirma o comportamento em todos os browsers e dispositivos.

Próximas entregas: preview de imagem e uploads/limpeza de anexos. 4B e 4C
continuam por implementar, em entregas separadas. O utilizador confirmou
entretanto o swipe esquerdo em iPhone.

## 21. Correções de 4A após avaliação em iPad/iPhone

O utilizador confirmou que imagens grandes respeitam os limites do contentor,
mas identificou abertura indevida do teclado ao tocar na imagem, fecho dos
controlos ao alinhar e tabelas com colunas demasiado comprimidas. Correções
implementadas e verificadas em 2026-09-18; esta secção atualiza a secção 20.

Alterações aplicadas:

- Tap com touch/pen seleciona a imagem sem focar o editor. O pointerdown
  impede o foco por eventos de rato compatíveis, mantendo o pan nativo.
  Se havia texto em edição, tocar na imagem retira esse foco. Rato conserva
  a sincronização da seleção DOM através de editor.view.focus().
- Alinhar ou redimensionar mantém os controlos abertos. Fecham ao tocar fora,
  selecionar outro conteúdo ou iniciar o drag existente da imagem.
- Três botões de alinhamento centrados sob a imagem, com slider numa linha
  separada abaixo. O conjunto acompanha o centro da imagem nos três
  alinhamentos e respeita a largura do contentor. Cores, superfícies, bordas,
  estados ativos e foco usam os tokens do NoteX; alvos de toque de 44 px.
  O slider mantém o elemento range nativo e a operação por teclado.
- Colunas de tabelas na composição adaptada têm mínimo visual de 10 rem,
  configurado pelo token note-table-column-min. Frases com palavras curtas
  deixam de comprimir as colunas até uma palavra por linha: quando a largura
  necessária excede o contentor, surge scroll horizontal local.
  Não altera larguras guardadas nem o mínimo de resize do desktop normal.
- Código dentro de pre preserva explicitamente espaços e linhas, incluindo
  linhas longas compostas por palavras curtas. Quotes e tips com prosa normal
  continuam a quebrar linhas; tabelas e código largos no seu interior usam
  scroll local, sem transformar toda a prosa numa superfície horizontal.

Validação focada:

- Chrome/Playwright CLI a 1366, 390 e 320 px com touch nativo emulado via CDP,
  e a 1920 px com rato: seleção da imagem, três alinhamentos e resize mantêm
  os controlos visíveis; slider abaixo dos botões e conjunto dentro do editor.
- Touch na imagem/controlos não deixa um elemento contenteditable focado.
  Tap no texto continua a permitir edição; voltar a tocar na imagem retira
  esse foco. Swipe vertical iniciado na imagem desloca a nota sem abrir os
  controlos nem focar o editor.
- Tabela de cinco colunas com frases normais, tabela dentro de tip e código
  com uma linha longa de palavras curtas: scroll horizontal local em mobile;
  cinco colunas cabem no tablet largo sem impor scroll desnecessário.
  Swipe horizontal e vertical sobre tabela/código passaram separadamente.
- Reexecutados 31 testes existentes de extensões do editor, richTextInput e
  dispatcher MCP; regras de estilos e build de produção/typecheck passaram.
  Contratos/handlers MCP não foram alterados; transporte desktop não repetido.
- Screenshots e scripts de QA em output/playwright/image-review-*.png,
  check-image-review.js e check-native-review.js, numa biblioteca isolada.

Falta confirmar em iPad/iPhone que o teclado real não abre ao tocar na imagem
e que alinhamentos/resize mantêm os controlos. A emulação verifica foco e
gestos do browser, mas não reproduz o teclado do sistema iOS. Preview,
uploads/limpeza de anexos, toolbar 4B e gestos de blocos 4C continuam separados.

## 22. Resize proporcional por duas pegas

Após avaliação real da secção 21, o utilizador aprovou substituir o slider:
ao mudar a altura da imagem, o slider deslocava-se e dificultava manter o dedo
no controlo. Entrega implementada em 2026-09-19 para ensaio em iPad/iPhone.

Comportamento aplicado:

- Duas pegas nos cantos superior esquerdo e inferior direito, visíveis com os
  controlos da imagem. Indicadores geométricos discretos, área de interação
  de 44 px, cores e estados de foco do NoteX. Slider removido; três botões de
  alinhamento mantidos sob a imagem e abertos depois do resize.
- Arrastar qualquer pega aumenta/diminui a imagem proporcionalmente, usando
  o movimento horizontal ou vertical predominante. O tamanho mínimo continua
  a adaptar-se a contentores mais estreitos; o máximo é a largura disponível.
  Tocar num único lado não bloqueia crescimento: a posição provisória ajusta-se
  dentro do contentor até atingir a largura total permitida.
- Captura de ponteiro mantém o gesto ao sair da área inicial da pega. Apenas
  as pegas reservam touch-action: none; a superfície restante conserva o pan
  normal. Touch/pen não foca texto; rato preserva o foco existente do editor.
- A imagem mantém-se no fluxo do documento: o bloco cresce em altura e afasta
  o conteúdo seguinte. Compensação de scroll tenta manter o canto agarrado na
  mesma posição vertical relativa ao dedo, considerando VisualViewport.
  Para a pega superior, esta compensação afasta visualmente o conteúdo anterior.
- Alinhamento horizontal libertado provisoriamente durante o gesto para ambas
  as pegas acompanharem o ponteiro; translação limitada aos limites do contentor.
  Ao largar, reaplica-se o alinhamento escolhido. Junto às margens, a pega não
  pode acompanhar uma posição do dedo que exigiria sair do contentor.
- Perto do topo/fundo da vista, um gesto de crescimento já iniciado pode
  continuar enquanto o dedo permanece junto à extremidade correspondente.
  Aceleração gradual e crescimento limitado pela largura disponível.
- Espaço temporário de scroll antes/depois do conteúdo permite compensar a
  posição em notas curtas e durante redução da imagem. Inserido fora do
  documento ProseMirror e removido ao concluir/cancelar/desmontar o node view.
  Ao concluir, preserva-se a posição vertical sempre que o scroll final permitir.
- Tamanho provisório apenas na geometria do node view; uma atualização de
  atributos ao largar, usando a gravação diferida já existente. Sem alterar
  identidade do ficheiro, proporções, conteúdo ou contrato MCP.
- pointercancel, perda de captura, Escape, saída da janela, segundo contacto,
  zoom, mudança de largura do viewport ou alteração concorrente da largura
  guardada cancelam e restauram tamanho/scroll. Alterações de altura das barras
  do browser não cancelam por si só o gesto.
- Pegas acessíveis por Tab: setas ajustam largura, Home/End escolhem limites.
  Passo numérico e parâmetros do gesto em settings.json/editor.imageSizing:
  resizeStep 1, keyboardResizeStep 10, edgeScrollZone 64 e maxEdgeScrollSpeed 200.
  São configuração da app, sem acrescentar preferências ao Profile.

Validação focada:

- Chrome/Playwright CLI em biblioteca isolada: duas pegas, três alinhamentos,
  aumento e redução a 1366, 390 e 320 px com touch emulado via CDP e a 1920 px
  com rato. Proporções, largura, ausência de salto inicial, acompanhamento
  vertical, persistência dos controlos e conservação de alinhamento/ficheiro.
- Resize vertical com uma imagem já encostada a um lado, compensação ao largar,
  crescimento junto à extremidade da vista, limite máximo, cancelamento nativo,
  Escape, foco desktop, undo/redo e resize por teclado verificados no browser.
- Perda de captura cancela sem gravar; reload conserva tamanho e ID do ficheiro.
  Notas curtas ensaiadas em tablet/mobile e resize de imagens antigas com wrap
  ensaiado em desktop. O gesto mantém a compensação e remove os espaços finais.
  Numa nota curta, o restauro ao largar pode atingir o limite de scroll: em
  emulação mobile, a toolbar larga atual pode aumentar o layout viewport e
  limitar a compensação final. Esta pendência de viewport mantém-se ligada a 4B.
- Tap sem movimento não modifica uma largura guardada superior ao contentor.
  Movimento provisório não grava a nota; conclusão grava pelo caminho existente.
- 31 testes existentes de extensões/richTextInput/dispatcher MCP passaram,
  assim como regras de estilos e build/typecheck. Transporte MCP desktop não
  repetido nesta entrega; contratos e handlers mantidos.
- Scripts e imagens de QA em output/playwright/check-image-handles.js,
  check-image-resize-safety.js, check-image-resize-short.js e image-handles-*.png. A toolbar mobile atual
  ainda pode cobrir parte da nota em emulação; a sua adaptação mantém-se em 4B.

Avaliação real pendente: ambos os cantos em iPad/iPhone, imagens a meio de texto
e no início/fim de notas, aumento/redução com movimentos diagonais e verticais,
alinhamentos e gesto junto às barras do browser em portrait/landscape.
Preview e uploads/limpeza de anexos continuam como entregas seguintes de 4A;
toolbar 4B e gestos/reordenação de blocos 4C permanecem separados.

## 23. Preview fullscreen de imagens

Entrega implementada e avaliada em iPad e iPhone reais em 2026-09-19.

- Em tablet/mobile, o primeiro tap curto seleciona a imagem e mostra os seus
  controlos. Um segundo tap curto na mesma imagem abre o preview. Não é exigido
  double-tap rápido. Rato em desktop conserva a interação existente.
- Movimento acima de 10 px, múltiplos contactos e pointercancel anulam a
  sequência, evitando abrir o preview depois de swipe, drag ou pinch.
- O preview reutiliza o modal da app: ocupa a área visível, bloqueia o scroll
  do documento, mantém foco contido e fecha pelo botão visível ou Escape,
  restaurando o foco ao sair.
- A imagem abre centrada e conserva as proporções. A dimensão inicial máxima é
  80% da largura e 80% da altura visíveis, deixando margem que identifica o
  modo de preview e mantém o botão de fechar separado da imagem. Uma única
  escala, calculada a partir das dimensões originais, escolhe o primeiro eixo
  que atinge esse limite e deriva o outro pelo ratio original; a imagem nunca
  é esticada para preencher simultaneamente os dois limites.
- Pinch permite zoom entre 1× e 4×. Quando ampliada, a imagem acompanha pan e
  fica limitada ao overflow real, sem se perder fora da área visível. O zoom e
  a posição são temporários e reiniciam ao abrir, mudar de imagem ou alterar a
  geometria visível.
- Gestos do preview ficam isolados do Tiptap e não alteram conteúdo, atributos,
  ficheiros ou ordem de blocos. Não foram adicionadas galeria ou navegação entre
  imagens.

Validação: testes focados dos limites de zoom/pan e do modal passaram, assim
como typecheck e regras de estilos. O utilizador confirmou o funcionamento do
preview em iPad e iPhone reais. Por indicação do utilizador, não se repetiu
Playwright para o ajuste visual final de 80%; deve ser confirmado nos mesmos
dispositivos quando a app for atualizada.

Próxima entrega de 4A: uploads e limpeza permanente de anexos. Toolbar 4B e
gestos/reordenação de blocos 4C permanecem separados.

## 24. Uploads e limpeza permanente de anexos

Entrega implementada e avaliada em dispositivos reais e no desktop Tauri em
2026-09-19.

- A ação Inserir imagem abre apenas formatos de imagem. A imagem continua a ser
  inserida no corpo da nota e aparece também no painel Ficheiros, associada ao
  bloco que a contém.
- A ação Inserir ficheiro abre os formatos de documento já suportados. O ficheiro
  é guardado e aparece apenas no painel Ficheiros; não cria um cartão dentro do
  Tiptap nem fica associado ao bloco que estava em edição.
- O nome do ficheiro no painel é a própria ação de abrir. Mantém ellipsis para
  nomes extensos. Formatos que o browser consegue apresentar abrem normalmente;
  nos restantes, o browser/sistema trata a gravação do ficheiro.
- Exportar/descarregar conserva o comportamento de desktop. O botão é escondido
  dentro da aba lateral adaptada de tablet/mobile, onde abrir pelo nome e apagar
  continuam disponíveis com alvos de toque de 44 px.
- Apagar uma imagem no editor ou apagar qualquer entrada no painel remove o nó
  do documento, o registo da nota e o ficheiro físico. Apagar um bloco ou apagar
  definitivamente uma nota aplica a mesma limpeza a todos os ficheiros ligados.
- A eliminação física ocorre antes da remoção dos registos. Se a segunda fase
  falhar, a entrada continua visível e a operação pode ser repetida; a eliminação
  do ficheiro é idempotente. Isto evita confirmar uma eliminação enquanto o blob
  ainda ocupa armazenamento sem existir uma forma normal de o encontrar.
- No Web, a URL temporária em cache é revogada no próprio momento da eliminação,
  em vez de permanecer ativa até fechar ou trocar de biblioteca.
- Remover do editor uma imagem/ficheiro é uma operação permanente e fica fora do
  histórico do Tiptap. Undo, redo ou uma atualização tardia de conteúdo não podem
  restaurar o ID apagado; para voltar a usar o ficheiro é necessário inseri-lo de
  novo. Corte, seleção, remoção de bloco e eliminação pelo painel usam a mesma
  regra de limpeza.
- Se a nota ou o bloco desaparecer enquanto o seletor de ficheiros está aberto,
  ou se a gravação dos metadados falhar depois do upload, o ficheiro recém-criado
  é eliminado para não deixar lixo no armazenamento.
- Uploads e gravações automáticas de conteúdo são serializados por nota. Isto
  impede que um autosave iniciado durante o seletor reponha uma versão anterior
  do estado e faça um documento recém-adicionado desaparecer do painel até ao
  reload. Falhas reais de seleção/importação apresentam agora feedback visível.
- Não foram alterados contratos, comandos ou handlers MCP. A classificação e a
  localização visual dos anexos são decisões do cliente/store existente.

Validação automatizada: typecheck, regras de estilos e 13 testes focados do
editor, store e preview passaram. Os testes cobrem a associação distinta de
imagens/documentos, a ordem da eliminação física, a remoção do nó Tiptap e o
bloqueio de restauro por undo. Incluem também uma transação de upload suspensa
enquanto o autosave começa, confirmando que ambos os resultados permanecem no
estado final. Build de produção executado após esta secção.

Avaliação real concluída em iPhone, iPad e desktop: imagens aparecem no corpo e
no painel, desaparecem de ambos ao eliminar e abrem numa nova aba; ficheiros de
texto aparecem apenas no painel e desaparecem da lista ao eliminar. Tocar no
nome apresenta o fluxo de gravação do browser em tablet/mobile e abre o ficheiro
na aplicação associada no desktop, neste caso o Notepad. A correção da corrida
entre upload e autosave foi confirmada nos três ambientes. O utilizador tinha
também confirmado anteriormente que o MCP continua operacional no desktop.

Com esta entrega e avaliação, o 4A fica concluído. Toolbar 4B e
gestos/reordenação de blocos 4C continuam separados.

## 25. Primeira entrega de 4B — cabeçalho e ações da nota

Implementação em 2026-09-19, avaliada em desktop estreito, tablet e mobile.

- Desktop normal mantém a composição anterior. No layout adaptado sem touch,
  destinado a janelas estreitas com rato/teclado, o cabeçalho passa para duas
  zonas: Voltar e ações da nota na primeira linha; toolbar completa abaixo,
  podendo quebrar em duas linhas conforme o espaço real disponível.
- Tablet/mobile com touch reúne participação no backup, favorito e mover para a
  lixeira num menu `⋮`. As operações e estados são os existentes. Exportação
  `.notex` e `Saved locally` não aparecem no menu adaptado; desktop conserva-os.
- O menu usa o componente visual, foco inicial, setas, Home/End, Escape e fecho
  exterior já usados nos restantes menus da app. Alvos têm 44 px e as ações de
  backup/favorito expõem o respetivo estado às tecnologias de apoio.
- Em mobile touch até 680 px, Voltar deixa de aparecer conforme decisão
  anterior. Tablet conserva o botão. A distinção de touch considera ponteiros
  coarse disponíveis e `maxTouchPoints`, incluindo dispositivos híbridos; um
  desktop amplo não entra nesta composição apenas por possuir touch.
- O BubbleMenu de bold/italic/link deixa de ser montado na experiência touch
  adaptada. A toolbar principal mantém os mesmos comandos. Desktop normal e
  desktop estreito conservam o BubbleMenu por decisão do utilizador.
- A toolbar touch continua temporariamente no cabeçalho até existir deteção do
  teclado no passo seguinte. Não se forçou já scroll horizontal: os pickers de
  cores e tabelas estão atualmente dentro do mesmo contentor e seriam cortados
  por `overflow-x`. Linha única, scroll e overlays externos serão entregues em
  conjunto para não retirar ferramentas durante o estado intermédio.
- Foram acrescentados rótulos explícitos para incluir/excluir a nota do backup,
  substituindo uma chave de tradução inexistente também no botão desktop.
- O menu `⋮` usa o posicionador flutuante partilhado pelas listas: abre alinhado
  para a esquerda do botão e muda de lado automaticamente quando o espaço do
  viewport assim o exige. Mantém também os limites e o reposicionamento durante
  resize/scroll.
- Nos layouts adaptados, o cabeçalho da nota fica sticky imediatamente sob a
  topbar. A posição usa a base real da topbar, incluindo variações de gutter e a
  titlebar do desktop, em vez do afastamento histórico fixo de `3.5rem`. O
  desktop normal conserva a posição anterior.
- A aba direita renderizada por portal calcula também a área protegida pela
  titlebar nativa do Tauri. Em desktop estreito, o título e o botão de fechar
  começam abaixo dessa barra e a altura útil do drawer é reduzida pelo mesmo
  valor; Web, iPad e iPhone conservam a geometria do `VisualViewport`.
- Sem alterações a modelos, armazenamento, sync, contratos ou handlers MCP.

Validação automatizada: typecheck e regras de estilos passaram. Build de
produção executado após esta secção. A composição, ações corretas do menu e
ausência do BubbleMenu touch foram confirmadas em janela estreita, iPad e
iPhone. O alinhamento adaptativo do menu e a posição sticky corrigida aguardam
a verificação final nesses dispositivos.

Próxima entrega: estado do teclado/VisualViewport e reposicionamento da toolbar;
em seguida, linha única com scroll horizontal, seleção e overlays sem clipping.

## 26. Segunda entrega de 4B — toolbar touch em linha única

Implementação ajustada e validada em 2026-09-22 em iPhone, iPad e desktop.

- Em layouts touch adaptados, a toolbar permanece no cabeçalho sticky da nota e
  deixa de tentar acompanhar o teclado virtual. No tablet fica entre `Voltar` e
  o menu `⋮`; no smartphone, onde `Voltar` está oculto, fica imediatamente à
  esquerda do menu.
- A toolbar continua a ser a mesma instância React e conserva os mesmos comandos.
  Apresenta uma única linha, alvos de 44 px e scroll horizontal por swipe.
- Chevrons suaves são apresentados dentro das extremidades da toolbar apenas
  quando existem comandos ocultos nessa direção: no início aparece apenas o da
  direita, durante o percurso podem aparecer ambos e no fim apenas o da
  esquerda. São indicadores visuais e não interferem com o swipe ou com os
  botões.
- Menus de cor/highlight e tabela são portados para fora do contentor de scroll
  e posicionados com Floating UI junto ao respetivo botão, com flip e limites do
  viewport.
- Foi removida a deteção e o posicionamento baseados em `VisualViewport`, assim
  como reservas de espaço específicas para o teclado. A barra nativa apresentada
  pelo iOS continua sob controlo do browser/sistema e não é personalizada pela
  aplicação Web.
- Desktop normal e desktop estreito mantêm a composição anteriormente validada;
  os chevrons aplicam-se apenas à experiência touch adaptada.
- A infraestrutura partilhada de clique exterior, foco de menus e popovers foi
  estendida por parâmetros opcionais; os comportamentos desktop existentes são
  os defaults e permanecem inalterados.
- A correção das patch notes mobile usa `100dvh` e uma grelha interna com scroll
  limitado, impedindo que o modal ultrapasse a área visível.

Validação automatizada: typecheck, regras de estilos e build passaram após o
ajuste. Não foi executado Playwright.

Correção do ensaio real: em browsers iOS, abrir o teclado pode deslocar a
`VisualViewport` sem deslocar a viewport de layout usada por `position: sticky`.
A topbar e o cabeçalho da nota passam a acompanhar apenas esse `offsetTop`,
mantendo-se empilhados durante o scroll com o teclado aberto. Não é acrescentado
espaço ao documento; quando a viewport regressa à posição normal, o offset volta
a zero.

Validação real concluída: em iPhone e iPad, a toolbar, o scroll horizontal e os
chevrons funcionam corretamente; escrita, seleção, formatação e menus flutuantes
mantêm-se acessíveis e os menus permanecem dentro do ecrã. Desktop normal e
desktop estreito não apresentam regressões. O header continua sticky durante o
scroll com o teclado aberto.

O editor mobile não suporta iPhone em landscape nesta fase: a altura útil com o
teclado aberto é insuficiente para uma experiência aceitável, incluindo num
iPhone 14 Pro Max. Um eventual aviso para regressar a portrait fica registado
como decisão futura e não foi implementado. O iPad continua suportado em portrait
e landscape.

Próxima entrega depois desta avaliação: 4C, interação e reordenação touch dos
blocos com compactação temporária, linha de destino e menu mover/eliminar.
