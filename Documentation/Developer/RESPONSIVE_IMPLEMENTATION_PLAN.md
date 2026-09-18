# NoteX: janela desktop de meia largura, tablet e avaliação mobile

Estado: Etapas 1, 2 e 3 consideradas concluídas pelo utilizador em 2026-09-18,
após as correções da secção 11 e a avaliação no iPad Air M3 de 13", Chrome.
Mantém-se uma pendência transversal de altura disponível no browser, a tratar
na Etapa 4 em coordenação com os overlays da Etapa 5 (secção 12).
Esta aceitação não significa validação real de todos os browsers e dispositivos.
Etapa 4: propostas para revisão; direção de 4C acordada, ainda sem implementação.
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
- Determinar o estado pelo foco/seleção e interação, não apenas pelo teclado
  virtual: teclado fechado ou teclado físico não provam fim da edição.
  A forma de regressar à leitura ainda precisa de revisão.
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
