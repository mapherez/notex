# Plano de Implementação MCP para o NoteX

> **Estado:** plano remoto preservado para trabalho futuro. A prioridade atual é o servidor MCP local embutido definido em [`MCP_LOCAL_IMPLEMENTATION_PLAN.md`](./MCP_LOCAL_IMPLEMENTATION_PLAN.md). O diretório `backend/` e esta arquitetura não devem ser removidos.

## Resumo

- O primeiro artefacto será o **contrato partilhado** entre backend e NoteX. Depois cria-se uma versão mínima do backend com um simulador de NoteX, e só então se liga a aplicação real. Não se deve concluir um dos lados inteiro antes de validar o fluxo ponta a ponta.
- Fluxo final: `plataforma AI -> MCP HTTPS -> backend -> WebSocket autenticado -> NoteX aberto -> command layer -> stores atuais -> SQLite local`.
- A SQLite atual do NoteX permanece na versão 3, sem tabelas, colunas ou migrações novas.
- O backend terá uma SQLite própria apenas para contas Google, sessões, autorizações OAuth e clientes MCP.
- Conteúdo de notas pode atravessar backend e plataforma AI durante uma chamada, mas nunca será persistido, indexado ou incluído em logs pelo backend.

## Arquitetura Fechada

- Backend independente em `backend/`, com Node.js 24 LTS, TypeScript, Express, `better-sqlite3`, `ws`, Zod e Vitest/Supertest.
- Usar o SDK MCP TypeScript v2 oficial, Streamable HTTP stateless e compatibilidade com clientes da geração 2025 quando suportada pelo SDK. A versão corrente torna o protocolo stateless e privilegia CIMD sobre DCR. [MCP 2026-07-28](https://blog.modelcontextprotocol.io/posts/2026-07-28/), [autorização MCP](https://modelcontextprotocol.io/specification/draft/basic/authorization).
- Usar Better Auth com Google, OAuth Provider, Device Authorization, MCP e CIMD. Manter DCR para clientes antigos. Isto evita construir manualmente um Authorization Server moderno. [Better Auth MCP](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/plugins/mcp.mdx).
- Reaproveitar do `nox-sync` os padrões de Google OAuth, migrações SQLite, Docker, GHCR e workflows; não copiar a implementação Go, porque o novo backend necessita também de OAuth 2.1/CIMD para clientes MCP.
- Manter `backend/package-lock.json` separado do frontend. Um pacote leve `packages/notex-mcp-contract` fornece schemas Zod, tipos e versões do protocolo sem transformar o repositório num workspace que instale dependências nativas do backend no NoteX.
- O Rust/Tauri guarda o refresh token no Windows Credential Manager, controla HTTPS/WebSocket e comunica com o renderer por eventos Tauri. Tokens persistentes nunca ficam na SQLite do NoteX nem em `localStorage`.
- O renderer executa os comandos através dos stores existentes; Rust e backend nunca escrevem diretamente na SQLite das notas.

## Fases

### Fase 0: Contrato e Guardrails

- Definir mensagens `BridgeRequest`, `BridgeResponse`, `BridgeReady`, estado de presença, versão do protocolo e erros tipados.
- Fixar limites: frames validados, ticket WebSocket de uso único, timeout de 20 segundos, heartbeat e ausência total de replay ou fila.
- Documentar o threat model e a regra de não registar argumentos, resultados, títulos, IDs de notas ou emails.
- Antes de tocar no editor, consultar os audits históricos `99` no commit `617bf8a` e `16` no commit `8f86a62`; não misturar este trabalho com refatoração CSS, seletores, TOC ou redesign.

### Fase 1: Backend e Simulador

- Criar `/mcp`, metadata RFC 9728/RFC 8414, CIMD, DCR, autorização com PKCE S256, resource indicators, refresh token rotation e scopes `notex:read`, `notex:create` e `notex:edit`.
- Google usa apenas `openid email profile`; a identidade canónica é `issuer + sub`, com email verificado apenas como atributo visível.
- O registo de uma conta só é permitido por um device flow iniciado por `Register account` no NoteX. Login ou OAuth MCP nunca criam silenciosamente uma conta.
- Implementar a bridge WebSocket e um simulador de desktop para validar autenticação, routing, timeout, desconexão e o primeiro `notex_status`.
- Guardar presença e pedidos em curso apenas em memória. Reinício ou desconexão falha imediatamente todos os pedidos e nunca os volta a executar.
- Persistir em `/data/notex-mcp.sqlite` apenas utilizadores, sessões, grants, tokens, clientes OAuth, chaves e migrações.

### Fase 2: Autenticação e Ligação no NoteX

- `Register` e `Login` iniciam device authorization, abrem o browser do sistema e usam Google. `Register` de uma conta já existente funciona como login; `Login` de uma conta inexistente devolve instrução para registar.
- Depois de `App.tsx` terminar o bootstrap atual, Rust renova o token, obtém um ticket, abre WSS e só envia `ready` quando stores e dispatcher estiverem preparados.
- Uma nova autenticação desktop revoga imediatamente todas as anteriores, fecha a socket antiga e coloca a aplicação antiga em logged out.
- Logout revoga apenas a sessão desktop atual. As autorizações das plataformas permanecem, mas as ferramentas devolvem `User not logged in`.
- No Profile, adicionar a secção MCP como último elemento da coluna esquerda, usando a grelha existente: logged out mostra `Register` e `Login`; logged in mostra email, `Logout` e `EllipsisVertical`.
- O menu inclui `Revoke AI access` e `Delete MCP account`, ambos com modal de confirmação. Revogar não desliga o NoteX; apagar elimina apenas metadados remotos e nunca toca nas notas locais.
- Na sidebar, junto da versão, mostrar ponto verde + `Online` apenas após bridge pronta; todos os restantes estados mostram ponto vermelho + `Offline`. O Profile apresenta estados mais detalhados.

### Fase 3: Leitura Local

- Criar um dispatcher independente de transporte que invoque `useNotesStore.getState()` e `useKnowledgeStore.getState()`, reutilizando os stores e repository atuais.
- Extrair a pesquisa atual para uma função partilhada usada pela UI e MCP.
- Implementar leitura de notas ativas e do lixo. Notas no lixo são visíveis, mas marcadas como read-only.
- Entregar esta fase ponta a ponta antes das escritas: AI autentica, confirma estado, pesquisa e lê uma nota real sem qualquer alteração de schema.

### Fase 4: Escrita e Rich Text

- Extrair as configurações Tiptap inline/full para factories partilhadas, mantendo markup, classes, node views e comportamento visual.
- Converter `{ format: "text" | "html", value }` através do mesmo schema Tiptap usado pelo editor. Nunca expor JSON Tiptap no protocolo.
- Remover scripts, protocolos inseguros, imagens, ficheiros e nós não suportados dos inputs MCP; manter formatação suportada como headings, listas, tabelas, links, cores, highlights, quotes e code.
- Adicionar um coordenador por nota para identificar debounce, save em curso e rascunhos locais. Uma edição MCP sobre uma nota dirty devolve conflito.
- Todas as mutações existentes exigem `expectedVersion`; o campo `Note.version` atual é suficiente. Criar nota com blocos deve usar uma única transação local.
- Campos omitidos permanecem inalterados. Não adicionar delete, trash, restore, reorder, ficheiros, import/export, links ou criação de tags/coleções no MVP.

### Fase 5: Hardening e Release

- Adicionar rate limiting, validação de Host/Origin, proteção SSRF para CIMD, tokens audience-bound, revogação imediata e logs estruturados sem payload.
- Criar Docker multi-stage Debian slim, utilizador não-root, volume `/data`, porta 8080 e healthchecks. TLS e upgrade WebSocket ficam no reverse proxy.
- Publicar `ghcr.io/mapherez/notex-mcp` para `linux/amd64` e `linux/arm64`, seguindo os workflows do `nox-sync`.
- Adicionar CI separado para frontend/Rust, contrato, backend e Docker; atualizar workflows existentes de Node 20 para Node 24.
- O MVP suporta uma única instância de backend. Escala horizontal futura exige um router de presença partilhado e não faz parte desta implementação.

## Contratos MCP

- Leitura: `notex_status`, `search_notes`, `get_note`, `get_note_block`, `list_tags`, `list_collections`.
- Escrita: `create_note`, `update_note_header`, `add_note_block`, `update_note_block`, `set_note_tags`.
- `search_notes` aceita `active`, `trash` ou `all`, usando `active` por defeito.
- `get_note` devolve header, versão e resumo ordenado dos blocos; `get_note_block` devolve o conteúdo rico exato de um bloco.
- Tags e coleções são referenciadas por IDs obtidos nas ferramentas de listagem. IDs desconhecidos são rejeitados; nenhuma entidade organizacional é criada.
- Erros públicos: `USER_NOT_LOGGED_IN` → `User not logged in`; `NOTEX_OFFLINE` → `NoteX is offline`; além de `FORBIDDEN`, `NOT_FOUND`, `READ_ONLY_TRASH`, `CONFLICT`, `INVALID_INPUT`, `TIMEOUT` e `INTERNAL`.
- Várias plataformas AI podem estar autorizadas em simultâneo, mas todas encaminham para a única sessão desktop ativa daquela conta.

## Testes e Aceitação

- Abrir uma cópia de uma base v3 existente e confirmar mesmas tabelas, colunas, versão e conteúdo antes de qualquer ação MCP.
- Validar registo, login, reinício da app, logout, revogação, eliminação de conta e substituição imediata da sessão desktop anterior.
- Confirmar que app fechada, backend reiniciado ou socket interrompida falham sem replay quando o NoteX regressa.
- Testar OAuth com PKCE, CIMD e DCR, scopes, audience/resource, refresh, revogação e tentativa de criar conta através do cliente AI.
- Testar leitura ativa/lixo e rejeição de todas as mutações no lixo.
- Testar conflitos por versão, rascunho local, dois clientes AI e desconexão durante uma escrita.
- Criar fixtures rich text de browser/Word e confirmar preservação de formatação suportada e remoção de scripts/ficheiros.
- Validar Profile/sidebar em PT/EN, dark/light e viewports atuais; executar `npm run typecheck`, `npm run check:styles`, `npm run build`, testes Rust/backend e testes de integração MCP.
- Critério de compatibilidade: cliente MCP oficial/Inspector consegue descobrir, autenticar e executar todo o fluxo. Não haverá código específico para ChatGPT, Claude ou Grok; cada plataforma apenas precisa de aceitar um URL MCP remoto customizado.

## Defaults Fixados

- URL oficial do backend embutido na build de produção; override apenas em builds de desenvolvimento.
- Sessões desktop e autorizações AI persistem até logout, revogação, eliminação ou deteção de token comprometido.
- Backend não guarda notas, índices, filas, ações pendentes ou histórico de ferramentas.
- Conteúdo solicitado pode transitar temporariamente pelo backend e pela plataforma AI, conforme aceite.
- Uma futura LLM local chamará diretamente o mesmo dispatcher, sem Google, OAuth remoto ou backend.
