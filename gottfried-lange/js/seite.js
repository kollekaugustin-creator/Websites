// Für alle Seiten:
// 1. Rohr-Leiste: dünnes gelbes Rohr ganz oben, das sich beim Lesen füllt.
// 2. Sanfte Seitenwechsel: Moderne Browser blenden über CSS (View Transitions) über.
//    Ältere Browser bekommen hier ein kurzes Ausblenden beim Klick auf einen Link.
// Bei „Bewegung reduzieren“ gibt es keine Überblendung; die Leiste zeigt nur den Stand.
(function () {
  var ruhig = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Rohr-Leiste ---------- */
  var leiste = document.createElement("div");
  leiste.className = "rohr-leiste";
  leiste.setAttribute("aria-hidden", "true");
  leiste.innerHTML = "<span></span>";
  var fuell = leiste.firstChild, wartet = false;
  function stand() {
    wartet = false;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var f = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 1;
    fuell.style.transform = "scaleX(" + f.toFixed(4) + ")";
  }
  function anstossen() { if (!wartet) { wartet = true; requestAnimationFrame(stand); } }
  document.addEventListener("DOMContentLoaded", function () {
    document.body.appendChild(leiste);
    stand();
    window.addEventListener("scroll", anstossen, { passive: true });
    window.addEventListener("resize", anstossen);
    window.addEventListener("load", anstossen);
  });

  /* ---------- Seitenwechsel (nur Browser ohne View Transitions) ---------- */
  if (ruhig || "onpagereveal" in window) return;
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target || a.hasAttribute("download") || a.origin !== location.origin) return;
    if (!/\.html$|\/$/.test(a.pathname) || (a.pathname === location.pathname && a.hash)) return;
    e.preventDefault();
    document.documentElement.classList.add("seite-geht");
    setTimeout(function () { location.href = a.href; }, 180);
  });
  // Zurück-Taste: Seite aus dem Zwischenspeicher wieder sichtbar machen
  window.addEventListener("pageshow", function () { document.documentElement.classList.remove("seite-geht"); });
})();
