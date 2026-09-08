# Plano de Implementação do Modal Base do NoteX

## Estado

- Plano aprovado conceptualmente em 2026-09-08.
- Fases 1, 2 e 3 implementadas em 2026-09-08.
- Todos os dialogs da aplicação usam `AppModal`; não permanecem backdrops ou listeners de Escape duplicados.
- Privacy e Terms são modais globais em PT/EN, controlados por `?modal=privacy|terms` sem desmontar a rota atual.
- As rotas antigas `/privacy` e `/terms` redirecionam para os novos URLs internos.
- O teste focado do `AppModal`, `npm run check:styles` e `npm run build` foram concluídos sem erros.
- Fase 4 tecnicamente concluída. A inspeção visual manual em dark/light e desktop/mobile continua pendente porque não havia browser disponível na sessão de implementação.
- Este trabalho não altera MCP, stores, SQLite, import/export ou conteúdo das notas.

## Objetivo

Criar um único componente estrutural para todos os modais da aplicação. O componente fornece o backdrop, a superfície visual e o comportamento comum, mas não define a largura, altura ou conteúdo funcional de cada modal.

Todos os modais devem:

- usar o mesmo backdrop e superfície visual;
- apresentar um botão `X` no canto superior direito;
- fechar com `Escape` quando o fecho for permitido;
- restaurar o foco no controlo que abriu o modal;
- impedir interação incoerente com a página por trás;
- respeitar os limites do viewport;
- manter conteúdo, ações e dimensões definidos pelo componente específico.

## Componente Base

Criar `src/components/ui/AppModal.tsx` com uma API próxima de:

```tsx
<AppModal
  open={open}
  onClose={onClose}
  labelledBy="modal-title"
  className="feature-modal"
  dismissible={!operationInProgress}
>
  {children}
</AppModal>
```

Responsabilidades do `AppModal`:

- renderizar o backdrop e a superfície através de um portal para `document.body`;
- aplicar `role="dialog"`, `aria-modal="true"` e `aria-labelledby`;
- renderizar sempre o botão `X` comum com o ícone Lucide `X`;
- chamar `onClose` através do `X` ou de `Escape`;
- manter o botão `X` visível mas desativado quando `dismissible=false`;
- ignorar `Escape` quando `dismissible=false`;
- não fechar ao clicar no backdrop;
- mover o foco para o modal quando abre;
- reter a navegação por Tab dentro do modal;
- devolver o foco ao elemento anterior quando fecha;
- impedir que atalhos da página por trás sejam acionados a partir do modal;
- permitir fecho programático pelo componente funcional após sucesso ou cancelamento controlado.

O componente base não terá `width`, `height`, variantes de tamanho ou layouts de footer. Pode aplicar apenas limites derivados do viewport para impedir overflow fora da janela.

## Estilos

Manter em `src/styles/components/_modals.scss`:

- `.modal-backdrop`: posicionamento, cor e z-index comuns;
- `.app-modal`: posição relativa, border, radius, background e shadow comuns;
- `.app-modal__close`: posição e comportamento do botão `X`;
- estilos comuns de foco e estado disabled.

Cada feature mantém a sua classe para dimensões e layout, por exemplo:

- `.delete-confirm-modal`;
- `.shortcut-help-modal`;
- `.patch-notes-modal`;
- `.mcp-configuration-modal`;
- `.legal-modal`.

O estilo atual de `.choice-modal` deve ser separado: superfície comum passa para `.app-modal`; grid, gap, padding e largura compacta ficam numa classe de conteúdo usada apenas pelos modais que precisam desse layout.

## Política de Fecho

- Modais informativos e confirmações: `X` ativo e `Escape` ativo.
- O `X` de uma confirmação equivale a cancelar; ações Yes/No ou equivalentes permanecem no conteúdo.
- Botões cuja única função seja `Close` podem ser removidos quando forem redundantes com o `X`.
- Import/export ou outra operação não interrompível: `dismissible=false`, `X` visível mas disabled e `Escape` ignorado.
- Assim que a operação deixar de ser crítica, o modal volta a permitir fecho.
- O backdrop nunca fecha o modal nesta implementação, preservando uma regra única e previsível.

## Inventário de Migração

Migrar as 11 estruturas atuais para `AppModal`:

1. Confirmação de nova nota em `AppShell`.
2. `DeleteConfirmModal`, já reutilizado em notas e tags.
3. Confirmação de exportação de nota.
4. Confirmação de ações do lixo.
5. Exportação da base de dados no Profile.
6. Escolha do tipo de importação no Profile.
7. Confirmação/progresso de importação da base no Profile.
8. Resumo de importação de nota no Profile.
9. Ajuda de atalhos no Profile.
10. Configuração MCP.
11. Patch notes.

Durante a migração devem ser removidos:

- backdrops duplicados;
- `role`, `aria-modal` e listeners de Escape duplicados;
- botões `X` locais;
- botões `Close` redundantes;
- estilos de superfície repetidos.

Os componentes funcionais continuam a controlar o seu estado e as suas ações. Os modais do Profile continuam a existir apenas enquanto o Profile está montado.

## Privacy e Terms

### URL interno

Privacy e Terms passam a ser modais globais controlados pelo query parameter `modal`:

```text
/notes/XYZ?modal=terms
/notes/XYZ?modal=privacy
/notes?collection=receitas&modal=terms
```

Regras:

- abrir o modal adiciona `modal=terms` ou `modal=privacy` sem alterar o pathname;
- parâmetros existentes como `collection`, `tag` e `sort` são preservados;
- a página atual permanece montada por trás do modal;
- fechar remove apenas o parâmetro `modal`;
- navegação Back fecha o modal e regressa ao URL anterior;
- valores de `modal` desconhecidos são ignorados;
- as rotas antigas `/privacy` e `/terms` redirecionam para `/?modal=privacy` e `/?modal=terms` para preservar compatibilidade interna.

O host global do modal legal deve ficar em `AppShell`, porque a sidebar e o conteúdo da rota já vivem nesse nível.

### Conteúdo e i18n

Extrair o conteúdo hardcoded de `LegalPage.tsx` para os ficheiros:

- `src/locales/pt.json`;
- `src/locales/en.json`.

Estrutura prevista:

```json
{
  "legal": {
    "privacy": {
      "title": "...",
      "paragraphs": ["...", "..."]
    },
    "terms": {
      "title": "...",
      "paragraphs": ["...", "..."]
    }
  }
}
```

Usar `raw<string[]>()` para ler os parágrafos e `t()` para títulos e labels. A versão portuguesa deve traduzir todo o conteúdo atualmente disponível em inglês. A adequação jurídica do texto continua a exigir revisão própria; este trabalho garante apenas consistência funcional e linguística.

Uma rota interna Tauri não é uma página pública acessível pela Internet. Privacy e Terms públicos para um futuro Google OAuth/backend remoto continuam a ser um requisito separado.

## Fases

### Fase 1 — Primitive e modais simples

- Criar `AppModal` e estilos base.
- Cobrir X, Escape, estado não dismissível, foco e backdrop.
- Migrar nova nota, delete, exportação de nota e lixo.
- Preservar dimensões e ações atuais.

Critério de saída: os modais simples usam uma única estrutura e mantêm o comportamento funcional existente.

### Fase 2 — Profile e modais complexos

- Migrar os cinco modais do Profile.
- Bloquear fecho nas fases críticas de import/export.
- Migrar configuração MCP e patch notes.
- Remover listeners e close buttons duplicados.

Critério de saída: não permanece nenhuma implementação manual de backdrop/dialog nos componentes de feature.

### Fase 3 — Privacy e Terms globais

- Adicionar conteúdo PT/EN aos locales.
- Criar `LegalModal` sobre `AppModal`.
- Alterar os links da sidebar para preservar pathname e search params.
- Adicionar o host global em `AppShell`.
- Converter as rotas antigas em redirects internos.
- Remover estilos e componente de página que deixarem de ser usados.

Critério de saída: Privacy e Terms abrem sobre qualquer página sem desmontar o conteúdo existente.

### Fase 4 — Validação e limpeza

- Confirmar todos os modais em PT/EN, dark/light e desktop/mobile.
- Confirmar X, Escape, foco, Tab, retorno de foco e backdrop.
- Confirmar `dismissible=false` durante import/export.
- Confirmar URL, Back e preservação de filtros e nota atual.
- Executar typecheck, styles e build.
- Remover CSS e imports mortos.

Critério de saída: comportamento e aparência uniformes, sem regressões funcionais ou duplicação estrutural.

## Fora do Âmbito

- Alterar fluxos de import/export.
- Alterar o conteúdo funcional das patch notes ou do MCP.
- Transformar dropdowns, color pickers, file pickers nativos ou o update banner em modais.
- Criar URLs públicas para Google OAuth.
- Definir tamanhos globais para todos os modais.

## Decisões Fechadas

- Existe um único componente estrutural `AppModal`.
- O conteúdo é sempre injetado pelo componente funcional.
- A base não define largura nem altura.
- Todos os modais apresentam `X` e suportam Escape quando dismissíveis.
- Em operações não interrompíveis, o `X` permanece visível mas disabled e Escape não fecha.
- O backdrop não fecha modais.
- Privacy e Terms são globais e usam `?modal=privacy|terms`.
- Privacy e Terms passam a ter conteúdo em PT e EN nos ficheiros de locale.
