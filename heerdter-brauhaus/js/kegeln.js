// =====================================================================
// Heerdter Brauhaus – „Alle Neune!“ (3D-Kegelbahn auf feiern.html)
//
// Beim Herunterscrollen bleibt der obere Bereich stehen und der Scroll-Weg
// schiebt die Kugel die Bahn hinunter. Kurz vor den Kegeln übernimmt die
// Physik (cannon-es): Die Kugel trifft, die Kegel fallen echt durcheinander.
// Danach erscheint „Alle Neune!“ (oder „Fast! …“).
//
// Deutsches Kegeln: 9 Kegel in einer Raute, der mittlere („König“) etwas
// größer mit rotem Kopf, Kugel ohne Grifflöcher.
//
// Ohne 3D (kein WebGL, „Bewegung reduzieren“, zu langsames Gerät) bleibt das
// Standbild (SVG) im HTML stehen, und die Seite scrollt ganz normal.
//
// Zum Testen in der Adresszeile:
//   feiern.html?kegeln=an   → 3D immer zeigen (ohne Geschwindigkeits-Prüfung)
//   feiern.html?kegeln=aus  → immer das Standbild zeigen
// =====================================================================


// ---------------------------------------------------------------------
// EINSTELLUNGEN – hier kann man den Effekt anpassen
// ---------------------------------------------------------------------
const EINSTELLUNGEN = {
  // --- Kugel ---
  // Diese Werte sind per Simulation abgestimmt: So fallen beim ersten Wurf
  // immer alle Neune (bei „Nochmal werfen“ etwa 17 von 20 Mal).
  kugelTempo: 6,          // Tempo beim Wurf (Meter pro Sekunde)
  zielX: 0.04,            // seitlicher Zielpunkt: 0 = genau auf den vorderen Kegel
  schraeg: 0.02,          // Kugel läuft leicht schräg von rechts in die Raute
  kugelMasse: 4,          // in Kilo (etwas schwerer als echt, damit es sicher kracht)

  // --- Scrollen ---
  scrollWegDesktop: 1.6,  // wie lange der Bereich stehen bleibt (in Bildschirmhöhen)
  scrollWegHandy: 1.1,    // auf dem Handy kürzer
  physikAb: 0.55,         // ab diesem Anteil des Scroll-Wegs übernimmt die Physik (0 bis 1)

  // --- Kamera ---
  kamera: {
    sichtfeldDesktop: 40,   // Bildwinkel in Grad
    sichtfeldHandy: 58,
    hoehe: 0.62,            // Kamerahöhe hinter der Kugel (Meter)
    abstand: 2.0,           // Abstand hinter der Kugel (Meter)
    // Blick auf die Kegel beim Abräumen (seitlich leicht erhöht)
    endeDesktop: { x: 0.45, y: 0.85, z: 1.9 },
    endeHandy: { x: 0.3, y: 0.95, z: 2.2 },
  },

  // --- Texte ---
  textAlleNeune: "Alle Neune!",
  textUnterzeile: "Freie Termine für Ihren Kegelabend",
  textButton: "Kegelbahn anfragen",
  textFast: "Fast! {anzahl} von 9 – probieren Sie es bei uns selbst.",
  textNochmal: "Nochmal werfen",
  textHinweis: "Scrollen Sie – die Kugel rollt.",

  // --- Farben ---
  farbeUmgebung: "#4A0E0E",  // Ochsenblut
  farbeKegel: "#F4EEE2",
  farbeKoenigKopf: "#B3261E",

  // Unter dieser Bildrate schaltet die Seite aufs Standbild um
  minBilderProSekunde: 30,
};


// ---------------------------------------------------------------------
// Maße (in Metern)
// ---------------------------------------------------------------------
const BAHN_BREITE = 1.2;
const BAHN_ENDE = -1.2;        // hinter den Kegeln
const KUGEL_RADIUS = 0.08;
const KEGEL_ABSTAND = 0.22;    // Abstand der Kegel entlang der Rauten-Seiten
const KEGEL_MASSE = 0.6;       // in Kilo
const KOENIG_GROESSE = 1.08;   // der König ist etwas größer
const ABWURF_Z = 2.0;          // hier übernimmt die Physik die Kugel
const START_Z_DESKTOP = 11;    // Startpunkt der Kugel
const START_Z_HANDY = 7;


// ---------------------------------------------------------------------
// Start: erst prüfen, ob 3D sinnvoll ist, dann nachladen, sobald sichtbar
// ---------------------------------------------------------------------
const bereich = document.querySelector("[data-kegeln]");
if (bereich) vorbereiten();

function vorbereiten() {
  const modus = new URLSearchParams(location.search).get("kegeln"); // "an" oder "aus"
  const erzwungen = modus === "an";
  if (modus === "aus") return;
  if (!erzwungen && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!webglMoeglich()) return;

  // Erst laden, wenn der Bereich in Sichtweite kommt
  const beobachter = new IntersectionObserver((eintraege) => {
    if (!eintraege[0].isIntersecting) return;
    beobachter.disconnect();
    laden(erzwungen);
  }, { rootMargin: "300px 0px" });
  beobachter.observe(bereich);
}

async function laden(erzwungen) {
  let THREE, CANNON;
  try {
    [THREE, CANNON] = await Promise.all([
      import("./vendor/three-glas.min.js"),
      import("./vendor/cannon-es.min.js"),
    ]);
  } catch (fehler) {
    return; // Dateien nicht ladbar → Standbild bleibt
  }
  try {
    baueKegelbahn(THREE, CANNON, erzwungen);
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
// Die 3D-Kegelbahn
// ---------------------------------------------------------------------
function baueKegelbahn(THREE, CANNON, erzwungen) {
  const E = EINSTELLUNGEN;
  const buehne = bereich.querySelector(".kegel-sticky");
  const ergebnis = bereich.querySelector("[data-kegel-ergebnis]");
  const ergebnisTitel = bereich.querySelector("[data-kegel-titel]");
  const ergebnisText = bereich.querySelector("[data-kegel-text]");
  const knopfAnfragen = bereich.querySelector("[data-kegel-anfragen]");
  const knopfNochmal = bereich.querySelector("[data-kegel-nochmal]");
  const hinweis = bereich.querySelector("[data-kegel-hinweis]");

  // Handy = schmaler Bildschirm oder Finger-Bedienung → einfachere Version
  const handy = window.innerWidth < 700 || matchMedia("(pointer: coarse)").matches;
  const hochkant = () => buehne.clientWidth < buehne.clientHeight;
  const startZ = handy ? START_Z_HANDY : START_Z_DESKTOP;

  // ----- Zeichenfläche -----
  const canvas = document.createElement("canvas");
  canvas.className = "kegel-canvas";
  canvas.setAttribute("aria-hidden", "true");
  buehne.prepend(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, handy ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Schatten (mit weichem Rand über shadow.radius) nur am Computer; auf dem Handy keine (spart Rechenzeit)
  renderer.shadowMap.enabled = !handy;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const szene = new THREE.Scene();
  const umgebung = new THREE.Color(E.farbeUmgebung);
  szene.background = umgebung;
  szene.fog = new THREE.Fog(umgebung, handy ? 6 : 8, handy ? 12 : 17); // Bahnende verschwindet im Dunkel

  const kamera = new THREE.PerspectiveCamera(handy ? E.kamera.sichtfeldHandy : E.kamera.sichtfeldDesktop, 1, 0.05, 40);

  // ----- Licht: warm von oben, Kegel hinten im Lichtkegel -----
  szene.add(new THREE.HemisphereLight(0xffd9a8, 0x2a0a0a, 0.55));

  const deckenlicht = new THREE.DirectionalLight(0xffd6a0, 1.6);
  deckenlicht.position.set(0.6, 4, 3);
  deckenlicht.castShadow = !handy;
  deckenlicht.shadow.mapSize.set(1024, 1024);
  deckenlicht.shadow.camera.left = -2.2;
  deckenlicht.shadow.camera.right = 2.2;
  deckenlicht.shadow.camera.top = 2.2;
  deckenlicht.shadow.camera.bottom = -2.2;
  deckenlicht.shadow.camera.near = 0.5;
  deckenlicht.shadow.camera.far = 10;
  deckenlicht.shadow.radius = 4;
  deckenlicht.shadow.bias = -0.0005;
  szene.add(deckenlicht, deckenlicht.target);

  const kegelLampe = new THREE.SpotLight(0xffc98a, 18, 6, 0.55, 0.6, 1.6);
  kegelLampe.position.set(0, 2.4, 0.2);
  kegelLampe.target.position.set(0, 0, -0.2);
  szene.add(kegelLampe, kegelLampe.target);

  // ----- Bahn mit Holz-Maserung (selbst gezeichnet) -----
  const bahnLaenge = startZ + 3 - BAHN_ENDE;
  const bahnMitteZ = (startZ + 3 + BAHN_ENDE) / 2;
  const holz = holzTextur(THREE, renderer);
  holz.repeat.set(1, bahnLaenge / 3);
  const bahn = new THREE.Mesh(
    new THREE.PlaneGeometry(BAHN_BREITE, bahnLaenge),
    new THREE.MeshStandardMaterial({ map: holz, roughness: 0.45, metalness: 0 })
  );
  bahn.rotation.x = -Math.PI / 2;
  bahn.position.z = bahnMitteZ;
  bahn.receiveShadow = !handy;
  szene.add(bahn);

  // Seitliche Rinnen (halbe Röhren) und Holzbanden
  const rinnenMaterial = new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.6, side: THREE.DoubleSide });
  const bandenMaterial = new THREE.MeshStandardMaterial({ color: 0x5a3320, roughness: 0.55 });
  for (const seite of [-1, 1]) {
    const rinne = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, bahnLaenge, 16, 1, true, Math.PI / 2, Math.PI), rinnenMaterial);
    rinne.rotation.x = Math.PI / 2;
    rinne.position.set(seite * 0.69, 0, bahnMitteZ);
    rinne.receiveShadow = !handy;
    szene.add(rinne);

    const bande = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, bahnLaenge), bandenMaterial);
    bande.position.set(seite * 0.81, 0.1, bahnMitteZ);
    szene.add(bande);

    // dunkle Holzvertäfelung an den Wänden
    const wand = new THREE.Mesh(new THREE.PlaneGeometry(bahnLaenge, 2.4), new THREE.MeshStandardMaterial({ color: 0x3b1a10, roughness: 0.8 }));
    wand.rotation.y = -seite * Math.PI / 2;
    wand.position.set(seite * 1.5, 1.0, bahnMitteZ);
    szene.add(wand);
  }

  // Rückwand hinter den Kegeln (dunkler Vorhang) und Fanggrube
  const rueckwand = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.4), new THREE.MeshStandardMaterial({ color: 0x2a0707, roughness: 0.9 }));
  rueckwand.position.set(0, 1.0, -1.3);
  szene.add(rueckwand);
  const grube = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.4), new THREE.MeshStandardMaterial({ color: 0x1e0805, roughness: 1 }));
  grube.rotation.x = -Math.PI / 2;
  grube.position.set(0, -0.15, -2.0);
  szene.add(grube);

  // Lampenschirm über den Kegeln
  const schirm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.3, 0.2, 24, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x2b1a10, roughness: 0.5, side: THREE.DoubleSide, emissive: 0x3a1a05 })
  );
  schirm.position.set(0, 2.45, 0.2);
  szene.add(schirm);

  // ----- Kegel (gedrechselt per LatheGeometry) -----
  const kegelGeoNormal = kegelGeometrie(THREE, 1, E.farbeKegel, null, handy);
  const kegelGeoKoenig = kegelGeometrie(THREE, KOENIG_GROESSE, E.farbeKegel, E.farbeKoenigKopf, handy);
  const kegelMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0 });

  // ----- Kugel ohne Grifflöcher, bernsteinfarben marmoriert -----
  const kugel = new THREE.Mesh(
    new THREE.SphereGeometry(KUGEL_RADIUS, handy ? 24 : 40, handy ? 16 : 28),
    new THREE.MeshPhysicalMaterial({ map: kugelTextur(THREE), roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 })
  );
  kugel.castShadow = !handy;
  szene.add(kugel);

  // ---------------------------------------------------------------------
  // Physik (cannon-es)
  // ---------------------------------------------------------------------
  // Für jeden Wurf wird die Physik-Welt frisch gebaut. So verhält sich jeder
  // Wurf genau wie berechnet (in einer wiederverwendeten Welt bleiben Reste
  // vom vorigen Wurf hängen, und die Kegel fallen anders).
  const d = KEGEL_ABSTAND / Math.SQRT2;
  const kegel = [];
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const koenig = i === 0 && j === 0;
      const g = koenig ? KOENIG_GROESSE : 1;
      const mesh = new THREE.Mesh(koenig ? kegelGeoKoenig : kegelGeoNormal, kegelMaterial);
      mesh.castShadow = !handy;
      szene.add(mesh);
      // 9 Kegel in der Raute: ein auf der Spitze stehendes 3×3-Quadrat
      kegel.push({ mesh, g, start: new CANNON.Vec3((i - j) * d, 0.14 * g, (i + j) * d), koerper: null });
    }
  }

  let welt = null;
  let kugelKoerper = null;

  function neueWelt() {
    welt = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0), allowSleep: true });
    welt.solver.iterations = 12;
    const matBahn = new CANNON.Material("bahn");
    const matKegel = new CANNON.Material("kegel");
    const matKugel = new CANNON.Material("kugel");
    welt.addContactMaterial(new CANNON.ContactMaterial(matKegel, matBahn, { friction: 0.35, restitution: 0.1 }));
    welt.addContactMaterial(new CANNON.ContactMaterial(matKegel, matKegel, { friction: 0.3, restitution: 0.7 }));
    welt.addContactMaterial(new CANNON.ContactMaterial(matKugel, matKegel, { friction: 0.1, restitution: 0.35 }));
    welt.addContactMaterial(new CANNON.ContactMaterial(matKugel, matBahn, { friction: 0.2, restitution: 0.05 }));

    const festerKoerper = (halbeMasse, pos) => {
      const k = new CANNON.Body({ mass: 0, material: matBahn });
      k.addShape(new CANNON.Box(new CANNON.Vec3(...halbeMasse)));
      k.position.set(...pos);
      welt.addBody(k);
    };
    festerKoerper([BAHN_BREITE / 2, 0.05, bahnLaenge / 2], [0, -0.05, bahnMitteZ]);   // Bahn
    for (const seite of [-1, 1]) {
      festerKoerper([0.09, 0.05, bahnLaenge / 2], [seite * 0.69, -0.12, bahnMitteZ]);  // Rinne
      festerKoerper([0.03, 0.3, bahnLaenge / 2], [seite * 0.81, 0.1, bahnMitteZ]);     // Bande
    }
    festerKoerper([1, 0.5, 0.05], [0, 0.3, -1.3]);   // Rückwand
    festerKoerper([1, 0.05, 1], [0, -0.2, -2.0]);    // Fanggrube

    for (const k of kegel) {
      const g = k.g;
      const koerper = new CANNON.Body({ mass: KEGEL_MASSE * g, material: matKegel, allowSleep: true, sleepSpeedLimit: 0.08, sleepTimeLimit: 0.4 });
      // vereinfachte Form für die Physik: Fuß, Hals und Kopf
      koerper.addShape(new CANNON.Cylinder(0.05 * g, 0.038 * g, 0.18 * g, 10), new CANNON.Vec3(0, -0.05 * g, 0));
      koerper.addShape(new CANNON.Cylinder(0.02 * g, 0.05 * g, 0.11 * g, 10), new CANNON.Vec3(0, 0.095 * g, 0));
      koerper.addShape(new CANNON.Sphere(0.028 * g), new CANNON.Vec3(0, 0.19 * g, 0));
      koerper.position.copy(k.start);
      welt.addBody(koerper);
      koerper.sleep();
      k.koerper = koerper;
    }

    kugelKoerper = new CANNON.Body({
      mass: E.kugelMasse, material: matKugel, shape: new CANNON.Sphere(KUGEL_RADIUS),
      linearDamping: 0.01, angularDamping: 0.01,
    });
  }

  // ---------------------------------------------------------------------
  // Ablauf: rollen (Scroll steuert) → wurf (Physik) → fertig (Ergebnis)
  // ---------------------------------------------------------------------
  let zustand = "rollen";
  let wurfZeit = 0;
  let wurfX = E.zielX;
  const hilfsVektor = new CANNON.Vec3();
  const oben = new CANNON.Vec3(0, 1, 0);

  function kegelAufstellen() {
    neueWelt();
    for (const k of kegel) {
      k.mesh.position.set(k.start.x, k.start.y, k.start.z);
      k.mesh.quaternion.set(0, 0, 0, 1);
    }
  }

  function zuruecksetzen() {
    kegelAufstellen();
    zustand = "rollen";
    ergebnisVerstecken();
  }

  function werfen(zufall) {
    // Beim ersten Wurf immer genau gleich (so fallen alle Neune);
    // „Nochmal werfen“ streut etwas, damit es lebendig bleibt.
    wurfX = E.zielX + (zufall ? (Math.random() - 0.5) * 0.03 : 0);
    const tempo = E.kugelTempo + (zufall ? (Math.random() - 0.5) * 0.6 : 0);
    kugelKoerper.position.set(wurfX + E.schraeg * ABWURF_Z, KUGEL_RADIUS, ABWURF_Z);
    kugelKoerper.velocity.set(-E.schraeg * tempo, 0, -tempo);
    kugelKoerper.angularVelocity.set(-tempo / KUGEL_RADIUS, 0, 0); // rollt, rutscht nicht
    welt.addBody(kugelKoerper);
    zustand = "wurf";
    wurfZeit = 0;
  }

  function gefalleneKegel() {
    let anzahl = 0;
    for (const k of kegel) {
      k.koerper.quaternion.vmult(oben, hilfsVektor);
      if (hilfsVektor.y < 0.6 || k.koerper.position.y < 0.05) anzahl++;
    }
    return anzahl;
  }

  function alleRuhig() {
    for (const k of kegel) {
      if (k.koerper.sleepState !== CANNON.Body.SLEEPING && k.koerper.velocity.length() > 0.05) return false;
    }
    return true;
  }

  function ergebnisZeigen(anzahl) {
    const alle = anzahl === 9;
    ergebnisTitel.textContent = alle ? E.textAlleNeune : E.textFast.replace("{anzahl}", anzahl);
    ergebnisText.textContent = E.textUnterzeile;
    knopfAnfragen.textContent = E.textButton;
    knopfNochmal.textContent = E.textNochmal;
    ergebnis.classList.toggle("kegel-ergebnis--fast", !alle);
    ergebnis.hidden = false;
    ergebnis.classList.remove("ist-neu");
    void ergebnis.offsetWidth; // Animation neu starten
    ergebnis.classList.add("ist-neu");
  }

  function ergebnisVerstecken() {
    ergebnis.hidden = true;
    ergebnis.classList.remove("ist-neu");
  }

  knopfNochmal.addEventListener("click", () => {
    kegelAufstellen();
    ergebnisVerstecken();
    werfen(true);
  });

  // ---------------------------------------------------------------------
  // Scroll-Fortschritt (0 = Anfang, 1 = Ende des stehenden Bereichs)
  // ---------------------------------------------------------------------
  const scrollWeg = handy ? E.scrollWegHandy : E.scrollWegDesktop;
  bereich.style.setProperty("--kegel-scrollweg", scrollWeg * 100 + "svh");

  const fortschritt = () => {
    const weg = bereich.offsetHeight - buehne.offsetHeight;
    if (weg <= 0) return 0;
    return clamp(-bereich.getBoundingClientRect().top / weg, 0, 1);
  };

  // ---------------------------------------------------------------------
  // Größe anpassen
  // ---------------------------------------------------------------------
  const groesseAnpassen = () => {
    const b = buehne.clientWidth;
    const h = buehne.clientHeight;
    if (!b || !h) return;
    renderer.setSize(b, h, false);
    kamera.aspect = b / h;
    kamera.updateProjectionMatrix();
  };
  groesseAnpassen();
  new ResizeObserver(groesseAnpassen).observe(buehne);

  // ---------------------------------------------------------------------
  // Kamera: fährt hinter der Kugel mit, beim Aufprall seitlich auf die Kegel
  // ---------------------------------------------------------------------
  const kameraPos = new THREE.Vector3();
  const kameraBlick = new THREE.Vector3();
  const zielPos = new THREE.Vector3();
  const zielBlick = new THREE.Vector3();
  let kameraBereit = false;

  function kameraZiel(kugelZ, mischung) {
    // mischung: 0 = hinter der Kugel, 1 = Blick auf die Kegel
    const ende = hochkant() ? E.kamera.endeHandy : E.kamera.endeDesktop;
    const abstand = E.kamera.abstand * (hochkant() ? 1.15 : 1);
    const hinten = { x: (wurfX + E.schraeg * kugelZ) * 0.6, y: E.kamera.hoehe, z: kugelZ + abstand };
    zielPos.set(
      lerp(hinten.x, ende.x, mischung),
      lerp(hinten.y, ende.y, mischung),
      lerp(hinten.z, ende.z, mischung)
    );
    zielBlick.set(0, lerp(0.12, 0.1, mischung), lerp(-0.1, -0.15, mischung));
  }

  // ---------------------------------------------------------------------
  // Animation
  // ---------------------------------------------------------------------
  let letzteZeit = null;
  let laufzeit = 0;
  let erstesBild = true;
  let beendet = false;
  let messStart = null;
  let messBilder = 0;
  let schlechteMessungen = 0;
  let kugelRollWinkel = 0;
  let letzteKugelZ = startZ;

  const bild = (jetzt) => {
    if (beendet) return;
    const dtRoh = letzteZeit === null ? 1 / 60 : (jetzt - letzteZeit) / 1000;
    letzteZeit = jetzt;
    const dt = Math.min(dtRoh, 1 / 20);
    laufzeit += dt;

    // --- Bildrate prüfen (nur in den ersten Sekunden, vor dem Wurf) ---
    if (!erzwungen && laufzeit > 1 && laufzeit < 8 && zustand === "rollen") {
      if (dtRoh > 0.5) messStart = null;
      else if (messStart === null) { messStart = jetzt; messBilder = 0; }
      else {
        messBilder++;
        if (jetzt - messStart >= 1500) {
          const fps = (messBilder * 1000) / (jetzt - messStart);
          schlechteMessungen = fps < E.minBilderProSekunde ? schlechteMessungen + 1 : 0;
          messStart = null;
          if (schlechteMessungen >= 2) { aufStandbildUmschalten(); return; }
        }
      }
    }

    const p = fortschritt();
    if (hinweis) hinweis.hidden = p > 0.03 || zustand !== "rollen";

    // --- Zurückgescrollt? Dann stehen die Kegel wieder ---
    if (zustand !== "rollen" && p < E.physikAb - 0.1) zuruecksetzen();

    let kameraMischung = 0;

    if (zustand === "rollen") {
      // Der Scroll-Weg schiebt die Kugel von startZ bis zum Abwurfpunkt
      const anteil = clamp(p / E.physikAb, 0, 1);
      const z = lerp(startZ, ABWURF_Z, anteil);
      wurfX = E.zielX;
      kugelRollWinkel -= (letzteKugelZ - z) / KUGEL_RADIUS;
      letzteKugelZ = z;
      kugel.position.set(E.zielX + E.schraeg * z, KUGEL_RADIUS, z);
      kugel.rotation.set(kugelRollWinkel, 0, 0);
      kameraMischung = smooth(0.75, 1, anteil) * 0.35;
      kameraZiel(z, kameraMischung);
      if (p >= E.physikAb) werfen(false);
    }

    if (zustand === "wurf" || zustand === "fertig") {
      // Physik in festen kleinen Schritten rechnen
      welt.step(1 / 120, dt, 4);
      wurfZeit += dt;
      kugel.position.copy(kugelKoerper.position);
      kugel.quaternion.copy(kugelKoerper.quaternion);
      for (const k of kegel) {
        k.mesh.position.copy(k.koerper.position);
        k.mesh.quaternion.copy(k.koerper.quaternion);
      }
      letzteKugelZ = kugel.position.z;
      kameraMischung = 0.35 + 0.65 * smooth(0, 0.9, wurfZeit);
      kameraZiel(Math.max(kugel.position.z, ABWURF_Z - 0.5), kameraMischung);

      if (zustand === "wurf" && wurfZeit > 1.2 && (alleRuhig() || wurfZeit > 4)) {
        zustand = "fertig";
        ergebnisZeigen(gefalleneKegel());
      }
    }

    // Kamera weich nachführen
    if (!kameraBereit) {
      kameraPos.copy(zielPos);
      kameraBlick.copy(zielBlick);
      kameraBereit = true;
    } else {
      const weich = Math.min(1, dt * 6);
      kameraPos.lerp(zielPos, weich);
      kameraBlick.lerp(zielBlick, weich);
    }
    kamera.position.copy(kameraPos);
    kamera.lookAt(kameraBlick);

    // Schatten-Licht folgt dem Geschehen (zwischen Kugel und Kegeln)
    const mitteZ = Math.min(kugel.position.z, 3) * 0.5;
    deckenlicht.position.set(0.6, 4, mitteZ + 3);
    deckenlicht.target.position.set(0, 0, mitteZ);

    renderer.render(szene, kamera);

    if (erstesBild) {
      erstesBild = false;
      bereich.classList.add("kegel-3d"); // Standbild ausblenden, 3D einblenden
    }
  };

  // ---------------------------------------------------------------------
  // Nur rechnen, wenn der Bereich sichtbar ist und der Tab vorne liegt
  // ---------------------------------------------------------------------
  let sichtbar = true;
  const laufenLassen = () => {
    if (beendet) return;
    if (sichtbar && !document.hidden) {
      letzteZeit = null;
      messStart = null;
      renderer.setAnimationLoop(bild);
    } else {
      renderer.setAnimationLoop(null);
    }
  };
  new IntersectionObserver((eintraege) => {
    sichtbar = eintraege[0].isIntersecting;
    laufenLassen();
  }).observe(bereich);
  document.addEventListener("visibilitychange", laufenLassen);

  // ---------------------------------------------------------------------
  // Notbremse: zurück zum Standbild (Bereich wird wieder kurz)
  // ---------------------------------------------------------------------
  function aufStandbildUmschalten() {
    beendet = true;
    renderer.setAnimationLoop(null);
    const vorher = bereich.offsetHeight;
    const imBereich = Math.max(0, -bereich.getBoundingClientRect().top);
    bereich.classList.remove("kegeln-aktiv", "kegel-3d");
    const unterschied = vorher - bereich.offsetHeight;
    if (imBereich > 0) window.scrollBy(0, -Math.min(imBereich, unterschied));
    ergebnisVerstecken();
    if (hinweis) hinweis.hidden = true;
    setTimeout(() => {
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    }, 600);
  }

  // Los geht's: Bereich wird höher (Scroll-Weg), Kegel stehen
  if (hinweis) hinweis.textContent = E.textHinweis;
  kegelAufstellen();
  bereich.classList.add("kegeln-aktiv");
  laufenLassen();
}


// ---------------------------------------------------------------------
// Kegel-Form: Profil wird rundherum gedreht (wie an der Drechselbank)
// ---------------------------------------------------------------------
function kegelGeometrie(THREE, groesse, farbeKoerper, farbeKopf, handy) {
  // [Radius, Höhe] von unten nach oben; schlanker als ein Bowling-Pin
  const profil = [
    [0, 0], [0.03, 0], [0.038, 0.008], [0.046, 0.04], [0.054, 0.1], [0.055, 0.13],
    [0.052, 0.17], [0.043, 0.21], [0.031, 0.245], [0.021, 0.275], [0.019, 0.29],
    [0.022, 0.305], [0.027, 0.322], [0.029, 0.34], [0.027, 0.36], [0.02, 0.38],
    [0.01, 0.395], [0, 0.4],
  ].map(([r, y]) => new THREE.Vector2(r * groesse, y * groesse));
  const geo = new THREE.LatheGeometry(profil, handy ? 20 : 32);
  // Ursprung in den Schwerpunkt legen (passt zur Physik)
  geo.translate(0, -0.14 * groesse, 0);

  // Farben je Ecke: Holzweiß, beim König der Kopf rot
  const koerper = new THREE.Color(farbeKoerper);
  const kopf = farbeKopf ? new THREE.Color(farbeKopf) : null;
  const pos = geo.attributes.position;
  const farben = new Float32Array(pos.count * 3);
  const kopfAb = (0.3 - 0.14) * groesse;
  for (let i = 0; i < pos.count; i++) {
    const c = kopf && pos.getY(i) > kopfAb ? kopf : koerper;
    farben[i * 3] = c.r;
    farben[i * 3 + 1] = c.g;
    farben[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(farben, 3));
  return geo;
}


// ---------------------------------------------------------------------
// Holz-Maserung für die Bahn (auf ein unsichtbares Zeichenblatt gemalt)
// ---------------------------------------------------------------------
function holzTextur(THREE, renderer) {
  const c = document.createElement("canvas");
  c.width = 512;   // = Bahnbreite
  c.height = 1024; // = 3 Meter Bahn
  const g = c.getContext("2d");
  const bretter = 10;
  const breite = c.width / bretter;
  let zufall = 42;
  const rnd = () => ((zufall = (zufall * 16807) % 2147483647) / 2147483647);

  for (let b = 0; b < bretter; b++) {
    const x0 = b * breite;
    // Grundfarbe: helles Ahornholz, jedes Brett etwas anders
    const hell = 205 + rnd() * 25;
    g.fillStyle = `rgb(${hell + 20}, ${hell - 10}, ${hell - 70})`;
    g.fillRect(x0, 0, breite, c.height);
    // feine Maserung: leicht gewellte Linien
    for (let l = 0; l < 14; l++) {
      g.strokeStyle = `rgba(120, 80, 40, ${0.05 + rnd() * 0.1})`;
      g.lineWidth = 0.6 + rnd() * 1.4;
      g.beginPath();
      const x = x0 + rnd() * breite;
      const welle = 1 + rnd() * 3;
      const phase = rnd() * 6;
      for (let y = 0; y <= c.height; y += 16) {
        const xx = x + Math.sin(y / 90 + phase) * welle;
        if (y === 0) g.moveTo(xx, y); else g.lineTo(xx, y);
      }
      g.stroke();
    }
    // ab und zu ein kleiner Ast
    if (rnd() < 0.4) {
      g.fillStyle = "rgba(110, 70, 35, .25)";
      g.beginPath();
      g.ellipse(x0 + breite * (0.3 + rnd() * 0.4), rnd() * c.height, 3 + rnd() * 3, 8 + rnd() * 8, 0, 0, Math.PI * 2);
      g.fill();
    }
    // Fuge zwischen den Brettern
    g.fillStyle = "rgba(90, 55, 25, .35)";
    g.fillRect(x0, 0, 1.5, c.height);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
}


// ---------------------------------------------------------------------
// Kugel-Muster: bernsteinfarben marmoriert
// ---------------------------------------------------------------------
function kugelTextur(THREE) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#7A2E0C";
  g.fillRect(0, 0, c.width, c.height);
  let zufall = 7;
  const rnd = () => ((zufall = (zufall * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) {
    g.strokeStyle = i % 3 ? `rgba(201, 120, 45, ${0.25 + rnd() * 0.3})` : `rgba(40, 10, 2, ${0.3 + rnd() * 0.3})`;
    g.lineWidth = 2 + rnd() * 7;
    g.beginPath();
    let y = rnd() * c.height;
    g.moveTo(-10, y);
    for (let x = 0; x <= c.width + 10; x += 16) {
      y += (rnd() - 0.5) * 14;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}


// ---------------------------------------------------------------------
// Kleine Helfer
// ---------------------------------------------------------------------
function clamp(wert, min, max) {
  return Math.min(max, Math.max(min, wert));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smooth(von, bis, x) {
  const t = clamp((x - von) / (bis - von), 0, 1);
  return t * t * (3 - 2 * t);
}
