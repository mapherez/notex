# NoteX — Google Drive e Web: CHECKPOINT

Última atualização: 2026-09-17.

**Funcionalidades principais implementadas e validadas pelo utilizador. Preparação da release 2.3.0 e deployment público ainda em curso; manter este ficheiro até concluir esses passos.**
Plano de referência: `GOOGLE_DRIVE_WEB_IMPLEMENTATION_PLAN.md`.

## Estado atual

- Migração SQLite 3 → 4 explícita, snapshot consistente, verificação de integridade e rollback implementados. Nunca apagar tabelas por diferença de versão.
- Bibliotecas desktop por conta, adoção da biblioteca local com anexos, snapshots, conflitos e proteção contra operações de outra conta implementadas.
- IndexedDB por conta com notas, anexos e fila persistente implementado; desktop mantém SQLite.
- OAuth desktop (PKCE, navegador externo, callback local, Windows Credential Manager) e web (Google Identity Services) integrados e confirmados com Google real pelo utilizador.
- Profile, modal de login obrigatório na web, logout com preservação dos dados e troca de conta integrados.
- Formato JSON partilhado, catálogo global e cliente Drive appDataFolder implementados.
- Motor ligado à aplicação: backups agrupados, versões, conflitos, eliminações, exclusões, download progressivo e prioridades por nota/collection/tag.
- Banner expansível e aviso de fecho desktop implementados. Web sem popup nativo de saída.
- Anexos desktop → web e cache offline da aplicação confirmados pelo utilizador, incluindo refresh offline, edição, reconexão, backup e atualização no desktop.
- Imports desktop de SQLite e .notex interrompem as transferências durante a substituição; DB importada passa pela migração e reinicialização do estado cloud.

## Correções na última retoma

- Compilação TypeScript e Rust confirmou as alterações deixadas na interrupção anterior.
- Falhas transitórias de rede/limites Drive têm nova tentativa automática com atraso crescente. Falhas de autorização não repetem pedidos automaticamente.
- Catálogo local é carregado e apresentado antes da tentativa de acesso à Drive, incluindo quando offline.
- Otimização de notas inalteradas já não ignora conflitos pendentes ou escolhas do utilizador.
- Exclusões são consultadas antes de iniciar cada upload; uma nota já em transferência não é cancelada imediatamente ao ser excluída.
- Organização distingue primeira conciliação de reaberturas posteriores, evitando voltar a unir indiscriminadamente tags/collections em cada arranque.
- Catálogo apresentado mantém uma cópia separada das alterações de upload ainda por publicar.
- Downloads guardam anexos completos em staging persistente; na retoma, verificam tamanho/hash antes de reutilizar.
- Uploads guardam pasta, anexos e JSONs completos em staging persistente, permitindo reutilização após falha antes da publicação do catálogo.
- Limpeza de versões antigas/staging substituído passa por fila persistente. Revalida referências do catálogo e conserva pastas com anexos ainda utilizados. Tipagem confirmada após esta alteração; falta validar o comportamento real com Drive.

## Validação efetivamente executada

- Última retoma: `npm.cmd exec -- tsc -b` passou; `cargo check --offline --manifest-path src-tauri/Cargo.toml --lib` passou.
- Após correções de transferências: `npm.cmd run build` passou, incluindo geração do service worker. Warnings de anotações zod e imports estáticos/dinâmicos não bloquearam o build.
- Três testes focados de recuperação passaram: retry transitório com atraso, ausência de repetição automática de autorização e apresentação de catálogo em cache antes da rede.
- Histórico anterior: 36 testes TypeScript e 24 testes Rust passaram antes da integração mais recente. Não equivalem a validação integral do estado atual.
- Validação real posterior pelo utilizador: login Google, alterações de notas nos dois sentidos, refresh com sessão mantida, logout/login, separação de contas, anexos desktop → web, refresh/edição offline e backup após reconexão recebido pelo desktop. Abrir sem editar não dispara backup nem updatedAt.
- As secções cronológicas abaixo preservam o estado de cada etapa; referências antigas a configuração/login/offline pendentes estão ultrapassadas pelos testes posteriores.

## Trabalho restante

1. Confirmar secrets do workflow e estado público/Branding/Data Access do projeto OAuth na Google. Não foi inspecionada configuração remota.
2. Gerar instalador 2.3.0 no GitHub e confirmar atualização da app instalada, migração e preservação de notas/anexos antes da publicação pública.
3. Definir o encaminhamento público apenas de /app/ para a imagem da webapp, mantendo landing/docs no deployment independente. Ajustar GOOGLE_WEB_ORIGIN/origem OAuth para https://notex.mapherez.com, reconstruir a imagem e validar no URL HTTPS final. Encaminhamento ainda pendente.
4. Publicar documentação atualizada junto da release. Guias, configuração, deployment e privacidade atualizados nesta etapa; apagar este CHECKPOINT quando o restante estiver concluído.

Limites da validação real: limpeza diária, interrupções de uploads grandes,
conflitos e imports foram verificados em casos focados/simulações, sem percurso
real completo confirmado pelo utilizador. Anexos web → desktop ainda sem
confirmação explícita. Não equivalem a funcionalidades por implementar.
Tablet/mobile e MCP hosted ficam para fases posteriores.

## Configuração externa

Configuração migrada para `VITE_GOOGLE_WEB_CLIENT_ID`, `VITE_GOOGLE_DESKTOP_CLIENT_ID`
e `VITE_GOOGLE_WEB_ORIGIN`. `.env.local` na raiz foi criado vazio e está ignorado
pelo Git; `.env.example` é o modelo versionado. O JSON anterior foi removido.
Os comandos npm Tauri carregam o env antes de iniciar o CLI e passam os valores
ao Rust e ao frontend. O workflow de release recebe os valores dos repository
secrets `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_DESKTOP_CLIENT_ID`,
`GOOGLE_DESKTOP_CLIENT_SECRET` e `GOOGLE_WEB_ORIGIN` (sem VITE_ nos nomes dos secrets).
Configuração local e OAuth/Drive reais validados pelo utilizador.
Verificação desta alteração: TypeScript (`tsc -b`), Rust (`cargo check --offline
--lib`) e execução do wrapper Tauri com `dev --help` passaram. `git check-ignore`
confirmou que `.env.local` não entra no repo.
Instruções: `GOOGLE_DRIVE_SETUP.md` e `GOOGLE_DRIVE_WEB_DEPLOYMENT.md`.
Não publicar nem alterar configuração externa sem autorização.

## Preferência de execução

Concentrar esforço em implementação concreta. Limitar verificações a compilação e casos essenciais de integridade/recuperação, sem repetir suites amplas desnecessariamente.

## Bloco 1 — consistência dos backups (concluído)

Âmbito limitado à publicação/confirmação e alterações durante upload; não iniciou os blocos seguintes.

- Antes de enviar metadata.json, persiste revisão pretendida e tokens exatos dos pendentes incluídos.
- Depois da publicação, guarda catálogo confirmado/baselines e confirma apenas os tokens enviados. Tanto SQLite como IndexedDB usam confirmação condicional, preservando alterações mais recentes.
- Na retoma, compara o registo de publicação com o catálogo real. Uma resposta perdida ou falha de escrita local permite repetir a confirmação, sem reenviar notas já publicadas. Se a revisão não coincidir, mantém os pendentes para conciliação normal.
- O registo só é limpo após concluir as confirmações; falhas parciais são repetíveis.
- Contagem de uploads concluídos avança após publicação/confirmação, não durante preparação de ficheiros.
- Organização só é confirmada quando efetivamente incluída no catálogo publicado.
- Verificação focada: seis testes do motor passaram (três anteriores e três novos: resposta perdida após commit remoto, edição durante upload e falha local de confirmação). Usa IndexedDB de teste e Drive simulada, sem acesso a dados reais.
- `npm.cmd exec -- tsc -b` passou após as alterações.

Bloco 2 autorizado e concluído abaixo.

## Bloco 2 — uploads grandes persistentes (concluído)

- Cliente Drive recebe o armazenamento da conta (SQLite/IndexedDB) para persistir a sessão antes de enviar conteúdo.
- Sessão identificada por pasta, nome, tamanho, MIME e hash do conteúdo; não mistura ficheiros diferentes. Reutiliza o hash já calculado pelo motor.
- Após reabrir, consulta bytes confirmados pela Drive e envia só o restante; não confia num offset local que possa estar desatualizado.
- Recupera upload já concluído e guarda o ID para sobreviver a uma interrupção antes do registo do anexo no motor.
- Sessões expiradas são substituídas; valida a origem/path do URL antes de enviar credenciais.
- Quatro testes focados com IndexedDB fechado/reaberto e HTTP simulado: retoma parcial, conclusão remota, expiração e conteúdo diferente. Os seis testes do motor também passaram. Compilação TypeScript passou.
- Não usa Google real nem altera configuração externa. Sessão expirada exige reenviar o ficheiro; a retoma parcial depende de a Drive conservar a sessão.
- Referência: <https://developers.google.com/workspace/drive/api/guides/manage-uploads>

Bloco 3 autorizado e concluído abaixo.

## Bloco 3 — ficheiros abandonados (concluído)

- Novas pastas de backup são marcadas na criação com appProperties (notexBackup e noteId). A marca existe na Drive mesmo quando se perde a resposta à criação.
- Varrimento paginado do appDataFolder descobre essas árvores e os descendentes, incluindo ficheiros cujo ID não chegou a ser registado pela app.
- Consulta catálogo atual após listar; preserva referências e todos os seus antecessores, incluindo anexos partilhados entre versões.
- Preserva a árvore de uploads locais ainda recuperáveis, ficheiros com menos de 24 horas e ficheiros sem data válida. Elimina filhos antes de pastas.
- Corre no máximo uma vez por dia após sucesso, também em bibliotecas inalteradas. Falhas não bloqueiam backups e não marcam a limpeza como concluída.
- Limpeza limitada a árvores marcadas pelo NoteX. Órfãos anteriores sem identificação não são apagados por heurística; versões antigas conhecidas continuam cobertas pela fila existente. Sessões de upload expiradas são geridas pelo bloco 2; não há varrimento de caches locais neste bloco.
- Compilação TypeScript passou; 14 testes cloud passaram, incluindo quatro casos novos de seleção segura e retoma da limpeza, com Drive simulada.
- Referência: <https://developers.google.com/workspace/drive/api/guides/properties>

Bloco 4 autorizado e concluído abaixo.

## Bloco 4 — fluxos desktop (concluído em código)

- Imports SQLite/.notex e transições de conta usam exclusão mútua: não substituem a biblioteca enquanto login/logout/mudança de conta detém a operação.
- Imports param cloud/MCP, aguardam gravações locais e chamadas nativas, fixam o ID da biblioteca na substituição e recarregam settings/organização/notas antes de retomar serviços.
- Falha no import restaura acesso à biblioteca e serviços; a exclusão mútua é libertada em finally.
- Cancelar o login invalida respostas tardias, impedindo ativação involuntária de uma conta. A fase de transferência/ativação já iniciada não pode ser cancelada pelo modal.
- Falhas de logout/ativação mantêm a conta anterior e repõem cloud/MCP. Trocas concluídas deixam MCP parado, evitando transferir implicitamente uma ligação externa para outra biblioteca.
- Conflitos mantêm a conta candidata verificada para repetir a ativação com a escolha, sem novo popup Google.
- Validação: compilação TypeScript passou; sete testes focados TS passaram (imports, proteção de chamadas, cancelamento tardio, logout falhado e resolução de conflito); três testes Rust de adoção passaram (IDs/anexos, falhas preservam bibliotecas, versão mais recente protegida).
- Não foram usados dados reais nem login Google real; validação visual e OAuth real continuam pendentes. Nenhuma configuração Google/deployment alterada.

Bloco 5 autorizado e concluído abaixo.

## Bloco 5 — web e interface (concluído em código)

- Priorização de notas/collections/tags já não contorna a pausa. A abertura explícita de uma nota descarrega só essa nota, sem retomar a biblioteca inteira.
- Estado em cache calcula notas por descarregar antes de contactar a Drive; o banner compacto mostra downloads em pausa/pendentes em vez de indicar falsamente biblioteca atualizada.
- Pesquisa mostra indicação de conteúdo parcial junto dos resultados enquanto existem notas apenas na cloud, incluindo quando offline ou com downloads pausados.
- Nota ainda indisponível deixa de mostrar carregamento indefinido em caso de erro: apresenta explicação, voltar e tentar novamente.
- Perfil web lembrado inválido retorna ao login sem abrir biblioteca convidada. Logout remove a conta lembrada e mantém o próximo arranque atrás do login.
- Service worker serve HTML da mesma versão que os assets em cache; atualização segue o ciclo normal do worker, sem forçar substituição de tabs abertas. Não adiciona beforeunload nem popups de saída.
- Verificações focadas: dez testes passaram (arranque web e motor, incluindo pausa/prioridade/download explícito). Build de produção passou com geração do worker; sem login Google real nem inspeção visual nesta etapa.
- Referência offline: <https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers>
- Ferramenta externa modern-web-guidance recusada pela revisão automática por risco de supply chain; usada documentação oficial como alternativa, sem executar o pacote.

## Correção durante o primeiro teste OAuth desktop — 2026-09-17

- Botão Google do Profile inicia diretamente a autorização desktop num clique; o modal mostra o progresso e permite cancelar/repetir em caso de erro.
- Windows abre URLs através de ShellExecuteW no browser predefinido, substituindo a chamada ao Explorer que abria uma pasta com o URL OAuth.
- Compilações TypeScript/Rust passaram e os três testes existentes de transições de conta passaram, incluindo início direto e cancelamento da resposta tardia.
- A conclusão do login Google e o acesso real à Drive continuam por confirmar no teste do utilizador.

## Segundo teste OAuth desktop — diagnóstico e página de regresso

- Página de callback acompanha o estilo NoteX, com logótipo e texto apenas em inglês. Distingue autorização recebida, cancelamento e pedido inválido; não confirma prematuramente a ligação da conta.
- Suporte a GOOGLE_DESKTOP_CLIENT_SECRET apenas no Rust, carregado pelo wrapper de env e configurável no workflow de release. Usado na troca e renovação de tokens quando preenchido.
- Erros OAuth têm mensagens específicas e código visível; falhas de troca de tokens registam apenas HTTP/código estável, sem respostas brutas, códigos de autorização ou tokens.
- A causa exata da mensagem genérica do teste anterior continua por confirmar com os novos diagnósticos; login real e Drive continuam pendentes.
- Validação: TypeScript e Rust compilaram; três testes focados OAuth passaram (PKCE, callback/HTML inglês e classificação segura de erros). Sem login real ou alterações a notas.

## Botões de conta no Profile

- Utilizador confirmou a página de regresso no browser; ajustado o botão de login à referência oficial Google (fundo claro e logótipo oficial a cores, guardado localmente).
- Profile mostra apenas Sign out após login; removida a ação Choose another account. O botão Google também é reutilizado no modal para manter consistência.
- Ações têm espaçamento, estados hover/focus/disabled e estilos próprios, sem alterar os fluxos de login/logout.
- TypeScript e compilação SCSS passaram; verificação de estilos dos dois ficheiros alterados passou após formatação de blocos existentes.

Restante: validação real desktop/web/Drive, inspeção visual/offline em browser real, correções daí resultantes e documentação final.

## Incidente de compatibilidade entre desenvolvimento e app instalada — 2026-09-17

- tauri:dev estava a partilhar com a app instalada o identificador/pasta de dados. A migração 3→4 e a adoção da biblioteca pela conta deixaram a base principal vazia em schema 4, que a release instalada em schema 3 recusava abrir.
- Verificação em cópias: biblioteca da conta e backups continham 8 notas, 23 blocos, 2 tags e 4 collections, com integridade válida. O conteúdo atual corresponde ao backup schema 3; apenas lastOpenedAt de uma nota diferia.
- Pasta de dados completa copiada para recuperação fora do repo. Reposta a base schema 3 validada na pasta principal, preservando a biblioteca da conta, backups e restantes ficheiros. Nenhuma app foi aberta durante a recuperação.
- tauri:dev passa a carregar configuração com identificador com.mapherez.notex.dev. Proteção Rust impede builds debug com identificador de produção de abrir/migrar o armazenamento.
- Utilizador confirmou a abertura da app instalada com as notas recuperadas e o download progressivo, nota a nota, no tauri:dev isolado. O isolamento não separa a Drive real da conta Google usada para testes.
- Verificação da proteção: compilação Rust e dois testes de library_context passaram, incluindo recusa do identificador de produção em debug; wrapper dev verificado em modo help sem iniciar a app.

## Banner de backup e empilhamento de avisos

- Banner Drive desaparece quando não há trabalho, erros ou conflitos. Verificações periódicas silenciosas não fazem o banner reaparecer; conclusão de transferências mostra uma confirmação temporária pelo sistema de toasts.
- Estado Drive e backup manual ficam acessíveis no cartão da conta do Profile. Ações de backup/transferência têm estilos hover/focus/disabled próprios.
- Atualizações, transferências e toasts partilham uma coluna fixa no canto inferior direito; altura e espaçamento seguem o conteúdo, incluindo quando os detalhes do backup são expandidos.
- TypeScript, stylelint dos ficheiros alterados e compilação SCSS passaram. Sem alterações ao motor de backup, temporizações ou dados locais.

## Layout modular do Profile

- Módulos são filhos diretos de uma CSS Grid com posicionamento automático e alturas naturais; classes genéricas profile-module--wide/full definem apenas a largura ocupada, sem números de linha fixos.
- Primeira linha desktop: conta, Preferences com shortcuts, Backups & transfers com export/import e Drive. Segunda: MCP e Database Management em duas colunas. Statistics ocupa a linha inteira.
- Adicionado indicador Tags com a mesma contagem, ícone e cor da homepage. Breakpoints existentes adaptam a grid a duas/uma coluna.
- Compilação TypeScript, stylelint dos ficheiros alterados e compilação SCSS passaram. Sem iniciar a app ou alterar armazenamento.
- Ajustes visuais seguintes: títulos do banner/conflitos convertidos para texto simples; avatar maior e conteúdo da conta centrado; botão Google numa linha com largura natural; caminhos completos em várias linhas e conteúdo da gestão de DB equilibrado verticalmente. TypeScript e estilos passaram.

## Testes reais web/desktop e autorização após refresh — 2026-09-17

- Utilizador confirmou alterações e backups automáticos nos dois sentidos (desktop → web e web → desktop), preservação da edição web após refresh, atualização após logout/login e ausência de backups/updates ao abrir notas sem editar.
- Autorização web guardada em sessionStorage para sobreviver a refreshes na mesma tab, com validade original e margem de 60 segundos. Não prolonga nem renova automaticamente tokens Google. Logout/cancelamento remove a autorização guardada; notas locais permanecem.
- Restauração verifica conta, client ID e validade; dados inválidos/expirados são descartados. Se sessionStorage estiver indisponível, login continua a funcionar com o token em memória.
- Enquanto GOOGLE_REAUTHORIZE estiver ativo, banner omite Back up now, aviso Keep NoteX open, título/progresso de transferência e pausa/retoma. Profile oferece reautorização em vez de backup manual nesse estado.
- Validação focada: TypeScript compilou e sete testes passaram (autorização após recarregamento, isolamento por conta, logout, validade/client ID/formato e arranque web). Sem staging/commits ou alterações a bases reais.
- Ainda pendentes: teste real desta persistência após refresh/logout, utilização offline e anexos caso não tenham sido testados; documentação final e conclusão do checkpoint.
- Indicador/link MCP Online/Offline do rodapé da sidebar reservado ao desktop; não aparece na web enquanto a integração MCP para o host não estiver implementada. Versão e links legais continuam visíveis.
- Favicon da web reutiliza o icon.ico oficial da app em public/favicon.ico, referenciado pelo index.html e incluído automaticamente nos assets públicos/cache offline do build.
- Utilizador confirmou autorização mantida após refresh, anexos desktop → web e isolamento entre contas, incluindo atualização da biblioteca ao regressar à conta original. Offline continua pendente; anexos web → desktop ainda sem confirmação explícita.
- Nomes longos dos anexos no painel Files limitados com reticências; ícone e ações mantêm o espaço disponível. Nome completo acessível no tooltip nativo. Correção partilhada pelo desktop e web.
- Teste offline confirmado pelo utilizador: edição de nota sem internet preservada e backup automático realizado quando a ligação regressou. Este resultado valida edição/reconexão; não confirma arranque ou refresh da webapp sem internet.
- Teste seguinte confirmou refresh da webapp sem internet, continuação da edição offline, backup após reconexão e receção da alteração no desktop. Refresh offline e ciclo de sincronização completo confirmados pelo utilizador.
- Preparação 2.3.0: documentação consolidada com estado real dos testes, guia público Google Drive/web, privacidade atualizada, nomes de secrets explícitos e instruções de deployment. Build/instalador serão gerados no GitHub pelo utilizador; publicação OAuth e deployment ainda não executados.
- Verificação documental: build da landing gerou 15 artigos; check validou 18 páginas, links, assets, âncoras e índice de pesquisa. Compilação TypeScript passou com privacidade/termos PT/EN atualizados. Sem staging/commits, publicação ou alterações aos valores OAuth.

## Imagem Docker web e compose — 2026-09-17

- Workflow manual Publish NoteX Web Image compila com os Secrets web, verifica Nginx/rotas/service worker e publica latest, versão e SHA no GHCR para AMD64/ARM64. Não passa o secret desktop.
- Dockerfile em duas etapas, contexto web próprio sem env/dados locais, runtime Nginx na porta 8080, healthcheck e política de cache/fallback da SPA. Contexto Docker MCP permanece inalterado.
- Compose independente, copiável para o host como docker-compose.yml, imagem ghcr.io/mapherez/notex-web:latest, porta 8093 e sem necessidade de volumes/env. Tag/porta podem ser ajustadas por env opcional.
- Configuração inicial usou app.notex.mapherez.com; substituída pelo deployment no mesmo domínio com /app/, descrito abaixo.
- Docker local tem CLI mas daemon não está ativo; não foi construída/executada imagem localmente nem publicado no GHCR. Execução real do workflow/container permanece pendente.
- Verificação focada: build de produção npm run build passou, incluindo service worker; docker compose config --quiet passou. Warnings existentes de anotações zod/imports MCP não bloquearam o build. Sem alterações ao contexto MCP, dados locais, staging ou commits.

## Correção do check de estilos do PR

- Removidas props size dos ícones Drive/backup/logout no Profile; dimensões e flex-shrink definidos no SCSS.
- Verificador distingue dimensões numéricas JSX com chavetas de variáveis numéricas comuns, evitando o falso positivo em const size no teste de upload Drive.
- npm run check:styles passou integralmente (stylelint e lint:no-inline-styles); git diff --check passou. Alterações no branch web_mode, sem staging ou commits.

## Correção Nginx no primeiro publish web

- Build da imagem chegou à verificação Nginx no GitHub, onde a regex de assets com {8,} sem aspas causou erro de parsing. Expressão colocada entre aspas, preservando a regra de cache.
- Correção no main após merge do PR; sem staging/commits. A validação real nginx -t e publicação precisam de uma nova execução do workflow com o commit corrigido. Docker local permanece sem validação de runtime nesta etapa.

## Deployment no domínio original com /app/ — 2026-09-17

- Landing e documentação preservam notex.mapherez.com e /docs/ e o workflow independente de Pages. A inclusão da landing na imagem, feita sem pedido do utilizador, foi retirada. A imagem contém apenas dist/ em /app/, com o mesmo compose e porta 8093.
- Base Vite configurável por NOTEX_WEB_BASE_PATH, definido como /app/ apenas no build da imagem. Router, favicon, logos, botão Google e thumbnails respeitam o base; desktop/dev mantêm / por defeito. Dados e formatos de armazenamento não foram alterados.
- Service worker registado em /app/sw.js, limitado a /app/; ignora pedidos fora desse âmbito, incluindo navegação para a landing. Nginx serve apenas a app, devolve 404 fora dela e redireciona /app para /app/ sem alterar o protocolo do proxy.
- Check da imagem atualizado para verificar isolamento da app, redirect, rotas /app/, worker e assets. Não foi aberto/executado Docker localmente nesta alteração. Alterações ao conteúdo/layout da landing nesta etapa foram retiradas.
- Build de produção da app com base /app/ passou, incluindo TypeScript e geração do worker. Build da landing gerou 15 artigos. Validação do runtime Nginx/container fica no workflow do GitHub; URL público ainda por validar.
- Próximo passo: definir o encaminhamento público por caminho antes do deployment em /app/. Não encaminhar o domínio inteiro para o container. GOOGLE_WEB_ORIGIN e Authorized JavaScript origins = https://notex.mapherez.com; publicação da imagem e validação pública continuam pendentes.
