// Speisekarte: Umschalter „Speisen | Getränke“, Filter „Nur vegetarisch“
// und die Kategorie-Leiste, die beim Scrollen die aktuelle Kategorie markiert.
// Ohne JavaScript bleibt alles sichtbar, die Knöpfe sind dann einfache Sprunglinks.
(function () {
  var karte = document.querySelector("[data-karte]");
  if (!karte) return;

  var bereiche = karte.querySelectorAll("[data-bereich]");
  var bereichKnoepfe = document.querySelectorAll("[data-bereich-knopf]");
  var leisten = document.querySelectorAll("[data-leiste]");
  var leiste = document.querySelector(".kategorie-leiste");
  var steuerung = document.querySelector(".karte-steuerung");
  var filterKnopf = document.querySelector("[data-filter-veg]");
  var filterStatus = document.querySelector("[data-filter-status]");
  var aktuell = "speisen";

  document.documentElement.classList.add("karte-js");

  // ---------- Umschalter Speisen | Getränke ----------
  function bereichZeigen(name, nachObenScrollen) {
    aktuell = name;
    for (var i = 0; i < bereiche.length; i++) bereiche[i].hidden = bereiche[i].getAttribute("data-bereich") !== name;
    for (var j = 0; j < leisten.length; j++) leisten[j].hidden = leisten[j].getAttribute("data-leiste") !== name;
    for (var k = 0; k < bereichKnoepfe.length; k++) {
      var aktiv = bereichKnoepfe[k].getAttribute("data-bereich-knopf") === name;
      if (aktiv) bereichKnoepfe[k].setAttribute("aria-current", "true");
      else bereichKnoepfe[k].removeAttribute("aria-current");
    }
    // Der vegetarisch-Filter gilt nur für Speisen
    if (filterKnopf) filterKnopf.hidden = name !== "speisen";
    if (nachObenScrollen && steuerung) {
      var oben = steuerung.getBoundingClientRect().top + window.scrollY - 8;
      if (window.scrollY > oben) window.scrollTo({ top: oben });
    }
    beobachten();
  }

  for (var i = 0; i < bereichKnoepfe.length; i++) {
    bereichKnoepfe[i].addEventListener("click", function (e) {
      e.preventDefault();
      bereichZeigen(this.getAttribute("data-bereich-knopf"), true);
    });
  }

  // Ein Sprunglink (z. B. #bier) öffnet automatisch den passenden Bereich
  function bereichAusAdresse() {
    var ziel = location.hash && document.getElementById(location.hash.slice(1));
    var b = ziel && ziel.closest ? ziel.closest("[data-bereich]") : null;
    return b ? b.getAttribute("data-bereich") : (location.hash === "#getraenke" ? "getraenke" : "speisen");
  }
  window.addEventListener("hashchange", function () {
    var b = bereichAusAdresse();
    if (b !== aktuell) bereichZeigen(b, false);
  });

  // ---------- Filter „Nur vegetarisch“ ----------
  if (filterKnopf) {
    filterKnopf.addEventListener("click", function () {
      var an = filterKnopf.getAttribute("aria-pressed") !== "true";
      filterKnopf.setAttribute("aria-pressed", an ? "true" : "false");
      document.documentElement.classList.toggle("nur-veg", an);
      if (filterStatus) {
        var anzahl = karte.querySelectorAll('[data-bereich="speisen"] .gericht[data-veg]').length;
        filterStatus.textContent = an ? anzahl + " vegetarische Gerichte werden angezeigt." : "Alle Gerichte werden angezeigt.";
      }
      beobachten();
    });
  }

  // ---------- Leiste: aktuelle Kategorie markieren ----------
  var beobachter = null;
  function markieren(id) {
    var links = leiste.querySelectorAll("a");
    for (var i = 0; i < links.length; i++) {
      var treffer = links[i].getAttribute("href") === "#" + id;
      if (treffer) {
        links[i].setAttribute("aria-current", "true");
        // Leiste seitlich so verschieben, dass der markierte Eintrag sichtbar ist
        var ul = links[i].closest("ul");
        var li = links[i].parentNode;
        if (ul && (li.offsetLeft < ul.scrollLeft || li.offsetLeft + li.offsetWidth > ul.scrollLeft + ul.clientWidth)) {
          ul.scrollTo({ left: li.offsetLeft - 16, behavior: "smooth" });
        }
      } else {
        links[i].removeAttribute("aria-current");
      }
    }
  }

  function beobachten() {
    if (!("IntersectionObserver" in window)) return;
    if (beobachter) beobachter.disconnect();
    beobachter = new IntersectionObserver(function (eintraege) {
      for (var i = 0; i < eintraege.length; i++) {
        if (eintraege[i].isIntersecting) markieren(eintraege[i].target.id);
      }
    }, { rootMargin: "-25% 0px -65% 0px" });
    var kats = karte.querySelectorAll('[data-bereich="' + aktuell + '"] [data-kategorie]');
    for (var j = 0; j < kats.length; j++) beobachter.observe(kats[j]);
  }

  // Leiste bekommt einen Schatten, sobald sie oben „klebt“
  if (leiste && "IntersectionObserver" in window) {
    var marke = document.createElement("div");
    marke.setAttribute("aria-hidden", "true");
    leiste.parentNode.insertBefore(marke, leiste);
    new IntersectionObserver(function (e) {
      leiste.classList.toggle("klebt", !e[0].isIntersecting);
    }).observe(marke);
  }

  bereichZeigen(bereichAusAdresse(), false);
  // Kam man über einen Sprunglink, nach dem Umschalten noch einmal dorthin springen
  if (location.hash.length > 1) {
    var ziel = document.getElementById(location.hash.slice(1));
    if (ziel) ziel.scrollIntoView();
  }
})();
