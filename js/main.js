const header = document.querySelector(".site-header");
const menu = document.getElementById("menu");

// Transparent over the hero; once the page scrolls the header turns solid and shrinks
function updateHeader() {
  header.classList.toggle("is-scrolled", window.scrollY > 24);
}

window.addEventListener("scroll", updateHeader, { passive: true });
updateHeader();

// Same-page links don't dismiss a popover on their own
menu.addEventListener("click", (event) => {
  if (event.target.closest("a") && menu.matches(":popover-open")) {
    menu.hidePopover();
  }
});
