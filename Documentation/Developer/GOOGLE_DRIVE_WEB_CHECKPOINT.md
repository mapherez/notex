# CHECKPOINT — Google Drive e versão web do NoteX

## Objetivo e regras de continuidade

- Plano completo: [GOOGLE_DRIVE_WEB_IMPLEMENTATION_PLAN.md](GOOGLE_DRIVE_WEB_IMPLEMENTATION_PLAN.md).
- Este ficheiro regista progresso real, validações, decisões e próximos passos. Atualizar após cada etapa implementada e antes de interromper o trabalho.
- Não marcar uma etapa como concluída apenas por estar planeada ou parcialmente implementada.
- Apagar este CHECKPOINT apenas quando toda a implementação desta fase e as respetivas validações estiverem concluídas. Manter o plano.
- O utilizador autorizou guardar estes documentos; isso não autoriza começar a implementação. Antes de implementar, comunicar o trabalho proposto e obter autorização.
- Preservar alterações existentes no workspace e não publicar releases nem alterar configuração Google sem autorização.

## Estado atual

**Plano guardado; implementação global ainda não iniciada.**

Trabalho prévio realizado nesta conversa, anterior à criação do plano:

- Ordenação e datas das notas recentes ajustadas para `updatedAt`, mantendo o limite de apresentação e o campo `lastOpenedAt`.
- Proteção imediata do schema SQLite: removido o reset destrutivo; inicialização de DB vazia numa transação; rejeição de schemas incompatíveis ou sem versão sem alterar os dados.
- Esta proteção **não implementa ainda migrações automáticas entre versões**.

Validações anteriormente executadas na conversa:

- `npm.cmd run typecheck`: passou após a alteração de recentes.
- `cargo test --lib sqlite_storage::tests`: 6 testes passaram após a proteção do schema.
- `git diff --check`: passou nas verificações dessas alterações.
- Não foi realizada validação visual de recentes nem validação real de Google Drive, IndexedDB ou transferências.
- Estes resultados são históricos, não testes novamente executados ao guardar os documentos. Reavaliar o estado do código ao retomar.

Estado observado antes de criar os documentos: alterações staged em `src-tauri/src/sqlite_storage.rs` e `src/content/patch-notes.md`. Não foram modificadas nesta etapa de documentação.

## Decisões fechadas

- SQLite no desktop; IndexedDB na web; JSON e anexos na `appDataFolder` da Drive. Sem SQLite WASM na web.
- Um `metadata.json` global para a listagem; conteúdo por nota baseado no `.notex-note` existente, sem ZIP na Drive.
- Login desktop opcional na Profile; web exige conta e apresenta modal NoteX quando não há sessão. Escolha de conta no fluxo oficial Google.
- Sem backend próprio de sessões e sem exclusão de dispositivos. Biblioteca isolada por conta, identificada pelo ID Google.
- Desktop: raiz para utilização sem login; pasta por email para cada conta. Notas da raiz são incorporadas na próxima conta utilizada, com transferência recuperável.
- Logout preserva dados. Desktop volta à biblioteca sem conta; web volta ao modal e não permite criar notas sem login.
- Web pode reabrir offline numa conta previamente ligada, desde que não tenha ocorrido logout explícito.
- Primeiro login combina bibliotecas automaticamente. Maior versão vence; empate de versão com conteúdo diferente pede escolha.
- Eliminações acompanham a Drive; marcadores impedem ressurreição de notas. Sem ação separada obrigatória para apagar da Drive.
- Todas as notas têm backup por defeito; apenas o último backup é recuperável. Sem histórico de versões na interface.
- Backup agrupado: 30 segundos de pausa ou 2 minutos de pendência durante edição contínua; uma entrada por nota e botão manual.
- Abrir notas e guardar conteúdo inalterado não gera backup. Organização acompanha a conta; preferências visuais e configurações do sistema ficam locais.
- Download de toda a biblioteca por defeito, progressivo e sequencial, com prioridades e pausa/retoma.
- Pesquisa em metadados globais e conteúdo já disponível, indicando quando ainda está incompleta.
- Banner recolhível; aviso de fecho no desktop com pendentes e conta ligada; sem popup de saída na web.
- Import/export manual permanece no desktop. Web transfere dados apenas de/para Drive.
- Desktop Windows e web em ecrãs desktop primeiro. Tablet e mobile ficam para trabalho posterior.

## Etapas e progresso

- [ ] **1. Segurança e bibliotecas:** migrações sequenciais, backup prévio, gravações sem alterações, bibliotecas por conta e resolução da biblioteca ativa em todos os serviços.
- [ ] **2. Contratos comuns:** armazenamento, ficheiros, formato de backup, validação e preservação de identidade/relações.
- [ ] **3. Desktop e Drive:** OAuth, credenciais seguras, catálogo, publicação segura, filas, versões e eliminações.
- [ ] **4. Web:** IndexedDB, isolamento de contas, login, abertura offline, downloads progressivos e pesquisa parcial.
- [ ] **5. Interface e validação:** Profile, banner, fecho desktop, testes de falha/compatibilidade, performance e preparação de release.

Tablet e mobile não são requisitos para concluir este CHECKPOINT; pertencem à fase posterior descrita no plano.

## Próximo passo

Após autorização para implementar, rever o diff existente e o armazenamento atual, depois iniciar a etapa 1. Não aumentar a versão do schema sem fornecer e testar a respetiva migração na mesma alteração.

## Configuração externa pendente

- Identificar/configurar o projeto Google e os clientes OAuth desktop/web no mesmo projeto.
- Definir a origem HTTPS da web e as origens autorizadas na configuração Google.
- Obter autorização antes de alterar configuração externa ou publicar. A falta desta configuração não impede implementar e testar as camadas locais com simulações.

## Registo de execução

### Preparação documental

- Guardado o plano completo acordado, sem iniciar a implementação.
- Criado este CHECKPOINT com decisões, trabalho prévio e etapas pendentes.
- Em cada atualização futura, registar alterações concretas, comandos/resultados de validação, limitações e o ponto exato de retoma.
