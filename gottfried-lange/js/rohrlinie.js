// Rohr-Linie (nur ab 1024 px, nicht bei „Bewegung reduzieren“):
// Ein gelbes Rohr läuft vom Haus am linken Seitenrand bis zur Notdienst-Nummer.
// Es wächst beim Runterscrollen und schrumpft beim Hochscrollen, darin fließt Wasser.
// An jedem Abschnitt schlägt ein Manometer aus; kommt das Wasser an, leuchtet die Nummer auf.
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var main = document.querySelector("main");
  var haus = document.querySelector(".haus");
  var nummer = document.querySelector(".emergency-number");
  if (!main || !haus || !nummer) return;
  var notdienst = nummer.closest("section");
  var gross = matchMedia("(min-width: 1024px)"), ruhig = matchMedia("(prefers-reduced-motion: reduce)");
  var svg = null, clipRect = null, uhren = [], startY = 0, endeY = 0, angekommen = false, tick = false;

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function seiteY(r) { return r.top + scrollY - (main.getBoundingClientRect().top + scrollY); }
  function seiteX(r) { return r.left - main.getBoundingClientRect().left; }

  function abbauen() {
    if (svg) svg.remove();
    svg = null; uhren = [];
  }

  function aufbauen() {
    abbauen();
    if (!gross.matches || ruhig.matches || haus.hidden) return;
    var buehne = haus.querySelector(".haus-buehne"), sticky = haus.querySelector(".haus-sticky");
    var scroller = haus.querySelector(".haus-scroll"), hsvg = haus.querySelector(".haus-svg");
    var inhalt = notdienst.querySelector(".container");
    // Rohr in der Mitte des linken Seitenrands
    var cs = getComputedStyle(inhalt);
    var x = Math.max(16, (inhalt.getBoundingClientRect().left + parseFloat(cs.paddingLeft) - main.getBoundingClientRect().left) / 2);
    // Anschluss am Haus: Lage im SVG, umgerechnet auf die Endposition des eingerasteten Hauses
    var b = buehne.getBoundingClientRect(), st = sticky.getBoundingClientRect(), sc = scroller.getBoundingClientRect();
    var endUnten = seiteY(sc) + sc.height + (b.bottom - st.bottom);
    var vb = hsvg.viewBox.baseVal, u = b.width / vb.width, a = hsvg.getAttribute("data-anschluss").split(",");
    var ax = seiteX(b) + (+a[0] - vb.x) * u, ay = endUnten - b.height + (+a[1] - vb.y) * u;
    // Ziel: unter der Notdienst-Nummer, Weg unter dem Text entlang
    var n = nummer.getBoundingClientRect(), ns = notdienst.getBoundingClientRect();
    var nx = seiteX(n) + 30, ny = seiteY(n) + n.height + 10;
    var lauf = seiteY(ns) + ns.height - 48;
    startY = ay - 20; endeY = lauf;
    var r = 16;
    var d = "M" + ax + "," + ay + " H" + (x + r) + " Q" + x + "," + ay + " " + x + "," + (ay + r) +
      " V" + (lauf - r) + " Q" + x + "," + lauf + " " + (x + r) + "," + lauf +
      " H" + (nx - r) + " Q" + nx + "," + lauf + " " + nx + "," + (lauf - r) + " V" + ny;

    svg = el("svg", { "class": "rohrlinie", "aria-hidden": "true", focusable: "false", width: main.clientWidth, height: lauf + 40 });
    var defs = el("defs", {}, svg);
    var cp = el("clipPath", { id: "rohrlinie-clip" }, defs);
    clipRect = el("rect", { x: 0, y: 0, width: main.clientWidth, height: 0 }, cp);
    var g = el("g", { "clip-path": "url(#rohrlinie-clip)" }, svg);
    el("path", { d: d, "class": "rl-kontur" }, g);
    el("path", { d: d, "class": "rl-rohr" }, g);
    el("path", { d: d, "class": "rl-glanz" }, g);
    el("path", { d: d, "class": "rl-wasser" }, g);
    // Muffen in regelmäßigen Abständen
    for (var y = ay + 180; y < lauf - 60; y += 260) el("rect", { x: x - 6, y: y, width: 12, height: 7, rx: 2, "class": "rl-muffe" }, g);
    // Manometer an jedem Abschnitt zwischen Haus und Notdienst
    Array.prototype.forEach.call(main.children, function (s) {
      if (s.tagName !== "SECTION") return;
      var sy = seiteY(s.getBoundingClientRect()) + 70;
      if (sy < ay + 60 || sy > lauf - 60) return;
      var m = el("g", { "class": "rl-uhr", transform: "translate(" + x + " " + sy + ")" }, g);
      el("circle", { r: 15, "class": "rl-uhr-rand" }, m);
      el("circle", { r: 11.5, "class": "rl-uhr-blatt" }, m);
      el("path", { d: "M-8,4 A9,9 0 1 1 8,4", "class": "rl-uhr-skala" }, m);
      var z = el("g", { "class": "rl-zeiger" }, m);
      el("path", { d: "M-1.2,0 L0,-9 L1.2,0 Z" }, z);
      el("circle", { r: 1.8, "class": "rl-uhr-achse" }, m);
      uhren.push({ el: m, y: sy });
    });
    main.appendChild(svg);
    angekommen = false;
    update();
  }

  function update() {
    tick = false;
    if (!svg) return;
    var kopf = innerHeight * 0.72 - main.getBoundingClientRect().top; // Wasserspitze im Koordinatensystem von <main>
    var h = Math.max(0, kopf - startY);
    clipRect.setAttribute("y", startY);
    clipRect.setAttribute("height", h);
    uhren.forEach(function (u) { u.el.classList.toggle("aktiv", kopf > u.y); });
    if (!angekommen && kopf > endeY + 10) {
      angekommen = true;
      nummer.classList.remove("leuchtet");
      void nummer.offsetWidth;
      nummer.classList.add("leuchtet");
    } else if (angekommen && kopf < endeY - 120) angekommen = false;
  }
  function onScroll() { if (!tick) { tick = true; requestAnimationFrame(update); } }

  var t;
  function neu() { clearTimeout(t); t = setTimeout(aufbauen, 150); }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", neu);
  addEventListener("load", neu);
  [gross, ruhig].forEach(function (mq) { mq.addEventListener ? mq.addEventListener("change", neu) : mq.addListener(neu); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(neu);
  neu();
})();
