// Über-uns-Seite: Zeitstrahl und Zahlen-Leiste.
// - Die Linie des Zeitstrahls wächst beim Scrollen mit,
//   die Stationen blenden nacheinander ein.
// - Die großen Zahlen zählen beim Erscheinen kurz hoch.
// Bei „Bewegung reduzieren“ (oder ohne JavaScript) ist sofort alles sichtbar.
document.addEventListener("DOMContentLoaded", function () {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  /* ---------- Zeitstrahl ---------- */
  var timeline = document.querySelector(".timeline");
  var items = timeline ? Array.prototype.slice.call(timeline.querySelectorAll(".timeline-item")) : [];
  if (timeline) timeline.classList.add("timeline--animated");

  /* ---------- Zahlen ---------- */
  var numbers = Array.prototype.slice.call(document.querySelectorAll(".stat-number[data-count]"));
  numbers.forEach(function (el) { el.textContent = "0" + (el.getAttribute("data-suffix") || ""); });

  function countUp(el) {
    var target = parseInt(el.getAttribute("data-count"), 10);
    var suffix = el.getAttribute("data-suffix") || "";
    var duration = 1200;
    var startTime = null;
    function step(now) {
      if (!startTime) startTime = now;
      var t = Math.min((now - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - t, 3); // am Ende sanft abbremsen
      el.textContent = Math.round(target * eased) + suffix;
      if (t < 1) window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);
  }

  var ticking = false;
  function check() {
    ticking = false;
    var vh = window.innerHeight;

    if (timeline) {
      // Linie: wie weit die Bildschirmmitte schon in den Zeitstrahl hineinreicht
      var rect = timeline.getBoundingClientRect();
      var progress = (vh * 0.6 - rect.top) / rect.height;
      progress = Math.max(0, Math.min(1, progress));
      timeline.style.setProperty("--fortschritt", progress.toFixed(3));

      // Stationen nacheinander einblenden (bei mehreren gleichzeitig leicht versetzt)
      var delay = 0;
      items = items.filter(function (item) {
        if (item.getBoundingClientRect().top < vh * 0.85) {
          item.style.transitionDelay = delay + "ms";
          item.classList.add("is-visible");
          delay += 150;
          return false;
        }
        return true;
      });
    }

    numbers = numbers.filter(function (el) {
      if (el.getBoundingClientRect().top < vh * 0.9) {
        countUp(el);
        return false;
      }
      return true;
    });
  }

  function onScroll() {
    if (!ticking) { ticking = true; window.requestAnimationFrame(check); }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  check();
});
