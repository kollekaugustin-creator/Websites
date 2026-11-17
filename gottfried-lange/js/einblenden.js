// Abschnitte weiter unten blenden beim Scrollen dezent ein (400 ms).
// Was beim Laden schon sichtbar ist, bleibt ruhig (keine Ladeanimation).
// Bei „Bewegung reduzieren“ im Betriebssystem passiert gar nichts.
document.addEventListener("DOMContentLoaded", function () {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var pending = [];
  document.querySelectorAll("main > section").forEach(function (section) {
    if (section.getBoundingClientRect().top > window.innerHeight) {
      section.classList.add("reveal");
      pending.push(section);
    }
  });
  if (!pending.length) return;

  var ticking = false;
  function check() {
    ticking = false;
    var limit = window.innerHeight * 0.9;
    // Alles, was im Bild ist oder schon darüber liegt, wird sichtbar –
    // auch wenn man mit einem Sprung daran vorbeigescrollt ist.
    pending = pending.filter(function (section) {
      if (section.getBoundingClientRect().top < limit) {
        section.classList.add("is-visible");
        return false;
      }
      return true;
    });
    if (!pending.length) {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    }
  }
  function onScroll() {
    if (!ticking) { ticking = true; window.requestAnimationFrame(check); }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
});
