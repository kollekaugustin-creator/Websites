// Kontaktformular:
// 1. Klare deutsche Fehlermeldungen.
// 2. Mit JavaScript in 3 Schritten (Anliegen → Beschreibung → Kontakt) mit Fortschritt.
// Ohne JavaScript erscheint das ganze Formular auf einmal, der Browser prüft die Pflichtfelder.
// Name des Formulars und alle Feldnamen bleiben gleich, damit Netlify die Anfragen weiter annimmt.
document.addEventListener("DOMContentLoaded", function () {
  var form = document.querySelector(".contact-form");
  if (!form) return;

  form.setAttribute("novalidate", "");
  var fields = Array.prototype.slice.call(form.querySelectorAll("[data-error]"));

  function clearError(field) {
    var wrap = field.closest(".field");
    var msg = wrap.querySelector(".field-error");
    if (msg) msg.remove();
    wrap.classList.remove("has-error");
    field.removeAttribute("aria-invalid");
    field.removeAttribute("aria-describedby");
  }

  function showError(field) {
    var wrap = field.closest(".field");
    var msg = document.createElement("p");
    msg.className = "field-error";
    msg.id = field.id + "-fehler";
    msg.textContent = field.getAttribute("data-error");
    wrap.appendChild(msg);
    wrap.classList.add("has-error");
    field.setAttribute("aria-invalid", "true");
    field.setAttribute("aria-describedby", msg.id);
  }

  // Prüft eine Liste von Feldern; gibt das erste fehlerhafte zurück
  function pruefen(liste) {
    var erstes = null;
    liste.forEach(function (field) {
      clearError(field);
      if (!field.checkValidity()) {
        showError(field);
        if (!erstes) erstes = field;
      }
    });
    return erstes;
  }

  fields.forEach(function (field) {
    var wrap = field.closest(".field");
    wrap.addEventListener(field.type === "radio" ? "change" : "input", function () {
      if (field.checkValidity()) clearError(field);
    });
  });

  /* ---------- Schritte ---------- */
  var schritte = Array.prototype.slice.call(form.querySelectorAll(".schritt"));
  var fortschritt = form.querySelector(".form-fortschritt");
  var aktuell = 0;

  function zeige(n, fokus) {
    aktuell = n;
    schritte.forEach(function (s, i) { s.hidden = i !== n; });
    if (fortschritt) {
      fortschritt.style.setProperty("--stand", n / (schritte.length - 1));
      Array.prototype.forEach.call(fortschritt.children, function (li, i) {
        li.classList.toggle("is-aktiv", i === n);
        li.classList.toggle("is-fertig", i < n);
        if (i === n) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
      });
    }
    if (fokus) {
      var titel = schritte[n].querySelector(".schritt-titel");
      titel.focus({ preventScroll: true });
      var oben = form.getBoundingClientRect().top;
      if (oben < 80) window.scrollBy({ top: oben - 100, behavior: "smooth" });
    }
  }
  function felderVon(n) { return fields.filter(function (f) { return schritte[n].contains(f); }); }
  function weiter() {
    var fehler = pruefen(felderVon(aktuell));
    if (fehler) { fehler.focus(); return; }
    zeige(aktuell + 1, true);
  }

  if (schritte.length > 1) {
    form.classList.add("form--schritte");
    if (fortschritt) fortschritt.hidden = false;
    form.querySelectorAll(".schritt-knoepfe, .schritt-zurueck").forEach(function (el) { el.hidden = false; });
    form.querySelectorAll(".schritt-weiter").forEach(function (b) { b.addEventListener("click", weiter); });
    form.querySelectorAll(".schritt-zurueck").forEach(function (b) {
      b.addEventListener("click", function () { zeige(aktuell - 1, true); });
    });
    // Kachel gewählt → direkt weiter zu Schritt 2
    form.querySelectorAll('.schritt[data-schritt="1"] input[type="radio"]').forEach(function (r) {
      r.addEventListener("click", function (e) { if (e.detail > 0) setTimeout(weiter, 250); });
    });
    // Anliegen aus dem Link übernehmen, z. B. kontakt.html?anliegen=Heizung
    var vor = new URLSearchParams(location.search).get("anliegen");
    if (vor) {
      var r = form.querySelector('input[name="anliegen"][value="' + vor.replace(/[^A-Za-zÄÖÜäöü]/g, "") + '"]');
      if (r) r.checked = true;
    }
    zeige(0, false);
  }

  form.addEventListener("submit", function (e) {
    // Enter in Schritt 1 oder 2: nicht absenden, sondern weiter
    if (schritte.length > 1 && aktuell < schritte.length - 1) {
      e.preventDefault();
      weiter();
      return;
    }
    // Alle Felder prüfen; bei Fehler zum Schritt mit dem Fehler springen
    var fehler = pruefen(fields);
    if (fehler) {
      e.preventDefault();
      var n = schritte.findIndex(function (s) { return s.contains(fehler); });
      if (n > -1 && n !== aktuell) zeige(n, false);
      fehler.focus();
    }
  });
});
