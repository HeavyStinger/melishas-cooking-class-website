const menu = document.getElementById("menu");

// Same-page links don't dismiss a popover on their own
menu.addEventListener("click", (event) => {
  if (event.target.closest("a") && menu.matches(":popover-open")) {
    menu.hidePopover();
  }
});
