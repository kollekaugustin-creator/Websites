// Das Brauhaus Schlebusch – kleines Skript für alle Seiten.
// 1. Menü auf dem Handy auf- und zuklappen
// 2. Karte erst nach Klick laden
// 3. Inhalte aus dem CMS laden (Ordner content/): Einstellungen,
//    Tagesangebot und Speisekarte. Wenn das nicht klappt, bleiben die
//    festen Texte im HTML stehen bzw. es erscheint ein Hinweis mit Telefonnummer.

document.documentElement.classList.add("js");

var TELEFON_FALLBACK = "0214 8505860";
var WOCHENTAGE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

var preisFormat = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
function preis(zahl) {
  var n = Number(zahl);
  return isNaN(n) ? "" : preisFormat.format(n);
}

function el(tag, klasse, text) {
  var e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}

function ladeJson(pfad) {
  return fetch(pfad, { cache: "no-cache" }).then(function (antwort) {
    if (!antwort.ok) throw new Error("Laden fehlgeschlagen: " + pfad);
    return antwort.json();
  });
}

/* ---------- 1. Menü ---------- */
function initMenue() {
  var button = document.querySelector(".menu-toggle");
  var nav = document.getElementById("hauptmenue");
  if (!button || !nav) return;
  button.hidden = false;

  function setOpen(open) {
    nav.classList.toggle("is-open", open);
    button.setAttribute("aria-expanded", open ? "true" : "false");
    button.textContent = open ? "Schließen" : "Menü";
  }
  button.addEventListener("click", function () {
    setOpen(button.getAttribute("aria-expanded") !== "true");
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && nav.classList.contains("is-open")) {
      setOpen(false);
      button.focus();
    }
  });
}

/* Höhe der Kopfzeile merken, damit die Sprungleiste der Speisekarte
   direkt darunter kleben bleibt */
function merkeKopfHoehe() {
  var header = document.querySelector(".site-header");
  if (!header) return;
  document.documentElement.style.setProperty("--kopf-hoehe", header.offsetHeight + "px");
}

/* ---------- 2. Karte erst nach Klick ---------- */
function initKarte() {
  var box = document.querySelector(".map[data-map-src]");
  if (!box) return;
  var button = box.querySelector(".map-load");
  if (!button) return;
  button.addEventListener("click", function () {
    var iframe = document.createElement("iframe");
    iframe.src = box.getAttribute("data-map-src");
    iframe.title = "Karte: Das Brauhaus Schlebusch, Saarstraße 1, 51375 Leverkusen";
    iframe.loading = "lazy";
    iframe.referrerPolicy = "no-referrer-when-downgrade";
    box.innerHTML = "";
    box.appendChild(iframe);
  });
}

/* ---------- 3a. Einstellungen ---------- */
function zeigeEinstellungen(daten) {
  // Reservierungs-Buttons: Ziel und Text
  if (daten.reservierungs_link) {
    document.querySelectorAll("[data-reservieren]").forEach(function (a) {
      a.setAttribute("href", daten.reservierungs_link);
    });
  }
  if (daten.button_text) {
    document.querySelectorAll("[data-reservieren-text]").forEach(function (s) {
      s.textContent = daten.button_text;
    });
  }
  if (daten.telefon) {
    document.querySelectorAll("[data-telefon]").forEach(function (s) {
      s.textContent = daten.telefon;
    });
  }
  if (daten.kuechenschluss) {
    document.querySelectorAll("[data-kuechenschluss]").forEach(function (s) {
      s.textContent = daten.kuechenschluss;
    });
  }

  // Hinweis-Zeile ganz oben
  var hinweis = document.querySelector("[data-hinweis]");
  if (hinweis) {
    if (daten.hinweis_aktiv && daten.hinweis) {
      hinweis.textContent = daten.hinweis;
      hinweis.hidden = false;
    } else {
      hinweis.hidden = true;
    }
  }

  var zeiten = Array.isArray(daten.oeffnungszeiten) ? daten.oeffnungszeiten : [];
  if (!zeiten.length) return;
  var heuteName = WOCHENTAGE[new Date().getDay()];

  // Große Tabelle (Seite Reservierung & Anfahrt)
  document.querySelectorAll("[data-oeffnungszeiten]").forEach(function (tbody) {
    tbody.innerHTML = "";
    zeiten.forEach(function (z) {
      var tr = el("tr");
      if (z.tag === heuteName) tr.className = "ist-heute";
      var th = el("th", null, z.tag);
      th.scope = "row";
      tr.appendChild(th);
      tr.appendChild(el("td", null, z.ruhetag ? "Ruhetag" : z.zeiten));
      tbody.appendChild(tr);
    });
  });

  // Kurze Liste (Fußzeile)
  document.querySelectorAll("[data-oeffnungszeiten-kurz]").forEach(function (ul) {
    ul.innerHTML = "";
    zeiten.forEach(function (z) {
      ul.appendChild(el("li", null, z.tag.slice(0, 2) + ": " + (z.ruhetag ? "Ruhetag" : z.zeiten)));
    });
  });

  // „Heute geöffnet“ (Startseite)
  var heute = document.querySelector("[data-heute]");
  if (heute) {
    var eintrag = zeiten.filter(function (z) { return z.tag === heuteName; })[0];
    if (eintrag) {
      heute.textContent = eintrag.ruhetag
        ? "Heute (" + heuteName + ") ist Ruhetag."
        : "Heute geöffnet: " + eintrag.zeiten + " Uhr";
      heute.hidden = false;
    }
  }
}

/* ---------- 3b. Tagesangebot ---------- */
function istGueltig(angebot) {
  if (!angebot || angebot.aktiv === false) return false;
  if (!angebot.gueltig_bis) return true;
  var bis = new Date(angebot.gueltig_bis + "T23:59:59");
  if (isNaN(bis.getTime())) return true;
  return new Date() <= bis;
}

function zeigeTagesangebot(daten) {
  var ziele = document.querySelectorAll("[data-tagesangebot]");
  if (!ziele.length) return;
  var angebote = (daten && Array.isArray(daten.angebote) ? daten.angebote : []).filter(istGueltig);

  ziele.forEach(function (ziel) {
    var abschnitt = ziel.closest("[data-tagesangebot-abschnitt]");
    ziel.innerHTML = "";
    if (!angebote.length) {
      if (abschnitt) abschnitt.hidden = true;
      return;
    }
    angebote.forEach(function (a) {
      var karte = el("article", "angebot");
      karte.appendChild(el("h3", null, a.titel));
      if (a.beschreibung) karte.appendChild(el("p", null, a.beschreibung));
      if (a.preis !== undefined && a.preis !== null && a.preis !== "") {
        karte.appendChild(el("p", "preis", preis(a.preis)));
      }
      ziel.appendChild(karte);
    });
    if (abschnitt) abschnitt.hidden = false;
  });
}

/* ---------- 3c. Speisekarte ---------- */
function ankerName(text, i) {
  return "kat-" + i + "-" + String(text).toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function zeigeSpeisekarte(daten) {
  var ziel = document.querySelector("[data-speisekarte]");
  if (!ziel) return;
  var leiste = document.querySelector("[data-sprungleiste]");
  var kategorien = daten && Array.isArray(daten.kategorien) ? daten.kategorien : [];
  if (!kategorien.length) throw new Error("Speisekarte leer");

  ziel.innerHTML = "";
  if (leiste) leiste.innerHTML = "";

  kategorien.forEach(function (kat, i) {
    var id = ankerName(kat.titel, i);
    var abschnitt = el("section", "kategorie");
    abschnitt.id = id;
    abschnitt.setAttribute("aria-labelledby", id + "-titel");
    var h2 = el("h2", null, kat.titel);
    h2.id = id + "-titel";
    abschnitt.appendChild(h2);
    if (kat.hinweis) abschnitt.appendChild(el("p", "kategorie-hinweis", kat.hinweis));

    var liste = el("ul", "gerichte");
    (kat.gerichte || []).forEach(function (g) {
      var li = el("li", "gericht");
      var name = el("span", "gericht-name", g.name);
      if (g.kennzeichnung && g.kennzeichnung.length) {
        var k = el("span", "kennzeichen", g.kennzeichnung.join(", "));
        k.setAttribute("aria-label", "Kennzeichnung " + g.kennzeichnung.join(", "));
        name.appendChild(k);
      }
      if (g.vegan) name.appendChild(el("span", "tag", "vegan"));
      else if (g.vegetarisch) name.appendChild(el("span", "tag", "vegetarisch"));
      li.appendChild(name);
      li.appendChild(el("span", "gericht-preis", preis(g.preis)));
      if (g.beschreibung) li.appendChild(el("span", "gericht-beschreibung", g.beschreibung));
      liste.appendChild(li);
    });
    abschnitt.appendChild(liste);
    ziel.appendChild(abschnitt);

    if (leiste) {
      var li = el("li");
      var a = el("a", null, kat.titel);
      a.href = "#" + id;
      li.appendChild(a);
      leiste.appendChild(li);
    }
  });
}

function zeigeFallback(ziel) {
  if (!ziel) return;
  ziel.innerHTML = "";
  var box = el("p", "fallback");
  box.appendChild(document.createTextNode("Die Speisekarte lädt gerade nicht. Rufen Sie uns gern an: "));
  var a = el("a", null, TELEFON_FALLBACK);
  a.href = "tel:+492148505860";
  box.appendChild(a);
  box.appendChild(document.createTextNode("."));
  ziel.appendChild(box);
}

/* ---------- Start ---------- */
document.addEventListener("DOMContentLoaded", function () {
  initMenue();
  initKarte();
  merkeKopfHoehe();
  window.addEventListener("resize", merkeKopfHoehe);

  ladeJson("content/einstellungen.json")
    .then(zeigeEinstellungen)
    .catch(function () { /* feste Texte im HTML bleiben stehen */ });

  if (document.querySelector("[data-tagesangebot]")) {
    ladeJson("content/tagesangebot.json")
      .then(zeigeTagesangebot)
      .catch(function () { zeigeTagesangebot(null); });
  }

  var karte = document.querySelector("[data-speisekarte]");
  if (karte) {
    ladeJson("content/speisekarte.json")
      .then(zeigeSpeisekarte)
      .catch(function () {
        zeigeFallback(karte);
        var leiste = document.querySelector(".sprungleiste");
        if (leiste) leiste.hidden = true;
      });
  }
});
