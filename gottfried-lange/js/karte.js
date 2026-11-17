// Google-Karte erst laden, wenn jemand auf "Karte laden" klickt.
// Vorher werden keine Daten an Google übertragen.
document.addEventListener("DOMContentLoaded", function () {
  var box = document.querySelector(".map[data-map-src]");
  if (!box) return;
  var button = box.querySelector(".map-load");
  if (!button) return;

  button.addEventListener("click", function () {
    var iframe = document.createElement("iframe");
    iframe.src = box.getAttribute("data-map-src");
    iframe.title = "Karte: Gottfried Lange GmbH, Further Str. 79, 41462 Neuss";
    iframe.loading = "lazy";
    iframe.referrerPolicy = "no-referrer-when-downgrade";
    box.innerHTML = "";
    box.appendChild(iframe);
  });
});
