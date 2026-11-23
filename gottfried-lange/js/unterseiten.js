// Interaktive Bauplan-Elemente der Unterseiten. Jedes Teil startet nur,
// wenn es auf der Seite vorkommt. Ohne JavaScript bleibt alles als normaler Text sichtbar.
document.addEventListener("DOMContentLoaded", function () {
  var ruhig = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function alle(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------- Heizung: Heizkreislauf ---------- */
  var hk = document.querySelector(".heizkreis");
  if (hk) {
    var svg = hk.querySelector(".hk-svg"), info = hk.querySelector(".hk-info"), liste = hk.querySelector(".hk-liste");
    var typ = "gas", gewaehlt = "kessel";
    hk.classList.add("hk--js");
    hk.querySelector(".hk-umschalter").hidden = false;
    info.hidden = false;

    function erklaeren(teil, fokus) {
      gewaehlt = teil;
      var eintrag = liste.querySelector('[data-teil="' + teil + '"]');
      var texte = alle("dd", eintrag).filter(function (dd) {
        var t = dd.getAttribute("data-typ");
        return !t || t === typ;
      }).map(function (dd) { return dd.textContent; });
      info.querySelector(".hk-info-titel").textContent = eintrag.querySelector("dt").textContent;
      info.querySelector(".hk-info-text").textContent = texte.join(" ");
      alle(".teil", svg).forEach(function (g) { g.classList.toggle("is-aktiv", g.getAttribute("data-teil") === teil); });
      if (fokus && window.innerWidth < 768) info.scrollIntoView({ block: "nearest", behavior: ruhig ? "auto" : "smooth" });
    }
    alle(".teil", svg).forEach(function (g) {
      g.addEventListener("click", function () { erklaeren(g.getAttribute("data-teil"), true); });
      g.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); erklaeren(g.getAttribute("data-teil"), false); }
      });
    });
    alle(".hk-umschalter button", hk).forEach(function (b) {
      b.addEventListener("click", function () {
        typ = b.getAttribute("data-typ");
        svg.setAttribute("class", "hk-svg typ-" + typ);
        alle(".hk-umschalter button", hk).forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        // Teil, das es bei dieser Heizart nicht gibt → zurück zum Kessel
        var g = svg.querySelector('.teil[data-teil="' + gewaehlt + '"]');
        erklaeren(g && !g.closest(".nur:not(.nur-" + typ + ")") ? gewaehlt : "kessel", false);
      });
    });
    erklaeren("kessel", false);
  }

  /* ---------- Bad: Ablauf wächst beim Scrollen ---------- */
  var ablauf = document.querySelector(".ablauf");
  if (ablauf && !ruhig) {
    var schritte = alle(".ablauf-schritt", ablauf), tick = false;
    ablauf.classList.add("ablauf--animiert");
    function ablaufStand() {
      tick = false;
      var vh = window.innerHeight, r = ablauf.getBoundingClientRect();
      var f = Math.max(0, Math.min(1, (vh * 0.65 - r.top) / r.height));
      ablauf.style.setProperty("--fortschritt", f.toFixed(3));
      schritte.forEach(function (s) {
        s.classList.toggle("is-da", s.getBoundingClientRect().top + 24 < vh * 0.65);
      });
    }
    window.addEventListener("scroll", function () { if (!tick) { tick = true; requestAnimationFrame(ablaufStand); } }, { passive: true });
    window.addEventListener("resize", ablaufStand);
    ablaufStand();
  }

  /* ---------- Bad: Vorher-Nachher-Regler ---------- */
  alle(".vorher-nachher").forEach(function (vn) {
    var regler = vn.querySelector(".vn-regler");
    vn.classList.add("vn--js");
    regler.hidden = false;
    function setzen() {
      vn.style.setProperty("--pos", regler.value + "%");
      regler.setAttribute("aria-valuetext", regler.value + " % Vorher");
    }
    regler.addEventListener("input", setzen);
    setzen();
  });

  /* ---------- Kundendienst: Was ist passiert? ---------- */
  var hilfe = document.querySelector(".hilfe");
  if (hilfe) {
    var kacheln = alle(".hilfe-kachel", hilfe), panels = alle(".hilfe-panel", hilfe);
    hilfe.classList.add("hilfe--js");
    panels.forEach(function (p) { p.hidden = true; });
    kacheln.forEach(function (k) {
      k.addEventListener("click", function () {
        var offen = k.getAttribute("aria-expanded") === "true";
        kacheln.forEach(function (x) { x.setAttribute("aria-expanded", "false"); });
        panels.forEach(function (p) { p.hidden = true; });
        if (offen) return;
        var p = document.getElementById(k.getAttribute("aria-controls"));
        k.setAttribute("aria-expanded", "true");
        p.hidden = false;
        // Rohrbruch: direkt zur Notdienst-Nummer
        var ziel = p.querySelector(".hilfe-nummer a") ? p.querySelector(".btn") : null;
        var r = p.getBoundingClientRect();
        if (r.bottom > window.innerHeight - 90) {
          window.scrollBy({ top: r.bottom - window.innerHeight + 110, behavior: ruhig ? "auto" : "smooth" });
        }
        if (ziel) ziel.focus({ preventScroll: true });
      });
    });
  }
});
