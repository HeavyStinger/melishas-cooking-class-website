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

// Underline the nav link for the section in view. The thin band is a line 45% down the screen:
// whichever section crosses it is the current one. Sections without a link of their own
// (like "What happens in your class") belong to the link above them.
const sections = [...document.querySelectorAll("main > section[id]")];
const navLinks = [...document.querySelectorAll('.nav-links a[href^="#"]')];

if (navLinks.length) {
  const linkFor = new Map();
  let owner = null;
  sections.forEach((section) => {
    const own = navLinks.find((link) => link.hash === `#${section.id}`);
    owner = own ?? (section.dataset.nav === "none" ? null : owner);
    linkFor.set(section, owner);
  });

  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((link) => {
          if (link === linkFor.get(entry.target)) link.setAttribute("aria-current", "true");
          else link.removeAttribute("aria-current");
        });
      });
    },
    { rootMargin: "-45% 0px -54% 0px" },
  );
  sections.forEach((section) => spy.observe(section));
}
