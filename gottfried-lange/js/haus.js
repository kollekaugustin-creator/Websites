// Das Lange-Haus auf der Startseite.
// - Baut sich auf: Bodenplatte → Stockwerke → Dach → Rohre → Wasser + Flamme → warme Fenster.
//   Ab 768 px an das Scrollen gekoppelt (runter = aufbauen, hoch = zurückbauen),
//   auf dem Handy einmal automatisch (ca. 3 Sekunden).
// - Räume sind Buttons: Klick/Tippen zoomt auf den Raum und zeigt eine Infokarte.
// - Bei „Bewegung reduzieren“: Haus sofort fertig, keine Animation, Klick öffnet direkt die Karte.
// Ohne JavaScript bleiben die drei Leistungs-Karten sichtbar.
(function () {
  "use strict";
  var root = document.querySelector(".haus");
  if (!root || !window.SVGElement) return;

  var section = root.closest("section");
  var fallback = section.querySelector(".service-cards");
  var svg = root.querySelector(".haus-svg");
  var buehne = root.querySelector(".haus-buehne");
  var zoomEl = root.querySelector(".haus-zoom");
  var scroller = root.querySelector(".haus-scroll");
  var rooms = Array.prototype.slice.call(svg.querySelectorAll(".raum"));
  var reveals = Array.prototype.slice.call(svg.querySelectorAll("rect.reveal"));
  var motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var wide = window.matchMedia("(min-width: 768px)");

  // Haus statt Karten zeigen
  root.hidden = false;
  if (fallback) fallback.hidden = true;
  section.classList.add("mit-haus");

  // Abschnitts-Überschrift: ab Tablet neben dem Haus, auf dem Handy darüber
  var intro = section.querySelector(".section-intro");
  var seite = root.querySelector(".haus-seite");
  var introPlatz = intro ? intro.parentNode : null;
  function introSetzen() {
    if (!intro) return;
    if (wide.matches) { if (intro.parentNode !== seite) seite.insertBefore(intro, seite.firstChild); }
    else if (intro.parentNode !== introPlatz) introPlatz.insertBefore(intro, introPlatz.firstChild);
  }

  /* ---------- Rohre: Länge messen, damit sie sich „verlegen“ können ---------- */
  var pipes = Array.prototype.slice.call(svg.querySelectorAll(".rohr")).map(function (el) {
    return { el: el, len: el.getTotalLength(), seq: +el.getAttribute("data-seq") };
  });
  pipes.sort(function (a, b) { return a.seq - b.seq; });
  var pipeTotal = pipes.reduce(function (s, p) { return s + p.len; }, 0);

  /* ---------- Aufbau zeichnen (p von 0 bis 1) ---------- */
  var PHASES = {
    platte: [0, 0.08], keller: [0.08, 0.22], eg: [0.22, 0.38], og: [0.38, 0.52],
    dach: [0.52, 0.64], rohre: [0.64, 0.84], wasser: [0.84, 0.92], warm: [0.92, 1]
  };
  function seg(p, name) {
    var r = PHASES[name];
    return Math.max(0, Math.min(1, (p - r[0]) / (r[1] - r[0])));
  }
  var current = -1;
  function render(p) {
    p = Math.max(0, Math.min(1, p));
    if (Math.abs(p - current) < 0.0005) return;
    current = p;
    var st = svg.style;
    st.setProperty("--p-platte", seg(p, "platte").toFixed(3));
    st.setProperty("--p-dach", seg(p, "dach").toFixed(3));
    st.setProperty("--p-wasser", seg(p, "wasser").toFixed(3));
    st.setProperty("--p-warm", seg(p, "warm").toFixed(3));
    reveals.forEach(function (r) {
      var f = seg(p, r.getAttribute("data-stock"));
      var yb = +r.getAttribute("data-yb"), yt = +r.getAttribute("data-yt");
      r.setAttribute("y", (yb - f * (yb - yt)).toFixed(1));
    });
    var drawn = seg(p, "rohre") * pipeTotal;
    pipes.forEach(function (pp) {
      var show = Math.max(0, Math.min(pp.len, drawn));
      drawn -= pp.len;
      pp.el.style.strokeDasharray = pp.len + " " + pp.len;
      pp.el.style.strokeDashoffset = (pp.len - show).toFixed(1);
    });
    root.classList.toggle("is-fertig", p >= 0.999);
  }
  function renderFertig() {
    current = -1;
    render(1);
    pipes.forEach(function (pp) { pp.el.style.strokeDasharray = ""; pp.el.style.strokeDashoffset = ""; });
  }

  /* ---------- Aufbau steuern ---------- */
  var mode = null, autoDone = false, autoRaf = 0, ticking = false;
  function kopfHoehe() {
    var h = document.querySelector(".site-header");
    return h ? h.getBoundingClientRect().height : 0;
  }
  function scrollProgress() {
    // Start: Haus kommt ins Bild (Oberkante bei 60 % der Bildschirmhöhe).
    // Ende: nach 75 % der „eingerasteten“ Strecke – der Rest bleibt zum Ausprobieren.
    var r = scroller.getBoundingClientRect();
    var kopf = kopfHoehe();
    var strecke = scroller.offsetHeight - window.innerHeight + kopf;
    var start = window.innerHeight * 0.6;
    var weg = start - kopf + Math.max(0, strecke) * 0.75;
    return weg > 0 ? (start - r.top) / weg : 1;
  }
  function autoPlay() {
    if (autoDone) return;
    var r = buehne.getBoundingClientRect();
    if (r.top > window.innerHeight * 0.75 || r.bottom < 0) return;
    autoDone = true;
    var start = null, dauer = 3000;
    function step(t) {
      if (!start) start = t;
      var x = Math.min(1, (t - start) / dauer);
      render(x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
      if (x < 1) autoRaf = requestAnimationFrame(step); else renderFertig();
    }
    autoRaf = requestAnimationFrame(step);
  }
  function update() {
    ticking = false;
    if (mode === "scroll" && !offen) render(scrollProgress());
    else if (mode === "auto") autoPlay();
  }
  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }
  function setMode() {
    introSetzen();
    var m = motion.matches ? "fertig" : (wide.matches ? "scroll" : "auto");
    if (m === mode) return;
    mode = m;
    cancelAnimationFrame(autoRaf);
    root.setAttribute("data-modus", m);
    if (m === "fertig") renderFertig();
    else if (m === "auto") { if (autoDone) renderFertig(); else { render(0); autoPlay(); } }
    else update();
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  [motion, wide].forEach(function (mq) {
    if (mq.addEventListener) mq.addEventListener("change", setMode); else mq.addListener(setMode);
  });
  setMode();

  /* ---------- Leben nur, wenn das Haus im Bild ist (spart Akku) ---------- */
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (e) {
      root.classList.toggle("is-sichtbar", e[0].isIntersecting);
    }).observe(buehne);
  } else root.classList.add("is-sichtbar");

  /* ---------- Räume: hervorheben, zoomen, Infokarte ---------- */
  var offen = null;
  var karten = {};
  Array.prototype.forEach.call(root.querySelectorAll(".haus-karte"), function (k) {
    karten[k.getAttribute("data-raum")] = k;
  });
  var labels = {};
  Array.prototype.forEach.call(svg.querySelectorAll(".raum-label"), function (l) {
    labels[l.getAttribute("data-raum")] = l;
  });

  function hot(id, an) {
    if (labels[id]) labels[id].classList.toggle("is-hot", an);
  }

  function zoomAuf(poly) {
    if (motion.matches) return;
    var vb = svg.viewBox.baseVal;
    var bb = poly.getBBox();
    var w = buehne.clientWidth, h = buehne.clientHeight;
    var u = w / vb.width;
    var rx = (bb.x - vb.x) * u, ry = (bb.y - vb.y) * u, rw = bb.width * u, rh = bb.height * u;
    var z = Math.min(w * 0.95 / rw, h * 0.85 / rh, 2.1);
    var tx = w / 2 - (rx + rw / 2) * z;
    var ty = h / 2 - (ry + rh / 2) * z;
    zoomEl.style.transform = "translate(" + tx.toFixed(1) + "px," + ty.toFixed(1) + "px) scale(" + z.toFixed(3) + ")";
  }

  function oeffnen(poly) {
    var id = poly.getAttribute("data-raum");
    if (offen) schliessen(false);
    offen = poly;
    if (mode === "scroll" || mode === "auto") { cancelAnimationFrame(autoRaf); autoDone = true; renderFertig(); }
    root.classList.add("is-offen");
    poly.classList.add("is-aktiv");
    hot(id, true);
    rooms.forEach(function (r) { r.setAttribute("tabindex", "-1"); r.setAttribute("aria-expanded", r === poly ? "true" : "false"); });
    zoomAuf(poly);
    var k = karten[id];
    k.hidden = false;
    var titel = k.querySelector("h3");
    titel.focus({ preventScroll: true });
    if (!wide.matches) k.scrollIntoView({ behavior: motion.matches ? "auto" : "smooth", block: "nearest" });
  }

  function schliessen(fokus) {
    if (!offen) return;
    var poly = offen, id = poly.getAttribute("data-raum");
    offen = null;
    root.classList.remove("is-offen");
    poly.classList.remove("is-aktiv");
    hot(id, false);
    zoomEl.style.transform = "";
    karten[id].hidden = true;
    rooms.forEach(function (r) { r.setAttribute("tabindex", "0"); r.setAttribute("aria-expanded", "false"); });
    if (fokus !== false) poly.focus({ preventScroll: true });
    onScroll();
  }

  rooms.forEach(function (r) {
    var id = r.getAttribute("data-raum");
    r.setAttribute("aria-expanded", "false");
    r.setAttribute("aria-controls", "haus-karte-" + id);
    r.addEventListener("click", function () { oeffnen(r); });
    r.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); oeffnen(r); }
    });
    r.addEventListener("mouseenter", function () { hot(id, true); });
    r.addEventListener("mouseleave", function () { if (offen !== r) hot(id, false); });
    r.addEventListener("focus", function () { hot(id, true); });
    r.addEventListener("blur", function () { if (offen !== r) hot(id, false); });
  });
  Array.prototype.forEach.call(root.querySelectorAll(".haus-zurueck"), function (b) {
    b.addEventListener("click", function () { schliessen(true); });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && offen) schliessen(true);
  });
  window.addEventListener("resize", function () { if (offen) zoomAuf(offen); });
})();
