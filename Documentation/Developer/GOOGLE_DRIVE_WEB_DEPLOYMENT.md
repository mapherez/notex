# NoteX — deployment web e manutenção de releases

## Estado atual

Release, configuração de produção e deployment público concluídos, conforme
confirmação do utilizador em 2026-09-17 sobre validações realizadas noutro chat.
Não houve nova publicação ou inspeção remota nesta sessão. O registo está no
[plano e validação da implementação](GOOGLE_DRIVE_WEB_IMPLEMENTATION_PLAN.md).
As instruções seguintes permanecem como referência para reconstruções,
atualizações e futuras releases.

Desktop e web partilham o código da app. O build da raiz (`npm run build`)
gera a webapp em `dist/`, incluindo o service worker. A landing page e a
documentação pública têm build separado em `landing/dist/`.

O workflow Tauri compila e publica o instalador. O deployment web tem ficheiros
separados: `docker/web/Dockerfile`, `docker/web/nginx.conf`,
`.github/workflows/web-publish.yml` e `docker-compose.web.yml`.
`docker-compose.mcp.yml` pertence ao MCP e não serve para este deployment.

## Endereço da webapp

Os endereços mantêm os deployments separados:

- Landing: `https://notex.mapherez.com/`, publicada pelo workflow de Pages.
- Documentação: `https://notex.mapherez.com/docs/`, no mesmo build da landing.
- Webapp: `https://notex.mapherez.com/app/`, imagem Docker independente.

`GOOGLE_WEB_ORIGIN` no GitHub e **Authorized JavaScript origins** no cliente
OAuth web devem ser `https://notex.mapherez.com`, sem `/app` ou barra final.

A imagem compila a app com `NOTEX_WEB_BASE_PATH=/app/`, adapta o router e os
assets e regista o service worker apenas nesse âmbito. Desktop e `npm run dev`
mantêm o caminho base `/`. A cache offline da app não interceta a landing/docs.

A landing não entra no contexto, build ou imagem Docker. Atualizações de
landing/docs continuam pelo workflow existente, sem reconstruir a webapp.

O encaminhamento público é por caminho. Apenas `/app` e
`/app/…` devem chegar ao container; o resto mantém o deployment da landing.
Não apontar o domínio inteiro para este container, que não serve a landing.
A preparação do build para /app/ não substitui a configuração de encaminhamento
no proxy público.

IndexedDB e sessão pertencem à origem do browser: mudar de hostname implica
uma nova biblioteca local, recuperável da Drive após login.

## Build e publicação da imagem

1. Confirmar repository Secrets `GOOGLE_WEB_CLIENT_ID` e `GOOGLE_WEB_ORIGIN`.
   A origem é `https://notex.mapherez.com`.
   O workflow não usa ID/secret desktop nem precisa de um token GHCR adicional.
2. Enviar os ficheiros para o GitHub. Em **Actions → Publish NoteX Web Image →
   Run workflow**, escolher o branch que contém esta implementação e executar.
   O workflow é manual; não publica imagens automaticamente em cada commit.
   Para aparecer normalmente na lista Actions, o workflow deve existir no branch
   por defeito do repositório; depois é possível escolher outro branch no dispatch.
3. O Dockerfile instala com `npm ci` e compila apenas a webapp numa etapa Node.
   Apenas a configuração pública web entra nesse build; o contexto não inclui
   landing/docs, `.env.local`, credenciais, dados locais ou ficheiros Rust.
   `Dockerfile.dockerignore` aplica-se só ao web build, preservando o contexto MCP.
4. O workflow verifica configuração Nginx, redirect /app, fallback de uma rota
   de nota em /app/, service worker e 404 de assets e rotas fora da app antes
   de publicar. O build final reutiliza a cache.
5. GHCR recebe `ghcr.io/mapherez/notex-web:latest`, a versão do package.json
   (por exemplo `:2.3.1`) e `:sha-<commit completo>`, para AMD64 e ARM64.
   O frontend compila na arquitetura do builder; não requer emulação ARM para
   compilar JavaScript. O resumo da execução inclui o digest publicado.

O runtime contém apenas Nginx e o build da webapp, sem Node, Rust, SQLite ou backend MCP
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
O container serve `http://HOST_IP:8093/app/`; o healthcheck interno consulta
`/healthz`. O encaminhamento público por caminho deve preservar `/app/` e
encaminhar apenas a app para esta porta, mantendo landing/docs no destino
independente. Não substituir
o destino de todo o domínio pelo container. Confirmar que a porta não colide
com outro serviço no host.

O compose não cria volumes: as bibliotecas ficam no browser/Drive de cada
utilizador. Trocar ou recriar o container não apaga essas bibliotecas.

Para atualizar, repetir `docker compose pull` e `docker compose up -d`.
Depois da atualização, fechar as tabs antigas e reabrir a app para permitir
que o novo service worker assuma controlo, sem misturar versões na tab aberta.

Pasta sugerida no host: `~/homelab/notex-web/docker-compose.yml`, com `.env`
ao lado se houver variáveis de imagem, porta ou proxy. O compose aceita
`NOTEX_WEB_TAG` (default `latest`) e `NOTEX_WEB_PORT` (default `8093`). Por exemplo:

```dotenv
NOTEX_WEB_TAG=2.3.1
NOTEX_WEB_PORT=8093
```

Sem `.env`, os defaults já permitem arrancar. Os valores OAuth Vite
são incorporados no JavaScript durante a compilação: um `.env` no host não
altera uma imagem já compilada.

Para servir apenas a app num servidor estático, compilar com
`NOTEX_WEB_BASE_PATH=/app/` e publicar `dist/` em `app/`, usando as mesmas regras
de rotas/cache do Nginx. Não colocar o build desktop com base `/` dentro de /app/.

## Configuração do servidor estático

- Servir `/app/index.html` como fallback apenas para as rotas da app, por
  exemplo `/app/notes/:id`; pedidos de assets inexistentes devem produzir 404.
- Servir `/app/sw.js` como JavaScript, sem fallback HTML nem cache imutável.
  Não alargar o seu âmbito à raiz do domínio.
- Usar revalidação para index.html e sw.js; cache longa apenas para assets
  versionados por hash. Outros assets públicos precisam de revalidação.
- Servir por HTTPS. O servidor recebe pedidos dos ficheiros da app; as notas
  e os tokens Google não são guardados no host. O tráfego normal HTTP pode
  constar dos logs do servidor/reverse proxy.
- Confirmar login, refresh numa rota de nota e modo offline no URL final.

Referência: [deploy estático Vite](https://vite.dev/guide/static-deploy.html).

Referências de publicação: [GHCR e GitHub Actions](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images),
[visibilidade GHCR](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).

## Checklist para futuras releases desktop

- Confirmar versões e patch notes coerentes com a release a publicar.
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
- Atualizar a documentação permanente com alterações e resultados da validação.
