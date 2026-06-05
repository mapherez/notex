# Typography Audit

## Estado

- Estado: Visto
- Data: 2026-06-05
- Revalidado: 2026-06-05, apos compact automatico
- Ficheiros analisados:
  - `src/styles/base/_typography.scss`
  - `src/styles/abstracts/_variables.scss`
  - `src/styles/components/_editor.scss`
  - `src/styles/components/_forms.scss`
  - `src/styles/components/_modals.scss`
  - `src/styles/layout/_shell.scss`
  - `src/styles/pages/_dashboard.scss`
  - `src/styles/pages/_note.scss`
  - `src/styles/pages/_note-detail.scss`
  - `src/styles/pages/_profile.scss`
  - Restantes SCSS via pesquisa agregada

## Revalidacao

- A pesquisa foi repetida apos o compact automatico.
- Resultado: sem divergencias face ao levantamento inicial.
- Total confirmado: 199 declaracoes tipograficas.
- Totais por propriedade:
  - `font-size`: 87
  - `font-weight`: 69
  - `line-height`: 35
  - `letter-spacing`: 8
- Contagem confirmada por ficheiro:
  - `layout/_shell.scss`: 26
  - `pages/_note-detail.scss`: 24
  - `pages/_profile.scss`: 23
  - `components/_editor.scss`: 19
  - `components/_modals.scss`: 19
  - `pages/_note.scss`: 19
  - `components/_filters.scss`: 17
  - `pages/_dashboard.scss`: 12
  - `components/_notes.scss`: 12
  - `pages/_tags.scss`: 8
  - `components/_forms.scss`: 7
  - `components/_updater.scss`: 4
  - `components/_custom-select.scss`: 3
  - `components/_labels.scss`: 2
  - `components/_loading.scss`: 2
  - `components/_menus.scss`: 1
  - `base/_typography.scss`: 1

## Findings

- `_typography.scss` praticamente nao esta a ser usado. Neste momento so contem `.page-title { letter-spacing: 0; }`.
- A definicao real de `.page-title` e `.page-subtitle` esta em `components/_forms.scss`, apesar de serem primitives de texto globais.
- Foram encontradas 199 declaracoes tipograficas espalhadas pelos SCSS (`font-size`, `font-weight`, `line-height`, `letter-spacing`).
- Os ficheiros com mais declaracoes tipograficas sao:
  - `layout/_shell.scss`: 26
  - `pages/_note-detail.scss`: 24
  - `pages/_profile.scss`: 23
  - `components/_editor.scss`: 19
  - `components/_modals.scss`: 19
  - `pages/_note.scss`: 19
  - `components/_filters.scss`: 17
- Ha varios tamanhos repetidos que ja se comportam como tokens, mas estao escritos diretamente em cada ficheiro:
  - `0.78rem`: 14 ocorrencias
  - `0.92rem`: 11 ocorrencias
  - `0.88rem`: 10 ocorrencias
  - `0.86rem`: 8 ocorrencias
  - `0.82rem`: 5 ocorrencias
  - `0.9rem`: 5 ocorrencias
  - `1.05rem`: 3 ocorrencias
  - `clamp(1.8rem, 3vw, 2.25rem)`: 3 ocorrencias
- Os pesos tipograficos tambem estao muito fragmentados:
  - `700`: 14 ocorrencias
  - `760`: 13 ocorrencias
  - `650`: 9 ocorrencias
  - `740`: 9 ocorrencias
  - `780`: 9 ocorrencias
  - `720`: 6 ocorrencias
  - `750`: 4 ocorrencias
  - `560`, `800`, `850`: ocorrencias pontuais
- Existem dois mundos diferentes que devem ser tratados separadamente:
  - UI typography: titulos de pagina, labels, descriptions, captions, botoes, rows, cards e modals.
  - Content typography: editor, markdown preview, document body, headings e tabelas dentro da nota.
- Os titulos principais nao sao todos iguais e isso faz sentido:
  - Page title: `clamp(1.65rem, 2.3vw, 2rem)`.
  - Document title: `clamp(1.8rem, 3vw, 2.25rem)`.
  - Section/panel title: `1.2rem`.
  - Modal title: `1.35rem`.
  Estes valores devem ser nomeados para evitar que parecam escolhas aleatorias.
- O padrao de uppercase micro-label existe em varios locais:
  - `font-size: 0.78rem`
  - `font-weight: 700` ou `760`
  - `letter-spacing: 0.04em`
  - `text-transform: uppercase`
  Deve ser transformado num token ou primitive.
- As line-heights tambem estao repetidas sem nomes:
  - Tight/title: `1.15`, `1.2`, `1.25`
  - Compact: `1.35`, `1.45`
  - Body: `1.55`, `1.65`
  - Reading/content: `1.7`, `1.75`
- `panel-title`, `profile-section-title`, `settings-title`, titulos de modal e alguns headings usam valores parecidos, mas cada area declara o seu estilo.
- `editor` e `note-detail` partilham varias necessidades de content typography, sobretudo line-height de leitura e headings, mas nao usam tokens comuns.
- A app ja tem uma boa base visual, mas a tipografia esta a depender de convencao manual em vez de sistema.

## Recomendacoes

- Usar `_typography.scss` como ponto central para primitives tipograficas globais.
- Mover `.page-title` e `.page-subtitle` de `_forms.scss` para `_typography.scss`.
- Criar tokens tipograficos em `_variables.scss` antes de fazer migracoes grandes:

```scss
"font-size-caption": 0.78rem,
"font-size-meta": 0.82rem,
"font-size-control": 0.86rem,
"font-size-description": 0.88rem,
"font-size-row": 0.92rem,
"font-size-body": 1rem,
"font-size-section-title": 1.2rem,
"font-size-modal-title": 1.35rem,
"font-size-page-title": clamp(1.65rem, 2.3vw, 2rem),
"font-size-document-title": clamp(1.8rem, 3vw, 2.25rem),

"font-weight-regular": 560,
"font-weight-medium": 650,
"font-weight-label": 700,
"font-weight-strong": 760,
"font-weight-heading": 780,

"line-height-tight": 1.15,
"line-height-heading": 1.25,
"line-height-compact": 1.45,
"line-height-body": 1.65,
"line-height-reading": 1.75,

"letter-spacing-label": 0.04em,
```

- Depois dos tokens existirem, migrar por areas pequenas:
  - Primeiro `Profile`, porque ja foi parcialmente limpo.
  - Depois `Dashboard`, porque ainda define primitives globais.
  - Depois `Modals`, porque a UX de import/export ja usa esse padrao.
  - Depois `Notes`, `Note detail` e `Editor`, mantendo a diferenca entre UI e content.
- Criar primitives/classes apenas quando reduzirem repeticao real:
  - `.page-title`
  - `.page-subtitle`
  - `.section-title`
  - `.eyebrow-label` ou `.meta-label`
  - `.muted-text`
- Para content typography, preferir tokens em vez de classes globais demasiado genericas:
  - `--nx-content-line-height`
  - `--nx-content-heading-weight`
  - `--nx-content-table-header-size`
- Evitar alterar tudo de uma vez. A mudanca tem impacto visual transversal e deve ser feita em commits/fases pequenos.

## Risco

- Medio.
- Centralizar tipografia pode melhorar muito a manutencao, mas tambem pode mudar subtilmente alinhamentos, alturas de cards, botaoes, modals e editor.
- O maior risco esta em misturar UI typography com content/editor typography. Esses dois grupos devem partilhar tokens base, mas nao necessariamente as mesmas classes.

## Proxima Acao

- Avancar para `Audit/04_breakpoints_audit.md`.
- Antes de implementar alteracoes, decidir se os tokens tipograficos entram primeiro em `_variables.scss` ou se tambem criamos logo primitives em `_typography.scss`.
