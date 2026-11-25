// =====================================================================
// Einmaliges Werkzeug: „Wurf aufnehmen“ für die Kegelbahn (feiern.html)
//
// Simuliert mit der Physik-Engine cannon-es sehr fein (300 Schritte pro
// Sekunde) viele Würfe mit leicht verschiedenen Zielpunkten, Winkeln und
// Tempi. Von allen Würfen, bei denen ALLE NEUNE fallen, wird der
// spektakulärste ausgewählt und als js/kegel-wurf.json gespeichert.
// Die Webseite spielt nur diese Aufnahme ab (immer gleich gut, ruckelfrei).
//
// Aufruf (im Ordner heerdter-brauhaus):
//   node js/vendor/kegel-wurf-aufnehmen.mjs                  (sucht 10 Minuten)
//   node js/vendor/kegel-wurf-aufnehmen.mjs --sekunden=1800  (länger suchen)
// Weitere Schalter: siehe unten bei „Viele Varianten durchprobieren“.
// =====================================================================

import * as CANNON from "./cannon-es.min.js";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------
// Maße und Gewichte – deutsches Kegeln, Sektion Classic (9 Kegel)
// Quellen: DKBC-Prüfprotokoll Kegelbahnabnahme (Kugel 160 ± 0,5 mm,
// 2818–2871 g; Kegel-Prüfgewichte um 1660–1750 g), Vereins- und
// Verbandsseiten (Kegel 40 cm hoch, König 43 cm, Raute mit 1 m
// Seitenlänge, Kugellauffläche 19,50 m lang, 1,34–1,50 m breit).
// ---------------------------------------------------------------------
export const MASSE = {
  kugelRadius: 0.08,        // 160 mm Durchmesser
  kugelMasse: 2.85,         // kg (2818–2871 g)
  kegelHoehe: 0.40,         // m
  koenigHoehe: 0.43,        // m, der mittlere Kegel ist 3 cm höher
  kegelMasse: 1.7,          // kg (Prüfwerte um 1,66–1,75 kg)
  // Kegelabstand: Die Quellen nennen 25 cm bzw. 50 cm (Raute mit 1 m Seite).
  // Mit 50 cm fiel in rund 10 000 simulierten Würfen nie „Alle Neune“ (nur Achter) –
  // auf echten Bahnen ist das ebenfalls ein seltener Glückswurf. Für die Animation
  // verwenden wir 42 cm: innerhalb der genannten Spanne, die Raute wirkt fast gleich breit.
  kegelAbstand: 0.42,       // m zwischen benachbarten Kegeln entlang der Rauten-Seite
  bahnBreite: 1.5,          // m Lauffläche am Kegelstand
  wandX: 0.86,              // Seitenwände des Kegelstands (Innenkante, m von der Mitte)
  rueckwandZ: -1.22,        // gepolsterte Rückwand: ca. 0,5 m hinter dem Hinterkegel
};

// Zum Ausprobieren anderer Maße: KEGEL_MASSE='{"kegelAbstand":0.42}' node …
if (typeof process !== "undefined" && process.env.KEGEL_MASSE) Object.assign(MASSE, JSON.parse(process.env.KEGEL_MASSE));

// Reibung und Rückprall: Kegel und Kugel aus Kunststoff/Kunstharz auf
// glatter, lackierter Lauffläche. Feste Normwerte gibt es dafür nicht; die
// Zahlen sind übliche Schätzwerte (harte Kunststoffe prallen mit 0,4–0,7 ab,
// Lack auf Lack gleitet mit Reibwerten um 0,2–0,3). Die Holzbanden federn,
// die gepolsterte Rückwand schluckt die Energie.
const REIBUNG = {
  kegelBahn: { friction: 0.24, restitution: 0.25 },
  kegelKegel: { friction: 0.22, restitution: 0.62 },
  kugelKegel: { friction: 0.12, restitution: 0.55 },
  kugelBahn: { friction: 0.25, restitution: 0.1 },
  kegelWand: { friction: 0.25, restitution: 0.5 },    // Seitenbanden aus Holz
  kegelPolster: { friction: 0.6, restitution: 0.08 }, // gepolsterte Rückwand
};
// Zum Ausprobieren anderer Werte: KEGEL_REIBUNG='{"kegelBahn":{…}}' node …
if (typeof process !== "undefined" && process.env.KEGEL_REIBUNG) Object.assign(REIBUNG, JSON.parse(process.env.KEGEL_REIBUNG));

// Kegel-Profil [Radius, Höhe] in Metern, von unten nach oben:
// Fuß, Bauch (größter Durchmesser 110 mm), Hals, Kopf.
export const KEGEL_PROFIL = [
  [0, 0], [0.029, 0], [0.033, 0.008], [0.04, 0.03], [0.047, 0.06], [0.053, 0.1],
  [0.055, 0.135], [0.054, 0.16], [0.05, 0.195], [0.043, 0.23], [0.034, 0.26],
  [0.025, 0.285], [0.0195, 0.305], [0.0195, 0.318], [0.024, 0.333], [0.029, 0.35],
  [0.031, 0.365], [0.03, 0.379], [0.026, 0.39], [0.017, 0.397], [0, 0.4],
];

// Kollisionsform: gestapelte Kegelstümpfe + Kugel für den Kopf
const KOLLISION = [
  { von: 0, bis: 0.06, rUnten: 0.029, rOben: 0.047 },
  { von: 0.06, bis: 0.16, rUnten: 0.047, rOben: 0.054 },
  { von: 0.16, bis: 0.25, rUnten: 0.054, rOben: 0.037 },
  { von: 0.25, bis: 0.32, rUnten: 0.037, rOben: 0.02 },
];
const KOPF = { y: 0.364, r: 0.031 };

// Schwerpunkt (gleichmäßige Dichte) aus dem Profil berechnen
function schwerpunkt() {
  let v = 0, vy = 0;
  for (let i = 1; i < KEGEL_PROFIL.length; i++) {
    const [r1, y1] = KEGEL_PROFIL[i - 1], [r2, y2] = KEGEL_PROFIL[i];
    const h = y2 - y1;
    if (h <= 0) continue;
    const vol = (Math.PI * h * (r1 * r1 + r1 * r2 + r2 * r2)) / 3;
    v += vol;
    vy += vol * (y1 + h / 2);
  }
  return vy / v;
}
export const SCHWERPUNKT = schwerpunkt();

// Kegelstand: 9 Kegel in der Raute, Mitte bei z = 0, Vorderkegel vorne (+z)
export function kegelPositionen() {
  const d = MASSE.kegelAbstand / Math.SQRT2;
  const liste = [];
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      liste.push({ x: (i - j) * d, z: (i + j) * d, koenig: i === 0 && j === 0 });
    }
  }
  return liste;
}

// ---------------------------------------------------------------------
// Eine Simulation
// ---------------------------------------------------------------------
const SCHRITT = 1 / 300; // 300 Schritte/s: die Kugel bewegt sich pro Schritt höchstens ca. 3 cm
const START_Z = 3.0; // hier beginnt die Aufnahme (Kugel rollt schon)

function simuliere({ x0, winkel, tempo, versatz = [] }, aufnehmen = false, fps = 60) {
  // Kein „Schlafen“: Ein schlafender Kegel wirkt im ersten Moment des Treffers
  // wie eine feste Wand (die Kugel prallt ab). Deshalb rechnen alle Körper immer.
  const welt = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.81, 0), allowSleep: false });
  welt.solver.iterations = 14;
  welt.solver.tolerance = 1e-5;
  const mBahn = new CANNON.Material(), mKegel = new CANNON.Material(), mKugel = new CANNON.Material();
  const mWand = new CANNON.Material(), mPolster = new CANNON.Material();
  welt.addContactMaterial(new CANNON.ContactMaterial(mKegel, mBahn, REIBUNG.kegelBahn));
  welt.addContactMaterial(new CANNON.ContactMaterial(mKegel, mKegel, REIBUNG.kegelKegel));
  welt.addContactMaterial(new CANNON.ContactMaterial(mKugel, mKegel, REIBUNG.kugelKegel));
  welt.addContactMaterial(new CANNON.ContactMaterial(mKugel, mBahn, REIBUNG.kugelBahn));
  welt.addContactMaterial(new CANNON.ContactMaterial(mKegel, mWand, REIBUNG.kegelWand));
  welt.addContactMaterial(new CANNON.ContactMaterial(mKugel, mWand, REIBUNG.kegelWand));
  welt.addContactMaterial(new CANNON.ContactMaterial(mKegel, mPolster, REIBUNG.kegelPolster));
  welt.addContactMaterial(new CANNON.ContactMaterial(mKugel, mPolster, REIBUNG.kegelPolster));

  const fest = (halb, pos, mat) => {
    const k = new CANNON.Body({ mass: 0, material: mat });
    k.addShape(new CANNON.Box(new CANNON.Vec3(...halb)));
    k.position.set(...pos);
    welt.addBody(k);
  };
  fest([2, 0.1, 6], [0, -0.1, 1.5], mBahn);                              // Lauffläche + Kegeltisch
  fest([0.1, 0.6, 6], [MASSE.wandX + 0.1, 0.5, 1.5], mWand);             // Seitenwand rechts
  fest([0.1, 0.6, 6], [-MASSE.wandX - 0.1, 0.5, 1.5], mWand);            // Seitenwand links
  fest([2, 0.6, 0.1], [0, 0.5, MASSE.rueckwandZ - 0.1], mPolster);       // gepolsterte Rückwand

  const kegel = [];
  for (const [nr, p] of kegelPositionen().entries()) {
    // Stellmaschine: jeder Kegel steht bis zu ±5 mm neben seiner Markierung
    const dx = versatz[nr * 2] || 0, dz = versatz[nr * 2 + 1] || 0;
    const g = p.koenig ? MASSE.koenigHoehe / MASSE.kegelHoehe : 1;
    const b = new CANNON.Body({ mass: MASSE.kegelMasse * g, material: mKegel });
    for (const t of KOLLISION) {
      const h = (t.bis - t.von) * g;
      b.addShape(new CANNON.Cylinder(t.rOben * g, t.rUnten * g, h, 14), new CANNON.Vec3(0, ((t.von + t.bis) / 2 - SCHWERPUNKT) * g, 0));
    }
    b.addShape(new CANNON.Sphere(KOPF.r * g), new CANNON.Vec3(0, (KOPF.y - SCHWERPUNKT) * g, 0));
    b.position.set(p.x + dx, SCHWERPUNKT * g, p.z + dz);
    b.linearDamping = 0.02;
    b.angularDamping = 0.04;
    welt.addBody(b);
    kegel.push({ b, g, start: { x: p.x + dx, z: p.z + dz } });
  }

  const r = MASSE.kugelRadius;
  const kugel = new CANNON.Body({ mass: MASSE.kugelMasse, material: mKugel, shape: new CANNON.Sphere(r), linearDamping: 0.005, angularDamping: 0.005 });
  const vx = -Math.sin(winkel) * tempo, vz = -Math.cos(winkel) * tempo;
  kugel.position.set(x0, r, START_Z);
  kugel.velocity.set(vx, 0, vz);
  kugel.angularVelocity.set(vz / r, 0, -vx / r); // rollt sauber, ohne zu rutschen
  welt.addBody(kugel);

  // Treffer und Auswertung
  let aufprall = null;
  kugel.addEventListener("collide", (e) => {
    if (aufprall === null && kegel.some((k) => k.b === e.body)) aufprall = welt.time;
  });

  const bilder = [];
  const proBild = Math.round(1 / fps / SCHRITT);
  const oben = new CANNON.Vec3(), hoch = new CANNON.Vec3(0, 1, 0);
  let maxHoehe = 0, wandTreffer = new Set(), drehung = 0, ruheSeit = [];
  const dauerMax = 5;
  let ende = dauerMax;
  let gefangen = false, zeitNeun = null;
  for (let n = 0; n * SCHRITT < dauerMax; n++) {
    welt.step(SCHRITT);
    // Kugelfang: Hinter dem Kegelstand fängt ein Vorhang die Kugel ab,
    // sie springt nicht zurück in die Kegel.
    if (!gefangen && kugel.position.z < MASSE.rueckwandZ + 0.3) {
      gefangen = true;
      kugel.linearDamping = 0.97;
      kugel.angularDamping = 0.97;
    }
    const t = welt.time;
    for (let i = 0; i < kegel.length; i++) {
      const b = kegel[i].b;
      maxHoehe = Math.max(maxHoehe, b.position.y - SCHWERPUNKT * kegel[i].g);
      if (Math.abs(b.position.x) > MASSE.wandX - 0.08 || b.position.z < MASSE.rueckwandZ + 0.08) wandTreffer.add(i);
      drehung += b.angularVelocity.length() * SCHRITT;
      const ruhig = b.velocity.length() < 0.04 && b.angularVelocity.length() < 0.3;
      if (ruhig) { if (ruheSeit[i] === undefined) ruheSeit[i] = t; } else ruheSeit[i] = undefined;
    }
    // Liegen schon alle Neune? (alle 10 Schritte prüfen)
    if (zeitNeun === null && aufprall !== null && n % 10 === 0) {
      let liegend = 0;
      for (const k of kegel) { k.b.quaternion.vmult(hoch, oben); if (oben.y < 0.6) liegend++; }
      if (liegend === 9) zeitNeun = t;
    }
    if (aufnehmen && n % proBild === 0) {
      const z = [];
      for (const k of [kugel, ...kegel.map((k) => k.b)]) {
        z.push(+k.position.x.toFixed(4), +k.position.y.toFixed(4), +k.position.z.toFixed(4),
          +k.quaternion.x.toFixed(4), +k.quaternion.y.toFixed(4), +k.quaternion.z.toFixed(4), +k.quaternion.w.toFixed(4));
      }
      bilder.push(z);
    }
    // alles liegt still (auch die Kugel ist hinten in der Polsterung oder steht)?
    // Fertig: 1 Sekunde nachdem der neunte Kegel liegt (einer darf noch kullern)
    if (ende === dauerMax && zeitNeun !== null && t > zeitNeun + 1.0) {
      ende = t;
      if (!aufnehmen) break;
    }
    if (aufnehmen && ende < dauerMax && t > ende + 0.4) break;
    // Bei der Suche früh abbrechen, wenn der Wurf sowieso nicht in Frage kommt
    if (!aufnehmen && (aufprall === null ? t > 1.2 : t > aufprall + 2.2)) break;
  }

  let gefallen = 0;
  for (const k of kegel) {
    k.b.quaternion.vmult(hoch, oben);
    if (oben.y < 0.6) gefallen++;
  }
  // „Nachkullern“: Tempo des schnellsten Kegels am Ende (einer soll noch rollen)
  const nachkullern = Math.max(...kegel.map((k) => k.b.velocity.length()));
  return { gefallen, aufprall, ende, zeitNeun, maxHoehe, wandTreffer: wandTreffer.size, drehung, nachkullern, bilder, kugelStart: { x: x0, z: START_Z, vx, vz } };
}

// Bewertung „wie spektakulär“
function punkte(e) {
  if (e.gefallen !== 9 || e.aufprall === null || e.zeitNeun === null) return -1;
  if (e.aufprall > START_Z / 6) return -1;            // die Kugel muss die Kegel von vorne treffen
  const bisAlleLiegen = e.zeitNeun - e.aufprall;
  if (bisAlleLiegen > 1.8) return -1;                  // soll in die 2–2,5-s-Animation passen
  const kullern = e.nachkullern > 0.25 && e.nachkullern < 1.8 ? 1 : 0;
  return e.wandTreffer * 2 + e.maxHoehe * 12 + kullern * 4 + e.drehung * 0.02 - bisAlleLiegen * 3;
}

// ---------------------------------------------------------------------
// Viele Varianten durchprobieren (Zufallssuche mit Zeitbudget)
//   --sekunden=600   wie lange gesucht wird (Standard 600)
//   --seed=1         Startwert des Zufalls (für parallele Suchen verschiedene Werte)
//   --variante='{…}' keine Suche, genau diese Variante aufnehmen und speichern
//   --nur-suchen     beste Variante nur ausgeben, nicht speichern
// ---------------------------------------------------------------------
function argument(name, standard) {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : standard;
}

function zufallsVariante(rnd) {
  const ziel = (rnd() - 0.5) * 0.5;            // seitlicher Treffpunkt am Vorderkegel (m)
  const w = (rnd() - 0.5) * 16;                // Winkel in Grad (schräg in die Gasse)
  const tempo = 6.5 + rnd() * 4.5;             // 6,5–11 m/s (ca. 23–40 km/h)
  const winkel = (w * Math.PI) / 180;
  const versatz = Array.from({ length: 18 }, () => (rnd() - 0.5) * 0.01);
  return { x0: ziel + Math.tan(winkel) * (START_Z - 0.707), winkel, tempo, versatz };
}

function aufnehmenUndSpeichern(v) {
  const fps = 60;
  const a = simuliere(v, true, fps);
  if (a.gefallen !== 9) console.log("Warnung: bei der Aufnahme fielen nur", a.gefallen, "Kegel");
  const startPos = kegelPositionen().map((p, i) => ({ ...p, x: +(p.x + (v.versatz?.[i * 2] || 0)).toFixed(4), z: +(p.z + (v.versatz?.[i * 2 + 1] || 0)).toFixed(4) }));
  const daten = {
    info: "Aufgenommener Wurf (cannon-es, 300 Schritte/s). Erzeugt von js/vendor/kegel-wurf-aufnehmen.mjs",
    variante: v,
    fps,
    aufprall: +a.aufprall.toFixed(3),   // Sekunde des ersten Kegeltreffers (ab Aufnahmebeginn)
    alleLiegen: +a.zeitNeun.toFixed(3), // ab hier liegen alle Neune
    ende: +a.ende.toFixed(3),           // 1 s nachdem der neunte Kegel liegt (Aufnahme-Ende)
    kugel: { radius: MASSE.kugelRadius, start: a.kugelStart },
    kegel: { profil: KEGEL_PROFIL, schwerpunkt: +SCHWERPUNKT.toFixed(4), hoehe: MASSE.kegelHoehe, koenigHoehe: MASSE.koenigHoehe, positionen: kegelPositionen(), aufgestellt: startPos },
    bahn: { breite: MASSE.bahnBreite, wandX: MASSE.wandX, rueckwandZ: MASSE.rueckwandZ },
    // je Bild: Kugel, dann 9 Kegel, jeweils x, y, z, qx, qy, qz, qw
    bilder: a.bilder,
  };
  const ziel = fileURLToPath(new URL("../kegel-wurf.json", import.meta.url));
  writeFileSync(ziel, JSON.stringify(daten));
  console.log("Gespeichert:", ziel, a.bilder.length, "Bilder, Aufprall", daten.aufprall, "s, Ende", daten.ende, "s");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const feste = argument("variante", null);
  if (feste) {
    aufnehmenUndSpeichern(JSON.parse(feste));
  } else {
    const sekunden = +argument("sekunden", 600);
    let z = +argument("seed", 1) * 9301 + 49297;
    const rnd = () => ((z = (z * 16807) % 2147483647) / 2147483647);
    const t0 = Date.now();
    let anzahl = 0, neuner = 0, beste = null, bestePunkte = -1;
    const verteilung = {};
    while (Date.now() - t0 < sekunden * 1000) {
      const v = zufallsVariante(rnd);
      const e = simuliere(v);
      anzahl++;
      verteilung[e.gefallen] = (verteilung[e.gefallen] || 0) + 1;
      if (e.gefallen === 9) neuner++;
      const p = punkte(e);
      if (p > bestePunkte) {
        bestePunkte = p;
        beste = v;
        console.log(`neue beste Variante: Punkte ${p.toFixed(2)}, Wandtreffer ${e.wandTreffer}, Höhe ${e.maxHoehe.toFixed(2)} m, nachkullern ${e.nachkullern.toFixed(2)} s`);
      }
    }
    console.log(`${anzahl} Würfe, davon ${neuner}× alle Neune. Verteilung:`, JSON.stringify(verteilung));
    if (!beste) { console.log("Keine Alle-Neune-Variante gefunden – länger suchen (--sekunden=…)."); process.exit(1); }
    console.log("BESTE " + JSON.stringify({ punkte: bestePunkte, variante: beste }));
    if (!process.argv.includes("--nur-suchen")) aufnehmenUndSpeichern(beste);
  }
}

export { simuliere, punkte };
