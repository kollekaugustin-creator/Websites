// Kleine Wow-Effekte auf den Unterseiten (Heizung, Bad, Kundendienst, Über uns).
// Jedes Teil startet nur, wenn es auf der Seite vorkommt.
// Bei „Bewegung reduzieren“ (oder ohne JavaScript) steht sofort alles im Endzustand da.
document.addEventListener("DOMContentLoaded", function () {
  var ruhig = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function alle(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  var main = document.querySelector("main");

  /* ---------- Inhalte gleiten gestaffelt ins Bild ---------- */
  var gleiter = alle(".cards > *, .gallery > *, .hilfe-kacheln > li, .value-tiles > *, .fakten > li, .stil-panels, .vorher-nachher, .contact-list > li");
  if (!ruhig && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (eintraege) {
      eintraege.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("ist-da");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    gleiter.forEach(function (el) {
      var nr = Array.prototype.indexOf.call(el.parentNode.children, el);
      el.style.transitionDelay = Math.min(nr, 5) * 90 + "ms";
      el.classList.add("gleiten");
      io.observe(el);
    });
  }

  /* ---------- Zahlen zählen hoch, sobald sie sichtbar werden ---------- */
  alle("[data-zaehlen]").forEach(function (el) {
    var ziel = +el.getAttribute("data-zaehlen"), von = +(el.getAttribute("data-von") || 0);
    if (ruhig || !("IntersectionObserver" in window)) return;
    el.textContent = von;
    var beob = new IntersectionObserver(function (e) {
      if (!e[0].isIntersecting) return;
      beob.disconnect();
      var t0 = null;
      requestAnimationFrame(function schritt(t) {
        if (!t0) t0 = t;
        var x = Math.min(1, (t - t0) / 1400);
        el.textContent = Math.round(von + (ziel - von) * (1 - Math.pow(1 - x, 3)));
        if (x < 1) requestAnimationFrame(schritt);
      });
    });
    beob.observe(el);
  });

  /* ---------- Herstellerlogos als Laufband in zwei Reihen ---------- */
  if (!ruhig) alle(".brand-logos").forEach(function (liste) {
    var bilder = alle("img", liste);
    if (bilder.length < 3) return;
    var band = document.createElement("div");
    band.className = "laufband";
    band.setAttribute("aria-hidden", "true");
    [bilder, bilder.slice().reverse()].forEach(function (reihe, r) {
      var zeile = document.createElement("div"), spur = document.createElement("div");
      zeile.className = "laufband-reihe" + (r ? " laufband-rueck" : "");
      spur.className = "laufband-spur";
      // genug Logos, damit die Reihe auch auf breiten Bildschirmen nie leer läuft
      var runden = Math.max(2, Math.ceil(12 / reihe.length));
      for (var h = 0; h < 2; h++) for (var i = 0; i < runden; i++) reihe.forEach(function (img) {
        var c = img.cloneNode(true);
        c.removeAttribute("loading");
        c.alt = "";
        var f = document.createElement("span");
        f.className = "laufband-logo";
        f.appendChild(c);
        spur.appendChild(f);
      });
      spur.style.animationDuration = runden * reihe.length * 3.2 + "s";
      zeile.appendChild(spur);
      band.appendChild(zeile);
    });
    liste.classList.add("visually-hidden");   // die Liste bleibt für Screenreader erhalten
    liste.parentNode.insertBefore(band, liste.nextSibling);
  });

  /* ---------- Bad: Stil-Umschalter Modern / Klassisch / Barrierearm ---------- */
  var stilWahl = document.querySelector(".stil-umschalter");
  if (stilWahl) {
    var panels = alle(".stil-panel");
    stilWahl.hidden = false;
    document.querySelector(".stil-panels").classList.add("stil-panels--js");
    function zeigeStil(k) {
      alle("button", stilWahl).forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-stil") === k)); });
      panels.forEach(function (p) { p.classList.toggle("ist-aktiv", p.getAttribute("data-stil") === k); p.setAttribute("aria-hidden", String(p.getAttribute("data-stil") !== k)); });
    }
    alle("button", stilWahl).forEach(function (b) { b.addEventListener("click", function () { zeigeStil(b.getAttribute("data-stil")); }); });
    zeigeStil("modern");
  }

  /* ---------- Kundendienst: Wartungs-Checkliste hakt sich beim Scrollen ab ---------- */
  var punkte = alle(".checkliste li");
  if (punkte.length && !ruhig) {
    document.querySelector(".checkliste").classList.add("checkliste--js");
    var warte = false;
    function haken() {
      warte = false;
      var grenze = innerHeight * 0.75, verzug = 0;
      punkte = punkte.filter(function (li) {
        if (li.getBoundingClientRect().top > grenze) return true;
        setTimeout(function () { li.classList.add("ist-geprueft"); }, verzug);
        verzug += 260;
        return false;
      });
      if (!punkte.length) removeEventListener("scroll", anstoss);
    }
    function anstoss() { if (!warte) { warte = true; requestAnimationFrame(haken); } }
    addEventListener("scroll", anstoss, { passive: true });
    haken();
  }

  /* ---------- Das gelbe Rohr als roter Faden: zeichnet sich bis zum Anruf-Button ---------- */
  var ziel = document.querySelector(".cta-section a[href^='tel:']");
  if (ziel && main) {
    var NS = "http://www.w3.org/2000/svg";
    var rohr = document.createElementNS(NS, "svg"), weg = document.createElementNS(NS, "path"), glanz = document.createElementNS(NS, "path");
    rohr.setAttribute("class", "rohrfaden");
    rohr.setAttribute("aria-hidden", "true");
    glanz.setAttribute("class", "rohrfaden-glanz");
    weg.setAttribute("class", "rohrfaden-rohr");
    rohr.appendChild(glanz); rohr.appendChild(weg);
    main.style.position = "relative";
    main.appendChild(rohr);
    var laenge = 0, startY = 0, endY = 0, breit = matchMedia("(min-width: 64rem)");
    function bauen() {
      rohr.style.display = breit.matches ? "" : "none";
      if (!breit.matches) return;
      var m = main.getBoundingClientRect(), b = ziel.getBoundingClientRect(), c = main.querySelector(".container").getBoundingClientRect();
      var x = Math.max(8, c.left - m.left - 14);            // im Rand neben dem Inhalt, nie über Text
      var hero = main.querySelector("section");
      startY = hero.getBoundingClientRect().bottom - m.top;
      // unter der Button-Reihe entlang und von unten in den Anruf-Button (kreuzt keinen anderen Button)
      var unten = b.bottom - m.top, y = unten + 14, bx = b.left - m.left + b.width / 2;
      endY = y;
      rohr.setAttribute("width", m.width);
      rohr.setAttribute("height", m.height);
      var d = "M" + x + "," + startY + " V" + (y - 12) + " Q" + x + "," + y + " " + (x + 12) + "," + y +
        " H" + (bx - 12) + " Q" + bx + "," + y + " " + bx + "," + (y - 12) + " V" + (unten + 1);
      weg.setAttribute("d", d); glanz.setAttribute("d", d);
      laenge = weg.getTotalLength();
      [weg, glanz].forEach(function (p) { p.style.strokeDasharray = laenge + " " + laenge; });
      stand();
    }
    function stand() {
      if (!laenge) return;
      var m = main.getBoundingClientRect();
      var kopf = ruhig ? endY : innerHeight * 0.72 - m.top;       // bis hierhin ist das Rohr gezeichnet
      var f = Math.max(0, Math.min(1, (kopf - startY) / (endY - startY)));
      [weg, glanz].forEach(function (p) { p.style.strokeDashoffset = (laenge * (1 - f)).toFixed(1); });
      ziel.classList.toggle("rohr-da", f >= 1);
    }
    var tick = false;
    addEventListener("scroll", function () { if (!tick) { tick = true; requestAnimationFrame(function () { tick = false; stand(); }); } }, { passive: true });
    addEventListener("resize", bauen);
    addEventListener("load", bauen);
    if ("ResizeObserver" in window) new ResizeObserver(bauen).observe(main);
    bauen();
  }
});
