// Hero-Video (img/hero.mp4): stumm, in Schleife, mit Standbild.
// Bei „Bewegung reduzieren“ bleibt nur das Standbild (img/hero.jpg).
// Fehlt die Videodatei, bleibt das Video einfach unsichtbar.
document.addEventListener("DOMContentLoaded", function () {
  var video = document.querySelector(".hero-video");
  if (!video) return;

  var motion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function stop() {
    video.pause();
    video.hidden = true;
  }

  function start() {
    if (motion.matches) return;
    if (!video.getAttribute("src")) video.src = video.getAttribute("data-src");
    var p = video.play();
    if (p && p.catch) p.catch(stop);
  }

  // Erst zeigen, wenn das Video wirklich läuft (kein schwarzer Kasten)
  video.addEventListener("playing", function () { video.hidden = false; });
  video.addEventListener("error", stop);

  if (motion.addEventListener) {
    motion.addEventListener("change", function () {
      if (motion.matches) stop(); else start();
    });
  }

  start();
});
