// =====================================================================
// Heerdter Brauhaus – Kegelbahn in 3D (feiern.html, ganz oben)
//
// Ablauf:
// 1. Seite lädt: Vollbild-Szene, Kamera tief hinter der Kugel.
// 2. Die erste kleine Scroll-/Wischbewegung (oder Pfeil runter, Leertaste,
//    Klick) startet den Wurf. Das Scrollen ist dabei kurz gesperrt (max. 3,5 s).
// 3. Der Wurf ist eine feste Aufnahme (js/kegel-wurf.json), vorab mit echter
//    Physik berechnet (js/vendor/kegel-wurf-aufnehmen.mjs). Die Seite spielt
//    sie nur ab: immer gleich gut, ruckelfrei auch auf dem Handy.
//    Beim Aufprall: kurze Zeitlupe, leichter Kamera-Wackler, Staub.
// 4. Liegt alles, blendet das Bild in Ochsenblut über und die Seite gleitet
//    zum Abschnitt „Saal“. Ganz nach oben zurück: Kegel stehen wieder.
//
// Ersatz (kein WebGL, „Bewegung reduzieren“, zu langsames Gerät):
// das Foto img/kegelbahn.jpg, normales Scrollen.
//
// Zum Testen in der Adresszeile:
//   feiern.html?kegeln=an   → 3D immer zeigen (ohne Geschwindigkeits-Prüfung)
//   feiern.html?kegeln=aus  → immer das Foto zeigen
// =====================================================================


// ---------------------------------------------------------------------
// EINSTELLUNGEN – hier kann man den Effekt anpassen
// ---------------------------------------------------------------------
const EINSTELLUNGEN = {
  // --- Wurf ---
  anlaufMeter: 5,           // so weit rollt die Kugel sichtbar, bevor die Aufnahme beginnt
  zeitlupe: 0.25,           // Tempo in der Zeitlupe (0.25 = viermal langsamer)
  zeitlupeDauer: 0.6,       // Sekunden Zeitlupe beim Aufprall
  wackler: 0.012,           // Stärke des Kamera-Wacklers beim Aufprall (Meter)
  pauseNachWurf: 0.5,       // Sekunden nach dem neunten Kegel bis zur Überblendung
  sperreMax: 3.5,           // Scrollen höchstens so lange sperren (Sekunden)

  // --- Kamera ---
  kamera: {
    sichtfeldDesktop: 30,   // Bildwinkel in Grad (klein = Teleobjektiv-Look)
    sichtfeldHandy: 46,
    hoehe: 0.27,            // Kamera tief hinter der Kugel (Meter über der Bahn)
    abstand: 1.7,          // Abstand hinter der Kugel (Meter)
    aufprall: { x: 0.42, y: 0.42, z: 2.35 },   // Blick auf die Kegel beim Aufprall
    ende: { x: 0.1, y: 1.0, z: 3.3 },          // Überblick, wenn alles liegt
  },

  // --- Farben ---
  farbeUmgebung: "#1C0606",     // sehr dunkles Ochsenblut
  farbeKegel: "#F7F2E8",
  farbeRinge: "#B3261E",

  // Unter dieser Bildrate wird zuerst vereinfacht, dann aufs Foto umgeschaltet
  minBilderProSekunde: 30,
};


// ---------------------------------------------------------------------
// Start: prüfen, ob 3D sinnvoll ist, dann nachladen, sobald sichtbar
// ---------------------------------------------------------------------
const bereich = document.querySelector("[data-kegeln]");
if (bereich) vorbereiten();

function vorbereiten() {
  const modus = new URLSearchParams(location.search).get("kegeln"); // "an" oder "aus"
  const erzwungen = modus === "an";
  if (modus === "aus") return;
  if (!erzwungen && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!webglMoeglich()) return;

  const beobachter = new IntersectionObserver((eintraege) => {
    if (!eintraege[0].isIntersecting) return;
    beobachter.disconnect();
    laden(erzwungen);
  }, { rootMargin: "300px 0px" });
  beobachter.observe(bereich);
}

async function laden(erzwungen) {
  let THREE, wurf;
  try {
    [THREE, wurf] = await Promise.all([
      import("./vendor/three-glas.min.js"),
      fetch(new URL("kegel-wurf.json", import.meta.url)).then((r) => r.json()),
    ]);
  } catch (fehler) {
    return; // Dateien nicht ladbar → Foto bleibt
  }
  try {
    baueKegelbahn(THREE, wurf, erzwungen);
  } catch (fehler) {
    console.warn("3D-Kegelbahn konnte nicht starten:", fehler);
  }
}

function webglMoeglich() {
  try {
    return !!(window.WebGL2RenderingContext && document.createElement("canvas").getContext("webgl2"));
  } catch (e) {
    return false;
  }
}


// ---------------------------------------------------------------------
// Die Szene
// ---------------------------------------------------------------------
function baueKegelbahn(THREE, wurf, erzwungen) {
  const E = EINSTELLUNGEN;
  const handy = window.innerWidth < 700 || matchMedia("(pointer: coarse)").matches;
  const hochkant = () => bereich.clientWidth < bereich.clientHeight;

  const blende = bereich.querySelector("[data-kegel-blende]");
  const pfeil = bereich.querySelector("[data-kegel-start]");
  const ueberspringen = bereich.querySelector("[data-kegel-ueberspringen]");
  const zielAbschnitt = document.getElementById("saal");

  // ----- Zeichenfläche -----
  const canvas = document.createElement("canvas");
  canvas.className = "kegel-canvas";
  canvas.setAttribute("aria-hidden", "true");
  bereich.prepend(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: false, powerPreference: "high-performance" });
  const pixel = Math.min(window.devicePixelRatio || 1, handy ? 1.5 : 1.75);
  renderer.setPixelRatio(pixel);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const szene = new THREE.Scene();
  // Die Tonwert-Anpassung dunkelt Farben ab; der Hintergrund wird daher etwas
  // heller angelegt, damit er am Ende wie dunkles Ochsenblut aussieht (nicht schwarz).
  const dunkel = new THREE.Color(E.farbeUmgebung).multiplyScalar(2.6);
  szene.background = dunkel;
  szene.fog = new THREE.Fog(dunkel, 14, 34);

  // Umgebungsspiegelung (für Lack und Glanz), gedämpft für die warme, dunkle Stimmung
  const pmrem = new THREE.PMREMGenerator(renderer);
  szene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.03).texture;
  szene.environmentIntensity = 0.22;
  pmrem.dispose();

  const kamera = new THREE.PerspectiveCamera(handy ? E.kamera.sichtfeldHandy : E.kamera.sichtfeldDesktop, 1, 0.03, 40);

  // ----- Maße aus der Aufnahme -----
  const R = wurf.kugel.radius;
  const WAND_X = wurf.bahn.wandX;
  const RUECK_Z = wurf.bahn.rueckwandZ;
  const BAHN_B = wurf.bahn.breite;
  const TISCH_VORNE = 1.05;           // Vorderkante der Kegelstand-Platte
  const BAHN_ENDE = 22;               // so weit reicht die Bahn nach vorne
  const kegelPos = wurf.kegel.positionen;

  // ---------------------------------------------------------------------
  // Licht: warme Lichtleiste über dem Kegelstand, sonst dunkel
  // ---------------------------------------------------------------------
  szene.add(new THREE.HemisphereLight(0xffd9b0, 0x200808, 0.1));

  const hauptlicht = new THREE.SpotLight(0xffd29a, 7, 0, 0.95, 0.8, 2);
  hauptlicht.position.set(0, 0.96, 1.0);
  hauptlicht.target.position.set(0, 0, -0.25);
  hauptlicht.castShadow = true;
  hauptlicht.shadow.mapSize.set(handy ? 1024 : 2048, handy ? 1024 : 2048);
  hauptlicht.shadow.camera.near = 0.2;
  hauptlicht.shadow.camera.far = 4;
  hauptlicht.shadow.radius = handy ? 3 : 6;      // weicher Schattenrand
  hauptlicht.shadow.bias = -0.0002;
  hauptlicht.shadow.normalBias = 0.01;
  szene.add(hauptlicht, hauptlicht.target);

  const fuelllicht = new THREE.SpotLight(0xffb878, 2.2, 0, 1.0, 0.9, 2);
  fuelllicht.position.set(0, 0.96, -0.9);
  fuelllicht.target.position.set(0, 0, 0.3);
  szene.add(fuelllicht, fuelllicht.target);

  // Bahnlicht: folgt der Kugel und wirft ihren Schatten auf die Bahn
  const bahnlicht = new THREE.DirectionalLight(0xffd7a8, 0.55);
  bahnlicht.castShadow = !handy;
  bahnlicht.shadow.mapSize.set(1024, 1024);
  const sc = bahnlicht.shadow.camera;
  sc.left = -0.6; sc.right = 0.6; sc.top = 0.6; sc.bottom = -0.6; sc.near = 0.1; sc.far = 5;
  bahnlicht.shadow.radius = 5;
  bahnlicht.shadow.bias = -0.0003;
  szene.add(bahnlicht, bahnlicht.target);

  // ---------------------------------------------------------------------
  // Bahn, Kegelstand-Platte, Banden, Rückwand, Lichtleiste
  // ---------------------------------------------------------------------
  // Die Lauffläche ist leicht durchsichtig: darunter liegen gespiegelte
  // Kopien von Kugel und Kegeln. So spiegeln sich die Kegel im Glanz der Bahn.
  const bahnMaterial = new THREE.MeshPhysicalMaterial({
    map: bahnTextur(THREE, renderer), roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.16,
    transparent: true, opacity: 0.9,
  });
  const bahnLaenge = BAHN_ENDE - TISCH_VORNE;
  bahnMaterial.map.repeat.set(1, bahnLaenge / 3);
  const bahn = new THREE.Mesh(new THREE.PlaneGeometry(BAHN_B, bahnLaenge), bahnMaterial);
  bahn.rotation.x = -Math.PI / 2;
  bahn.position.z = TISCH_VORNE + bahnLaenge / 2;
  bahn.receiveShadow = true;
  szene.add(bahn);

  const tischMaterial = new THREE.MeshPhysicalMaterial({
    map: tischTextur(THREE, renderer, kegelPos, WAND_X, RUECK_Z, TISCH_VORNE), roughness: 0.35,
    clearcoat: 0.8, clearcoatRoughness: 0.12, transparent: true, opacity: 0.86,
  });
  const tisch = new THREE.Mesh(new THREE.PlaneGeometry(WAND_X * 2, TISCH_VORNE - RUECK_Z), tischMaterial);
  tisch.rotation.x = -Math.PI / 2;
  tisch.position.set(0, 0.0004, (TISCH_VORNE + RUECK_Z) / 2);
  tisch.receiveShadow = true;
  szene.add(tisch);

  // Dunkler Boden unter der durchsichtigen Bahn (dort liegen die Spiegelbilder)
  const unterboden = new THREE.Mesh(new THREE.PlaneGeometry(4, 30), new THREE.MeshBasicMaterial({ color: 0x0d0302 }));
  unterboden.rotation.x = -Math.PI / 2;
  unterboden.position.set(0, -0.9, 8);
  szene.add(unterboden);

  // Rinnen (Fehlwurfrinnen) links und rechts der Lauffläche
  const rinnenMat = new THREE.MeshStandardMaterial({ color: 0x2a1610, roughness: 0.45, metalness: 0.3, side: THREE.DoubleSide });
  const rinnenB = (WAND_X - BAHN_B / 2) / 2;
  for (const s of [-1, 1]) {
    const rinne = new THREE.Mesh(new THREE.CylinderGeometry(rinnenB, rinnenB, bahnLaenge, 20, 1, true, Math.PI / 2, Math.PI), rinnenMat);
    rinne.rotation.x = Math.PI / 2;
    rinne.position.set(s * (BAHN_B / 2 + rinnenB), 0, TISCH_VORNE + bahnLaenge / 2);
    rinne.receiveShadow = true;
    szene.add(rinne);
  }

  // Seitenbanden (dunkles Holz) entlang der Bahn und Seitenwände am Kegelstand
  const holzDunkel = new THREE.MeshStandardMaterial({ map: dunkelholzTextur(THREE), roughness: 0.5, metalness: 0 });
  for (const s of [-1, 1]) {
    const bande = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.24, bahnLaenge), holzDunkel);
    bande.position.set(s * (WAND_X + 0.05), 0.12, TISCH_VORNE + bahnLaenge / 2);
    bande.receiveShadow = true;
    szene.add(bande);
    const wand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, TISCH_VORNE - RUECK_Z), holzDunkel);
    wand.position.set(s * (WAND_X + 0.05), 0.5, (TISCH_VORNE + RUECK_Z) / 2);
    wand.receiveShadow = true;
    szene.add(wand);
  }

  // Gepolsterte Rückwand (gestepptes Leder)
  const polster = polsterTexturen(THREE);
  const rueckwand = new THREE.Mesh(
    new THREE.PlaneGeometry(WAND_X * 2, 1.0),
    new THREE.MeshStandardMaterial({ map: polster.farbe, bumpMap: polster.hoehe, bumpScale: 3, roughness: 0.55 })
  );
  rueckwand.position.set(0, 0.5, RUECK_Z);
  rueckwand.receiveShadow = true;
  szene.add(rueckwand);

  // Abdeckung über dem Kegelstand mit warmer Lichtleiste an der Vorderkante
  const abdeckung = new THREE.Mesh(new THREE.BoxGeometry(WAND_X * 2 + 0.2, 0.06, TISCH_VORNE - RUECK_Z + 0.1), new THREE.MeshStandardMaterial({ color: 0x140605, roughness: 0.8 }));
  abdeckung.position.set(0, 1.03, (TISCH_VORNE + RUECK_Z) / 2);
  szene.add(abdeckung);
  const blendeVorne = new THREE.Mesh(new THREE.BoxGeometry(WAND_X * 2 + 0.2, 0.34, 0.04), holzDunkel);
  blendeVorne.position.set(0, 1.17, TISCH_VORNE + 0.04);
  szene.add(blendeVorne);
  const leiste = new THREE.Mesh(
    new THREE.BoxGeometry(WAND_X * 2 - 0.1, 0.025, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x2a1a10, emissive: 0xffc77a, emissiveIntensity: 3.2 })
  );
  leiste.position.set(0, 0.99, TISCH_VORNE - 0.02);
  szene.add(leiste);

  // ---------------------------------------------------------------------
  // Kegel (Drehkörper mit echtem Profil) und Kugel
  // ---------------------------------------------------------------------
  const SP = wurf.kegel.schwerpunkt;
  const kegelGeo = kegelGeometrie(THREE, wurf.kegel.profil, SP, 1, handy);
  const gKoenig = wurf.kegel.koenigHoehe / wurf.kegel.hoehe;
  const koenigGeo = kegelGeometrie(THREE, wurf.kegel.profil, SP, gKoenig, handy);
  const lack = (karte) => new THREE.MeshPhysicalMaterial({
    map: karte, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.06, specularIntensity: 0.7,
  });
  const kegelMat = lack(kegelTextur(THREE, E.farbeKegel, E.farbeRinge, false, wurf.kegel.hoehe));
  const koenigMat = lack(kegelTextur(THREE, E.farbeKegel, E.farbeRinge, true, wurf.kegel.hoehe));

  const kugelMat = new THREE.MeshPhysicalMaterial({ map: kugelTextur(THREE), roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.03 });
  const kugel = new THREE.Mesh(new THREE.SphereGeometry(R, handy ? 32 : 48, handy ? 24 : 32), kugelMat);
  kugel.castShadow = true;
  szene.add(kugel);

  const kegel = kegelPos.map((p) => {
    const m = new THREE.Mesh(p.koenig ? koenigGeo : kegelGeo, p.koenig ? koenigMat : kegelMat);
    m.castShadow = true;
    m.receiveShadow = true;
    szene.add(m);
    return m;
  });

  // Spiegelbilder unter der Bahn (Glanz-Spiegelung)
  const spiegel = [kugel, ...kegel].map((original) => {
    const m = new THREE.Mesh(original.geometry, original.material);
    m.scale.y = -1;
    szene.add(m);
    return m;
  });

  // ---------------------------------------------------------------------
  // Staub beim Aufprall
  // ---------------------------------------------------------------------
  const STAUB = handy ? 50 : 110;
  const staubGeo = new THREE.BufferGeometry();
  const staubPos = new Float32Array(STAUB * 3);
  staubGeo.setAttribute("position", new THREE.BufferAttribute(staubPos, 3));
  const staubMat = new THREE.PointsMaterial({
    map: punktTextur(THREE), color: 0xffe2b8, size: handy ? 0.018 : 0.014, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const staub = new THREE.Points(staubGeo, staubMat);
  staub.frustumCulled = false;
  szene.add(staub);
  const staubV = [];
  function staubStarten(x, z) {
    for (let i = 0; i < STAUB; i++) {
      staubPos[i * 3] = x + (Math.random() - 0.5) * 0.15;
      staubPos[i * 3 + 1] = 0.02 + Math.random() * 0.05;
      staubPos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.12;
      const a = Math.random() * Math.PI * 2, s = 0.15 + Math.random() * 0.5;
      staubV[i] = [Math.cos(a) * s, 0.15 + Math.random() * 0.45, Math.sin(a) * s - 0.2];
    }
    staubGeo.attributes.position.needsUpdate = true;
  }

  // ---------------------------------------------------------------------
  // Bildeffekte (nur Computer): Ambient Occlusion, Tiefenschärfe, Glanz
  // ---------------------------------------------------------------------
  // Alle Geräte zeichnen über dieselbe Kette (mit Kantenglättung);
  // nur am Computer kommen Ambient Occlusion, Tiefenschärfe und Glanz dazu.
  let composer = null, aoPass = null, bokeh = null;
  const ziel = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }); // Kantenglättung
  composer = new THREE.EffectComposer(renderer, ziel);
  composer.addPass(new THREE.RenderPass(szene, kamera));
  if (!handy) {
    aoPass = new THREE.GTAOPass(szene, kamera, 1, 1);
    aoPass.blendIntensity = 0.85;
    aoPass.updateGtaoMaterial({ radius: 0.12, distanceExponent: 1.5, thickness: 1, scale: 1.2, samples: 12 });
    composer.addPass(aoPass);
    bokeh = new THREE.BokehPass(szene, kamera, { focus: 3, aperture: 0.0002, maxblur: 0.008 });
    composer.addPass(bokeh);
    composer.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(1, 1), 0.2, 0.4, 0.97));
  }
  composer.addPass(new THREE.OutputPass());

  // ---------------------------------------------------------------------
  // Größe anpassen
  // ---------------------------------------------------------------------
  const groesseAnpassen = () => {
    const b = bereich.clientWidth, h = bereich.clientHeight;
    if (!b || !h) return;
    renderer.setSize(b, h, false);
    if (composer) { composer.setPixelRatio(pixel); composer.setSize(b, h); }
    kamera.aspect = b / h;
    kamera.fov = hochkant() ? E.kamera.sichtfeldHandy : E.kamera.sichtfeldDesktop;
    kamera.updateProjectionMatrix();
  };
  groesseAnpassen();
  new ResizeObserver(groesseAnpassen).observe(bereich);

  // ---------------------------------------------------------------------
  // Aufnahme abspielen
  // ---------------------------------------------------------------------
  const FPS = wurf.fps;
  const bilder = wurf.bilder;
  const N = bilder.length;
  const start = wurf.kugel.start;                     // Kugel zu Aufnahmebeginn
  const tempo = Math.hypot(start.vx, start.vz);
  const richtung = new THREE.Vector3(start.vx / tempo, 0, start.vz / tempo);
  const rollAchse = new THREE.Vector3(start.vz, 0, -start.vx).normalize();
  const anlaufZeit = E.anlaufMeter / tempo;
  const alleLiegen = wurf.alleLiegen ?? wurf.ende;     // ab hier liegen alle Neune
  const qA = new THREE.Quaternion(), qB = new THREE.Quaternion();

  function koerperSetzen(mesh, i, f) {
    // f = Bildnummer (mit Nachkommastellen) → weich zwischen zwei Bildern
    const a = bilder[Math.min(N - 1, Math.floor(f))];
    const b = bilder[Math.min(N - 1, Math.floor(f) + 1)];
    const t = f - Math.floor(f);
    const o = i * 7;
    mesh.position.set(a[o] + (b[o] - a[o]) * t, a[o + 1] + (b[o + 1] - a[o + 1]) * t, a[o + 2] + (b[o + 2] - a[o + 2]) * t);
    qA.set(a[o + 3], a[o + 4], a[o + 5], a[o + 6]);
    qB.set(b[o + 3], b[o + 4], b[o + 5], b[o + 6]);
    mesh.quaternion.slerpQuaternions(qA, qB, t);
  }

  function szeneStellen(simZeit) {
    if (simZeit < 0) {
      // Anlauf: Kugel rollt gerade auf die Kegel zu (vor der Aufnahme)
      const weg = tempo * simZeit; // negativ
      kugel.position.set(start.x + richtung.x * weg, R, start.z + richtung.z * weg);
      kugel.quaternion.setFromAxisAngle(rollAchse, weg / R);
      for (let i = 0; i < 9; i++) koerperSetzen(kegel[i], i + 1, 0);
    } else {
      const f = Math.min(simZeit * FPS, N - 1);
      koerperSetzen(kugel, 0, f);
      for (let i = 0; i < 9; i++) koerperSetzen(kegel[i], i + 1, f);
    }
    // Spiegelbilder: an der Bahn gespiegelt
    const alle = [kugel, ...kegel];
    for (let i = 0; i < alle.length; i++) {
      const o = alle[i], s = spiegel[i];
      s.position.set(o.position.x, -o.position.y, o.position.z);
      s.quaternion.set(-o.quaternion.x, o.quaternion.y, -o.quaternion.z, o.quaternion.w);
    }
  }

  // ---------------------------------------------------------------------
  // Ablauf: bereit → wurf → pause → blende → fertig
  // ---------------------------------------------------------------------
  let zustand = "bereit";
  let simZeit = -anlaufZeit, rate = 1, aufprallReal = null, endeReal = null, blendeStart = null;
  let sperreBis = 0;
  let uhr = 0, letzteZeit = null, beendet = false, erstesBild = true;

  function zuruecksetzen() {
    zustand = "bereit";
    simZeit = -anlaufZeit;
    rate = 1;
    aufprallReal = endeReal = blendeStart = null;
    staubMat.opacity = 0;
    blende.style.opacity = "0";
    if (pfeil) pfeil.hidden = false;
    if (ueberspringen) ueberspringen.hidden = false;
    szeneStellen(simZeit);
  }

  function wurfStarten() {
    if (zustand !== "bereit" || beendet) return;
    zustand = "wurf";
    sperreBis = performance.now() / 1000 + E.sperreMax; // echte Uhrzeit, nicht Animationszeit
    if (pfeil) pfeil.hidden = true;
  }

  function zumSaal(sanft = true) {
    sperreBis = 0;
    if (zielAbschnitt) {
      const oben = zielAbschnitt.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: oben, behavior: sanft ? "smooth" : "auto" });
    }
  }

  // ----- Eingaben: erste Scroll-/Wischbewegung startet den Wurf -----
  const ganzOben = () => window.scrollY < 4;
  const gesperrt = () => performance.now() / 1000 < sperreBis;

  window.addEventListener("wheel", (e) => {
    if (beendet) return;
    if (zustand === "bereit" && ganzOben() && e.deltaY > 0) { e.preventDefault(); wurfStarten(); }
    else if (gesperrt()) e.preventDefault();
  }, { passive: false });

  let fingerY = null;
  window.addEventListener("touchstart", (e) => { fingerY = e.touches[0].clientY; }, { passive: true });
  window.addEventListener("touchmove", (e) => {
    if (beendet) return;
    const nachUnten = fingerY !== null && fingerY - e.touches[0].clientY > 4; // Finger nach oben = Seite runter
    if (zustand === "bereit" && ganzOben() && nachUnten) { e.preventDefault(); wurfStarten(); }
    else if (gesperrt()) e.preventDefault();
  }, { passive: false });

  window.addEventListener("keydown", (e) => {
    if (beendet) return;
    const runter = ["ArrowDown", "PageDown", "End", " "].includes(e.key);
    if (!runter || e.target.closest("input, textarea, select, button, a")) return;
    if (zustand === "bereit" && ganzOben()) { e.preventDefault(); wurfStarten(); }
    else if (gesperrt()) e.preventDefault();
  });

  canvas.addEventListener("click", wurfStarten);
  if (pfeil) { pfeil.hidden = false; pfeil.addEventListener("click", wurfStarten); }
  if (ueberspringen) {
    ueberspringen.hidden = false;
    ueberspringen.addEventListener("click", (e) => {
      e.preventDefault();
      if (zustand !== "fertig") { zustand = "fertig"; blende.style.opacity = "1"; }
      zumSaal(true);
    });
  }

  // Ganz nach oben zurückgescrollt → Kegel stehen wieder (leise zurückgesetzt)
  window.addEventListener("scroll", () => {
    if (!beendet && zustand === "fertig" && ganzOben()) zuruecksetzen();
  }, { passive: true });

  // Kam man per Sprunglink (#saal) oder Zurück-Navigation weiter unten an:
  // nicht sperren; die Szene wartet, bis man ganz nach oben scrollt.
  if (!ganzOben() || location.hash) {
    zustand = "fertig";
    blende.style.opacity = "1";
  }

  // ---------------------------------------------------------------------
  // Kamera
  // ---------------------------------------------------------------------
  const kPos = new THREE.Vector3(), kBlick = new THREE.Vector3();
  const zPos = new THREE.Vector3(), zBlick = new THREE.Vector3();
  const hinten = new THREE.Vector3(), aufprallPos = new THREE.Vector3(), endePos = new THREE.Vector3();
  const blickKegel = new THREE.Vector3(0, 0.16, -0.05);
  let kameraBereit = false;

  function kameraZiel(dt) {
    const h = hochkant();
    hinten.set(kugel.position.x * 0.6 + 0.05, E.kamera.hoehe + (h ? 0.08 : 0), kugel.position.z + E.kamera.abstand * (h ? 1.1 : 1));
    aufprallPos.set(E.kamera.aufprall.x * (h ? 0.6 : 1), E.kamera.aufprall.y, E.kamera.aufprall.z + (h ? 0.35 : 0));
    endePos.set(E.kamera.ende.x, E.kamera.ende.y + (h ? 0.15 : 0), E.kamera.ende.z + (h ? 0.6 : 0));

    if (zustand === "bereit") {
      // ruhig atmende Kamera hinter der Kugel
      zPos.copy(hinten);
      zPos.x += Math.sin(uhr * 0.5) * 0.02;
      zPos.y += Math.sin(uhr * 0.7) * 0.01;
      zBlick.copy(blickKegel);
    } else if (simZeit < wurf.aufprall - 0.25) {
      // Kugel folgen, kurz vor dem Aufprall zur Seite schwenken
      zPos.copy(hinten).lerp(aufprallPos, smooth(-0.35, wurf.aufprall - 0.25, simZeit));
      zBlick.copy(blickKegel);
    } else {
      // nach dem Aufprall langsam zurück in den Überblick
      const weg = smooth(wurf.aufprall + 0.2, alleLiegen + 0.4, simZeit);
      zPos.copy(aufprallPos).lerp(endePos, weg);
      zBlick.set(0, lerp(0.16, 0.06, weg), lerp(-0.05, -0.3, weg));
    }
    if (zustand === "blende" || (zustand === "fertig" && blendeStart !== null)) {
      // Kamera fährt ins Dunkle (nach oben über die Abdeckung)
      const t = smooth(0, 0.9, uhr - blendeStart);
      zPos.y += t * 0.5; zPos.z -= t * 1.6;
      zBlick.y += t * 0.9; zBlick.z -= t * 1.2;
    }

    if (!kameraBereit) { kPos.copy(zPos); kBlick.copy(zBlick); kameraBereit = true; }
    const weich = Math.min(1, dt * (zustand === "wurf" ? 7 : 3));
    kPos.lerp(zPos, weich);
    kBlick.lerp(zBlick, weich);
    kamera.position.copy(kPos);

    // Wackler beim Aufprall
    if (aufprallReal !== null) {
      const t = uhr - aufprallReal;
      if (t > 0 && t < 0.7) {
        const s = E.wackler * Math.exp(-t / 0.18);
        kamera.position.x += Math.sin(t * 61) * s;
        kamera.position.y += Math.sin(t * 47 + 1.3) * s * 0.7;
      }
    }
    kamera.lookAt(kBlick);
  }

  // ---------------------------------------------------------------------
  // Hauptschleife
  // ---------------------------------------------------------------------
  let messStart = null, messBilder = 0, schlechte = 0;
  const fokusPunkt = new THREE.Vector3(0, 0.15, 0.1);

  const bild = (jetzt) => {
    if (beendet) return;
    const dtRoh = letzteZeit === null ? 1 / 60 : (jetzt - letzteZeit) / 1000;
    letzteZeit = jetzt;
    const dt = Math.min(dtRoh, 1 / 20);
    uhr += dt;

    // --- Bildrate prüfen, solange die Szene noch ruhig wartet ---
    if (!erzwungen && zustand === "bereit" && uhr > 1 && uhr < 12) {
      if (dtRoh > 0.5) messStart = null;
      else if (messStart === null) { messStart = jetzt; messBilder = 0; }
      else {
        messBilder++;
        if (jetzt - messStart >= 1500) {
          const fps = (messBilder * 1000) / (jetzt - messStart);
          messStart = null;
          if (fps < 45 && aoPass && aoPass.enabled) {
            // zu langsam für alle Effekte: erst Ambient Occlusion und Tiefenschärfe weglassen
            aoPass.enabled = false;
            bokeh.enabled = false;
          } else if (fps < E.minBilderProSekunde) {
            schlechte++;
            if (schlechte >= 2) { aufFotoUmschalten(); return; }
          } else schlechte = 0;
        }
      }
    }

    // --- Wurf: Zeit vorrücken (mit Zeitlupe beim Aufprall) ---
    if (zustand === "wurf" || zustand === "pause" || zustand === "blende") {
      const zlStart = wurf.aufprall - 0.03;
      const inZeitlupe = simZeit > zlStart && simZeit < zlStart + E.zeitlupeDauer * E.zeitlupe;
      rate += ((inZeitlupe || E.zeitlupe === 0 ? E.zeitlupe : 1) - rate) * Math.min(1, dt * 14);
      simZeit += dt * rate;
      if (aufprallReal === null && simZeit >= wurf.aufprall) {
        aufprallReal = uhr;
        const vorne = kegelPos.reduce((a, b) => (b.z > a.z ? b : a));
        staubStarten(vorne.x, vorne.z);
      }
      if (zustand === "wurf" && simZeit >= alleLiegen) { zustand = "pause"; endeReal = uhr; }
      simZeit = Math.min(simZeit, wurf.ende);
    }
    if (zustand === "pause" && uhr - endeReal > E.pauseNachWurf) {
      zustand = "blende";
      blendeStart = uhr;
      sperreBis = 0;
      blende.style.opacity = "1";
      setTimeout(() => { if (zustand === "blende") { zustand = "fertig"; zumSaal(true); } }, 900);
    }

    szeneStellen(zustand === "bereit" ? -anlaufZeit : simZeit);

    // --- Staub ---
    if (aufprallReal !== null) {
      const t = uhr - aufprallReal;
      staubMat.opacity = Math.max(0, 0.55 * (1 - t / 1.8)) * Math.min(1, t * 8);
      const z = dt * rate;
      for (let i = 0; i < STAUB; i++) {
        const v = staubV[i];
        staubPos[i * 3] += v[0] * z; staubPos[i * 3 + 1] += v[1] * z; staubPos[i * 3 + 2] += v[2] * z;
        v[0] *= 0.985; v[1] = v[1] * 0.985 - 0.02 * z; v[2] *= 0.985;
      }
      staubGeo.attributes.position.needsUpdate = true;
    }

    // --- Bahnlicht folgt der Kugel ---
    bahnlicht.position.set(kugel.position.x + 0.5, 2.2, kugel.position.z + 0.9);
    bahnlicht.target.position.copy(kugel.position);

    kameraZiel(dt);

    // --- Tiefenschärfe nur beim Aufprall ---
    if (bokeh && bokeh.enabled) {
      bokeh.uniforms.focus.value = kamera.position.distanceTo(fokusPunkt);
      let staerke = 0;
      if (aufprallReal !== null && uhr > aufprallReal) staerke = Math.exp(-Math.max(0, uhr - aufprallReal - 0.35) / 0.5);
      bokeh.uniforms.aperture.value = 0.0001 + staerke * 0.0012;
    }

    if (composer) composer.render(); else renderer.render(szene, kamera);

    if (erstesBild) { erstesBild = false; bereich.classList.add("kegel-3d"); }
  };

  // ---------------------------------------------------------------------
  // Nur rechnen, wenn sichtbar
  // ---------------------------------------------------------------------
  let sichtbar = true;
  const laufenLassen = () => {
    if (beendet) return;
    if (sichtbar && !document.hidden) { letzteZeit = null; messStart = null; renderer.setAnimationLoop(bild); }
    else renderer.setAnimationLoop(null);
  };
  new IntersectionObserver((e) => { sichtbar = e[0].isIntersecting; laufenLassen(); }).observe(bereich);
  document.addEventListener("visibilitychange", laufenLassen);

  function aufFotoUmschalten() {
    beendet = true;
    sperreBis = 0;
    renderer.setAnimationLoop(null);
    bereich.classList.remove("kegel-3d", "kegel-bereit");
    if (pfeil) pfeil.hidden = true;
    if (ueberspringen) ueberspringen.hidden = true;
    blende.style.opacity = "0";
    setTimeout(() => { renderer.dispose(); renderer.forceContextLoss(); canvas.remove(); }, 600);
  }

  // Testhilfe (nur mit ?kegeln=an): bestimmte Stelle des Wurfs anzeigen
  if (erzwungen) {
    window.__kegelTest = {
      renderer, kamera, szene,
      zustand: () => zustand,
      zeit: () => simZeit,
      wurf,
      springen(t) {
        zustand = "wurf"; simZeit = t; rate = 1; sperreBis = 0;
        if (t >= wurf.aufprall && aufprallReal === null) { aufprallReal = uhr - (t - wurf.aufprall) * 2; const v = kegelPos.reduce((a, b) => (b.z > a.z ? b : a)); staubStarten(v.x, v.z); }
        kameraBereit = false;
      },
      anhalten() { E.zeitlupe = 0; rate = 0; },
    };
  }

  // Los geht's
  // Szene genau so hoch wie der sichtbare Bildschirm unter Kopfzeile und Entwurfs-Leiste
  const obenSetzen = () => bereich.style.setProperty("--kegel-oben", Math.round(bereich.getBoundingClientRect().top + window.scrollY) + "px");
  obenSetzen();
  window.addEventListener("resize", obenSetzen, { passive: true });
  bereich.classList.add("kegel-bereit");
  groesseAnpassen(); // der Bereich hat jetzt seine volle Höhe
  szeneStellen(simZeit);
  laufenLassen();
}


// ---------------------------------------------------------------------
// Kegel-Geometrie: Profil rundherum gedreht, Ursprung im Schwerpunkt.
// Die Höhe wird als Bildkoordinate gespeichert, damit die roten Ringe scharf sitzen.
// ---------------------------------------------------------------------
function kegelGeometrie(THREE, profil, schwerpunkt, g, handy) {
  const punkte = [];
  for (let i = 0; i < profil.length; i++) {
    const [r, y] = profil[i];
    if (i > 0) {
      const [r0, y0] = profil[i - 1];
      for (let k = 1; k < 3; k++) {
        const t = k / 3;
        punkte.push(new THREE.Vector2((r0 + (r - r0) * t) * g, (y0 + (y - y0) * t) * g));
      }
    }
    punkte.push(new THREE.Vector2(r * g, y * g));
  }
  const geo = new THREE.LatheGeometry(punkte, handy ? 40 : 64);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  const hoehe = profil[profil.length - 1][1] * g;
  for (let i = 0; i < pos.count; i++) uv.setY(i, pos.getY(i) / hoehe);
  geo.translate(0, -schwerpunkt * g, 0);
  return geo;
}

// Lack-Textur: Weiß mit roten Ringen am Hals, beim König roter Kopf
function kegelTextur(THREE, weiss, rot, koenig, hoehe) {
  const c = document.createElement("canvas");
  c.width = 4; c.height = 1024;
  const g = c.getContext("2d");
  g.fillStyle = weiss; g.fillRect(0, 0, 4, 1024);
  const band = (von, bis) => { g.fillStyle = rot; g.fillRect(0, 1024 - (bis / hoehe) * 1024, 4, ((bis - von) / hoehe) * 1024); };
  band(0.262, 0.272);
  band(0.286, 0.3);
  if (koenig) band(0.318, 0.401); else band(0.31, 0.316);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Kugel aus Kunstharz, leicht marmoriert (dunkelrot/bernstein)
function kugelTextur(THREE) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#5A1A0C"; g.fillRect(0, 0, 512, 256);
  let z = 11;
  const rnd = () => ((z = (z * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = i % 4 === 0 ? `rgba(20,4,2,${0.35 + rnd() * 0.3})` : `rgba(${170 + rnd() * 50},${70 + rnd() * 40},${25 + rnd() * 20},${0.18 + rnd() * 0.25})`;
    g.lineWidth = 1.5 + rnd() * 6;
    g.beginPath();
    let y = rnd() * 256;
    g.moveTo(-10, y);
    for (let x = 0; x <= 522; x += 12) { y += (rnd() - 0.5) * 12 + Math.sin(x / 40 + i) * 2; g.lineTo(x, y); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

// Lauffläche: helles Holz mit Fugen (1,5 m breit, 3 m lang je Kachel)
function bahnTextur(THREE, renderer) {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 2048;
  const g = c.getContext("2d");
  let z = 42;
  const rnd = () => ((z = (z * 16807) % 2147483647) / 2147483647);
  const bretter = 24;
  const b = c.width / bretter;
  for (let i = 0; i < bretter; i++) {
    const hell = 196 + rnd() * 26;
    g.fillStyle = `rgb(${hell + 30},${hell - 18},${hell - 95})`;
    g.fillRect(i * b, 0, b, c.height);
    for (let l = 0; l < 10; l++) {
      g.strokeStyle = `rgba(120,78,38,${0.04 + rnd() * 0.08})`;
      g.lineWidth = 0.6 + rnd() * 1.2;
      g.beginPath();
      const x = i * b + rnd() * b, w = 0.5 + rnd() * 2, p = rnd() * 6;
      for (let y = 0; y <= c.height; y += 24) {
        const xx = x + Math.sin(y / 110 + p) * w;
        if (y === 0) g.moveTo(xx, y); else g.lineTo(xx, y);
      }
      g.stroke();
    }
    // Stoßfuge des Bretts an versetzter Stelle, Längsfuge am Rand
    g.fillStyle = "rgba(70,40,18,.45)";
    g.fillRect(i * b, rnd() * c.height, b, 2);
    g.fillStyle = "rgba(70,40,18,.5)";
    g.fillRect(i * b, 0, 1.5, c.height);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
}

// Kegelstand-Platte mit Markierungen für die 9 Kegel
function tischTextur(THREE, renderer, positionen, wandX, rueckZ, vorneZ) {
  const breite = wandX * 2, tiefe = vorneZ - rueckZ;
  const px = 600; // Bildpunkte pro Meter
  const c = document.createElement("canvas");
  c.width = Math.round(breite * px); c.height = Math.round(tiefe * px);
  const g = c.getContext("2d");
  const verlauf = g.createLinearGradient(0, 0, 0, c.height);
  verlauf.addColorStop(0, "#C9B08A"); verlauf.addColorStop(1, "#D8C29C");
  g.fillStyle = verlauf; g.fillRect(0, 0, c.width, c.height);
  // feine Plattenfugen
  g.strokeStyle = "rgba(80,50,25,.35)"; g.lineWidth = 2;
  for (let x = 0; x < c.width; x += px * 0.43) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, c.height); g.stroke(); }
  // Vorderkante (Übergang Bahn → Kegelstand): unten im Bild
  g.fillStyle = "#6B3A1A"; g.fillRect(0, c.height - 10, c.width, 10);
  // Kreis und Punkt für jeden Kegel (Bild-Oben = hinten an der Rückwand)
  for (const p of positionen) {
    const x = (p.x + wandX) * px, y = (p.z - rueckZ) * px;
    const py = c.height - y;
    g.strokeStyle = "rgba(90,20,15,.75)"; g.lineWidth = 4;
    g.beginPath(); g.arc(x, py, 0.075 * px, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "rgba(90,20,15,.85)";
    g.beginPath(); g.arc(x, py, 0.012 * px, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
}

// Dunkles Holz für Banden und Wände
function dunkelholzTextur(THREE) {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = "#3A1F14"; g.fillRect(0, 0, 256, 512);
  let z = 5;
  const rnd = () => ((z = (z * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 60; i++) {
    g.strokeStyle = `rgba(${rnd() < 0.5 ? "20,8,4" : "90,50,28"},${0.15 + rnd() * 0.2})`;
    g.lineWidth = 1 + rnd() * 2;
    g.beginPath();
    const x = rnd() * 256;
    g.moveTo(x, 0);
    g.bezierCurveTo(x + rnd() * 10, 170, x - rnd() * 10, 340, x + rnd() * 6, 512);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Gestepptes Leder-Polster: Farbe + Höhenbild (für die Wölbungen)
function polsterTexturen(THREE) {
  const w = 1024, h = 600, raster = 86;
  const farbe = document.createElement("canvas"), hoehe = document.createElement("canvas");
  farbe.width = hoehe.width = w; farbe.height = hoehe.height = h;
  const f = farbe.getContext("2d"), q = hoehe.getContext("2d");
  f.fillStyle = "#4A1410"; f.fillRect(0, 0, w, h);
  q.fillStyle = "#000"; q.fillRect(0, 0, w, h);
  for (let y = -raster; y < h + raster; y += raster / 2) {
    const versatz = (Math.round(y / (raster / 2)) % 2) * raster / 2;
    for (let x = -raster; x < w + raster; x += raster) {
      const cx = x + versatz, cy = y;
      const v = q.createRadialGradient(cx, cy + raster / 4, 2, cx, cy + raster / 4, raster * 0.55);
      v.addColorStop(0, "rgba(255,255,255,.9)"); v.addColorStop(1, "rgba(255,255,255,0)");
      q.fillStyle = v; q.fillRect(cx - raster, cy - raster, raster * 2, raster * 2);
      const l = f.createRadialGradient(cx, cy + raster / 4, 2, cx, cy + raster / 4, raster * 0.55);
      l.addColorStop(0, "rgba(140,50,35,.35)"); l.addColorStop(1, "rgba(0,0,0,0)");
      f.fillStyle = l; f.fillRect(cx - raster, cy - raster, raster * 2, raster * 2);
      // Knopf
      f.fillStyle = "#1E0605"; f.beginPath(); f.arc(cx, cy, 4, 0, Math.PI * 2); f.fill();
      q.fillStyle = "#000"; q.beginPath(); q.arc(cx, cy, 6, 0, Math.PI * 2); q.fill();
    }
  }
  const tf = new THREE.CanvasTexture(farbe); tf.colorSpace = THREE.SRGBColorSpace;
  return { farbe: tf, hoehe: new THREE.CanvasTexture(hoehe) };
}

// Weicher runder Punkt für den Staub
function punktTextur(THREE) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const v = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  v.addColorStop(0, "rgba(255,255,255,1)"); v.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = v; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// ---------------------------------------------------------------------
// Kleine Helfer
// ---------------------------------------------------------------------
function clamp(w, a, b) { return Math.min(b, Math.max(a, w)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function smooth(von, bis, x) {
  const t = clamp((x - von) / (bis - von), 0, 1);
  return t * t * (3 - 2 * t);
}
