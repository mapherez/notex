// iPadOS can report a desktop-sized viewport and a Mac user agent, including
// when a trackpad is connected. Keep installer links out of mobile browsers.
const mobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  || navigator.userAgentData?.mobile === true;
document.documentElement.toggleAttribute("data-mobile-device", mobileDevice);

const header = document.querySelector("[data-site-header]");
const menu = document.querySelector("[data-site-menu]");
const nav = document.getElementById("site-navigation");
const narrow = matchMedia("(max-width: 800px)");

function closeNavigation(returnFocus = false) {
  header.removeAttribute("data-navigation-open");
  menu.setAttribute("aria-expanded", "false");
  menu.setAttribute("aria-label", "Open navigation");
  if (returnFocus) menu.focus();
}

header.setAttribute("data-navigation-ready", "");
menu.hidden = false;
menu.addEventListener("click", () => {
  if (header.hasAttribute("data-navigation-open")) closeNavigation();
  else {
    document.dispatchEvent(new Event("site-navigation-open"));
    header.setAttribute("data-navigation-open", "");
    menu.setAttribute("aria-expanded", "true");
    menu.setAttribute("aria-label", "Close navigation");
    nav.querySelector("a")?.focus({ preventScroll: true });
  }
});
nav
  .querySelectorAll("a")
  .forEach((link) => link.addEventListener("click", () => closeNavigation()));
document.addEventListener("click", (event) => {
  if (!header.contains(event.target)) closeNavigation();
});
document.addEventListener("focusin", (event) => {
  if (!header.contains(event.target)) closeNavigation();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && header.hasAttribute("data-navigation-open")) {
    event.preventDefault();
    closeNavigation(true);
  }
});
document.addEventListener("site-theme-open", () => closeNavigation());
narrow.addEventListener("change", () => closeNavigation());
