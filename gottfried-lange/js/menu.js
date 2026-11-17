// Ausklappbares Menü fürs Handy.
// Ohne JavaScript bleibt das Menü einfach immer sichtbar.
document.documentElement.classList.add("js");

document.addEventListener("DOMContentLoaded", function () {
  var button = document.querySelector(".menu-toggle");
  var nav = document.getElementById("hauptmenue");
  if (!button || !nav) return;

  var label = button.querySelector(".menu-toggle-label");
  button.hidden = false;

  function setOpen(open) {
    nav.classList.toggle("is-open", open);
    button.setAttribute("aria-expanded", open ? "true" : "false");
    if (label) label.textContent = open ? "Schließen" : "Menü";
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
