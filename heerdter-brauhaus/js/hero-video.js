// Hero-Video der Startseite („Bier wird gezapft“).
// - Bei „Bewegung reduzieren“: Video gar nicht abspielen, nur das Posterbild zeigen.
// - Sonst: kleiner Knopf zum Anhalten/Weiterspielen (Barrierefreiheit).
// - Außerhalb des Bildschirms pausiert das Video, das spart Akku.
(function () {
  var video = document.querySelector("[data-hero-video]");
  if (!video) return;
  var knopf = document.querySelector("[data-hero-video-knopf]");
  var reduziert = window.matchMedia("(prefers-reduced-motion: reduce)");

  function nurPosterbild() {
    video.pause();
    video.removeAttribute("autoplay");
    // Quellen entfernen, damit das Video nicht weiter geladen wird
    var quellen = video.querySelectorAll("source");
    for (var i = 0; i < quellen.length; i++) quellen[i].remove();
    video.load();
    if (knopf) knopf.hidden = true;
  }

  if (reduziert.matches) {
    nurPosterbild();
    return;
  }
  if (reduziert.addEventListener) reduziert.addEventListener("change", function (e) { if (e.matches) nurPosterbild(); });

  var vomNutzerAngehalten = false;
  var PAUSE = '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>';
  var PLAY = '<path d="M8 5l11 7-11 7z"/>';

  function knopfAnzeigen() {
    if (!knopf) return;
    var laeuft = !video.paused;
    knopf.querySelector("svg").innerHTML = laeuft ? PAUSE : PLAY;
    knopf.setAttribute("aria-label", laeuft ? "Hintergrundvideo anhalten" : "Hintergrundvideo abspielen");
  }

  if (knopf) {
    knopf.hidden = false;
    knopf.addEventListener("click", function () {
      if (video.paused) { vomNutzerAngehalten = false; video.play(); }
      else { vomNutzerAngehalten = true; video.pause(); }
    });
    video.addEventListener("play", knopfAnzeigen);
    video.addEventListener("pause", knopfAnzeigen);
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (eintraege) {
      if (eintraege[0].isIntersecting) { if (!vomNutzerAngehalten) video.play().catch(function () {}); }
      else video.pause();
    }).observe(video);
  }
})();
