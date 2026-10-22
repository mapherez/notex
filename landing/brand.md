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

The desktop/web app uses the same approved geometry in `public/assets/`.
Its fixed native icon source is `public/assets/notex-icon.svg`: a white tile,
dark N, and the same three lilac tabs. `npm run tauri:icon` regenerates the
platform icons from that source. In-app marks follow the chosen app theme;
the installed desktop icon always keeps the white tile.

The app bundles Source Sans 3 (normal and italic) and Manrope, including their licenses, in
`public/assets/fonts/`. The Google sign-in confirmation embeds those fonts and
the approved icon so it can render without external font or image requests.

Source Sans 3 is used for app controls, headings, and note text. Manrope remains
reserved for the NoteX wordmark. Font files are bundled for offline use; the
website retains its own DM Sans / Manrope pairing.
