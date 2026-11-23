// Das Lange-Haus auf der Startseite (Abschnitt „Unsere Leistungen“).
// Aufbau beim Scrollen (Handy: automatisch), danach lebt das Haus.
// Räume sind Buttons: Zoom + Infokarte mit Überraschung (Thermostat, Bad 1974, Monteur).
// Jahreszeit (Nov–Feb Winter) und Abend (ab 18 Uhr) automatisch, Sommer/Winter umschaltbar.
// „Bewegung reduzieren“: Haus sofort fertig, keine Animation. Ohne JS: die drei Karten.
(function () {
  "use strict";
  var root = document.querySelector(".haus");
  if (!root || !window.SVGElement) return;
  var $ = function (sel, el) { return (el || root).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || root).querySelectorAll(sel)); };

  var section = root.closest("section");
  var svg = $(".haus-svg"), buehne = $(".haus-buehne"), zoomEl = $(".haus-zoom"), scroller = $(".haus-scroll");
  var motion = matchMedia("(prefers-reduced-motion: reduce)");
  var wide = matchMedia("(min-width: 768px)");
  var ruhig = function () { return motion.matches; };

  root.hidden = false;
  var fallback = section.querySelector(".service-cards");
  if (fallback) fallback.hidden = true;

  // Überschrift: ab Tablet neben dem Haus, auf dem Handy darüber
  var intro = section.querySelector(".section-intro"), seite = $(".haus-seite");
  var introPlatz = intro && intro.parentNode;
  function introSetzen() {
    if (!intro) return;
    var ziel = wide.matches ? seite : introPlatz;
    if (intro.parentNode !== ziel) ziel.insertBefore(intro, ziel.firstChild);
  }

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

  var aktuell = -1;
  function render(p) {
    p = Math.max(0, Math.min(1, p));
    if (Math.abs(p - aktuell) < 0.0005) return;
    aktuell = p;
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
    root.classList.toggle("is-fertig", p >= 0.999);
  }
  function fertig() {
    aktuell = -1; render(1);
    rohre.forEach(function (r) { r.els.forEach(function (el) { el.style.strokeDasharray = el.style.strokeDashoffset = ""; }); });
  }

  var modus = null, autoFertig = false, autoRaf = 0, tick = false, offen = null;
  function kopf() { var h = document.querySelector(".site-header"); return h ? h.getBoundingClientRect().height : 0; }
  function scrollFortschritt() {
    var r = scroller.getBoundingClientRect(), k = kopf();
    var strecke = Math.max(0, scroller.offsetHeight - innerHeight + k), start = innerHeight * 0.6;
    var weg = start - k + strecke * 0.75;
    return weg > 0 ? (start - r.top) / weg : 1;
  }
  function autoStart() {
    if (autoFertig) return;
    var r = buehne.getBoundingClientRect();
    if (r.top > innerHeight * 0.75 || r.bottom < 0) return;
    autoFertig = true;
    var t0 = null;
    (function step(t) {
      if (!t0) t0 = t;
      var x = Math.min(1, (t - t0) / 3000);
      render(x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
      if (x < 1) autoRaf = requestAnimationFrame(step); else fertig();
    })(performance.now());
  }
  function update() {
    tick = false;
    if (modus === "scroll" && !offen) render(scrollFortschritt());
    else if (modus === "auto") autoStart();
  }
  function onScroll() { if (!tick) { tick = true; requestAnimationFrame(update); } }
  function setModus() {
    introSetzen();
    var m = ruhig() ? "fertig" : (wide.matches ? "scroll" : "auto");
    if (m === modus) return;
    modus = m;
    cancelAnimationFrame(autoRaf);
    root.setAttribute("data-modus", m);
    if (m === "fertig" || (m === "auto" && autoFertig)) fertig();
    else if (m === "auto") { render(0); autoStart(); }
    else update();
  }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  [motion, wide].forEach(function (mq) { mq.addEventListener ? mq.addEventListener("change", setModus) : mq.addListener(setModus); });
  setModus();
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (e) { root.classList.toggle("is-sichtbar", e[0].isIntersecting); }).observe(buehne);
  } else root.classList.add("is-sichtbar");

  /* ---------- Räume: hervorheben, zoomen, Infokarte ---------- */
  var raeume = $$(".raum", svg), karten = {}, labels = {};
  $$(".haus-karte").forEach(function (k) { karten[k.getAttribute("data-raum")] = k; });
  $$(".raum-label", svg).forEach(function (l) { labels[l.getAttribute("data-raum")] = l; });
  function hot(id, an) { if (labels[id]) labels[id].classList.toggle("is-hot", an); }

  function zoomAuf(poly) {
    if (ruhig()) return;
    var id = poly.getAttribute("data-raum");
    var ziel = svg.querySelector('.zoom-ziel[data-raum="' + id + '"]') || poly;
    var vb = svg.viewBox.baseVal, bb = ziel.getBBox(), w = buehne.clientWidth, h = buehne.clientHeight, u = w / vb.width;
    var rw = bb.width * u, rh = bb.height * u;
    var z = Math.min(w * 0.95 / rw, h * 0.85 / rh, 2.1);
    var tx = w / 2 - ((bb.x - vb.x) * u + rw / 2) * z, ty = h / 2 - ((bb.y - vb.y) * u + rh / 2) * z;
    zoomEl.style.transform = "translate(" + tx.toFixed(1) + "px," + ty.toFixed(1) + "px) scale(" + z.toFixed(3) + ")";
  }
  function oeffnen(poly) {
    var id = poly.getAttribute("data-raum");
    if (offen) schliessen(false);
    offen = poly;
    cancelAnimationFrame(autoRaf); autoFertig = true; fertig();
    root.classList.add("is-offen");
    hot(id, true);
    raeume.forEach(function (r) { r.setAttribute("tabindex", "-1"); r.setAttribute("aria-expanded", r === poly ? "true" : "false"); });
    zoomAuf(poly);
    var k = karten[id];
    k.hidden = false;
    $("h3", k).focus({ preventScroll: true });
    if (!wide.matches) k.scrollIntoView({ behavior: ruhig() ? "auto" : "smooth", block: "nearest" });
  }
  function schliessen(fokus) {
    if (!offen) return;
    var poly = offen, id = poly.getAttribute("data-raum");
    offen = null;
    root.classList.remove("is-offen");
    hot(id, false);
    zoomEl.style.transform = "";
    karten[id].hidden = true;
    raeume.forEach(function (r) { r.setAttribute("tabindex", "0"); r.setAttribute("aria-expanded", "false"); });
    if (fokus !== false) poly.focus({ preventScroll: true });
    onScroll();
  }
  raeume.forEach(function (r) {
    var id = r.getAttribute("data-raum");
    r.setAttribute("aria-expanded", "false");
    r.setAttribute("aria-controls", "haus-karte-" + id);
    r.addEventListener("click", function () { oeffnen(r); });
    r.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); oeffnen(r); } });
    r.addEventListener("mouseenter", function () { hot(id, true); });
    r.addEventListener("mouseleave", function () { if (offen !== r) hot(id, false); });
    r.addEventListener("focus", function () { hot(id, true); });
    r.addEventListener("blur", function () { if (offen !== r) hot(id, false); });
  });
  $$(".haus-zurueck").forEach(function (b) { b.addEventListener("click", function () { schliessen(true); }); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && offen) schliessen(true); });
  addEventListener("resize", function () { if (offen) zoomAuf(offen); });

  /* ---------- Umschalter (Jahreszeit, Bad) ---------- */
  function umschalter(attr, wert) {
    $$("[data-" + attr + "]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-" + attr) === wert ? "true" : "false"); });
  }

  /* ---------- Jahreszeit + Abend ---------- */
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
  var van = $(".van", svg), mAussen = $(".monteur-aussen", svg), mInnen = $(".monteur-innen", svg), haken = $(".repariert", svg);
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
})();
