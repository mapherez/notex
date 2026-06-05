# Themes Audit

## Estado

- Estado: Visto
- Data: 2026-06-05
- Ficheiros analisados:
  - `src/styles/themes/_dark.scss`
  - `src/styles/themes/_light.scss`
  - `src/styles/themes/_index.scss`
  - `src/styles/abstracts/_variables.scss`
  - `src/config/settings.json`
  - `src/config/appSettings.ts`
  - `src/core/theme/themeRegistry.ts`
  - `src/App.tsx`
  - restantes SCSS via pesquisa de tokens e cores hardcoded

## Findings

- O sistema atual de theme funciona via CSS variables:
  - `:root` recebe `$base-tokens`.
  - `[data-theme="dark"]` recebe `dark.$theme`.
  - `[data-theme="light"]` recebe `light.$theme`.
  - `App.tsx` aplica `document.documentElement.dataset.theme = settings.theme`.
- Cada theme tem 15 tokens:
  - `color-canvas`
  - `color-canvas-muted`
  - `color-sidebar`
  - `color-surface`
  - `color-surface-elevated`
  - `color-surface-subtle`
  - `color-border`
  - `color-border-strong`
  - `color-text`
  - `color-text-muted`
  - `color-text-soft`
  - `color-input`
  - `color-chip`
  - `color-chip-solid`
  - `color-hover`
- Os themes dark/light têm a mesma estrutura de keys. Isto e bom para adicionar themes sem quebrar tokens existentes.
- Os tokens de surface/text/border estao a ser bastante usados. Os mais frequentes no SCSS sao:
  - `--nx-color-border`: 114
  - `--nx-color-text-muted`: 88
  - `--nx-color-text`: 87
  - `--nx-color-accent`: 48
  - `--nx-color-surface-elevated`: 32
  - `--nx-color-hover`: 32
  - `--nx-color-surface`: 31
  - `--nx-color-input`: 24
  - `--nx-color-border-strong`: 23
- `color-chip` e `color-chip-solid` existem em ambos os themes, mas nao estao a ser usados fora dos ficheiros de theme.
- `color-accent`, `color-accent-strong`, `color-accent-soft`, semantic status colors e a palette de tag colors estao em `_variables.scss`, nao nos themes.
- Isto significa que trocar dark/light altera surfaces/text/borders, mas nao altera accent nem palette.
- Para futuro suporte a accents, o sistema ainda nao esta separado. Hoje accent e theme vivem no mesmo namespace `--nx-color-*`, mas accent nao tem selector proprio tipo `[data-accent="..."]`.
- `$palette-colors` e usado por loops Sass em:
  - `layout/_shell.scss`
  - `components/_color-picker.scss`
  - `components/_editor.scss`
  - `pages/_dashboard.scss`
  - `pages/_note-detail.scss`
- Fora de `_variables.scss`, os palette tokens aparecem diretamente sobretudo como defaults (`neutral`, `blue`). A maioria das cores de tags/collections e gerada via classes criadas pelos loops.
- Existem 54 ocorrencias de cores diretas fora de `_variables.scss` e dos theme files.
- Os ficheiros com mais cores diretas fora de variables/themes sao:
  - `components/_notes.scss`: 27
  - `layout/_shell.scss`: 11
  - `pages/_profile.scss`: 5
  - `components/_labels.scss`: 3
  - `pages/_note-detail.scss`: 2
  - `pages/_dashboard.scss`: 2
- Muitas cores hardcoded em `components/_notes.scss` sao decorativas para thumbnail variants (`purple`, `paper`, `terminal`, `landscape`, `book`, `text`). Essas podem continuar hardcoded se forem tratadas como artwork, nao como UI theme.
- Algumas cores hardcoded parecem UI/system e deviam virar tokens ou aliases:
  - `#fff` para texto inverse/on-accent.
  - overlay/backdrop values como `rgba(0, 0, 0, 0.48)` e `rgba(0, 0, 0, 0.56)`.
  - chip fallback colors como `#f4f5f7`, `#f8f9fb`, `#101216`, `rgba(7, 8, 10, 0.12)`.
  - brand/logo gradient colors.
  - shadows locais em `note-detail`.
- O chip system ainda esta muito preso a fundos claros:
  - `background: color-mix(in srgb, var(--nx-chip-hue) 72%, #f4f5f7)`
  - `color: color-mix(in srgb, var(--nx-chip-hue) 46%, #101216)`
  Isto pode funcionar visualmente hoje, mas limita themes futuros que precisem de outra base de mistura.
- `settings.json` define apenas `dark` e `light`, mas o SCSS precisa de selectors correspondentes em `_index.scss`. Adicionar um theme novo exige:
  - adicionar theme SCSS;
  - importar em `_index.scss`;
  - criar selector `[data-theme="..."]`;
  - adicionar o item em `settings.json`;
  - garantir translations do label.
- `themeRegistry.ts` limita icons a `'moon' | 'sun'`. Isto chega para dark/light, mas nao para varios themes futuros sem alterar o type.

## Recomendacoes

- Manter os tokens atuais de theme como base. A separacao entre base tokens e theme tokens esta correta.
- Remover ou usar `color-chip` e `color-chip-solid`. Como ja existem nos themes, o melhor e usa-los nos chips em vez dos hardcoded fallbacks.
- Adicionar alguns tokens de theme antes de criar themes novos:

```scss
"color-text-inverse": #fff,
"color-backdrop": rgba(...),
"color-overlay": rgba(...),
"color-chip-border": ...,
"color-chip-bg": ...,
"color-chip-bg-hover": ...,
"color-chip-text": ...,
"color-brand-start": ...,
"color-brand-end": ...,
"shadow-popover": ...,
"shadow-floating": ...,
```

- Separar accent de theme quando for altura de adicionar accents:

```scss
[data-accent="blue"] {
  --nx-color-accent: ...;
  --nx-color-accent-strong: ...;
  --nx-color-accent-soft: ...;
}
```

- Nao mover automaticamente toda a palette para dark/light. Primeiro decidir se tag/collection colors devem:
  - manter a mesma identidade em todos os themes;
  - ou ter variantes por theme para contraste melhor.
- Se a palette continuar global, criar pelo menos tokens de chip base por theme para evitar misturar tag hue com `#f4f5f7`/`#101216` em todos os themes.
- Tratar thumbnail variant colors como artwork. Podem ficar hardcoded, mas devem ficar isoladas e documentadas como assets visuais, nao como UI tokens.
- Trocar `#fff` por `var(--nx-color-text-inverse)` quando for UI text em cima de accent/brand/status.
- Trocar backdrops hardcoded por `var(--nx-color-backdrop)` ou `var(--nx-color-overlay-backdrop)`.
- Rever `themeRegistry.ts` antes de adicionar themes alem de dark/light:
  - permitir mais icon names;
  - ou separar o icon do theme switcher do conceito de theme atual.
- A ordem recomendada para implementar:
  - criar tokens missing simples (`text-inverse`, `backdrop`, chip base);
  - migrar chips e overlays;
  - separar accent com um novo selector;
  - so depois adicionar themes/accent variants.

## Risco

- Medio.
- Themes tocam quase toda a UI. Pequenas mudancas em surface/text/border podem alterar contraste em muitos componentes.
- Migrar chips tem risco medio porque tags/collections aparecem em list view, grid view, detail, filters e imports.
- Migrar thumbnails para tokens tem baixo retorno se forem apenas arte decorativa; melhor nao misturar com theme cleanup agora.
- Separar accents e themes e uma mudanca estrutural. Deve ser feita depois de estabilizar os tokens base.

## Proxima Acao

- Avancar para `Audit/07_components_styles_audit.md`.
- Antes de implementar:
  - decidir se `color-chip`/`color-chip-solid` passam a ser usados;
  - decidir quais hardcoded colors sao artwork e quais sao UI tokens;
  - decidir se accents ficam em `[data-accent]` separado ou continuam no theme por agora.
