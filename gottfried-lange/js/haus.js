// Das Lange-Haus im Hero der Startseite (vereinfachte Fassung).
// Ein Raum färbt sich ein, wenn man mit der Maus darüberfährt, ihn antippt,
// mit der Tastatur auswählt oder einen der vier Raum-Buttons drückt.
// Immer nur ein Raum gleichzeitig; dazu erscheint eine kurze Karte mit Link.
// Ohne JavaScript: das Haus als ruhige Zeichnung, darunter die Leistungs-Karten.
(function () {
  "use strict";
  var root = document.querySelector(".hero-haus");
  if (!root || !window.SVGElement) return;
  var svg = root.querySelector(".haus-svg"), bereich = root.querySelector(".raum-bereich");
  var flaechen = Array.prototype.slice.call(svg.querySelectorAll(".raum"));
  var knoepfe = Array.prototype.slice.call(root.querySelectorAll(".raum-knopf"));
  var karten = Array.prototype.slice.call(root.querySelectorAll(".raum-karte"));
  var gewaehlt = null;   // angetippter / angeklickter Raum (bleibt stehen)

  // Mit JavaScript: Raum-Auswahl zeigen, die alten Leistungs-Karten ersetzt sie
  bereich.hidden = false;
  var alt = document.querySelector(".leistungen-ohne-js");
  if (alt) alt.hidden = true;

  // Nur die Farbe im Haus (beim Darüberfahren)
  function faerben(id) {
    if (id) svg.setAttribute("data-aktiv", id); else svg.removeAttribute("data-aktiv");
  }
  // Raum fest auswählen: Farbe, Button, Karte
  function waehlen(id) {
    gewaehlt = gewaehlt === id ? null : id;
    faerben(gewaehlt);
    knoepfe.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-raum") === gewaehlt)); });
    flaechen.forEach(function (f) { f.setAttribute("aria-pressed", String(f.getAttribute("data-raum") === gewaehlt)); });
    karten.forEach(function (k) { k.hidden = k.getAttribute("data-raum") !== gewaehlt; });
  }

  knoepfe.forEach(function (b) {
    var id = b.getAttribute("data-raum");
    b.addEventListener("click", function () { waehlen(id); });
    b.addEventListener("mouseenter", function () { faerben(id); });
    b.addEventListener("mouseleave", function () { faerben(gewaehlt); });
  });
  flaechen.forEach(function (f) {
    var id = f.getAttribute("data-raum");
    f.setAttribute("aria-pressed", "false");
    f.addEventListener("click", function () { waehlen(id); });
    f.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); waehlen(id); }
    });
    f.addEventListener("mouseenter", function () { faerben(id); });
    f.addEventListener("mouseleave", function () { faerben(gewaehlt); });
    f.addEventListener("focus", function () { faerben(id); });
    f.addEventListener("blur", function () { faerben(gewaehlt); });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && gewaehlt) waehlen(gewaehlt);
  });
})();
