import { readFile } from "node:fs/promises";

// These are the user-approved SVGs, including their scale and translation.
// Keep the app's public/assets and native icons independent of the website.
const sources = Object.fromEntries(
  await Promise.all(
    ["dark", "light"].map(async (tile) => [
      tile,
      await readFile(
        new URL(`../assets/brand/notex-${tile}.svg`, import.meta.url),
        "utf8",
      ),
    ]),
  ),
);

function contents(source) {
  const match = source.match(/<svg\b[^>]*>([\s\S]*?)<\/svg>/);
  if (!match) throw new Error("Invalid approved NoteX SVG");
  return match[1].replace(/<title\b[^>]*>[\s\S]*?<\/title>/, "").trim();
}

export function brandMark({
  size = 32,
  theme = "light",
  standalone = false,
  adaptive = false,
} = {}) {
  // Site light theme uses the dark tile, and site dark theme the light tile.
  const source = sources[theme === "dark" ? "light" : "dark"];
  if (standalone && !adaptive) return source;
  const tileClass = standalone ? "tile" : "mark-tile";
  const letterClass = standalone ? "letter" : "mark-letter";
  const body = contents(source)
    .replace(/<rect\b/, `<rect class="${tileClass}"`)
    .replace(/<path\b/g, `<path class="${letterClass}"`);
  const style = adaptive
    ? "<style>.tile{fill:#151b26}.letter{fill:#ffffff}@media(prefers-color-scheme:dark){.tile{fill:#ffffff}.letter{fill:#151b26}}</style>"
    : "";
  return `<svg ${standalone ? 'xmlns="http://www.w3.org/2000/svg"' : 'class="brand-mark" aria-hidden="true"'} viewBox="0 0 256 256" width="${size}" height="${size}" fill="none">${standalone ? "<title>NoteX</title>" : ""}${style}${body}</svg>`;
}
