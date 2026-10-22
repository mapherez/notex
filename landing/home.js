const screenButtons = [...document.querySelectorAll("[data-screen]")];
function activateScreen(button) {
  for (const tab of screenButtons) {
    const active = tab === button;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    const panel = document.getElementById(tab.getAttribute("aria-controls"));
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  }
}
screenButtons.forEach((button, index) => {
  button.addEventListener("click", () => activateScreen(button));
  button.addEventListener("keydown", (event) => {
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % screenButtons.length;
    else if (event.key === "ArrowLeft")
      next = (index + screenButtons.length - 1) % screenButtons.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = screenButtons.length - 1;
    else return;
    event.preventDefault();
    activateScreen(screenButtons[next]);
    screenButtons[next].focus();
  });
});
activateScreen(screenButtons[0]);
