export function formatShortcutForDisplay(shortcut: string) {
  return shortcut
    .split("+")
    .map((part) => {
      const token = part.trim();
      const normalized = token.toLowerCase();

      if (normalized === "mod") {
        return "Ctrl / ⌘";
      }
      if (normalized === "alt") {
        return "Alt";
      }
      if (normalized === "shift") {
        return "Shift";
      }
      if (normalized === "arrowleft") {
        return "←";
      }
      if (normalized === "arrowup") {
        return "↑";
      }
      if (normalized === "arrowright") {
        return "→";
      }
      if (normalized === "arrowdown") {
        return "↓";
      }

      return token.length === 1 ? token.toUpperCase() : token;
    })
    .join(" + ");
}
