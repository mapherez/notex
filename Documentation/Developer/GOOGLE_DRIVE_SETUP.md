# Configuração Google do NoteX

## Desenvolvimento e builds locais

Preencher `.env.local` na raiz do projeto (junto ao `package.json`). Está
ignorado pelo Git; `.env.example` é o modelo vazio que fica no repositório.

```dotenv
VITE_GOOGLE_WEB_CLIENT_ID=CLIENT_ID_WEB.apps.googleusercontent.com
VITE_GOOGLE_DESKTOP_CLIENT_ID=CLIENT_ID_DESKTOP.apps.googleusercontent.com
VITE_GOOGLE_WEB_ORIGIN=https://ENDERECO-DA-WEBAPP
GOOGLE_DESKTOP_CLIENT_SECRET=CLIENT_SECRET_DO_CLIENTE_DESKTOP
```

Para testar o login desktop, preencher o ID desktop e, caso exigido pela Google,
o respetivo client secret do cliente **Desktop app**. Não usar o secret do cliente web.
`GOOGLE_DESKTOP_CLIENT_SECRET` é lido apenas pelo build Rust, sem prefixo `VITE_`,
e enviado à Google na troca e renovação de tokens. Não é incluído no JavaScript web.
É incorporado na app desktop, onde não pode ser tratado como um segredo confidencial.
PKCE e state continuam a proteger a autorização. Para testar
no browser local, preencher o ID web e usar `http://localhost:5173` como origem,
autorizada também no cliente Google. Em produção, usar a origem HTTPS pública.

```powershell
npm run tauri:dev
npm run tauri:build
```

Os comandos Tauri passam primeiro por `scripts/tauri-with-env.mjs`, que usa o
carregador de env do Vite e passa os valores ao frontend e ao Cargo. O Rust
incorpora `VITE_GOOGLE_DESKTOP_CLIENT_ID` em compilação; não lê um `.env` no PC
do utilizador. Para web, `npm run dev` e `npm run build` usam o carregador normal
do Vite. Variáveis já definidas no ambiente têm precedência sobre os ficheiros.

Depois de alterar `.env.local`, parar e voltar a iniciar `tauri:dev` ou o servidor
Vite. Builds de produção precisam de ser reconstruídos. Invocar `cargo` ou o
CLI Tauri diretamente não carrega `.env.local`; para login configurado, usar
os comandos npm acima ou fornecer a variável diretamente ao ambiente do Cargo.

### Isolamento obrigatório de desenvolvimento

`npm run tauri:dev` carrega `src-tauri/tauri.dev.conf.json`, com identificador
`com.mapherez.notex.dev`. No Windows, os dados ficam em
`AppData/Roaming/com.mapherez.notex.dev`, separados da app instalada
(`AppData/Roaming/com.mapherez.notex`). Não copia nem migra os dados de produção.

Builds debug com o identificador de produção recusam abrir o armazenamento.
Isto também protege contra arranques diretos por Cargo/CLI sem a configuração dev.
Os testes OAuth continuam a usar a Drive da conta escolhida; o isolamento acima
é do armazenamento local, não uma conta Google ou repositório Drive de teste.

`src/config/google.json` deixou de ser usado e foi removido. Sem configuração,
o desktop continua utilizável localmente; login Google informa que não está
configurado. A web mantém o seu fluxo de login obrigatório.

## GitHub Actions

Criar os seguintes repository secrets em **Settings → Secrets and variables → Actions**:

| Secret | Variável passada ao build |
| --- | --- |
| `GOOGLE_WEB_CLIENT_ID` | `VITE_GOOGLE_WEB_CLIENT_ID` |
| `GOOGLE_DESKTOP_CLIENT_ID` | `VITE_GOOGLE_DESKTOP_CLIENT_ID` |
| `GOOGLE_DESKTOP_CLIENT_SECRET` | `GOOGLE_DESKTOP_CLIENT_SECRET` (apenas Rust) |
| `GOOGLE_WEB_ORIGIN` | `VITE_GOOGLE_WEB_ORIGIN` |

O workflow `release.yml` já faz esta ligação no passo de build Tauri. Não é
preciso criar um `.env` no runner. A ausência dos secrets mantém a possibilidade
de compilar uma app local sem Google configurado.

Ainda não há workflow/imagem Docker de distribuição da webapp neste passo.
Quando se configurar esse build, passar os mesmos valores ao ambiente de
`npm run build` (ou a build args no Dockerfile). Variáveis no container que
serve ficheiros já compilados não substituem a configuração do Vite.

Estes valores são públicos e ficam incorporados no build; env/Secrets mantêm-nos
fora do histórico do repo, sem os tornar secretos na app distribuída. Nunca
colocar passwords, access tokens, refresh tokens ou client secrets em `VITE_*`.

## Google Cloud

1. Criar um projeto e ativar a Google Drive API.
2. Configurar o consentimento OAuth e, durante testes, adicionar as contas de teste.
3. Criar um cliente OAuth do tipo **Desktop app** e outro **Web application**, no mesmo projeto.
4. No cliente web, autorizar a origem HTTPS exata e a origem de desenvolvimento usada (por exemplo `http://localhost:5173`).
5. Configurar os scopes `openid`, `email`, `profile` e `https://www.googleapis.com/auth/drive.appdata`.
6. Preencher os IDs e a origem no env local ou nos secrets acima. O fluxo web usa popup e acesso direto à Google, sem backend de sessões.

Credenciais em modo de teste podem ter limitações de duração impostas pela Google. Antes de distribuir, rever o estado de publicação e os requisitos atuais de consentimento no projeto Google.

## Autorização na web

A conta selecionada fica lembrada localmente; o access token fica em
`sessionStorage`, limitado à sessão da tab e à sua validade Google. Refreshes
nessa tab reutilizam o token válido, sem novo popup. Logout remove a conta
lembrada e o token, mantendo a biblioteca IndexedDB da conta.

Ao expirar o token ou se a Google rejeitar a autorização, os backups aguardam
nova autorização explícita. Não há refresh tokens web nem servidor de sessões.
Se o browser impedir sessionStorage, a autorização funciona apenas em memória.

Até haver configuração e contas de teste, a integração real com Google não pode ser validada. Os testes locais de armazenamento e as simulações de rede continuam independentes desta configuração.
