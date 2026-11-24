// Das Lange-Haus im Hero der Startseite.
// - Baut sich beim Laden einmal auf (2,5 s), danach pulsiert jeder Raum kurz auf.
// - Kamerafahrt: ab 768 px bleibt der Hero beim Scrollen stehen und zoomt nacheinander auf
//   Keller, Bad, Küche und Dach (1 / 4 …), danach zoomt das Haus heraus.
//   Handy: Tour mit Wischen bzw. „Weiter“/„Zurück“. Räume sind Buttons (Zoom + Infokarte).
// - Überraschungen: Thermostat, Bad 1974, „Lange rufen“, Sommer/Winter, Abend.
// - „Bewegung reduzieren“: kein Festhalten, keine Kamerafahrt, alles sofort im Endzustand.
// Ohne JavaScript: Haus als Bild, darunter die drei Leistungs-Karten.
(function () {
  "use strict";
  var root = document.querySelector(".hero-haus");
  if (!root || !window.SVGElement) return;
  var $ = function (sel, el) { return (el || root).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || root).querySelectorAll(sel)); };
  var svg = $(".haus-svg"), buehne = $(".haus-buehne"), zoomEl = $(".haus-zoom"), scroller = $(".hh-scroll");
  var motion = matchMedia("(prefers-reduced-motion: reduce)"), wide = matchMedia("(min-width: 768px)");
  var ruhig = function () { return motion.matches; };
  var TOUR = ["keller", "bad", "kueche", "dach"];

  // Mit JS: Bedienelemente zeigen, alte Leistungs-Karten ausblenden (der Rundgang ersetzt sie)
  $$(".haus-leiste, .haus-entdecken, .rundgang-start, .haus-info").forEach(function (e) { e.hidden = false; });
  var alt = document.querySelector(".leistungen-ohne-js");
  if (alt) alt.hidden = true;
  root.classList.add("mit-js");

  /* ---------- Aufbau ---------- */
  var gruppen = {};
  $$(".technik [data-rohr]", svg).forEach(function (el) {
    var id = el.getAttribute("data-rohr");
    if (!gruppen[id]) gruppen[id] = { els: [], len: el.getTotalLength(), seq: +el.getAttribute("data-seq") };
    gruppen[id].els.push(el);
  });
  var rohre = Object.keys(gruppen).map(function (k) { return gruppen[k]; }).sort(function (a, b) { return a.seq - b.seq; });
  var rohrSumme = rohre.reduce(function (s, r) { return s + r.len; }, 0);
  var reveals = $$("rect.reveal", svg);
  var PH = { platte: [0, .08], keller: [.08, .22], eg: [.22, .38], og: [.38, .52], dach: [.52, .64], rohre: [.64, .84], wasser: [.84, .92], warm: [.92, 1] };
  function seg(p, n) { var r = PH[n]; return Math.max(0, Math.min(1, (p - r[0]) / (r[1] - r[0]))); }
  function render(p) {
    ["platte", "dach", "rohre", "wasser", "warm"].forEach(function (n) { svg.style.setProperty("--p-" + n, seg(p, n).toFixed(3)); });
    reveals.forEach(function (r) {
      var f = seg(p, r.getAttribute("data-stock")), yb = +r.getAttribute("data-yb"), yt = +r.getAttribute("data-yt");
      r.setAttribute("y", (yb - f * (yb - yt)).toFixed(1));
    });
    var rest = seg(p, "rohre") * rohrSumme;
    rohre.forEach(function (r) {
      var zeig = Math.max(0, Math.min(r.len, rest));
      rest -= r.len;
      r.els.forEach(function (el) { el.style.strokeDasharray = r.len + " " + r.len; el.style.strokeDashoffset = (r.len - zeig).toFixed(1); });
    });
  }
  var gebaut = false, bauRaf = 0;
  function fertig() {
    cancelAnimationFrame(bauRaf);
    render(1);
    rohre.forEach(function (r) { r.els.forEach(function (el) { el.style.strokeDasharray = el.style.strokeDashoffset = ""; }); });
    if (!gebaut) { gebaut = true; root.classList.add("is-fertig"); pulsieren(); }
  }
  function pulsieren() {
    if (ruhig()) return;
    // Farbfläche + Schild jedes Raums leuchten nacheinander sanft auf
    ["keller", "wohnzimmer", "kueche", "bad", "dach"].forEach(function (id, i) {
      setTimeout(function () {
        if (offen) return;
        hot(id, true);
        setTimeout(function () { if (offen !== id) hot(id, false); }, 900);
      }, 400 + i * 550);
    });
  }
  if (ruhig()) fertig();
  else {
    render(0);
    var t0 = null;
    bauRaf = requestAnimationFrame(function step(t) {
      if (!t0) t0 = t;
      var x = Math.min(1, (t - t0) / 2500);
      render(x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
      if (x < 1) bauRaf = requestAnimationFrame(step); else fertig();
    });
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (e) { root.classList.toggle("is-sichtbar", e[0].isIntersecting); }).observe(buehne);
  } else root.classList.add("is-sichtbar");

  /* ---------- Anzeigen: Raum + Karte (Zoom), oder ganzes Haus ---------- */
  var info = $(".haus-info"), hhHaus = $(".hh-haus");
  var raeume = $$(".raum", svg), karten = {}, labels = {};
  $$(".haus-karte").forEach(function (k) { karten[k.getAttribute("data-raum")] = k; });
  $$(".raum-label", svg).forEach(function (l) { labels[l.getAttribute("data-raum")] = l; });
  var tourNav = $(".tour-nav"), tourNr = $(".tour-nr"), offen = null, schritt = 0, modus = null;
  function hot(id, an) {
    if (labels[id]) labels[id].classList.toggle("is-hot", an);
  }
  // Raum einfärben: Kopie des Stockwerks, auf den Raum zugeschnitten, blendet in 0,5 s ein
  var ebene = $(".farbe-ebene", svg), farbAktiv = null, NS = "http://www.w3.org/2000/svg";
  var STOCK = { keller: '.stock[data-stock="keller"]', wohnzimmer: '.stock[data-stock="eg"]', kueche: '.stock[data-stock="eg"]', bad: '.stock[data-stock="og"]', dach: ".dach" };
  function faerben(id) {
    if (id === farbAktiv) return;
    farbAktiv = id;
    Array.prototype.slice.call(ebene.children).forEach(function (g) {
      g.classList.remove("sichtbar");
      setTimeout(function () { g.remove(); }, ruhig() ? 0 : 520);
    });
    svg.classList.toggle("hat-farbe", !!id);
    if (!id) { svg.removeAttribute("data-aktiv"); return; }
    svg.setAttribute("data-aktiv", id);
    var kopie = $(STOCK[id], svg).cloneNode(true), g = document.createElementNS(NS, "g"), licht = document.createElementNS(NS, "polygon");
    kopie.removeAttribute("clip-path");
    kopie.setAttribute("class", "farbe-kopie");
    g.setAttribute("clip-path", "url(#farbe-" + id + ")");
    licht.setAttribute("class", "warmlicht");
    licht.setAttribute("points", poly(id).getAttribute("points"));
    g.appendChild(kopie); g.appendChild(licht);
    ebene.appendChild(g);
    if (ruhig()) g.classList.add("sichtbar");
    else requestAnimationFrame(function () { requestAnimationFrame(function () { g.classList.add("sichtbar"); }); });
  }
  function poly(id) { return svg.querySelector('.raum[data-raum="' + id + '"]'); }

  function zoomAuf(id) {
    if (ruhig() || !id) { zoomEl.style.transform = ""; return; }
    var ziel = svg.querySelector('.zoom-ziel[data-raum="' + id + '"]') || poly(id);
    var bb = ziel.getBBox();
    // Ausschnitt so wählen, dass auch alle Beschriftungen des Raums hineinpassen
    $$('.t-label[data-r="' + id + '"]', svg).forEach(function (l) {
      var c = l.getBBox(), x0 = Math.min(bb.x, c.x), y0 = Math.min(bb.y, c.y);
      bb = { x: x0, y: y0, width: Math.max(bb.x + bb.width, c.x + c.width) - x0, height: Math.max(bb.y + bb.height, c.y + c.height) - y0 };
    });
    var oben = info && info.parentNode === buehne ? $(".anlage", info).offsetHeight + 16 : 0;   // Platz für das Display
    var vb = svg.viewBox.baseVal, w = buehne.clientWidth, h = buehne.clientHeight - oben, u = w / vb.width;
    var rw = bb.width * u, rh = bb.height * u, z = Math.min(w * 0.96 / rw, h * 0.92 / rh, 2.4);
    var tx = w / 2 - ((bb.x - vb.x) * u + rw / 2) * z, ty = oben + h / 2 - ((bb.y - vb.y) * u + rh / 2) * z;
    zoomEl.style.transform = "translate(" + tx.toFixed(1) + "px," + ty.toFixed(1) + "px) scale(" + z.toFixed(3) + ")";
  }
  // id = Raum oder null (ganzes Haus); nr = Tour-Schritt 1–4 oder 0; fokus = Fokus auf die Karte setzen
  function anzeigen(id, nr, fokus) {
    if (id) fertig();
    if (offen && offen !== id) { karten[offen].hidden = true; hot(offen, false); }
    offen = id;
    root.classList.toggle("karte-offen", !!id);
    root.classList.toggle("im-rundgang", !!nr);
    tourNav.hidden = !nr;
    if (nr) tourNr.textContent = nr;
    raeume.forEach(function (r) {
      r.setAttribute("tabindex", id ? "-1" : "0");
      r.setAttribute("aria-expanded", r.getAttribute("data-raum") === id ? "true" : "false");
    });
    zoomAuf(id);
    faerben(id);
    if (!id) return;
    hot(id, true);
    var k = karten[id];
    k.hidden = false;
    if (fokus) {
      $("h3", k).focus({ preventScroll: true });
      // Handy: im Rundgang bleiben Haus und „Weiter/Zurück“ im Blick, sonst die Karte
      if (!wide.matches) (nr ? tourNav : k).scrollIntoView({ behavior: ruhig() ? "auto" : "smooth", block: nr ? "end" : "nearest" });
    }
  }
  function schliessen() {
    var war = offen;
    schritt = 0;
    anzeigen(null, 0);
    if (war && poly(war)) poly(war).focus({ preventScroll: true });
  }

  /* ---------- Kamerafahrt (ab 768 px) bzw. Tour (Handy, „Bewegung reduzieren“) ---------- */
  function kopf() { var h = document.querySelector(".site-header"); return h ? h.getBoundingClientRect().height : 0; }
  function schrittLaenge() { return innerHeight * 0.85; }
  function kameraSchritt() {
    var s = (kopf() - scroller.getBoundingClientRect().top) / schrittLaenge();
    return s < 0.5 ? 0 : Math.min(5, Math.floor(s + 0.5));
  }
  function geheZu(n) {
    n = Math.max(0, Math.min(modus === "kamera" ? 5 : 4, n));
    if (modus === "kamera") {
      var y = scroller.getBoundingClientRect().top + scrollY - kopf() + n * schrittLaenge() + 2;
      scrollTo({ top: y, behavior: "smooth" });
      return;
    }
    schritt = n;
    anzeigen(n >= 1 && n <= 4 ? TOUR[n - 1] : null, n >= 1 && n <= 4 ? n : 0, true);
    if (n === 0) $(".rundgang-start").focus({ preventScroll: true });
  }
  var tick = false;
  function update() {
    tick = false;
    if (modus !== "kamera") return;
    var n = kameraSchritt();
    if (n === schritt) return;
    schritt = n;
    anzeigen(n >= 1 && n <= 4 ? TOUR[n - 1] : null, n >= 1 && n <= 4 ? n : 0, false);
  }

  // Display + Legende: ab 1024 px im Bildausschnitt, darunter unter dem Haus
  var gross = matchMedia("(min-width: 64rem)");
  function infoPlatz() { if (info) (gross.matches ? buehne : hhHaus).appendChild(info); }
  gross.addEventListener ? gross.addEventListener("change", infoPlatz) : gross.addListener(infoPlatz);
  infoPlatz();
  function setModus() {
    var m = ruhig() ? "ruhig" : (wide.matches ? "kamera" : "tour");
    if (m === modus) return;
    modus = m;
    root.setAttribute("data-modus", m);
    schritt = 0;
    anzeigen(null, 0);
    update();
  }
  addEventListener("scroll", function () { if (!tick) { tick = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener("resize", function () { if (offen) zoomAuf(offen); });
  [motion, wide].forEach(function (mq) { mq.addEventListener ? mq.addEventListener("change", setModus) : mq.addListener(setModus); });
  setModus();

  $(".rundgang-start").addEventListener("click", function (e) {
    e.preventDefault();
    if (modus === "kamera") geheZu(1);
    else geheZu(1);
  });
  $(".tour-weiter").addEventListener("click", function () { geheZu((modus === "kamera" ? kameraSchritt() : schritt) + 1); });
  $(".tour-zurueck").addEventListener("click", function () { geheZu((modus === "kamera" ? kameraSchritt() : schritt) - 1); });
  // Wischen auf dem Haus (Handy-Tour)
  var x0 = null;
  buehne.addEventListener("pointerdown", function (e) { if (e.pointerType !== "mouse") x0 = e.clientX; });
  buehne.addEventListener("pointerup", function (e) {
    if (x0 === null || modus === "kamera") return;
    var dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) geheZu(schritt + (dx < 0 ? 1 : -1));
  });

  raeume.forEach(function (r) {
    var id = r.getAttribute("data-raum");
    r.setAttribute("aria-expanded", "false");
    r.setAttribute("aria-controls", "haus-karte-" + id);
    var auf = function () { var nr = TOUR.indexOf(id) + 1; if (modus !== "kamera") schritt = nr; anzeigen(id, modus !== "kamera" ? nr : 0, true); };
    r.addEventListener("click", auf);
    r.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); auf(); } });
    r.addEventListener("mouseenter", function () { hot(id, true); faerben(id); });
    r.addEventListener("mouseleave", function () { if (offen !== id) hot(id, false); faerben(offen); });
    r.addEventListener("focus", function () { hot(id, true); faerben(id); });
    r.addEventListener("blur", function () { if (offen !== id) hot(id, false); faerben(offen); });
  });
  $$(".haus-zurueck").forEach(function (b) { b.addEventListener("click", schliessen); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && offen) schliessen(); });

  /* ---------- Abend ---------- */
  function umschalter(attr, wert) {
    $$("[data-" + attr + "]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-" + attr) === wert ? "true" : "false"); });
  }
  var jetzt = new Date(), monat = jetzt.getMonth(), stunde = jetzt.getHours();
  root.classList.toggle("abend", stunde >= 18 || stunde < 6);

  /* ---------- Anlage: ein Zustand für alle Regler, das Display und die Zeichnung ----------
     Alle Zahlen sind vereinfachte Beispielwerte. [PRÜFEN: fachlich mit Lange abstimmen] */
  var SOLL = 60;                                   // Speicher-Solltemperatur in °C [PRÜFEN]
  var A = { winter: true, stufe: 3, dusche: false, speicher: SOLL, laden: false, kessel: "mittel" };
  var anzeige = {};
  $$("[data-wert]").forEach(function (e) { anzeige[e.getAttribute("data-wert")] = { el: e, wert: null }; });
  var brennerEl = $("[data-wert-text=brenner]"), modusEl = $(".anlage-modus");
  function fmt(v) { return String(v).replace("-", "−"); }
  // Zahl zählt sichtbar hoch oder runter
  function zaehlen(name, ziel) {
    var a = anzeige[name];
    if (!a) return;
    a.el.parentNode.classList.toggle("ist-aus", ziel === null);
    if (ziel === null) { cancelAnimationFrame(a.raf); a.el.textContent = "aus"; a.wert = null; return; }
    var von = a.wert === null ? ziel : a.wert;
    a.wert = ziel;
    cancelAnimationFrame(a.raf);
    if (ruhig() || von === ziel) { a.el.textContent = fmt(ziel); return; }
    var t0 = null;
    a.raf = requestAnimationFrame(function s(t) {
      if (!t0) t0 = t;
      var x = Math.min(1, (t - t0) / 800);
      a.el.textContent = fmt(Math.round(von + (ziel - von) * (1 - Math.pow(1 - x, 3))));
      if (x < 1) a.raf = requestAnimationFrame(s);
    });
  }
  function werte() {
    var v = A.winter ? (A.stufe - 1) / 4 : 0;                  // Ventilöffnung 0–1
    var vl = A.winter ? Math.round(35 + 35 * v) : null;        // Vorlauf 35–70 °C [PRÜFEN]
    var rl = A.winter ? Math.round(vl - (6 + 9 * v)) : null;   // Rücklauf: 6–15 K weniger [PRÜFEN]
    var heiz = A.winter ? Math.round(20 + 70 * v) : 0;          // Kesselleistung für die Heizung in % [PRÜFEN]
    var leistung = Math.min(100, heiz + (A.laden ? 30 : 0));    // + Speicher nachheizen [PRÜFEN]
    return { v: v, vl: vl, rl: rl, leistung: leistung, brenner: leistung > 0, aussen: A.winter ? -5 : 24 };  // Außen [PRÜFEN]
  }
  function hkFarbe(t) {
    var a = [79, 127, 209], b = [229, 72, 42];
    return "rgb(" + a.map(function (v, i) { return Math.round(v + (b[i] - v) * t); }).join(",") + ")";
  }
  function zeichnen() {
    var w = werte(), v = w.v;
    zaehlen("aussen", w.aussen); zaehlen("vl", w.vl); zaehlen("rl", w.rl);
    zaehlen("speicher", Math.round(A.speicher)); zaehlen("leistung", w.leistung);
    brennerEl.textContent = w.brenner ? "AN" : "AUS";
    brennerEl.classList.toggle("an", w.brenner);
    modusEl.textContent = A.winter ? "Winter" : "Sommer";
    root.classList.toggle("heizkreis-aus", !A.winter);
    root.classList.toggle("brenner-an", w.brenner);
    root.classList.toggle("laden", A.laden);
    root.classList.toggle("dusche-an", A.dusche);
    svg.style.setProperty("--ventil", (A.winter ? 0.12 + 0.88 * v : 0.05).toFixed(2));
    svg.style.setProperty("--tempo-hz", (2.6 - 1.9 * v).toFixed(2) + "s");
    svg.style.setProperty("--pumpe-s", (2.4 - 1.8 * v).toFixed(2) + "s");
    svg.style.setProperty("--flamme", w.brenner ? (0.45 + 0.75 * w.leistung / 100).toFixed(2) : "0");
    svg.style.setProperty("--hk-farbe", hkFarbe(A.winter ? 0.25 + 0.75 * v : 0));
    svg.style.setProperty("--hk-farbe-d", hkFarbe(A.winter ? (0.25 + 0.75 * v) * 0.85 : 0));
    glutZiel(A.winter ? 0.15 + 0.85 * v : 0);
    if (wbAn) waermebild(w);
  }

  // Heizkörper erwärmt sich von oben nach unten (Vorlauf kommt oben an)
  var stops = svg.querySelectorAll("#g-hk-glut stop"), glut = 0, glutRaf = 0;
  function glutSetzen(L) {
    glut = L;
    stops[1].setAttribute("offset", (L * 0.8).toFixed(3));
    stops[2].setAttribute("offset", Math.min(1, L * 0.8 + 0.2).toFixed(3));
    svg.style.setProperty("--glut", Math.min(1, L * 1.4).toFixed(2));
  }
  function glutZiel(L) {
    cancelAnimationFrame(glutRaf);
    if (ruhig()) { glutSetzen(L); return; }
    var von = glut, t0 = null;
    glutRaf = requestAnimationFrame(function s(t) {
      if (!t0) t0 = t;
      var x = Math.min(1, (t - t0) / 1600);
      glutSetzen(von + (L - von) * x);
      if (x < 1) glutRaf = requestAnimationFrame(s);
    });
  }

  /* ---------- Sommer / Winter ---------- */
  function saison(s) {
    A.winter = s === "winter";
    root.classList.toggle("saison-winter", A.winter);
    root.classList.toggle("saison-sommer", !A.winter);
    umschalter("saison", s);
    if (thermo) setStufe(A.stufe); else zeichnen();
  }
  $$("[data-saison]").forEach(function (b) { b.addEventListener("click", function () { saison(b.getAttribute("data-saison")); }); });

  /* ---------- Wohnzimmer: Thermostat mit Stufen 1–5 (1 ≈ 12 °C … 5 ≈ 28 °C) ---------- */
  var thermo = $(".thermostat"), knopf = $(".thermostat-knopf"), zahl = $(".thermostat-zahl");
  var sollEl = $(".thermostat-soll"), raumEl = $(".raum-temp"), ventilEl = $(".ventil-prozent"), raum = 20, raumRaf = 0;
  function raumZiel(z) {
    cancelAnimationFrame(raumRaf);
    if (ruhig()) { raum = z; raumEl.textContent = z; return; }
    var von = raum, t0 = null;
    raumRaf = requestAnimationFrame(function s(t) {
      if (!t0) t0 = t;
      var x = Math.min(1, (t - t0) / 1800);
      raum = von + (z - von) * x;
      raumEl.textContent = Math.round(raum);
      if (x < 1) raumRaf = requestAnimationFrame(s);
    });
  }
  function setStufe(s) {
    A.stufe = Math.max(1, Math.min(5, Math.round(s * 2) / 2));
    var t = (A.stufe - 1) / 4, soll = Math.round(12 + 16 * t);   // [PRÜFEN]
    knopf.style.transform = "rotate(" + (-135 + t * 270) + "deg)";
    zahl.textContent = String(A.stufe).replace(".", ",");
    sollEl.textContent = soll;
    ventilEl.textContent = A.winter ? Math.round(12 + 88 * t) : 0;
    thermo.setAttribute("aria-valuenow", A.stufe);
    thermo.setAttribute("aria-valuetext", "Stufe " + zahl.textContent + ", etwa " + soll + " Grad");
    raumZiel(A.winter ? soll : 23);
    zeichnen();
  }
  if (thermo) {
    var ziehen = false;
    var winkel = function (e) {
      var r = thermo.getBoundingClientRect();
      var a = Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))) * 180 / Math.PI;
      setStufe(1 + (Math.max(-135, Math.min(135, a)) + 135) / 67.5);
    };
    thermo.addEventListener("pointerdown", function (e) { ziehen = true; thermo.setPointerCapture(e.pointerId); winkel(e); e.preventDefault(); });
    thermo.addEventListener("pointermove", function (e) { if (ziehen) winkel(e); });
    thermo.addEventListener("pointerup", function () { ziehen = false; });
    thermo.addEventListener("pointercancel", function () { ziehen = false; });
    thermo.addEventListener("keydown", function (e) {
      var d = { ArrowUp: .5, ArrowRight: .5, ArrowDown: -.5, ArrowLeft: -.5, PageUp: 1, PageDown: -1 }[e.key];
      if (e.key === "Home") setStufe(1); else if (e.key === "End") setStufe(5); else if (d) setStufe(A.stufe + d); else return;
      e.preventDefault();
    });
  }

  /* ---------- Bad: Dusche an → Speicher kühlt ab, Kessel (oder Sonne) heizt nach ---------- */
  var dKnopf = $(".dusche-knopf"), dStatus = $(".dusche-status"), simTimer = 0, dText = "";
  function duschStatus() {
    var t = A.dusche ? (A.laden ? "Warmwasser fließt. Der Speicher kühlt ab, der Kessel heizt nach." : "Warmwasser fließt. Der Speicher kühlt langsam ab.")
      : (A.laden ? "Der Kessel heizt den Speicher wieder auf 60 °C." : "Speicher: Soll 60 °C.");
    if (t === dText) return;
    dText = t;
    dStatus.innerHTML = t + ' <mark class="hinweis">[PRÜFEN]</mark>';
  }
  function simulieren() {
    if (simTimer) return;
    simTimer = setInterval(function () {
      if (A.dusche) A.speicher = Math.max(48, A.speicher - 0.6);
      var grenze = A.winter ? 57 : 52;                  // ab hier springt der Brenner an [PRÜFEN]
      if (!A.winter && !A.dusche) A.speicher = Math.min(SOLL, A.speicher + 0.5);   // Sommer: die Sonne lädt
      if (!A.laden && A.speicher < grenze) A.laden = true;
      if (A.laden) A.speicher = Math.min(SOLL, A.speicher + 0.8);
      if (A.laden && A.speicher >= SOLL) A.laden = false;
      zeichnen(); duschStatus();
      if (!A.dusche && !A.laden && A.speicher >= SOLL) { clearInterval(simTimer); simTimer = 0; }
    }, ruhig() ? 40 : 450);
  }
  if (dKnopf) dKnopf.addEventListener("click", function () {
    A.dusche = !A.dusche;
    dKnopf.setAttribute("aria-pressed", String(A.dusche));
    simulieren(); zeichnen(); duschStatus();
  });

  /* ---------- Wärmebild ---------- */
  var wbKnopf = $(".waermebild-knopf"), wbAn = false, skala = $(".wb-skala"), legende = $(".legende");
  var PAL = [[-5, [16, 18, 92]], [8, [43, 90, 220]], [16, [32, 180, 205]], [20, [120, 220, 120]], [23, [247, 225, 74]], [28, [255, 150, 30]], [40, [232, 40, 28]], [70, [255, 246, 210]]];
  function thermofarbe(t) {
    for (var i = 1; i < PAL.length; i++) {
      if (t <= PAL[i][0] || i === PAL.length - 1) {
        var a = PAL[i - 1], b = PAL[i], x = Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0])));
        return "rgb(" + a[1].map(function (v, k) { return Math.round(v + (b[1][k] - v) * x); }).join(",") + ")";
      }
    }
  }
  function waermebild(w) {
    var rt = A.winter ? 12 + 16 * w.v : 23;   // Raumtemperaturen [PRÜFEN]
    var T = { keller: A.winter ? 15 : 18, wohnzimmer: rt, kueche: A.winter ? rt - 1 : 24, bad: A.winter ? rt + 2 : 24, schlafen: A.winter ? 16 : 23, dach: A.winter ? 0 : 33 };
    $$(".wb-raum", svg).forEach(function (p) { p.style.fill = thermofarbe(T[p.getAttribute("data-wb")]); });
    $$(".wb-vl", svg).forEach(function (p) { p.style.stroke = thermofarbe(w.vl || 20); });
    $$(".wb-rl", svg).forEach(function (p) { p.style.stroke = thermofarbe(w.rl || 20); });
    var hs = { kessel: w.brenner ? 0.95 : 0.3, speicher: 0.3 + (A.speicher - 48) / 24, hk: A.winter ? 0.15 + 0.85 * w.v : 0,
      handtuch: A.winter ? 0.2 + 0.8 * w.v : 0, abgas: w.brenner ? (A.kessel === "alt" ? 1 : 0.3) : 0, solar: A.winter ? 0.15 : 0.85 };
    Object.keys(hs).forEach(function (k) { $$(".wb-" + k, svg).forEach(function (c) { c.style.opacity = hs[k].toFixed(2); }); });
  }
  if (wbKnopf) wbKnopf.addEventListener("click", function () {
    wbAn = !wbAn;
    wbKnopf.setAttribute("aria-pressed", String(wbAn));
    root.classList.toggle("waermebild-an", wbAn);
    skala.hidden = !wbAn; legende.hidden = wbAn;
    if (wbAn) waermebild(werte());
  });

  /* ---------- Bad: 1974 | Heute ---------- */
  $$("[data-bad]").forEach(function (b) {
    b.addEventListener("click", function () {
      var w = b.getAttribute("data-bad");
      root.classList.toggle("bad-1974-an", w === "1974");
      umschalter("bad", w);
    });
  });

  /* ---------- Küche: Lange rufen ---------- */
  var rufen = $(".lange-rufen"), status = $(".lange-status");
  var van = $(".van", svg), mAussen = $(".monteur-aussen", svg), mInnen = $(".monteur-innen", svg);
  function xy(attr, f) { var p = svg.getAttribute(attr).split(","); return "translate(" + (+p[0] * f) + "px," + (+p[1] * f) + "px)"; }
  function anim(el, frames, ms, delay) {
    return el.animate(frames, { duration: ms, delay: delay || 0, easing: "ease-in-out", fill: "forwards" }).finished;
  }
  function repariert(an) {
    root.classList.toggle("ist-repariert", an);
    if (an) status.textContent = "Repariert! Der Hahn tropft nicht mehr.";
  }
  if (rufen) rufen.addEventListener("click", function () {
    rufen.disabled = true;
    repariert(false);
    status.textContent = "Der Monteur ist unterwegs …";
    if (ruhig() || !van.animate) { repariert(true); rufen.disabled = false; return; }
    var weg = xy("data-weg-aussen", 1), innenStart = xy("data-weg-innen", -1);
    anim(van, [{ transform: xy("data-van", -1), opacity: 0 }, { opacity: 1, offset: .25 }, { transform: "none", opacity: 1 }], 1600)
      .then(function () { return anim(mAussen, [{ opacity: 0, transform: "none" }, { opacity: 1, offset: .15 }, { transform: weg, opacity: 1, offset: .85 }, { transform: weg, opacity: 0 }], 1300); })
      .then(function () { return anim(mInnen, [{ opacity: 0, transform: innenStart }, { opacity: 1, offset: .2 }, { transform: "none", opacity: 1 }], 1300); })
      .then(function () { repariert(true); return anim(mInnen, [{ opacity: 1 }, { opacity: 1, offset: .6 }, { opacity: 0 }], 1400, 300); })
      .then(function () { return anim(van, [{ transform: "none", opacity: 1 }, { opacity: 1, offset: .7 }, { transform: xy("data-van", -1), opacity: 0 }], 1500); })
      .then(function () { [van, mAussen, mInnen].forEach(function (el) { el.getAnimations().forEach(function (a) { a.cancel(); }); }); rufen.disabled = false; });
  });

  /* ---------- Notfall-Modus „Rohrbruch?“ (höchstens 5 Sekunden) ---------- */
  var nKnopf = $(".notfall-knopf"), nKarte = $(".notfall-karte"), flut = $(".flut", svg), mKeller = $(".monteur-keller", svg);
  function notfallKarte() {
    nKarte.hidden = false;
    nKarte.classList.toggle("leuchtet", false); void nKarte.offsetWidth; nKarte.classList.toggle("leuchtet", true);
    $(".notfall-anruf", nKarte).focus({ preventScroll: true });
    nKnopf.disabled = false;
  }
  if (nKnopf) nKnopf.addEventListener("click", function () {
    nKnopf.disabled = true;
    nKarte.hidden = true;
    schritt = 0; anzeigen(null, 0); fertig();
    if (ruhig() || !flut.animate) { notfallKarte(); return; }
    var weg = xy("data-weg-aussen", 1), fern = xy("data-van", -1);
    var o = { duration: 4900, easing: "ease-in-out" };
    root.classList.toggle("spritzt", true);
    setTimeout(function () { root.classList.toggle("spritzt", false); }, 3100);
    flut.animate([{ transform: "translateY(26px)", opacity: 0 }, { opacity: 1, offset: .06 }, { transform: "none", opacity: 1, offset: .26 },
      { transform: "none", opacity: 1, offset: .64 }, { transform: "translateY(26px)", opacity: 0, offset: .82 }, { transform: "translateY(26px)", opacity: 0 }], o);
    van.animate([{ transform: fern, opacity: 0 }, { transform: fern, opacity: 0, offset: .16 }, { transform: "none", opacity: 1, offset: .42 },
      { transform: "none", opacity: 1, offset: .82 }, { transform: fern, opacity: 0 }], o);
    mAussen.animate([{ opacity: 0 }, { opacity: 0, transform: "none", offset: .43 }, { opacity: 1, offset: .46 },
      { opacity: 1, transform: weg, offset: .57 }, { opacity: 0, transform: weg, offset: .6 }, { opacity: 0, transform: weg }], o);
    mKeller.animate([{ opacity: 0 }, { opacity: 0, offset: .58 }, { opacity: 1, offset: .64 }, { opacity: 1, offset: .76 },
      { opacity: 0, offset: .86 }, { opacity: 0 }], o);
    setTimeout(notfallKarte, 4000);
  });
  if (nKarte) $(".notfall-zu", nKarte).addEventListener("click", function () { nKarte.hidden = true; nKnopf.focus(); });

  /* ---------- Heizungs-Check im Keller ---------- */
  var regler = $(".heizcheck-regler"), jahrOut = $(".heizcheck-jahr"), hText = $(".heizcheck-text"), abgasEl = $(".abgas-temp"), JAHR = jetzt.getFullYear();
  var SAETZE = { alt: "Ein Austausch lohnt sich oft.", mittel: "Regelmäßige Wartung hält sie effizient.", neu: "Sieht gut aus – wir warten auch ohne Vertrag." };
  function heizcheck() {
    var j = +regler.value, alter = JAHR - j, stufe = alter > 25 ? "alt" : (alter >= 10 ? "mittel" : "neu");
    // Abgastemperatur: alter Kessel ca. 150–200 °C, Brennwertkessel ca. 40–60 °C [PRÜFEN: fachlich mit Lange abstimmen]
    var abgas = stufe === "alt" ? Math.round(150 + Math.min(50, (alter - 25) * 2.5)) : Math.round(40 + alter * 0.8);
    A.kessel = stufe;
    jahrOut.textContent = j;
    abgasEl.textContent = abgas;
    regler.setAttribute("aria-valuetext", j + ", " + alter + " Jahre alt, Abgas etwa " + abgas + " Grad");
    root.classList.toggle("kessel-alt", stufe === "alt");
    root.classList.toggle("kessel-neu", stufe === "neu");
    hText.innerHTML = SAETZE[stufe] + ' <mark class="hinweis">[PRÜFEN: fachlich mit Lange abstimmen]</mark>';
    if (wbAn) waermebild(werte());
  }
  if (regler) { regler.max = JAHR; regler.value = JAHR - 15; regler.addEventListener("input", heizcheck); heizcheck(); }
  saison(monat >= 10 || monat <= 1 ? "winter" : "sommer");

  /* ---------- Bauteile: Liste in der Karte, Erklärung per Tippen, Hover oder Tastatur ---------- */
  var TEILE = {   // Kurz-Erklärungen [PRÜFEN: fachlich mit Lange abstimmen]
    kessel: ["Gas-Brennwertkessel", "Verbrennt Gas und erwärmt das Heizungswasser. Brennwert heißt: Er nutzt auch die Wärme im Abgas."],
    abgas: ["Abgasleitung", "Führt die Abgase über das Dach ins Freie. Beim Brennwertkessel sind sie nur noch handwarm."],
    pumpe: ["Umwälzpumpe", "Treibt das Heizungswasser durch alle Heizkörper. Je mehr Wärme gebraucht wird, desto schneller läuft sie."],
    sv: ["Sicherheitsventil", "Öffnet bei zu hohem Druck und lässt Wasser kontrolliert in den Abfluss."],
    mag: ["Ausdehnungsgefäß", "Warmes Wasser dehnt sich aus. Das Gefäß nimmt es auf und hält den Druck in der Anlage stabil."],
    verteiler: ["Heizkreisverteiler", "Verteilt das warme Wasser auf die Heizkreise im Haus: Vorlauf oben, Rücklauf unten."],
    speicher: ["Warmwasserspeicher", "Hält warmes Trinkwasser bereit, hier mit 60 °C. Kessel und Solaranlage heizen ihn auf."],
    gaszaehler: ["Gaszähler", "Misst, wie viel Gas der Kessel verbraucht. Davor sitzt die Absperreinrichtung."],
    wasserzaehler: ["Wasserzähler + Filter", "Am Hausanschluss: Absperrventil, Wasserzähler und ein Filter, der Schmutz aus dem Leitungswasser zurückhält."],
    kondensat: ["Kondensat", "Im Brennwertkessel wird aus dem Abgas Wasser. Dieses Kondensat läuft in den Abfluss."],
    solar: ["Solarleitung", "Bringt die Wärme von den Kollektoren auf dem Dach zum Speicher im Keller."],
    heizkoerper: ["Heizkörper", "Warmes Wasser kommt oben an (Vorlauf), gibt Wärme an den Raum ab und fließt unten abgekühlt zurück (Rücklauf)."],
    thermostat: ["Thermostatventil", "Der Thermostatkopf öffnet das Ventil so weit, wie der Raum Wärme braucht."],
    vorlauf: ["Vorlauf", "Die rote Leitung bringt warmes Heizungswasser vom Kessel zu den Heizkörpern."],
    ruecklauf: ["Rücklauf", "Die blaue Leitung führt das abgekühlte Wasser zurück zum Kessel."],
    steig: ["Steigleitungen", "Senkrechte Leitungen bringen Heizungs- und Trinkwasser in alle Etagen."],
    spuele: ["Spüle: kalt + warm", "Kaltwasser (grün) und Warmwasser (orange) kommen an der Armatur zusammen."],
    abwasser: ["Abwasser", "Abwasserleitungen haben Gefälle, damit das Wasser von allein zum Fallrohr läuft."],
    handtuch: ["Handtuchheizkörper", "Heizt das Bad und trocknet die Handtücher. Er hängt am Vor- und Rücklauf der Heizung."],
    dusche: ["Dusche: kalt + warm", "Die Armatur mischt Kalt- und Warmwasser auf Ihre Wunschtemperatur."],
    waschtisch: ["Waschtisch", "Kalt- und Warmwasser kommen von hinten, das Abwasser fließt mit Gefälle ab."],
    zirk: ["Zirkulation", "Eine kleine Pumpe hält das Warmwasser in Bewegung. So kommt es an jedem Hahn schnell warm an."],
    fallrohr: ["Fallrohr", "Sammelt das Abwasser aller Etagen und führt es in den Kanal."],
    kollektor: ["Solarkollektoren", "Fangen Sonnenwärme ein. Im Sommer decken sie den Großteil des Warmwassers."],
    solarstation: ["Solarstation + Pumpe", "Pumpt die Solarflüssigkeit zwischen Dach und Speicher, sobald die Sonne genug wärmt."]
  };
  var tLabels = $(".t-labels", svg);
  if (tLabels) svg.appendChild(tLabels);   // Schilder liegen über den Raum-Flächen und sind antippbar
  function zeigeTeil(id, teil) {
    var k = karten[id], info = k && $(".bauteil-info", k), t = TEILE[teil];
    if (!info || !t) return;
    info.innerHTML = "<strong>" + t[0] + ":</strong> " + t[1];
    $$(".bauteile-liste button", k).forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-teil") === teil)); });
    $$(".t-label", svg).forEach(function (l) { l.classList.toggle("is-gewaehlt", l.getAttribute("data-r") === id && l.getAttribute("data-teil") === teil); });
  }
  Object.keys(karten).forEach(function (id) {
    var labs = $$('.t-label[data-r="' + id + '"]', svg);
    if (!labs.length) return;
    var box = document.createElement("div");
    box.className = "bauteile";
    box.innerHTML = '<p class="bauteile-titel">Technik in diesem Raum</p><ol class="bauteile-liste"></ol><p class="bauteil-info" aria-live="polite">Tippen Sie auf ein Bauteil.</p>';
    labs.forEach(function (l) {
      var teil = l.getAttribute("data-teil"), li = document.createElement("li"), b = document.createElement("button");
      b.type = "button"; b.setAttribute("data-teil", teil); b.setAttribute("aria-pressed", "false");
      b.innerHTML = '<span class="bauteil-nr" aria-hidden="true">' + l.getAttribute("data-nr") + "</span>" + TEILE[teil][0];
      b.addEventListener("click", function () { zeigeTeil(id, teil); });
      li.appendChild(b); $(".bauteile-liste", box).appendChild(li);
      l.addEventListener("click", function () { zeigeTeil(id, teil); });
    });
    var reihe = $$(".btn-row", karten[id]).pop();
    karten[id].insertBefore(box, reihe);
  });

  /* ---------- Rohrzange als Mauszeiger: „packt“ beim Klicken zu ---------- */
  buehne.addEventListener("pointerdown", function (e) {
    if (e.pointerType !== "mouse") return;
    buehne.classList.toggle("packt", true);
    setTimeout(function () { buehne.classList.toggle("packt", false); }, 220);
  });
})();
