# NoteX mark

The website uses the user-approved three-tab SVGs on a 256 × 256 grid. The tile
has a 66-unit corner radius. The N and tabs retain the approved
`translate(-30 -30) scale(1.25)` transform. Each tab is 34 × 44 with radius 14,
placed at y=61, 107, and 153. The N is an outlined path, independent of fonts.
The wordmark remains Manrope with 2px letter spacing.

The exact approved originals are in `assets/brand/notex-dark.svg` and
`assets/brand/notex-light.svg`; the approved comparison is alongside them.
`scripts/brand.mjs` reads those SVGs to render the shared header/footer mark.
It changes only the accessibility wrapper and theme hooks, preserving geometry
and scale at every size. Header, footer, and product-window preview sizes are
32px, 28px, and 19px respectively. The favicon uses the same approved artwork.

- `assets/notex-mark.svg`: follows the embedding color scheme.
- `assets/notex-mark-light.svg`: dark tile and light N, for light surfaces.
- `assets/notex-mark-dark.svg`: light tile and dark N, for dark surfaces.
- `assets/notex-mark-512.png`: fixed version for social previews.
- `assets/favicon.ico`: small-size fallback for older browsers.
- `assets/apple-touch-icon.png`: fixed home-screen icon.

The three tab colors are `#bfb2ff`, `#9286ff`, and `#6968f5`, unchanged between
themes. Dark ink is `#151b26`; the light tile/letter is white. Inline marks
follow the site theme tokens, and the favicon switches with the site preference.
Asset filenames `notex-mark-light.svg` / `notex-mark-dark.svg` refer to the site
theme; the approved originals' names refer to the tile color.

The desktop/web app and native icon files remain independent of this website
revision. Do not copy this study into `public/assets/` or `src-tauri/icons/`
until the app-brand update is requested and the website mark is approved.

The app's existing `npm run tauri:icon` command continues to use its own source
in `public/assets/notex-mark-native.svg`. This website study does not update it.
