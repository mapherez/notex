# NoteX: Google Drive, bibliotecas por conta e versão web

Plano acordado na conversa de implementação. Este documento permanece após a conclusão do trabalho. O progresso é registado em `GOOGLE_DRIVE_WEB_CHECKPOINT.md`, que só será apagado quando a implementação e as validações estiverem concluídas.

## Estado na preparação da versão 2.3.0 — 2026-09-17

Funcionalidades principais implementadas. O utilizador confirmou OAuth real,
backup e atualização de notas nos dois sentidos, anexos desktop → web,
isolamento entre contas, sessão mantida após refresh e edição/refresh offline
com backup após reconexão recebido no desktop. Abrir sem editar não gera
backup nem alteração de updatedAt.

Configuração: [Google OAuth](GOOGLE_DRIVE_SETUP.md).
Publicação: [deployment e release](GOOGLE_DRIVE_WEB_DEPLOYMENT.md).
Permanecem a confirmação do instalador final/atualização com migração, o estado
público OAuth e a execução/validação do deployment web no host. Workflow de
imagem GHCR e compose web implementados. Tablet/mobile e MCP hosted
continuam fora desta fase. O checkpoint distingue casos simulados dos testes reais.

## 1. Objetivo e arquitetura

Manter o NoteX desktop rápido e utilizável offline, acrescentar backups automáticos na Drive pessoal e disponibilizar a mesma experiência de edição no browser.

| Ambiente | Armazenamento | Acesso |
| --- | --- | --- |
| Desktop Windows | SQLite e anexos locais | Login opcional |
| Web | IndexedDB, incluindo anexos e fila de transferências | Conta obrigatória |
| Google Drive | JSON e anexos na `appDataFolder` | Diretamente pelos clientes |

- Partilhar os modelos de dados, validação, regras de versões e lógica das transferências.
- Criar adaptadores específicos para armazenamento, ficheiros e autenticação.
- Não introduzir SQLite WASM na web.
- Não utilizar o backend MCP existente para autenticação ou backups. O servidor web serve os ficheiros da aplicação; não recebe notas nem guarda sessões Google.
- Não implementar bloqueio de sessões entre dispositivos. A interface comunica claramente backups pendentes.
- Prioridade: desktop Windows e web em ecrãs desktop; tablet e mobile ficam para fases posteriores.

## 2. Dados locais, contas e compatibilidade

### Proteção do SQLite

- Preservar a correção existente que elimina o reset destrutivo.
- Preparar migrações sequenciais explícitas; adicionar os campos/tabelas necessários ao controlo de backups através de uma migração do schema atual.
- Antes de migrar, criar uma cópia consistente de segurança. Executar a migração numa transação e atualizar a versão apenas após sucesso.
- Em falha, manter os dados anteriores e apresentar um erro recuperável.
- Schemas futuros ou históricos não reconhecidos não são modificados automaticamente.
- Manter os imports/exports desktop existentes e validar a compatibilidade do schema antes de substituir dados.

### Bibliotecas desktop

Estrutura dentro da pasta de dados atual:

```text
com.mapherez.notex/
  notex.sqlite
  files/
  conta-a@gmail.com/
    notex.sqlite
    files/
  conta-b@gmail.com/
    notex.sqlite
    files/
```

- Sem login, utilizar a biblioteca da raiz.
- Ao ligar uma conta, incorporar nessa biblioteca as notas e anexos existentes na raiz, preservando IDs.
- Copiar/juntar e validar antes de limpar a origem. Registar o progresso para recuperar de interrupções sem duplicações.
- Depois da incorporação, reconciliar automaticamente com a Drive: enviar notas locais em falta, descarregar remotas em falta e comparar as coincidentes.
- No logout, manter a biblioteca da conta e voltar à biblioteca local sem conta.
- Notas criadas posteriormente sem login passam para a próxima conta utilizada.
- Nunca transferir automaticamente dados entre duas bibliotecas de contas.
- Identificar contas pelo ID estável Google, usando o email como nome legível da pasta e validando os caminhos.
- Centralizar a resolução da biblioteca ativa para SQLite, anexos, import/export e MCP. Ao trocar de conta, terminar gravações locais e impedir operações pendentes de escrever na biblioteca seguinte.

### Bibliotecas web

- Separar IndexedDB por conta Google, com dados estruturados, anexos e estado persistente das transferências.
- Não existir biblioteca anónima.
- Sem sessão ou após logout, mostrar imediatamente o modal NoteX de login, sem permitir criar notas ou aceder à biblioteca.
- Manter dados locais e pendentes após logout.
- Depois de um login bem-sucedido, permitir reabertura offline na conta ativa. Um logout explícito volta a exigir autenticação.
- Guardar os recursos necessários para abrir a aplicação offline; pedir persistência ao browser e tratar falta de espaço sem descartar alterações.
- Coordenar separadores do mesmo browser para evitar dois executores concorrentes das transferências.

### Alterações reais

- `lastOpenedAt` continua localmente disponível, mas não incrementa a versão de conteúdo nem desencadeia backups.
- Comparar valores antes de gravar alterações de título, blocos, tags e restantes campos.
- Persistir a alteração e o respetivo estado pendente na mesma transação.
- Manter a ordenação de recentes por `updatedAt` já corrigida.
- Sincronizar organização da biblioteca, incluindo quick pins. Tema, idioma, layout, caminhos, credenciais e configurações MCP ficam locais.

## 3. Google Drive e transferências

### Autenticação

- **Desktop:** botão Google na secção “Utilizador local / Local account” da Profile. Abrir o browser do sistema com OAuth, PKCE e retorno local; guardar refresh tokens no armazenamento seguro do Windows.
- **Web:** modal NoteX com “Continuar com Google”; o clique abre o popup Google. Usar autorização diretamente no browser, sem refresh tokens num servidor próprio.
- Permitir escolher qualquer conta Google.
- Quando o acesso expirar ou for revogado, preservar pendentes e apresentar uma ação de reautorização.
- Logout local termina o acesso da aplicação, preservando as bibliotecas.
- Configurar clientes OAuth desktop e web no mesmo projeto Google, com acesso a `drive.appdata` e identificação básica da conta.

### Formato dos backups

```text
NoteX/
  metadata.json
  notes/
    <note-id>/
      manifest.json
      note.json
      files/
```

- Reaproveitar o conteúdo dos `.notex-note`, sem empacotar em ZIP para a Drive.
- O catálogo global contém IDs, títulos, subtítulos, tags, collections, estados necessários à lista, versões e referências aos ficheiros.
- Os manifests identificam o formato e os ficheiros que compõem cada backup.
- Preservar IDs de notas, blocos, anexos e relações. Referências a notas ainda não descarregadas não são eliminadas.
- Associar versão, checksum e última revisão conhecida localmente. `updatedAt` representa edição; `exportedAt` representa criação do backup.
- Não incluir credenciais, caminhos absolutos ou preferências específicas do dispositivo nos backups.

### Publicação, versões e eliminações

- Preparar novos ficheiros sem sobrescrever o último conjunto publicado. Atualizar o catálogo apenas quando os ficheiros necessários estiverem confirmados.
- Atualizar o catálogo uma vez por lote, incluindo apenas operações concluídas. Preservar entradas remotas que ainda não foram descarregadas.
- Manter temporariamente os ficheiros anteriores até confirmar a publicação; depois limpar os que deixaram de ser referenciados.
- Oferecer apenas o último backup, sem interface de histórico.
- Para a mesma nota, a maior versão vence. Versões iguais com conteúdo diferente suspendem apenas essa nota e pedem ao user qual manter.
- Mover para a lixeira, restaurar e eliminar definitivamente acompanham a biblioteca na Drive.
- Guardar marcadores de eliminação para impedir que uma cópia antiga volte a criar notas apagadas.
- Verificar alterações remotas antes de publicar, ao abrir, ao recuperar ligação e ao voltar à aplicação. Enquanto ativa e ligada, verificar no máximo uma vez por minuto. Isto não constitui exclusão entre dispositivos.

### Backups automáticos

- Todas as notas entram por defeito; permitir exclusões explícitas. Excluir de backups não apaga cópias já publicadas.
- Uma entrada pendente por nota, atualizada com o estado mais recente.
- Valores iniciais em configuração: 30 segundos sem alterações ou 2 minutos desde a primeira alteração pendente durante edição contínua.
- Disponibilizar “Backup agora”.
- Usar snapshots consistentes: edições feitas durante um upload ficam para o ciclo seguinte.
- Transferir apenas ficheiros novos ou alterados; reutilizar anexos pelo checksum.
- Persistir progresso e retomar operações interrompidas. Usar espera progressiva para falhas de rede e limites da API.
- Executar uploads em lotes sem sobrepor operações da mesma nota; dar prioridade às alterações locais sobre downloads de fundo.

### Download progressivo

- No primeiro acesso, carregar o catálogo e iniciar automaticamente a fila sequencial de download da biblioteca.
- Mostrar a lista antes de descarregar o conteúdo.
- Permitir priorizar notas, collections e tags; abrir uma nota pendente dá-lhe prioridade após a transferência em curso.
- Permitir pausar e retomar.
- Em acessos posteriores, descarregar apenas dados em falta ou alterados.
- Distinguir metadados disponíveis de conteúdo realmente descarregado; uma nota incompleta nunca é enviada como se fosse uma edição vazia.
- Pesquisar títulos e subtítulos de toda a biblioteca e conteúdo já descarregado, indicando discretamente quando a pesquisa ainda é parcial.

## 4. Interface e serviços partilhados

### Interfaces internas

Separar as responsabilidades hoje ligadas ao Tauri:

- **Armazenamento:** operações e transações sobre os modelos comuns, implementadas em SQLite e IndexedDB.
- **Ficheiros:** guardar, ler, apresentar e remover anexos.
- **Conta/biblioteca:** identificar a conta e selecionar a biblioteca ativa.
- **Formato de backup:** produzir e validar catálogo, manifests e conteúdo das notas.
- **Transferências:** filas persistentes, prioridades, versões, retentativas e progresso.

No IndexedDB, as transações devem assegurar a gravação conjunta de dados e pendentes; pedidos de rede ficam fora delas.

### Banner e saída

- Criar banner de transferências com o estilo do banner de updates, expansível por seta.
- Recolhido: estado e contagem compactos. Expandido: progresso, pendentes, falhas e ações.
- Não expandir automaticamente a cada atualização de progresso.
- Mostrar conclusão apenas depois de a publicação na Drive estar confirmada.
- No desktop, intercetar fecho com conta ligada e backups pendentes: “Concluir backups e sair”, “Sair agora” e “Cancelar”.
- Na web, não utilizar popups de saída. Manter o estado visível e retomar pendentes na próxima abertura.
- Usar traduções PT/EN, estilos e tokens existentes.

### Funcionalidades por plataforma

- Preservar import/export manual no desktop.
- Não apresentar imports/exports manuais na web: as transferências são feitas pela Drive.
- Manter editor, notas, pesquisa, organização e anexos nos dois ambientes.
- Manter updater, servidor MCP local e acesso a pastas como capacidades desktop; não carregar esses serviços no browser.

## 5. Validação e entrega

### Testes obrigatórios

- DB atual com notas e anexos: migração automática preserva conteúdo, IDs e relações.
- Migração falhada, schema desconhecido e interrupção: nenhuma eliminação de dados.
- Primeiro login, logout, troca de conta e incorporação interrompida: nenhuma mistura entre contas ou duplicação.
- Abrir uma nota e guardar valores iguais: nenhuma nova versão ou backup.
- Edição durante upload: só a revisão enviada fica confirmada; a seguinte permanece pendente.
- Downloads parciais, prioridades, pausa, reinício e referências entre notas.
- Versões superiores/inferiores, empate divergente, lixeira, restauro e eliminação offline sem ressurreição.
- Token expirado, falta de rede, limites da Drive, falta de espaço e falha antes de publicar o catálogo.
- Web offline após login e bloqueio da interface após logout.
- Regressão de import/export e MCP desktop na biblioteca ativa.
- Validar visualmente Profile, login e banner recolhível.
- Medir arranque, abertura/gravação e fluidez durante transferências com bibliotecas de 200 e 2 000 notas, incluindo anexos. Validar a web nos browsers desktop atuais Chrome, Edge, Firefox e Safari.

### Sequência de implementação

1. Migrações seguras, deteção de alterações reais e separação das bibliotecas.
2. Contratos comuns de armazenamento, ficheiros e formato de backup.
3. Login Google, Drive e backups no desktop.
4. IndexedDB, login web, persistência offline e downloads progressivos.
5. Interface final, testes entre ambientes e preparação da release.
6. Tablet e mobile em trabalho posterior.

As credenciais públicas OAuth e a origem HTTPS da web serão fornecidas na configuração da implementação. Nenhuma publicação ou alteração na configuração Google está incluída automaticamente neste plano.
