# NoteX mark

The mark is a custom vector N, with a separate lavender dot. It uses a 64 × 64
grid, a 17-unit corner radius, and a path rather than a font glyph. It stays
sharp at any scale and does not depend on a font download.

- `assets/notex-mark.svg`: follows the embedding color scheme.
- `assets/notex-mark-light.svg`: dark tile and light N, for light surfaces.
- `assets/notex-mark-dark.svg`: light tile and dark N, for dark surfaces.
- `assets/notex-mark-512.png`: fixed version for social previews.
- `assets/favicon.ico`: small-size fallback for older browsers.
- `assets/apple-touch-icon.png`: fixed home-screen icon.

The lavender dot remains `#8f9bf2` in both variants. Keep the same geometry,
padding and dot position in every export. Inline marks use the site theme
tokens, so manual theme overrides are reflected immediately. The favicon
also switches explicitly with the site preference.

The desktop/web app's sidebar and titlebar are dark in both app themes, so
they use the light-tile variant. Native desktop icons use a fixed dark tile
with a fine light outline: operating systems do not swap application icons
when the website theme changes.

Regenerate the native app icons with `npm run tauri:icon`. The source is
`public/assets/notex-mark-native.svg`; the matching web SVGs are in
`public/assets/` and `landing/assets/`.
