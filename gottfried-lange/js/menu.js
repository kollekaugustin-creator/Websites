// Kopfzeile: ausklappbares Menü fürs Handy und heller Hintergrund beim Scrollen.
// Ohne JavaScript bleibt das Menü einfach immer sichtbar.
document.documentElement.classList.add("js");

document.addEventListener("DOMContentLoaded", function () {
  var header = document.querySelector(".site-header");
  var button = document.querySelector(".menu-toggle");
  var nav = document.getElementById("hauptmenue");

  // Beim Scrollen bekommt die Kopfzeile einen durchscheinenden Hintergrund
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 40);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  if (!button || !nav) return;
  button.hidden = false;

  function setOpen(open) {
    nav.classList.toggle("is-open", open);
    button.setAttribute("aria-expanded", open ? "true" : "false");
    button.textContent = open ? "Schließen" : "Menü";
  }

  button.addEventListener("click", function () {
    setOpen(button.getAttribute("aria-expanded") !== "true");
  });

  // Mit der Escape-Taste schließen und zurück zum Menü-Button
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && nav.classList.contains("is-open")) {
      setOpen(false);
      button.focus();
    }
  });
});
