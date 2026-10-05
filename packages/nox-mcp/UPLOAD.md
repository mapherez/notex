# Enviar para o teu repo

O repo independente recebe **o conteúdo** desta pasta na sua raiz. Inclui
`typescript/`, `rust/`, `go/`, `contracts/`, `conformance/`, `scripts/`, `.github/`,
`.gitignore`, `LICENSE` e a documentação. Não copies `node_modules/`, `dist/`,
`target/` nem o `.git` do NoteX.

No repo NoteX, a exportação pode ser criada com:

```powershell
node packages/nox-mcp/scripts/export.mjs output/nox-mcp
```

O script exige um destino novo e não apaga ficheiros existentes. A pasta exportada
é a raiz pronta a copiar para o clone do teu repo preparado. Inclui os ficheiros
ocultos `.github` e `.gitignore`.

O caminho `github.com/mapherez/mcp` nos exemplos e metadados é um valor inicial.
Depois de copiar, configura o endereço real **na raiz do novo repo**:

```powershell
node scripts/configure-repository.mjs https://github.com/TEU_OWNER/TEU_REPO
```

Isto ajusta o módulo/imports Go, os metadados npm/Cargo e os exemplos da
documentação. Não liga ao GitHub nem altera os remotes do Git. O caminho Go tem de
corresponder ao endereço publicado; os nomes `@nox/mcp` e `nox-mcp` mantêm-se.

Dentro do clone preparado, depois de rever os ficheiros:

```powershell
git add .
git commit -m "Add reusable NoX MCP libraries"
git push
```

Se o repo ainda não estiver clonado, faz primeiro `git clone <URL_DO_TEU_REPO>`.
Copiar ou fazer push do código não publica automaticamente os packages.

Para publicar a versão inicial:

1. Deixa passar o workflow **NoX MCP conformity** no novo repo.
2. Configura os secrets `NPM_TOKEN` e `CARGO_REGISTRY_TOKEN`, com acesso aos nomes
   dos packages, e executa **Publish NoX MCP** manualmente. O workflow espera pela
   conformidade das três linguagens antes de publicar.
3. Publica a tag do submódulo Go:

```powershell
git tag go/v0.1.0
git push origin go/v0.1.0
```

Depois podes instalar `@nox/mcp`, `nox-mcp` e o módulo Go nas apps. O NoteX usa
dependências locais durante a migração; troca-as por versões publicadas quando a
release estiver disponível. Os consumidores Go/Rust não precisam de Node.
