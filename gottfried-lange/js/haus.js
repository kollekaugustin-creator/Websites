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
  $$(".haus-leiste, .haus-entdecken, .rundgang-start").forEach(function (e) { e.hidden = false; });
  var alt = document.querySelector(".leistungen-ohne-js");
  if (alt) alt.hidden = true;
  root.classList.add("mit-js");

  /* ---------- Aufbau ---------- */
  var gruppen = {};
  $$(".rohr-teil", svg).forEach(function (el) {
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
  var raeume = $$(".raum", svg), karten = {}, labels = {};
  $$(".haus-karte").forEach(function (k) { karten[k.getAttribute("data-raum")] = k; });
  $$(".raum-label", svg).forEach(function (l) { labels[l.getAttribute("data-raum")] = l; });
  var tourNav = $(".tour-nav"), tourNr = $(".tour-nr"), offen = null, schritt = 0, modus = null;
  function hot(id, an) {
    if (labels[id]) labels[id].classList.toggle("is-hot", an);
    $$('.raum-farbe[data-raum="' + id + '"]', svg).forEach(function (f) { f.classList.toggle("aktiv", an); });
  }
  function poly(id) { return svg.querySelector('.raum[data-raum="' + id + '"]'); }

  function zoomAuf(id) {
    if (ruhig() || !id) { zoomEl.style.transform = ""; return; }
    var ziel = svg.querySelector('.zoom-ziel[data-raum="' + id + '"]') || poly(id);
    var vb = svg.viewBox.baseVal, bb = ziel.getBBox(), w = buehne.clientWidth, h = buehne.clientHeight, u = w / vb.width;
    var rw = bb.width * u, rh = bb.height * u, z = Math.min(w * 0.95 / rw, h * 0.85 / rh, 2.1);
    var tx = w / 2 - ((bb.x - vb.x) * u + rw / 2) * z, ty = h / 2 - ((bb.y - vb.y) * u + rh / 2) * z;
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
    r.addEventListener("mouseenter", function () { hot(id, true); });
    r.addEventListener("mouseleave", function () { if (offen !== id) hot(id, false); });
    r.addEventListener("focus", function () { hot(id, true); });
    r.addEventListener("blur", function () { if (offen !== id) hot(id, false); });
  });
  $$(".haus-zurueck").forEach(function (b) { b.addEventListener("click", schliessen); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && offen) schliessen(); });

  /* ---------- Jahreszeit + Abend ---------- */
  function umschalter(attr, wert) {
    $$("[data-" + attr + "]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-" + attr) === wert ? "true" : "false"); });
  }
  var jetzt = new Date(), monat = jetzt.getMonth(), stunde = jetzt.getHours();
  function saison(s) {
    root.classList.toggle("saison-winter", s === "winter");
    root.classList.toggle("saison-sommer", s === "sommer");
    umschalter("saison", s);
    setTemp(s === "winter" ? 21 : 17);
  }
  $$("[data-saison]").forEach(function (b) { b.addEventListener("click", function () { saison(b.getAttribute("data-saison")); }); });
  root.classList.toggle("abend", stunde >= 18 || stunde < 6);

  /* ---------- Wohnzimmer: Thermostat ---------- */
  var thermo = $(".thermostat"), knopf = $(".thermostat-knopf"), zahl = $(".thermostat-zahl"), temp = 21;
  function farbe(t) {
    var a = [79, 127, 209], b = [229, 72, 42];
    return "rgb(" + a.map(function (v, i) { return Math.round(v + (b[i] - v) * t); }).join(",") + ")";
  }
  function setTemp(v) {
    temp = Math.max(15, Math.min(25, Math.round(v * 2) / 2));
    var t = (temp - 15) / 10;
    svg.style.setProperty("--hk-farbe", farbe(t));
    svg.style.setProperty("--hk-farbe-d", farbe(t * 0.85));
    svg.style.setProperty("--waerme", Math.max(0, (t - 0.45) * 1.8).toFixed(2));
    if (!thermo) return;
    knopf.style.transform = "rotate(" + (-135 + t * 270) + "deg)";
    zahl.textContent = temp.toFixed(1).replace(".", ",");
    thermo.setAttribute("aria-valuenow", temp);
    thermo.setAttribute("aria-valuetext", zahl.textContent + " Grad");
  }
  if (thermo) {
    var ziehen = false;
    var winkel = function (e) {
      var r = thermo.getBoundingClientRect();
      var a = Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))) * 180 / Math.PI;
      setTemp(15 + (Math.max(-135, Math.min(135, a)) + 135) / 27);
    };
    thermo.addEventListener("pointerdown", function (e) { ziehen = true; thermo.setPointerCapture(e.pointerId); winkel(e); e.preventDefault(); });
    thermo.addEventListener("pointermove", function (e) { if (ziehen) winkel(e); });
    thermo.addEventListener("pointerup", function () { ziehen = false; });
    thermo.addEventListener("pointercancel", function () { ziehen = false; });
    thermo.addEventListener("keydown", function (e) {
      var d = { ArrowUp: .5, ArrowRight: .5, ArrowDown: -.5, ArrowLeft: -.5, PageUp: 2, PageDown: -2 }[e.key];
      if (e.key === "Home") setTemp(15); else if (e.key === "End") setTemp(25); else if (d) setTemp(temp + d); else return;
      e.preventDefault();
    });
  }
  saison(monat >= 10 || monat <= 1 ? "winter" : "sommer");

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
  var regler = $(".heizcheck-regler"), jahrOut = $(".heizcheck-jahr"), hText = $(".heizcheck-text"), JAHR = jetzt.getFullYear();
  var SAETZE = { alt: "Ein Austausch lohnt sich oft.", mittel: "Regelmäßige Wartung hält sie effizient.", neu: "Sieht gut aus – wir warten auch ohne Vertrag." };
  function heizcheck() {
    var j = +regler.value, alter = JAHR - j, stufe = alter > 25 ? "alt" : (alter >= 10 ? "mittel" : "neu");
    jahrOut.textContent = j;
    regler.setAttribute("aria-valuetext", j + ", " + alter + " Jahre alt");
    root.classList.toggle("kessel-alt", stufe === "alt");
    root.classList.toggle("kessel-neu", stufe === "neu");
    hText.innerHTML = SAETZE[stufe] + ' <mark class="hinweis">[PRÜFEN: fachlich mit Lange abstimmen]</mark>';
  }
  if (regler) { regler.max = JAHR; regler.value = JAHR - 15; regler.addEventListener("input", heizcheck); heizcheck(); }

  /* ---------- Rohrzange als Mauszeiger: „packt“ beim Klicken zu ---------- */
  buehne.addEventListener("pointerdown", function (e) {
    if (e.pointerType !== "mouse") return;
    buehne.classList.toggle("packt", true);
    setTimeout(function () { buehne.classList.toggle("packt", false); }, 220);
  });
})();
