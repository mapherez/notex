# Plano de Implementação do MCP Local do NoteX

## Estado e relação com o trabalho existente

- Este é o plano ativo para a próxima etapa do MCP no NoteX.
- O objetivo imediato passa a ser ligar clientes AI locais diretamente ao NoteX aberto, sem backend, conta, Google OAuth, HTTPS ou cloud.
- O plano remoto em `MCP_IMPLEMENTATION_PLAN.md` e todo o diretório `backend/` ficam preservados para uma futura integração com plataformas web como `chatgpt.com`.
- O contrato em `packages/notex-mcp-contract`, o dispatcher, as leituras da Fase 3 e as escritas atualmente não validadas da Fase 4 são comuns aos modos local e remoto e não devem ser duplicados.
- Este pivot não autoriza alterações nem migrações na base de dados do NoteX.

## Objetivo

O utilizador deve conseguir:

1. Abrir o NoteX.
2. Ir à secção MCP do Profile.
3. Clicar em `Iniciar MCP`.
4. Abrir `Configurar MCP` em qualquer momento para consultar e copiar os dados de ligação.
5. Adicionar esses dados a qualquer cliente AI que suporte servidores MCP locais por Streamable HTTP.
6. Pedir ao cliente AI para pesquisar, ler, criar e editar notas através das ferramentas MCP do NoteX.

Quando o NoteX estiver fechado ou o servidor tiver sido parado, o endpoint local deixa de estar disponível. Não existem filas, replay, ações pendentes ou execução posterior.

## Fluxo final

```text
Cliente AI local
  -> MCP Streamable HTTP em 127.0.0.1
  -> servidor MCP dentro do processo Tauri do NoteX
  -> broker de pedidos Tauri
  -> dispatcher TypeScript existente
  -> stores/repository existentes
  -> SQLite local v3
```

O backend remoto não participa neste fluxo.

## Invariantes

- As notas permanecem exclusivamente na SQLite local atual.
- A base de dados do NoteX continua na versão 3, sem novas tabelas, colunas ou migrações.
- O servidor local nunca escuta em `0.0.0.0`, na LAN ou num endereço público.
- O Rust não lê nem escreve diretamente nas tabelas de notas para executar ferramentas MCP.
- Toda a lógica de notas continua a passar pelo dispatcher, stores e repository do renderer.
- O mesmo contrato e os mesmos nomes de ferramentas são usados pelos modos local e remoto.
- Pedidos em curso falham ao parar o servidor, fechar a app ou perder o renderer; nunca são repetidos.
- Argumentos, resultados, títulos, IDs e conteúdo de notas não são registados em logs.
- O código remoto existente não é removido, reescrito ou misturado no runtime local sem necessidade.
- Não existe comportamento específico para Codex, ChatGPT, Claude, Grok ou outra marca no protocolo ou na UI.

## Transporte escolhido

### Streamable HTTP local embutido

O servidor MCP será executado pelo Rust/Tauri dentro da própria aplicação e exposto num endpoint semelhante a:

```text
http://127.0.0.1:<porta>/mcp
```

Esta opção é preferida ao STDIO porque:

- corresponde ao requisito de o servidor existir dentro do NoteX aberto;
- não exige um segundo executável ou sidecar;
- permite que vários clientes locais compatíveis usem o mesmo endpoint;
- mantém a configuração do cliente estável entre execuções;
- parar ou fechar o NoteX remove imediatamente o endpoint.

O STDIO não faz parte do MVP. Poderá ser acrescentado no futuro apenas como adaptador para clientes que não suportem Streamable HTTP.

### SDK e runtime

- Usar o SDK MCP oficial para Rust (`rmcp`) com suporte a servidor Streamable HTTP e a revisão MCP corrente adotada pelo contrato.
- Usar o runtime Tokio que já existe no Tauri.
- Adicionar apenas as features necessárias do SDK e do servidor HTTP; não introduzir Node.js dentro da aplicação desktop.
- Fixar uma versão estável do SDK que inclua as correções de validação de Host/DNS rebinding.
- Manter o servidor stateless sempre que a revisão MCP negociada o permitir.

Referências:

- [MCP Streamable HTTP e segurança de transporte](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)
- [SDK MCP oficial para Rust](https://github.com/modelcontextprotocol/rust-sdk)
- [Configuração de servidores MCP locais no Codex](https://developers.openai.com/codex/mcp/)

## UX fechada

### Secção MCP no Profile

Os controlos remotos atuais de `Register` e `Login` deixam de ser apresentados no caminho principal e são substituídos por controlos locais.

Estado parado:

- Estado visual `Offline`.
- Botão principal `Iniciar MCP`.
- Botão secundário `Configurar MCP`.

Estado a iniciar:

- Estado visual `A iniciar`.
- Botão principal desativado com indicador de progresso.
- `Configurar MCP` continua acessível.

Estado ativo:

- Estado visual `Online`.
- Botão principal `Parar MCP`.
- Botão secundário `Configurar MCP`.

Estado de erro:

- Estado visual `Erro` ou `Offline` com detalhe no Profile.
- Botão principal `Tentar novamente` ou `Iniciar MCP`.
- `Configurar MCP` continua acessível para alterar a porta ou copiar os dados.

A sidebar apresenta `Online` apenas quando o servidor está a escutar, o renderer está pronto e o dispatcher pode receber pedidos. Todos os restantes estados aparecem como `Offline`.

### Modal genérico `Configurar MCP`

O modal está sempre disponível. Não é um onboarding mostrado uma única vez.

O modal apresenta:

- **Nome do servidor:** `NoteX`.
- **Transporte:** `Streamable HTTP`.
- **URL MCP:** o endereço local completo e atual.
- **Porta:** valor persistente e editável quando o servidor está parado.
- **Autenticação:** `Nenhuma (servidor local)`.
- **Estado:** `Online` ou `Offline`.

Ações do modal:

- Ícone/botão para copiar apenas a URL MCP.
- Botão `Copiar configuração` para copiar um bloco neutro de texto.
- Botão para fechar.

Formato neutro copiado:

```text
Name: NoteX
Transport: Streamable HTTP
URL: http://127.0.0.1:<porta>/mcp
Authentication: None (local server)
```

Não serão incluídos:

- nomes ou logótipos de plataformas AI;
- botões `Connect to Codex` ou equivalentes;
- ficheiros de configuração específicos de uma plataforma;
- instruções que assumam um cliente específico.

Cada cliente AI é responsável pela forma como recebe estes valores. O NoteX fornece os dados MCP universais.

### Persistência das preferências

- A porta e uma futura preferência de arranque automático pertencem às settings locais da aplicação, não à SQLite de notas.
- O MVP inicia parado em cada abertura da aplicação, salvo decisão posterior explícita sobre auto-start.
- Alterar a porta com o servidor ativo exige parar e voltar a iniciar; não haverá troca silenciosa de endpoint.

## Segurança local

### Controlos obrigatórios

- Bind exclusivo a `127.0.0.1`; não usar `localhost` como endereço de bind nem aceitar interfaces externas.
- Allowlist estrita do header `Host` para `127.0.0.1:<porta>`.
- Validar `Origin` em todos os pedidos e rejeitar origens web não autorizadas.
- Não ativar CORS permissivo.
- Aceitar apenas os métodos, content types e limites previstos pelo transporte MCP.
- Limite de payload alinhado com o contrato atual.
- Timeout de 20 segundos e cancelamento imediato no stop/close.
- Rate limit local simples por processo para evitar loops acidentais de ferramentas.
- Ferramentas de escrita marcadas como não read-only; ferramentas de leitura marcadas como read-only.
- Nunca incluir payloads MCP ou conteúdo de notas em logs Rust, Tauri ou frontend.

### Política de autenticação local

O MVP local não exige login, conta ou token. A configuração universal fica limitada ao nome, transporte e URL.

- O servidor aceita pedidos apenas enquanto o utilizador o tiver iniciado explicitamente no NoteX.
- Qualquer processo local capaz de chegar à porta pode chamar as ferramentas enquanto o MCP estiver ativo.
- Bind exclusivo a `127.0.0.1`, validação estrita de Host/Origin e ausência de CORS são obrigatórios.
- Esta política privilegia compatibilidade e configuração rápida entre clientes MCP locais.
- O risco de outros processos locais é aceite para o MVP e deve ser indicado no threat model e nas notas de release.

Um bearer token local pode ser adicionado mais tarde sem introduzir contas ou cloud. Essa evolução terá de preservar um modo de configuração genérico e só será feita após existir uma necessidade concreta.

## Reutilização do trabalho atual

### Reutilizado sem alterações conceptuais

- Os 11 comandos e schemas Zod de `@notex/mcp-contract`.
- `dispatchMcpCommand` como fronteira de validação e execução.
- Pesquisa, leitura e serialização rich text da Fase 3.
- Parser rich text, conflitos por versão, coordenação de drafts e transação nota+blocos da Fase 4 atualmente não validada.
- `useNotesStore`, `useKnowledgeStore`, repository e comandos SQLite existentes.
- Eventos Tauri para transportar pedidos entre Rust e renderer.
- Semântica de timeout, erros tipados e ausência de replay.

### Refatoração necessária

- Separar o conceito de transporte MCP do atual `mcp_bridge.rs`, que está orientado ao backend remoto.
- Criar um broker local de pedidos em Rust para correlacionar cada chamada HTTP com a resposta assíncrona do renderer.
- Fazer o listener TypeScript receber pedidos de uma origem local ou remota e chamar sempre o mesmo dispatcher.
- Mover descrições, annotations e schemas JSON das ferramentas para um manifesto partilhado; atualmente parte destes metadados existe apenas em `backend/src/mcp.ts`.
- Criar um store de estado do servidor local separado do estado de autenticação remota.
- Alterar a UI para consumir o estado local sem apagar as ações e serviços remotos existentes.

## Manifesto partilhado de ferramentas

O Rust precisa de anunciar `tools/list` antes de enviar `tools/call` ao renderer. Para evitar uma segunda definição manual:

- `packages/notex-mcp-contract` continua a ser a fonte de verdade.
- O pacote passa a gerar um manifesto JSON com nome, descrição, input schema, scopes e annotations de cada ferramenta.
- O backend remoto e o servidor Rust consomem o mesmo manifesto.
- O build Rust inclui o manifesto gerado ou uma cópia versionada verificada em CI.
- Uma alteração de ferramenta falha CI se Zod, manifesto, backend e Rust divergirem.

## Componentes a criar ou alterar

### Novos

- `src-tauri/src/mcp_local_server.rs`: lifecycle e transporte Streamable HTTP.
- `src-tauri/src/mcp_request_broker.rs`: pedidos em curso, deadlines, cancelamento e routing de respostas.
- `src/core/services/mcpLocalServer.ts`: comandos Tauri e listener transport-neutral.
- `src/store/useLocalMcpStore.ts`: estado `stopped | starting | running | stopping | error`.
- `src/components/profile/McpConfigurationModal.tsx`: configuração genérica sempre acessível.
- Manifesto JSON gerado em `packages/notex-mcp-contract`.

### Alterados

- `src-tauri/src/lib.rs`: registar manager e comandos locais.
- `src/core/services/mcpBridge.ts`: extrair o host comum do dispatcher sem eliminar o bridge remoto.
- `src/components/profile/McpProfileSection.tsx`: apresentar o modo local como UI principal.
- Sidebar: refletir disponibilidade local.
- I18n PT/EN: novos estados, labels e modal genérico.
- `src-tauri/Cargo.toml`: SDK MCP oficial e features HTTP estritamente necessárias.

### Preservados

- `backend/` completo.
- OAuth, Google, WebSocket remoto e credential storage já implementados.
- `Documentation/MCP_IMPLEMENTATION_PLAN.md` como plano remoto futuro.
- Schema SQLite v3 e todos os dados existentes.

## Fases de implementação

### Fase Local 0 — Documentação e preservação

- Adotar este documento como plano ativo.
- Registar o pivot no checkpoint principal.
- Preservar as alterações não commitadas da Fase 4 antes de refatorar transportes.
- Não executar migrações, upgrades de packages ou trabalho no backend.

Critério de saída: direção local documentada e fronteiras local/remoto explícitas.

### Fase Local 1 — Contrato e broker transport-neutral

- Extrair descrições e annotations das ferramentas do backend para o contrato.
- Gerar o manifesto JSON consumível por Rust.
- Criar o broker de pedidos entre Rust e renderer.
- Adaptar o bridge remoto ao broker sem mudar o protocolo externo existente.
- Garantir IDs únicos, deadline, limite de pedidos simultâneos e cancelamento.

Critério de saída: um pedido sintético local chega ao dispatcher e regressa ao chamador sem tocar no backend.

### Fase Local 2 — Servidor MCP embutido

- Integrar o SDK MCP oficial Rust.
- Implementar `initialize`, `tools/list` e `tools/call` sobre Streamable HTTP.
- Implementar o endpoint local sem autenticação, aplicando todas as proteções obrigatórias de loopback, Host e Origin.
- Implementar bind, start, stop, estado, erro de porta e shutdown.
- Rejeitar pedidos enquanto stores/dispatcher não estiverem prontos.
- Falhar todos os pedidos em curso no stop/close, sem replay.

Critério de saída: um cliente MCP genérico descobre as 11 ferramentas no endpoint loopback.

### Fase Local 3 — Profile e configuração genérica

- Substituir visualmente Register/Login por `Iniciar MCP` e `Configurar MCP`.
- Implementar estados de lifecycle e `Parar MCP`.
- Criar o modal sempre acessível com os campos universais.
- Implementar cópia da URL e do bloco neutro de configuração.
- Permitir alterar a porta apenas com o servidor parado.
- Atualizar sidebar e traduções PT/EN.
- Manter o código remoto sem entrada principal na UI.

Critério de saída: o utilizador consegue iniciar, parar e obter os dados de ligação sem referência a uma plataforma específica.

### Fase Local 4 — Leitura e escrita ponta a ponta

- Encaminhar as seis ferramentas de leitura pelo endpoint local.
- Encaminhar as cinco ferramentas de escrita atualmente implementadas.
- Validar rich text, notas no lixo, tags/coleções desconhecidas, expectedVersion e drafts locais.
- Confirmar transação única em `create_note` com blocos.
- Confirmar que stop/close durante uma chamada não produz execução posterior.

Critério de saída: um cliente MCP genérico lê e altera uma cópia de uma base v3 apenas enquanto o NoteX está aberto e o MCP ativo.

### Fase Local 5 — Hardening e distribuição

- Validar Host, Origin, DNS rebinding, payloads e rate limits.
- Validar conflito de porta e múltiplas instâncias do NoteX.
- Definir política de approvals recomendada para ferramentas de escrita sem a codificar para uma plataforma específica.
- Adicionar CI frontend/Rust e testes do manifesto partilhado.
- Validar Windows primeiro; documentar diferenças antes de ativar macOS/Linux.
- Atualizar documentação de utilizador com valores MCP universais.

Critério de saída: build distribuível, sem backend obrigatório, interoperável com clientes locais compatíveis.

## Testes futuros e aceitação

Nenhum destes testes deve ser executado automaticamente sem autorização explícita durante a implementação atual.

- Start, stop, restart e fecho da aplicação.
- Porta ocupada e alteração de porta.
- Host/Origin inválidos e tentativa de acesso por interface externa.
- `initialize`, `tools/list` e os 11 `tools/call`.
- Timeout, cancelamento, dois clientes e stop durante escrita.
- Leitura ativa/lixo e rejeição de escrita no lixo.
- Conflitos de versão e rascunhos locais pendentes.
- Rich text seguro e remoção/rejeição de scripts, imagens e ficheiros.
- Snapshot da SQLite v3 antes/depois, sem mudança de schema.
- Modal em PT/EN, dark/light e viewports atuais.
- MCP Inspector como cliente neutro; clientes AI concretos entram apenas como validação de compatibilidade, sem código específico.

## Fora do MVP local

- Login Google, contas e OAuth remoto.
- Backend público, HTTPS, WSS e routing multiutilizador.
- Acesso por websites AI a `localhost`.
- Descoberta automática de todas as aplicações AI instaladas.
- Alteração automática de ficheiros de configuração de terceiros.
- STDIO sidecar.
- LAN, acesso entre dispositivos ou cloud sync.
- Auto-start do MCP sem decisão explícita.

## Decisões fechadas

- O modo local é a prioridade atual.
- O servidor corre dentro do NoteX/Tauri.
- O transporte do MVP é Streamable HTTP em loopback.
- O MVP local não usa login nem bearer token.
- A UI e a configuração são genéricas, não específicas para Codex.
- `Configurar MCP` está sempre disponível.
- O backend remoto e o trabalho de autenticação ficam preservados, mas fora do caminho atual.
- O dispatcher e stores existentes são a única command layer para dados locais.
- Não existe alteração ao schema SQLite.

## Decisões futuras não bloqueantes

- Reavaliar um bearer token local apenas se surgir uma necessidade concreta de isolamento adicional.
- Decidir separadamente se uma versão futura deve permitir auto-start do MCP.
