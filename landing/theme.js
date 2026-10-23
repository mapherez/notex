// Resolve the theme before paint. The same preference is used on every site page.
(() => {
  const key = "notex-site-theme";
  const system = matchMedia("(prefers-color-scheme: dark)");
  const names = { system: "System", light: "Light", dark: "Dark" };
  let preference = "system";
  let refreshPicker = () => {};
  try {
    const stored = localStorage.getItem(key);
    if (stored === "light" || stored === "dark") preference = stored;
  } catch {
    /* Keep themes usable if browser storage is blocked. */
  }

  function apply() {
    const theme =
      preference === "system"
        ? system.matches
          ? "dark"
          : "light"
        : preference;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.themePreference = preference;
    document
      .querySelector('meta[name="color-scheme"]')
      ?.setAttribute("content", theme);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#0c1019" : "#f7f8fc");
    const favicon = document.querySelector(
      'link[rel="icon"][type="image/svg+xml"]',
    );
    const themeIcon = favicon?.getAttribute(`data-icon-${theme}`);
    if (themeIcon) favicon.setAttribute("href", themeIcon);
    refreshPicker();
  }
  apply();
  system.addEventListener("change", apply);
  window.addEventListener("storage", (event) => {
    if (event.key !== key && event.key !== null) return;
    preference =
      event.newValue === "light" || event.newValue === "dark"
        ? event.newValue
        : "system";
    apply();
  });

  document.addEventListener("DOMContentLoaded", () => {
    const control = document.querySelector("[data-theme-control]");
    const trigger = document.querySelector("[data-theme-trigger]");
    const panel = document.querySelector("[data-theme-panel]");
    if (!control || !trigger || !panel) return;
    const options = [...panel.querySelectorAll("[data-theme-value]")];
    // Native popovers provide the top layer and outside dismissal. A small manual
    // disclosure preserves the same behavior in browsers without the API.
    const nativePopover = "popover" in HTMLElement.prototype;
    if (nativePopover) {
      panel.setAttribute("popover", "auto");
      panel.hidden = false;
    }
    let opened = false;
    function position() {
      const rect = trigger.getBoundingClientRect();
      const width = panel.offsetWidth;
      const height = panel.offsetHeight;
      panel.style.left = `${Math.max(12, Math.min(rect.right - width, innerWidth - width - 12))}px`;
      panel.style.top = `${Math.max(12, rect.bottom + height + 8 > innerHeight - 12 ? rect.top - height - 8 : rect.bottom + 8)}px`;
    }
    function close(returnFocus = false) {
      if (!opened) return;
      if (nativePopover) panel.hidePopover();
      else panel.hidden = true;
      opened = false;
      trigger.setAttribute("aria-expanded", "false");
      if (returnFocus) trigger.focus();
    }
    function open() {
      document.dispatchEvent(new Event("site-theme-open"));
      if (nativePopover) panel.showPopover();
      else panel.hidden = false;
      opened = true;
      trigger.setAttribute("aria-expanded", "true");
      position();
      options
        .find((option) => option.dataset.themeValue === preference)
        ?.focus();
    }
    refreshPicker = () => {
      trigger.setAttribute("aria-label", `Color theme: ${names[preference]}`);
      trigger.title = `Color theme: ${names[preference]}`;
      for (const option of options)
        option.setAttribute(
          "aria-pressed",
          String(option.dataset.themeValue === preference),
        );
      const currentIcon = options
        .find((option) => option.dataset.themeValue === preference)
        .querySelector("svg");
      trigger
        .querySelector("[data-theme-icon]")
        .replaceChildren(currentIcon.cloneNode(true));
    };
    trigger.addEventListener("click", () => (opened ? close() : open()));
    trigger.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (!opened) open();
      }
    });
    options.forEach((option) =>
      option.addEventListener("click", () => {
        preference = option.dataset.themeValue;
        try {
          if (preference === "system") localStorage.removeItem(key);
          else localStorage.setItem(key, preference);
        } catch {
          /* Retain the in-memory preference for this page. */
        }
        apply();
        close(true);
      }),
    );
    panel.addEventListener("keydown", (event) => {
      const index = options.indexOf(document.activeElement);
      let next;
      if (event.key === "ArrowDown") next = (index + 1) % options.length;
      else if (event.key === "ArrowUp")
        next = (index + options.length - 1) % options.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = options.length - 1;
      else return;
      event.preventDefault();
      options[next].focus();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && opened) {
        event.preventDefault();
        close(true);
      }
    });
    document.addEventListener("pointerdown", (event) => {
      if (!nativePopover && !control.contains(event.target)) close();
    });
    document.addEventListener("focusin", (event) => {
      if (opened && !control.contains(event.target)) close();
    });
    panel.addEventListener("toggle", (event) => {
      opened = event.newState === "open";
      trigger.setAttribute("aria-expanded", String(opened));
    });
    document.addEventListener("site-navigation-open", () => close());
    window.addEventListener("resize", () => {
      if (opened) position();
    });
    window.addEventListener(
      "scroll",
      () => {
        if (opened) position();
      },
      true,
    );
    control.hidden = false;
    apply();
  });
})();
