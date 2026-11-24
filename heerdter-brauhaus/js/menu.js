// Bedienung: ausklappbares Menü fürs Handy und Karte erst nach Klick laden.
// Ohne JavaScript bleibt das Menü einfach immer sichtbar.
document.documentElement.classList.add("js");

document.addEventListener("DOMContentLoaded", function () {
  // ---------- Handy-Menü ----------
  var button = document.querySelector(".menu-toggle");
  var nav = document.getElementById("hauptmenue");

  if (button && nav) {
    button.hidden = false;
    var label = button.querySelector(".menu-toggle-label");

    var setOpen = function (open) {
      nav.classList.toggle("is-open", open);
      button.setAttribute("aria-expanded", open ? "true" : "false");
      if (label) label.textContent = open ? "Schließen" : "Menü";
    };

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
  }

  // ---------- Karte (Zwei-Klick-Lösung) ----------
  // Google Maps wird erst geladen, wenn jemand auf „Karte laden“ klickt.
  var karte = document.querySelector(".karte[data-map-src]");
  var laden = karte && karte.querySelector(".karte-laden");
  if (karte && laden) {
    laden.hidden = false;
    laden.addEventListener("click", function () {
      var iframe = document.createElement("iframe");
      iframe.src = karte.getAttribute("data-map-src");
      iframe.title = "Karte: Heerdter Brauhaus, Nikolaus-Knopp-Platz 28";
      iframe.loading = "lazy";
      iframe.referrerPolicy = "no-referrer-when-downgrade";
      karte.innerHTML = "";
      karte.appendChild(iframe);
      karte.classList.add("ist-geladen");
      iframe.focus();
    });
  }
});
