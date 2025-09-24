# Compêndio de Dúvidas Linguísticas — Project Plan & Architecture

> **Objetivo**: construir uma app escalável, acessível e multilíngua para pesquisa e gestão rápida de dúvidas de língua portuguesa (PT‑PT primeiro; extensível a BR/CPLP).
>
> **Estilo**: monorepo, TypeScript‑first, PWA‑ready, Postgres híbrido (colunas + JSONB), clean architecture, DX forte.

---

## 0) Princípios orientadores

* **DX first, produto rápido**: stack simples, automações onde fizer sentido.
* **Evoluir sem partir**: colunas para o estável; `jsonb` para secções evolutivas; *defaults on‑read*.
* **A11y + i18n desde o dia 1**: WCAG 2.2 AA, HTML semântico, navegação por teclado, locale‑aware.
* **Search rápido e relevante**: FTS português + `unaccent` + `pg_trgm`; filtros úteis.
* **Design tokens & themes**: light/dark de raiz; escalável a brands/mercados.
* **Segurança**: RLS (Row‑Level Security), princípio do menor privilégio, auditoria de mudanças.

---

## 1) Monorepo & tooling

**Gerência**: PNPM + Turborepo

```
apps/
  web/                # Next.js (App Router) — PWA, UI, i18n, a11y
  api/                # (Opcional) rotas server/edge para tarefas específicas
packages/
  ui/                 # Componentes reutilizáveis (Radix + Tailwind), tokens, temas
  config/             # Settings (mercados/roles/feature flags), locales
  types/              # Tipos TS partilhados (Entry, Search, Config)
  data-access/        # Repositórios (Supabase/Neon), mapeadores DTO↔domain
  search/             # Helpers de search (FTS queries, scoring, highlight)
  utils/              # Utilitários (zod, datas, markdown, a11y)
  eslint-config/      # ESLint partilhado
  tsconfig/           # TS configs partilhadas
infra/
  db/                 # SQL/migrações, seeds, roles/RLS, funções (RPC)
  ci/                 # Pipelines CI (lint, test, build, preview)
  docs/               # ADRs, notas de arquitetura
```

**Stack de base**

* **Runtime**: Next.js + TypeScript (App Router, Edge‑friendly)
* **UI**: TailwindCSS + Radix UI (acessibilidade) + Headless UI (se necessário)
* **State**: Zustand (UI/app state) + React Query (dados remotos)
* **PWA**: manifest + service worker (Workbox)
* **DB**: Postgres (Supabase/Neon) — híbrido colunas + `jsonb`
* **Auth**: Google/Apple (via Supabase Auth ou Auth.js)
* **Lints/tests**: ESLint, Prettier, Vitest, Playwright, axe-core
* **Commits & versão**: Conventional Commits + Changesets

---

## 2) Config & Locales

### 2.1 Estratégia de config (camadas)

1. **Base** (default comum)
2. **Mercado/país** (`pt-PT`, `pt-BR`, `CPLP`)
3. **Ambiente** (`dev`, `staging`, `prod`)
4. **Perfil de utilizador** (`guest`, `user`, `editor`, `admin`)

Resolução: `deep-merge` nessas ordens. Config exposta via provider no `apps/web`.

### 2.2 Estrutura de pastas em `packages/config`

```
config/
  base.json
  markets/
    pt-PT.json
    pt-BR.json
  roles/
    guest.json
    user.json
    editor.json
    admin.json
  features.json        # flags (ex.: editorMode, exportPDF, etc.)
locales/
  pt-PT/
    common.json
    search.json
    cards.json
  en-US/
    common.json
```

### 2.3 Seções de settings (exemplos)

* **app**: `locale`, `theme`, `dateFormat`, `featureFlags`
* **ui**: `header`, `sideMenu`, `footer`, `shortcuts`
* **search**: `pageSize`, `rankingWeights`, `minQueryLen`, `highlight`
* **a11y**: `reducedMotionDefault`, `focusRingStyle`

---

## 3) Theming & Design Tokens

* Tokens em `packages/ui/tokens` (core + tema light/dark + overrides por mercado)
* **Categorias**: cores, tipografia, espaçamentos, radius, sombras, z‑index.
* Expor CSS vars: `:root { --color-bg: … }`; temas por `data-theme="dark"`.
* Suporte a *prefers-color-scheme* + override por utilizador.

---

## 4) Acessibilidade (WCAG 2.2 AA)

* HTML semântico, landmarks (`header/nav/main/aside/footer`).
* Foco visível consistente; ordem de tab previsível.
* Atalhos: `Ctrl/⌘+K` (search), `F` (filtros), `?` (help).
* Contrast checker na CI (Playwright + axe).
* Labels e `aria-` nos controlos (search, filtros, toggles de tema).

---

## 5) i18n

* Locale primário **PT‑PT**; fallback **EN** mínimo.
* `packages/config/locales` para strings; chaves estáveis (`CARDS_TLDR_LABEL`).
* Date/number pluralization via Intl API.

---

## 6) Domínio & Modelo de Dados

### 6.1 Entradas (cartões)

* **Colunas estáveis**: `id (uuid)`, `slug`, `title`, `area`, `short_description`, `region`, `orthography`, `published`, `created_at`, `updated_at`, `search_document` (derivado p/ FTS)
* **Payload flexível (`jsonb`)**: `full_description_md`, `rules`, `goodExamples`, `badExamples`, `traps`, `exceptions`, `sources[]`, `aliases[]`, `schemaVersion`, `search_keywords[]`
* **Relações**: `entry_link(from_id, to_id, relation)`; `tag` + `entry_tag`
* **Privado por utilizador**: `user_note(user_id, entry_id, note_md)`

### 6.2 Defaults on‑read (contrato)

* Arrays ausentes → `[]`; strings ausentes → `""`; booleans ausentes → `false`; enums ausentes → `indiferente`; `schemaVersion` ausente → `1`.

---

## 7) Search (sem Vector, inteligente)

* Extensões: `unaccent` + `pg_trgm` + dicionário **portuguese**.
* Índice FTS em `search_document` (concat de título, tldr, corpo plain, aliases).
* Query: `websearch_to_tsquery('portuguese', unaccent(q))` + *fuzzy* via trigram (similarity).
* Ranking (peso): título > tldr > corpo > aliases; fusão com `similarity` p/ typos.
* Filtros: área, região, tags, status.
* Highlight: `ts_headline` (trechos relevantes).

---

## 8) Segurança & Permissões

* **RLS** em todas as tabelas com dados de utilizador.
* Políticas:

  * Público: `select` apenas de `entry.published = true` (+ joins safe)
  * `editor`: CRUD em `entry`/`link`/`tag` (audit log)
  * `user`: CRUD em `user_note` (scope `auth.uid()`)
* Auditoria: tabela de `changes` (quem, quando, o quê) ou `updated_by` + logs.

---

## 9) Autenticação & Perfis

* Auth Google/Apple (Supabase Auth ou Auth.js).
* Perfis: `guest`, `user` (login), `editor` (Lili e equipa), `admin`.
* *Feature gating*: certos painéis (Editor, Notas) só para perfis autorizados.

---

## 10) Fluxos de UX (alto nível)

* **Busca global**: `Ctrl/⌘+K` → autocomplete (prefix, aliases, ranking) → resultados (Cards | Tabela) → filtros à esquerda.
* **Página de cartão**: TL;DR + regras + exemplos (✓/✗) + armadilhas + fontes + relacionados + notas privadas (se logado).
* **Modo Editor**: Draft → Preview → Publish; ver histórico; validação (fontes obrigatórias, min TL;DR, etc.).
* **Notas privadas**: Markdown simples; privadas por utilizador.

---

## 11) PWA & Performance

* Service Worker (Workbox) p/ assets e shell; cache de resultados recente em memória.
* Medir `FCP`, `LCP`, `INP`; metas: LCP < 2.0s em 3G rápido; INP < 200ms.
* Preload do índice de search leve (opcional) para autocomplete offline básico.

---

## 12) Qualidade & CI/CD

* Pipelines: lint → typecheck → unit → e2e (a11y) → build.
* PR checks obrigatórios (coverage limiar 70%+ em domain/search).
* Previews por PR (Vercel).
* Migrações DB idempotentes e testadas (Drizzle SQL ou SQL plano). Backups semanais.

---

## 13) Padrões de código & arquitetura

* **Domain/Data/UI** (clean-ish): `domain` (tipos/serviços puros), `data-access` (repos), `ui` (componentes/VMs).
* **Design patterns** onde faz sentido: Repository, Adapter (DB/Storage), Factory (view models), Strategy (ranking), State Machine (import/export, publish).
* **Zod** para validar payloads (`jsonb`) e configs.

---

## 14) Roadmap (MVP → v1)

**MVP (2–3 sprints)**

1. Monorepo + infra base (apps/packages/infra)
2. DB mínima (entries + search\_document + RLS público)
3. Busca global (FTS + filtros) + página de cartão (read‑only)
4. Editor básico (draft → publish) com validação mínima
5. PWA + i18n + theming + a11y baseline

**v1**
6\. Notas privadas + favoritos
7\. Relações “Ver também” + auto‑relacionados via FTS
8\. Telemetria de busca/cliques
9\. Export simples (PDF/print layout)
10\. Gestão de tags/aliases e audit log

---

## 15) Métricas & Telemetria

* Search: queries sem resultado, CTR top result, tempo até 1º resultado.
* Conteúdo: cartões mais vistos, secções mais lidas, links 404 (checker assíncrono).
* UX: erros JS, INP/LCP, sucesso de keyboard nav (amostras e2e).

---

## 16) Tabela de decisão — Coluna vs JSONB

* **Coluna**: filtras/ordenas frequentemente, precisas de índice/FTS, integridade (unique), join com outras tabelas.
* **JSONB**: conteúdo opcional/variável por cartão, secções ricas (Markdown), evolução rápida sem migração.
* **Relação**: sempre que liga entradas (relacionados/tags) → tabelas relacionais (integridade + queries boas).

---

## 17) Defaults on‑read (oficiais)

* `arrays`: `[]`
* `strings`: `""` (ou não renderizar bloco)
* `booleans`: `false`
* `enums`: `"indiferente"` (quando aplicável)
* `schemaVersion`: `1`

---

## 18) ADRs (Architecture Decision Records)

* Guardar decisões em `infra/docs/adr-XXXX-titulo.md` (contexto → decisão → consequências).
* ADRs iniciais sugeridas: DB (Postgres híbrido), Search (FTS + trigram), Theming (tokens CSS), i18n (arquitetura), Auth (providers), RLS policies.

---

## 19) Open Questions (para fechar com a Lili)

* Enum de **áreas** (lista final) e **regiões**.
* Secções que são **rich text** vs. plain.
* Políticas de **publicação** (workflow/editor roles).
* **Export**: apenas print layout ou PDF “editorial” (tipografia avançada)?
* **Tags/aliases**: livres ou controladas por taxonomia?

---

## 20) Próximos passos

1. Criar o monorepo (pnpm + turbo) e esqueleto das pastas.
2. Inicializar DB (tabelas mínimas + RLS público + search\_document + extensões).
3. Levantar `packages/ui` (tokens + 2 temas) e `packages/config` (base + pt-PT).
4. Implementar busca global (FTS) e página de cartão (read‑only).
5. Validar com a Lili os campos finais e ativar Modo Editor (draft → publish).
