# Desenvolvimento, CI e release

O contrato é o mesmo em todos os projetos: commit/push de código → CI completo → pedido explícito de release → reutilização da aprovação → build/empacotamento/publicação.

## Uso

```sh
npm run hooks:install
# Editar, fazer commit e push do código na branch main.
# Aguardar o CI de origem, ou deixar a release aguardar pela sua conclusão.
npm run release
# Ou indicar a versão diretamente:
npm run release -- X.Y.Z
```

O script de release exige uma árvore limpa. Prepara apenas os campos de versão permitidos; alterações de código ou de dependências externas obrigam a novo CI. O pedido de release não volta a executar os testes de origem. Se a aprovação estiver pendente, o publisher aguarda; se falhar ou não existir, para antes de construir/publicar. Para recuperar, corrige ou repete o CI do commit de origem e volta a executar o workflow de release que falhou.

A aprovação pertence ao commit de origem exato; não basta existir outro CI verde no repositório.

## Hooks e verificações locais

Os hooks ficam ativos com `npm run hooks:install` e são reinstalados no prepare npm. Os frontends com instalação separada também fazem a instalação quando os scripts da raiz estão presentes. Os builds de distribuição sem esses scripts saltam esta configuração.

- Antes do commit: whitespace do stage e gofmt nos ficheiros Go do stage; os projetos com Vite+ usam vp staged, que isola e formata o stage. NoteX mantém as verificações SCSS; voice usa Ruff; PC Configurator usa as regras migradas para Vite+ e preserva os testes impactados.
- Antes do push: `npm run prepush`, com as verificações próprias da stack. Um push composto apenas pelo pedido de release é reconhecido e deixa a aprovação para o GitHub, sem repetir os checks locais.
- `npm run check`: `node scripts/git-hooks.mjs check`.
- `NOX_SKIP_HOOKS=1` permite desativar os hooks num processo local; a aprovação obrigatória no GitHub continua ativa.

## CI e distribuição

[CI](.github/workflows/ci.yml) · [Release](.github/workflows/release.yml)

Constrói os instaladores Windows x86_64 e macOS ARM64, assina o updater e publica os dois conjuntos de assets na mesma GitHub Release. Mantém os secrets de assinatura e Google já usados pelo workflow. As publicações manuais das imagens web/MCP também exigem CI aprovado.

Os builds de publicação continuam necessários para incorporar a nova versão, plataformas e assinatura. Smoke checks do artefacto final não equivalem a repetir a suite de testes de origem.


## Vite+ e formatação

Vite+ 1.6.0 para o frontend, testes e workspaces. O Stylelint mantém as regras específicas de CSS/SCSS; as duas regras de quebras de linha que conflituavam com Oxfmt foram desativadas. O bloco de compatibilidade Vitest v4 gerado pelo migrador foi removido após validar os 152 testes do frontend. O backend MCP remoto continua adiado como no workflow original: a dependência publicada @nox/mcp v0.6.1 não exporta o adaptador better-auth que esse backend exige. Os seus testes e pipeline remoto continuam separados/desativados; não foram apagados nem substituídos por testes mais fracos.

- Formatar: `npm run format`.
- Verificar formato/lint/tipos JS/TS: `npm run check:code`.
- O stage usa `vp staged` com `vp check --fix`, incluindo CSS/SCSS; o CI executa os mesmos checks.
- Oxfmt usa espaços, LF e `insertFinalNewline: true`. Ficheiros gerados, dependências e outputs ficam excluídos.
- A configuração VS Code na pasta `.` recomenda o Vite Plus Extension Pack e ativa formatação ao guardar. Instalar a extensão recomendada permite usar essa integração; os hooks funcionam pela CLI.
- Go/Rust/Python continuam com as ferramentas próprias onde se aplicam.

Os checks bloqueiam erros e problemas de formatação. Alguns projetos têm avisos de lint em código anterior, mantidos visíveis sem alterar silenciosamente o comportamento da aplicação. Documentação: [Vite+](https://viteplus.dev/guide/) · [Hooks](https://viteplus.dev/guide/commit-hooks).
