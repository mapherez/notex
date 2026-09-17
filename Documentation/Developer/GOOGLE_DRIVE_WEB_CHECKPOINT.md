# NoteX — Google Drive e Web: CHECKPOINT

Última atualização: 2026-09-17.

**Implementação em curso. Não apagar este ficheiro nem considerar a integração pronta para release.**
Plano de referência: `GOOGLE_DRIVE_WEB_IMPLEMENTATION_PLAN.md`.

## Estado atual

- Migração SQLite 3 → 4 explícita, snapshot consistente, verificação de integridade e rollback implementados. Nunca apagar tabelas por diferença de versão.
- Bibliotecas desktop por conta, adoção da biblioteca local com anexos, snapshots, conflitos e proteção contra operações de outra conta implementadas.
- IndexedDB por conta com notas, anexos e fila persistente implementado; desktop mantém SQLite.
- OAuth desktop (PKCE, navegador externo, callback local, Windows Credential Manager) e web (Google Identity Services) integrados. Falta configurar e validar com Google real.
- Profile, modal de login obrigatório na web, logout com preservação dos dados e troca de conta integrados.
- Formato JSON partilhado, catálogo global e cliente Drive appDataFolder implementados.
- Motor ligado à aplicação: backups agrupados, versões, conflitos, eliminações, exclusões, download progressivo e prioridades por nota/collection/tag.
- Banner expansível e aviso de fecho desktop implementados. Web sem popup nativo de saída.
- Anexos web e cache offline da aplicação implementados; validação completa no browser pendente.
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
- Nenhum login Google real, transferência real na Drive ou percurso completo desktop/web foi validado. Nenhuma DB real de utilizador foi migrada através da app durante esta retoma.

## Trabalho restante

1. Bloco 1 concluído em código: publicação com registo persistente, recuperação da confirmação local e preservação de edições durante upload. Casos focados passaram; confirmação com Google real permanece na etapa 6.
2. Bloco 3 concluído: descoberta de árvores de backup marcadas na Drive, independentemente dos IDs recebidos localmente; limpeza diária com preservação de referências e uploads recuperáveis. Validado com Drive simulada; validação real pendente.
3. Bloco 2 concluído: sessão de upload persistida por conta e conteúdo, retoma consultando bytes confirmados pela Drive, recuperação de conclusão e substituição de sessões expiradas. Falta validar com Drive real.
4. Bloco 4 concluído em código e verificações focadas: coordenação de transições, cancelamento de login, recuperação de falhas, conflitos de adoção e imports. Percurso real com Google permanece pendente na etapa 6.
5. Bloco 5 concluído em código e verificações focadas: arranque web, pausa/prioridades, estado de nota indisponível, pesquisa parcial e coerência da versão em cache. Validação visual e percurso offline num browser real continuam pendentes.
6. Configurar Google, validar autenticação e backup/recuperação reais entre desktop e web.
7. Atualizar documentação final e só então concluir o plano/remover este CHECKPOINT. Tablet/mobile ficam para fase posterior.

## Configuração externa

Configuração migrada para `VITE_GOOGLE_WEB_CLIENT_ID`, `VITE_GOOGLE_DESKTOP_CLIENT_ID`
e `VITE_GOOGLE_WEB_ORIGIN`. `.env.local` na raiz foi criado vazio e está ignorado
pelo Git; `.env.example` é o modelo versionado. O JSON anterior foi removido.
Os comandos npm Tauri carregam o env antes de iniciar o CLI e passam os valores
ao Rust e ao frontend. O workflow de release recebe os valores dos repository
secrets `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_DESKTOP_CLIENT_ID` e `GOOGLE_WEB_ORIGIN`.
Os valores reais continuam por fornecer; OAuth/Drive real ainda não validados.
Verificação desta alteração: TypeScript (`tsc -b`), Rust (`cargo check --offline
--lib`) e execução do wrapper Tauri com `dev --help` passaram. `git check-ignore`
confirmou que `.env.local` não entra no repo. Não foi iniciado login nem alterada
uma biblioteca real; configuração externa e validação Google continuam pendentes.
Instruções: `GOOGLE_DRIVE_SETUP.md`. O utilizador ainda não criou o projeto Google.
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
