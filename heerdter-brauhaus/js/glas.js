// =====================================================================
// Heerdter Brauhaus – „Das schwappende Glas“
// Ein 3D-Altbierglas im Hero der Startseite. Das Alt schwappt, wenn man
// die Maus bewegt, scrollt oder auf dem Handy wischt.
//
// Ohne 3D (kein WebGL, „Bewegung reduzieren“ eingeschaltet, zu langsames
// Gerät) bleibt einfach das gezeichnete Standbild (SVG) im HTML stehen.
//
// Zum Testen in der Adresszeile:
//   index.html?glas=an   → 3D immer zeigen (ohne Geschwindigkeits-Prüfung)
//   index.html?glas=aus  → immer das Standbild zeigen
// =====================================================================


// ---------------------------------------------------------------------
// EINSTELLUNGEN – hier kann man das Glas anpassen
// ---------------------------------------------------------------------
const EINSTELLUNGEN = {
  // Farben des Altbiers (dunkel am Rand, hell in der Mitte, Gegenlicht)
  farbeAltDunkel: "#8A3B12",
  farbeAltHell: "#B5651D",
  farbeAltGegenlicht: "#D9852F",
  farbeSchaum: "#F6EFE2",
  farbePerlen: "#FFE7B8",

  // Füllhöhe des Biers: 0.85 = 85 % des Glases (ohne Schaum)
  fuellhoehe: 0.85,
  // Höhe der Schaumkrone (in Glas-Einheiten; das Glas ist 2,3 hoch)
  schaumHoehe: 0.13,

  // Schwapp-Stärke: 1 = normal, 0.5 = ruhiger, 2 = wilder
  schwappStaerke: 1.0,
  // Wie schnell sich das Bier wieder beruhigt: kleiner = länger pendeln
  daempfung: 2.2,

  // Größte Neigung des Glases in Grad (Maus bzw. Handy kippen)
  maxNeigungGrad: 8,

  // Einschenken beim Laden (Sekunden)
  einschenkDauer: 2.0,

  // Anzahl der aufsteigenden Perlen
  anzahlPerlen: 45,

  // Unter dieser Bildrate schaltet die Seite aufs Standbild um
  minBilderProSekunde: 30,
};


// ---------------------------------------------------------------------
// Start: erst prüfen, ob 3D sinnvoll ist, dann three.js nachladen
// ---------------------------------------------------------------------
const buehne = document.querySelector("[data-glas]");
const hero = document.querySelector(".hero");

if (buehne && hero) starten();

async function starten() {
  const modus = new URLSearchParams(location.search).get("glas"); // "an" oder "aus"
  const erzwungen = modus === "an";
  if (modus === "aus") return;

  // Wer „Bewegung reduzieren“ eingestellt hat, bekommt das Standbild
  if (!erzwungen && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!webglMoeglich()) return;

  // Text und Seite zuerst fertig laden lassen, dann erst das 3D
  await warteBisSeiteRuhig();

  let THREE;
  try {
    THREE = await import("./vendor/three-glas.min.js");
  } catch (fehler) {
    return; // Datei nicht ladbar → Standbild bleibt
  }

  try {
    baueGlas(THREE, erzwungen);
  } catch (fehler) {
    console.warn("3D-Glas konnte nicht starten:", fehler);
  }
}

function webglMoeglich() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGL2RenderingContext && c.getContext("webgl2"));
  } catch (e) {
    return false;
  }
}

function warteBisSeiteRuhig() {
  return new Promise((fertig) => {
    const weiter = () => {
      if ("requestIdleCallback" in window) requestIdleCallback(() => fertig(), { timeout: 1200 });
      else setTimeout(fertig, 200);
    };
    if (document.readyState === "complete") weiter();
    else window.addEventListener("load", weiter, { once: true });
  });
}


// ---------------------------------------------------------------------
// Die 3D-Szene
// ---------------------------------------------------------------------
function baueGlas(THREE, erzwungen) {
  const E = EINSTELLUNGEN;
  const handy = matchMedia("(pointer: coarse)").matches;

  // ----- Zeichenfläche (für Screenreader unsichtbar) -----
  const canvas = document.createElement("canvas");
  canvas.className = "glas-canvas";
  canvas.setAttribute("aria-hidden", "true");
  buehne.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true, // durchsichtiger Hintergrund: der Hero bleibt Ochsenblut
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, handy ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const szene = new THREE.Scene();
  const kamera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);

  // ----- Licht: warm wie die Lampen über der Theke -----
  const pmrem = new THREE.PMREMGenerator(renderer);
  szene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
  szene.environmentIntensity = 0.6;
  pmrem.dispose();

  const lampe = new THREE.DirectionalLight(0xffd29a, 2.6);
  lampe.position.set(1.5, 6, 3);
  szene.add(lampe);
  const gegenlicht = new THREE.DirectionalLight(0xffb066, 1.6);
  gegenlicht.position.set(-2, 3, -4);
  szene.add(gegenlicht);
  szene.add(new THREE.AmbientLight(0xffe2c0, 0.25));

  // ----- Maße des Uerige-Bechers (schlank, leicht schräge Wand) -----
  const H = 2.3;          // Höhe
  const rUnten = 0.47;    // Außenradius unten
  const rOben = 0.53;     // Außenradius oben
  const wand = 0.035;     // Wandstärke
  const boden = 0.17;     // dicker Glasboden
  const radiusAussen = (y) => rUnten + (rOben - rUnten) * (y / H);
  const radiusInnen = (y) => radiusAussen(y) - wand;

  // Gruppe für alles, was sich mit dem Glas neigt
  const glasGruppe = new THREE.Group();
  glasGruppe.position.y = -H / 2;
  const halter = new THREE.Group(); // dreht sich um die Glasmitte
  halter.add(glasGruppe);
  szene.add(halter);

  // ----- Glas: Profil zeichnen und rundherum drehen (LatheGeometry) -----
  const P = (r, y) => new THREE.Vector2(r, y);
  const profil = [P(0, 0), P(rUnten - 0.03, 0), P(rUnten - 0.008, 0.006), P(rUnten, 0.03)];
  const stufen = 10;
  for (let i = 1; i <= stufen; i++) {
    const y = 0.03 + (H - 0.04) * (i / stufen);
    profil.push(P(radiusAussen(y), y)); // Außenwand nach oben
  }
  profil.push(P(rOben - wand * 0.15, H + 0.004), P(rOben - wand * 0.85, H + 0.004)); // runder Rand
  for (let i = 0; i <= stufen; i++) {
    const y = H - 0.01 - (H - 0.01 - boden - 0.03) * (i / stufen);
    profil.push(P(radiusInnen(y), y)); // Innenwand nach unten
  }
  profil.push(P(radiusInnen(boden) - 0.025, boden + 0.002), P(0, boden));
  const segmente = handy ? 48 : 72;

  const glasMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.03,
    transmission: 1,      // durchsichtig wie Glas
    thickness: 0.3,
    ior: 1.5,             // Brechungsindex von Glas
    specularIntensity: 0.8,
    specularColor: 0xfff0dd, // feine, warme Lichtreflexe am Rand
    envMapIntensity: 0.55,
    // Auf durchsichtigem Hintergrund richtig mischen, sonst wirkt das leere Glas milchig
    transparent: true,
    premultipliedAlpha: true,
  });
  const glas = new THREE.Mesh(new THREE.LatheGeometry(profil, segmente), glasMaterial);
  glas.renderOrder = 2;
  glasGruppe.add(glas);

  // ----- Flüssigkeit: Körper knapp innerhalb des Glases -----
  const fl = [];
  const yBierUnten = boden + 0.004;
  const yBierOben = H - 0.02;
  fl.push(P(0, yBierUnten), P(radiusInnen(yBierUnten) - 0.012, yBierUnten), P(radiusInnen(yBierUnten) - 0.004, yBierUnten + 0.01));
  for (let i = 1; i <= stufen; i++) {
    const y = yBierUnten + 0.01 + (yBierOben - yBierUnten - 0.01) * (i / stufen);
    fl.push(P(radiusInnen(y) - 0.004, y));
  }
  fl.push(P(0, yBierOben));

  const farbe = (hex) => new THREE.Color(hex);
  const bierUniforms = {
    uEbenePunkt: { value: new THREE.Vector3() },       // Punkt auf der Bier-Oberfläche
    uEbeneNormale: { value: new THREE.Vector3(0, 1, 0) }, // Neigung der Oberfläche
    uWelleRichtung: { value: new THREE.Vector2(1, 0) },
    uWelleHoehe: { value: 0 },
    uSchaum: { value: 0 },
    uZeit: { value: 0 },
    uLicht: { value: new THREE.Vector3(0.3, 1, 0.6).normalize() },
    uAltDunkel: { value: farbe(E.farbeAltDunkel) },
    uAltHell: { value: farbe(E.farbeAltHell) },
    uAltGegenlicht: { value: farbe(E.farbeAltGegenlicht) },
    uSchaumFarbe: { value: farbe(E.farbeSchaum) },
  };

  // Shader: alles oberhalb der (geneigten, welligen) Oberfläche wird
  // weggeschnitten. Darüber ein schmales Band Schaum. Die Innenseite,
  // die man durch den Schnitt sieht, wird in Schaumfarbe gemalt.
  const bierMaterial = new THREE.ShaderMaterial({
    uniforms: bierUniforms,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec3 vPosW;
      varying vec3 vPosL;
      varying vec3 vNormW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vPosW = w.xyz;
        vPosL = position;
        vNormW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uEbenePunkt;
      uniform vec3 uEbeneNormale;
      uniform vec2 uWelleRichtung;
      uniform float uWelleHoehe;
      uniform float uSchaum;
      uniform float uZeit;
      uniform vec3 uLicht;
      uniform vec3 uAltDunkel;
      uniform vec3 uAltHell;
      uniform vec3 uAltGegenlicht;
      uniform vec3 uSchaumFarbe;
      varying vec3 vPosW;
      varying vec3 vPosL;
      varying vec3 vNormW;

      float zufall(vec3 p) {
        return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      }

      void main() {
        // Höhe über der Oberfläche (mit Welle und feinem Kräuseln)
        vec2 rel = vPosW.xz - uEbenePunkt.xz;
        float welle = uWelleHoehe * sin(dot(rel, uWelleRichtung) * 5.5 - uZeit * 6.5)
                    + 0.003 * sin(vPosW.x * 13.0 + uZeit * 2.3) * cos(vPosW.z * 11.0 - uZeit * 1.7);
        float d = dot(vPosW - uEbenePunkt, uEbeneNormale) - welle;

        // Schaumkrone mit unregelmäßiger Oberkante
        float winkel = atan(vPosL.z, vPosL.x);
        float schaumRand = uSchaum * (1.0 + 0.16 * sin(winkel * 5.0 + uZeit * 0.5)
                                          + 0.09 * sin(winkel * 13.0 - uZeit * 0.8));
        if (d > schaumRand) discard;

        vec3 N = normalize(vNormW);
        vec3 V = normalize(cameraPosition - vPosW);
        vec3 farbe;

        if (!gl_FrontFacing) {
          // Blick von oben in den Schnitt: Schaumdecke
          farbe = uSchaumFarbe * 1.35 * (0.9 + 0.06 * zufall(floor(vPosW * 90.0)));
        } else if (d > 0.0) {
          // Schaum von der Seite: unten leicht bräunlich, oben cremeweiß
          float t = d / max(schaumRand, 0.0001);
          float licht = 0.72 + 0.28 * max(dot(N, uLicht), 0.0);
          float poren = 0.93 + 0.07 * zufall(floor(vPosW * 120.0));
          farbe = mix(uSchaumFarbe * vec3(0.86, 0.76, 0.62), uSchaumFarbe, smoothstep(0.0, 0.45, t));
          farbe *= licht * poren * 1.35;
        } else {
          // Altbier: Mitte leuchtet im Gegenlicht, Ränder dunkler
          float zuMir = clamp(dot(N, V), 0.0, 1.0);
          vec3 bier = mix(uAltDunkel * 0.55, uAltDunkel, smoothstep(0.0, 0.45, zuMir));
          bier = mix(bier, uAltHell, smoothstep(0.45, 0.95, zuMir));
          bier = mix(bier, uAltGegenlicht, pow(zuMir, 6.0) * 0.35);
          float tiefe = clamp(-d / 1.8, 0.0, 1.0);
          bier *= 1.0 - 0.22 * tiefe;
          // dunkle Kante direkt unter dem Schaum
          bier = mix(bier, uAltDunkel * 0.65, smoothstep(-0.035, 0.0, d) * 0.45);
          // Glanzlicht der Lampe
          vec3 halb = normalize(uLicht + V);
          bier += vec3(1.0, 0.85, 0.6) * pow(max(dot(N, halb), 0.0), 70.0) * 0.35;
          farbe = bier;
        }

        gl_FragColor = vec4(farbe, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const bier = new THREE.Mesh(new THREE.LatheGeometry(fl, segmente), bierMaterial);
  bier.renderOrder = 1;
  glasGruppe.add(bier);

  // ----- Perlen: kleine Bläschen, die aufsteigen -----
  const perlenMaterial = new THREE.MeshBasicMaterial({
    color: farbe(E.farbePerlen),
    transparent: true,
    opacity: 0.55,
    depthTest: false, // im Bier sichtbar (das Bier selbst ist undurchsichtig gezeichnet)
    depthWrite: false,
  });
  const perlen = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), perlenMaterial, E.anzahlPerlen);
  perlen.renderOrder = 3;
  perlen.frustumCulled = false;
  glasGruppe.add(perlen);

  const perlDaten = [];
  const neuePerle = (p, ganzUnten) => {
    // vor allem vorne im Glas, damit man sie sieht; manche an der Wand
    const winkel = Math.PI * (0.1 + Math.random() * 0.8);
    const yStart = boden + 0.03;
    const rMax = radiusInnen(yStart) - 0.03;
    const r = rMax * (Math.random() < 0.4 ? 0.92 : Math.sqrt(Math.random()) * 0.85);
    p.x = Math.cos(winkel) * r;
    p.z = Math.sin(winkel) * r;
    p.y = ganzUnten ? yStart : yStart + Math.random() * (H * 0.8);
    p.tempo = 0.25 + Math.random() * 0.45;
    p.groesse = 0.006 + Math.random() * 0.012;
    p.phase = Math.random() * 10;
    return p;
  };
  for (let i = 0; i < E.anzahlPerlen; i++) perlDaten.push(neuePerle({}, false));

  // ---------------------------------------------------------------------
  // Bewegung: gedämpfte Feder für das Schwappen
  // ---------------------------------------------------------------------
  // s = Schräglage der Oberfläche, v = Geschwindigkeit
  const feder = { x: { s: 0, v: 0 }, z: { s: 0, v: 0 } };
  const STEIFHEIT = 38; // etwa ein Pendeln pro Sekunde
  const MAX_SCHRAEG = 0.3;
  const anstossen = (vx, vz) => {
    feder.x.v += vx * E.schwappStaerke;
    feder.z.v += vz * E.schwappStaerke;
  };
  const federSchritt = (a, dt) => {
    const beschl = -STEIFHEIT * a.s - E.daempfung * a.v;
    a.v += beschl * dt;
    a.s += a.v * dt;
    if (a.s > MAX_SCHRAEG) { a.s = MAX_SCHRAEG; a.v *= -0.3; }
    if (a.s < -MAX_SCHRAEG) { a.s = -MAX_SCHRAEG; a.v *= -0.3; }
  };

  // Neigung des Glases (Maus oder Handy-Sensoren)
  const maxNeigung = (E.maxNeigungGrad * Math.PI) / 180;
  const neigung = { zielX: 0, zielZ: 0, x: 0, z: 0 };

  // ----- Maus (Desktop) -----
  let letzteMaus = null;
  const aufMaus = (e) => {
    if (e.pointerType !== "mouse") return;
    const box = hero.getBoundingClientRect();
    const mx = ((e.clientX - box.left) / box.width) * 2 - 1;
    const my = ((e.clientY - box.top) / box.height) * 2 - 1;
    neigung.zielZ = -clamp(mx, -1, 1) * maxNeigung;
    neigung.zielX = clamp(my, -1, 1) * maxNeigung * 0.5;
    if (letzteMaus) {
      const dx = (e.clientX - letzteMaus.x) / box.width;
      const dy = (e.clientY - letzteMaus.y) / box.height;
      anstossen(clamp(dx * 6, -0.8, 0.8), clamp(dy * 3, -0.5, 0.5));
    }
    letzteMaus = { x: e.clientX, y: e.clientY };
  };
  const mausWeg = () => {
    letzteMaus = null;
    neigung.zielX = 0;
    neigung.zielZ = 0;
  };
  hero.addEventListener("pointermove", aufMaus, { passive: true });
  hero.addEventListener("pointerleave", mausWeg, { passive: true });

  // ----- Wischen (Handy) – nur zuhören, das Scrollen läuft normal weiter -----
  let letzterFinger = null;
  hero.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    letzterFinger = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  hero.addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    if (!letzterFinger) letzterFinger = { x: t.clientX, y: t.clientY };
    const box = hero.getBoundingClientRect();
    const dx = (t.clientX - letzterFinger.x) / box.width;
    const dy = (t.clientY - letzterFinger.y) / box.height;
    anstossen(clamp(dx * 7, -0.9, 0.9), clamp(dy * 3, -0.6, 0.6));
    letzterFinger = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  hero.addEventListener("touchend", () => { letzterFinger = null; }, { passive: true });

  // ----- Scrollen (überall) -----
  let letztesScrollY = window.scrollY;

  // ----- Handy kippen (nur nach Freigabe per Button) -----
  const kippKnopf = buehne.querySelector("[data-glas-kippen]");
  if (kippKnopf && handy && "DeviceOrientationEvent" in window) {
    kippKnopf.hidden = false;
    kippKnopf.addEventListener("click", async () => {
      try {
        // iPhone fragt um Erlaubnis
        if (typeof DeviceOrientationEvent.requestPermission === "function") {
          const antwort = await DeviceOrientationEvent.requestPermission();
          if (antwort !== "granted") return;
        }
        window.addEventListener("deviceorientation", (e) => {
          if (e.gamma == null) return;
          neigung.zielZ = -clamp(e.gamma / 30, -1, 1) * maxNeigung;
          neigung.zielX = clamp(((e.beta || 0) - 45) / 45, -1, 1) * maxNeigung * 0.5;
        }, { passive: true });
        kippKnopf.textContent = "Glas kippt mit";
        kippKnopf.disabled = true;
      } catch (fehler) {
        kippKnopf.hidden = true;
      }
    });
  }

  // ---------------------------------------------------------------------
  // Größe anpassen
  // ---------------------------------------------------------------------
  const tanHalb = Math.tan(((kamera.fov / 2) * Math.PI) / 180);
  const groesseAnpassen = () => {
    const b = buehne.clientWidth;
    const h = buehne.clientHeight;
    if (!b || !h) return;
    renderer.setSize(b, h, false);
    kamera.aspect = b / h;
    // Abstand so wählen, dass das ganze Glas (mit etwas Rand) hineinpasst
    const abstandHoehe = 2.85 / (2 * tanHalb);
    const abstandBreite = 1.5 / (2 * tanHalb * kamera.aspect);
    const abstand = Math.max(abstandHoehe, abstandBreite);
    kamera.position.set(0, abstand * 0.11, abstand);
    kamera.lookAt(0, -0.02, 0);
    kamera.updateProjectionMatrix();
  };
  groesseAnpassen();
  new ResizeObserver(groesseAnpassen).observe(buehne);

  // ---------------------------------------------------------------------
  // Animation
  // ---------------------------------------------------------------------
  const hilfsMatrix = new THREE.Matrix4();
  const hilfsVektor = new THREE.Vector3();
  const hilfsObjekt = new THREE.Object3D();
  const normale = new THREE.Vector3();

  let startZeit = null;
  let letzteZeit = null;
  let zeit = 0;
  let erstesBild = true;
  let beendet = false;

  // Bildraten-Messung: zu langsam → Standbild
  let messStart = null;
  let messBilder = 0;
  let schlechteMessungen = 0;

  const bild = (jetzt) => {
    if (beendet) return;
    if (startZeit === null) startZeit = jetzt;
    const dtRoh = letzteZeit === null ? 1 / 60 : (jetzt - letzteZeit) / 1000;
    letzteZeit = jetzt;
    const dt = Math.min(dtRoh, 1 / 30);
    zeit += dt;
    const seitStart = (jetzt - startZeit) / 1000;

    // --- Bildrate prüfen (erst nach dem Aufwärmen) ---
    if (!erzwungen && seitStart > 1.2) {
      if (dtRoh > 0.5) {
        messStart = null; // Hänger (z. B. Tab gewechselt) nicht mitzählen
      } else if (messStart === null) {
        messStart = jetzt;
        messBilder = 0;
      } else {
        messBilder++;
        if (jetzt - messStart >= 2000) {
          const fps = (messBilder * 1000) / (jetzt - messStart);
          schlechteMessungen = fps < E.minBilderProSekunde ? schlechteMessungen + 1 : 0;
          messStart = null;
          if (schlechteMessungen >= 2) { aufStandbildUmschalten(); return; }
        }
      }
    }

    // --- Einschenken: Pegel steigt, Schaum wächst ---
    const fortschritt = clamp(seitStart / E.einschenkDauer, 0, 1);
    const fuell = 1 - Math.pow(1 - fortschritt, 3);
    const schaumWachsen = smooth(0.25, 1.0, fortschritt);
    const schaumNachlassen = 1 + 0.35 * (1 - smooth(1.0, 1.8, seitStart / E.einschenkDauer));
    const pegelY = boden + (H - boden) * E.fuellhoehe * fuell;

    // --- Scrollen stößt das Schwappen an ---
    const scrollDelta = window.scrollY - letztesScrollY;
    letztesScrollY = window.scrollY;
    if (scrollDelta !== 0) anstossen(clamp(scrollDelta * 0.0015, -0.5, 0.5), clamp(scrollDelta * 0.006, -1.2, 1.2));

    // --- Glas neigt sich weich zur Zielneigung; die Drehung stößt das Bier an ---
    const vorherZ = neigung.z;
    const vorherX = neigung.x;
    const weich = Math.min(1, dt * 5);
    neigung.z += (neigung.zielZ - neigung.z) * weich;
    neigung.x += (neigung.zielX - neigung.x) * weich;
    anstossen(-(neigung.z - vorherZ) * 2.5, (neigung.x - vorherX) * 2.5);
    halter.rotation.set(neigung.x, 0, neigung.z);

    // --- Feder rechnen (in zwei kleinen Schritten, damit es stabil bleibt) ---
    for (let i = 0; i < 2; i++) {
      federSchritt(feder.x, dt / 2);
      federSchritt(feder.z, dt / 2);
    }

    // --- Oberfläche an den Shader geben ---
    szene.updateMatrixWorld();
    hilfsVektor.set(0, pegelY, 0).applyMatrix4(glasGruppe.matrixWorld);
    bierUniforms.uEbenePunkt.value.copy(hilfsVektor);
    normale.set(feder.x.s, 1, feder.z.s).normalize();
    bierUniforms.uEbeneNormale.value.copy(normale);
    const richtungsLaenge = Math.hypot(feder.x.s, feder.z.s);
    if (richtungsLaenge > 0.002) bierUniforms.uWelleRichtung.value.set(feder.x.s / richtungsLaenge, feder.z.s / richtungsLaenge);
    const bewegung = Math.hypot(feder.x.v, feder.z.v) * 0.012 + richtungsLaenge * 0.05;
    bierUniforms.uWelleHoehe.value = Math.min(0.05, bewegung + 0.025 * (1 - fortschritt));
    bierUniforms.uSchaum.value = E.schaumHoehe * schaumWachsen * schaumNachlassen;
    bierUniforms.uZeit.value = zeit;

    // --- Perlen steigen auf ---
    hilfsMatrix.copy(glasGruppe.matrixWorld);
    for (let i = 0; i < perlDaten.length; i++) {
      const p = perlDaten[i];
      p.y += p.tempo * dt;
      hilfsVektor.set(p.x + Math.sin(zeit * 3 + p.phase) * 0.006, p.y, p.z).applyMatrix4(hilfsMatrix);
      const abstand = hilfsVektor.sub(bierUniforms.uEbenePunkt.value).dot(normale);
      if (abstand > -0.025) neuePerle(p, true); // an der Oberfläche verschwinden
      const sichtbar = p.y < pegelY - 0.02 ? 1 : 0;
      hilfsObjekt.position.set(p.x + Math.sin(zeit * 3 + p.phase) * 0.006, p.y, p.z);
      hilfsObjekt.scale.setScalar(p.groesse * sichtbar);
      hilfsObjekt.updateMatrix();
      perlen.setMatrixAt(i, hilfsObjekt.matrix);
    }
    perlen.instanceMatrix.needsUpdate = true;

    renderer.render(szene, kamera);

    if (erstesBild) {
      erstesBild = false;
      buehne.classList.add("glas-aktiv"); // Standbild ausblenden, 3D einblenden
    }
  };

  // ---------------------------------------------------------------------
  // Pausieren, wenn der Hero nicht sichtbar oder der Tab im Hintergrund ist
  // ---------------------------------------------------------------------
  let heroSichtbar = true;
  const laufenLassen = () => {
    if (beendet) return;
    const laufen = heroSichtbar && !document.hidden;
    if (laufen) {
      letzteZeit = null;
      messStart = null;
      letztesScrollY = window.scrollY;
      renderer.setAnimationLoop(bild);
    } else {
      renderer.setAnimationLoop(null);
    }
  };
  new IntersectionObserver((eintraege) => {
    heroSichtbar = eintraege[0].isIntersecting;
    laufenLassen();
  }).observe(hero);
  document.addEventListener("visibilitychange", laufenLassen);

  // ---------------------------------------------------------------------
  // Notbremse: zurück zum Standbild
  // ---------------------------------------------------------------------
  function aufStandbildUmschalten() {
    beendet = true;
    renderer.setAnimationLoop(null);
    buehne.classList.remove("glas-aktiv");
    if (kippKnopf) kippKnopf.hidden = true;
    hero.removeEventListener("pointermove", aufMaus);
    setTimeout(() => {
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    }, 600);
  }

  laufenLassen();
}


// ---------------------------------------------------------------------
// Kleine Helfer
// ---------------------------------------------------------------------
function clamp(wert, min, max) {
  return Math.min(max, Math.max(min, wert));
}

function smooth(von, bis, x) {
  const t = clamp((x - von) / (bis - von), 0, 1);
  return t * t * (3 - 2 * t);
}
