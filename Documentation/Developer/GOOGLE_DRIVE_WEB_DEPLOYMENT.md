# NoteX 2.3.0 — deployment web e preparação da release

## Estado atual

Desktop e web partilham o código da app. O build da raiz (`npm run build`)
gera a webapp em `dist/`, incluindo o service worker. A landing page e a
documentação pública têm build separado em `landing/dist/`.

O workflow Tauri compila e publica o instalador. O deployment web tem ficheiros
separados: `docker/web/Dockerfile`, `docker/web/nginx.conf`,
`.github/workflows/web-publish.yml` e `docker-compose.web.yml`.
`docker-compose.mcp.yml` pertence ao MCP e não serve para este deployment.

## Endereço da webapp

A landing page usa `https://notex.mapherez.com`, publicada por GitHub Pages.
Recomendação: manter essa configuração e servir a app na raiz de um subdomínio
dedicado, por exemplo `https://app.notex.mapherez.com`. Criar DNS para o host,
configurar HTTPS e autorizar essa origem no cliente OAuth web.

Nesse exemplo, `GOOGLE_WEB_ORIGIN` no GitHub e `VITE_GOOGLE_WEB_ORIGIN` no build
recebem `https://app.notex.mapherez.com`. Não definir essa origem como a landing
page se a app estiver num hostname diferente.

Alternativa: `https://notex.mapherez.com/app/`. A origem OAuth continua a ser
`https://notex.mapherez.com`, sem `/app`. Esta opção requer trabalho adicional:

- Servir landing e app através de um ponto de entrada que encaminhe `/app/`
  para a webapp. GitHub Pages não fornece um reverse proxy para o host.
- Adaptar o base do build Vite, basename do BrowserRouter, favicon/assets com
  caminhos absolutos e registo do service worker. Hoje usam a raiz `/`.
- Limitar o service worker ao âmbito `/app/` para não controlar a landing.
- Garantir fallback de rotas da app para o seu index.html.

Não publicar o build atual em `/app/` apenas alterando o reverse proxy.
IndexedDB e sessão pertencem à origem do browser: mudar de hostname implica
uma nova biblioteca local, recuperável da Drive após login.

## Build e publicação da imagem

1. Confirmar repository Secrets `GOOGLE_WEB_CLIENT_ID` e `GOOGLE_WEB_ORIGIN`.
   Para o subdomínio escolhido, a origem é `https://app.notex.mapherez.com`.
   O workflow não usa ID/secret desktop nem precisa de um token GHCR adicional.
2. Enviar os ficheiros para o GitHub. Em **Actions → Publish NoteX Web Image →
   Run workflow**, escolher o branch que contém esta implementação e executar.
   O workflow é manual; não publica imagens automaticamente em cada commit.
   Para aparecer normalmente na lista Actions, o workflow deve existir no branch
   por defeito do repositório; depois é possível escolher outro branch no dispatch.
3. O Dockerfile instala com `npm ci` e executa `npm run build` numa etapa Node.
   Apenas a configuração pública web entra nesse build; o contexto não inclui
   `.env.local`, credenciais, dados locais, landing ou ficheiros Rust.
   `Dockerfile.dockerignore` aplica-se só ao web build, preservando o contexto MCP.
4. O workflow verifica configuração Nginx, fallback de uma rota de nota, service
   worker e 404 de assets antes de publicar. O build final reutiliza a cache.
5. GHCR recebe `ghcr.io/mapherez/notex-web:latest`, a versão do package.json
   (por exemplo `:2.3.0`) e `:sha-<commit completo>`, para AMD64 e ARM64.
   O frontend compila na arquitetura do builder; não requer emulação ARM para
   compilar JavaScript. O resumo da execução inclui o digest publicado.

O runtime contém apenas Nginx e `dist/`, sem Node, Rust, SQLite ou backend MCP
em execução. Alterar origem/ID OAuth requer reconstruir a imagem.

Na primeira publicação, confirmar em **Packages → notex-web → Package settings**
que a visibilidade permite o pull pretendido. Para pull sem autenticação no
host, definir o pacote como público. Se permanecer privado, autenticar o Docker
no GHCR com uma credencial com acesso ao pacote antes de usar compose.

## Compose no host

Copiar `docker-compose.web.yml` do repositório para
`~/homelab/notex-web/docker-compose.yml`. É o único ficheiro obrigatório no host;
não é preciso clonar o código nem compilar nada nesse servidor.

```sh
cd ~/homelab/notex-web
docker compose pull
docker compose up -d
docker compose ps
```

A porta publicada é **8093**, mapeada para **8080** no container.
Configurar o reverse proxy de `app.notex.mapherez.com` para `http://HOST_IP:8093`,
com HTTPS no endpoint público. Confirmar que esta porta não colide com outro
serviço no host. O healthcheck interno consulta `/healthz`.

O compose não cria volumes: as bibliotecas ficam no browser/Drive de cada
utilizador. Trocar ou recriar o container não apaga essas bibliotecas.

Para atualizar, repetir `docker compose pull` e `docker compose up -d`.
Depois da atualização, fechar as tabs antigas e reabrir a app para permitir
que o novo service worker assuma controlo, sem misturar versões na tab aberta.

Pasta sugerida no host: `~/homelab/notex-web/docker-compose.yml`, com `.env`
ao lado se houver variáveis de imagem, porta ou proxy. O compose aceita
`NOTEX_WEB_TAG` (default `latest`) e `NOTEX_WEB_PORT` (default `8093`). Por exemplo:

```dotenv
NOTEX_WEB_TAG=2.3.0
NOTEX_WEB_PORT=8093
```

Sem `.env`, os defaults já permitem arrancar. Os valores OAuth Vite
são incorporados no JavaScript durante a compilação: um `.env` no host não
altera uma imagem já compilada.

Docker não é obrigatório: também é possível publicar `dist/` diretamente num
servidor estático. Imagem/compose são uma opção conveniente para este homelab.

## Configuração do servidor estático

- Servir index.html como fallback para as rotas BrowserRouter, por exemplo
  `/notes/:id`; pedidos de assets inexistentes devem produzir 404.
- Servir `/sw.js` como JavaScript, sem fallback HTML nem cache imutável.
- Usar revalidação para index.html e sw.js; cache longa apenas para assets
  versionados por hash. Outros assets públicos precisam de revalidação.
- Servir por HTTPS. O servidor recebe pedidos dos ficheiros da app; as notas
  e os tokens Google não são guardados no host. O tráfego normal HTTP pode
  constar dos logs do servidor/reverse proxy.
- Confirmar login, refresh numa rota de nota e modo offline no URL final.

Referência: [deploy estático Vite](https://vite.dev/guide/static-deploy.html).

Referências de publicação: [GHCR e GitHub Actions](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images),
[visibilidade GHCR](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).

## Preparação da release desktop

- Versão pretendida: 2.3.0. Confirmar versões e patch notes coerentes.
- Secrets esperados pelo workflow: `GOOGLE_WEB_CLIENT_ID`,
  `GOOGLE_DESKTOP_CLIENT_ID`, `GOOGLE_DESKTOP_CLIENT_SECRET`, `GOOGLE_WEB_ORIGIN`.
  Os três nomes públicos não têm prefixo VITE_ nos Secrets atuais.
- Usar o workflow para gerar um draft da release e o instalador assinado para
  o updater. Testar a atualização de uma instalação anterior com cópia de
  segurança da biblioteca, incluindo notas e anexos.
- Confirmar migração SQLite, abertura após reiniciar e login opcional desktop.
  tauri:dev usa armazenamento separado e não substitui este teste do instalador.
- Confirmar projeto OAuth publicado para o público pretendido e configuração
  de Branding/Data Access conforme indicado pela Google.
- Concluir documentação e apagar o checkpoint apenas quando o trabalho
  restante de release/deployment estiver fechado.
