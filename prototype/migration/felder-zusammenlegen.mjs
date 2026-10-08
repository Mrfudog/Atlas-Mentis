/**
 * Doppelte Felder zusammenlegen.
 *
 * Vier Stellen sagten dasselbe zweimal, und jedes Mal wurde die eine
 * gefüllt und die andere gelesen — oder umgekehrt:
 *
 * - **`Map.image` → `Image.image`.** Eine Karte *hat* ein Bild wie jeder
 *   andere Artikel, und genau dieses Bild ist ihr Hintergrund. Zwei Felder
 *   dafür hiessen, dass man dem leeren Schirm nicht ansieht, welches der
 *   Zeichner liest.
 * - **`Table.note` → `Notes.note`** und **`Access.note` → `Notes.note`.**
 *   Eine Notiz ist eine Notiz. `Notes.note` kann mehrere und lange; ein
 *   kurzes zweites Feld daneben heisst nur, beide durchsuchen zu müssen.
 * - **`Image.ref` → `Image.image`**, falls es das je gab: das Element las
 *   `ref`, das Register erklärte `image`, und solange beides auseinander
 *   lief, zeichnete das Bild nie.
 *
 *   node felder-zusammenlegen.mjs <verzeichnis-mit-entities>
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const stub = (text) =>
  String(text || '')
    .replace(/[[\]{}*_#>`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 5)
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'notiz';

/** Einen kurzen Text als Eintrag an `Notes.note` hängen. */
function alsNotiz(e, text) {
  const wert = String(text ?? '').trim();
  if (!wert) return false;
  const karte = (e.components.Notes ??= {});
  const liste = Array.isArray(karte.note) ? karte.note.slice() : [];
  /* Denselben Text nicht zweimal: die Wanderung darf zweimal laufen. */
  if (liste.some((x) => (x?.value ?? x) === wert)) return false;
  liste.push({ id: `note-${stub(wert)}`, value: wert });
  karte.note = liste;
  return true;
}

export function legeZusammen(e) {
  const c = e.components;
  if (!c || typeof c !== 'object') return 0;
  let n = 0;

  /* Das Bild der Karte. Steht schon eines an `Image`, gewinnt das — sonst
     überschriebe die Wanderung, was jemand nach dem Umzug gesetzt hat. */
  const map = c.Map;
  if (map && map.image !== undefined) {
    const ref = map.image;
    delete map.image;
    if (ref) {
      const bild = (c.Image ??= {});
      if (!bild.image) bild.image = ref;
    }
    n += 1;
  }
  /* Und der Feldname, den das Element einmal las, obwohl es ihn nie gab. */
  const bild = c.Image;
  if (bild && bild.ref !== undefined) {
    if (!bild.image && bild.ref) bild.image = bild.ref;
    delete bild.ref;
    n += 1;
  }

  for (const karte of ['Table', 'Access']) {
    const k = c[karte];
    if (!k || k.note === undefined) continue;
    alsNotiz(e, k.note);
    delete k.note;
    n += 1;
  }

  for (const [k, v] of Object.entries(c)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length) delete c[k];
  }
  return n;
}

const [, , ziel] = process.argv;
if (!ziel) {
  console.log('Map.image -> Image.image · Table.note, Access.note -> Notes.note · Image.ref -> Image.image');
  process.exit(0);
}
if (!existsSync(ziel)) {
  console.error(`${ziel} gibt es nicht`);
  process.exit(2);
}

let artikel = 0;
let felder = 0;
for (const datei of readdirSync(ziel).filter((f) => f.endsWith('.json'))) {
  const pfad = join(ziel, datei);
  const e = JSON.parse(readFileSync(pfad, 'utf8'));
  const n = legeZusammen(e);
  if (n) writeFileSync(pfad, `${JSON.stringify(e, null, 2)}\n`);
  felder += n;
  artikel += 1;
}
console.log(`${artikel} Artikel, ${felder} Felder zusammengelegt`);
