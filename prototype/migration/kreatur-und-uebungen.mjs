/**
 * **Kreatur, Übungen, Schwierigkeit, Zustand** — die Wanderung zu den
 * Entscheidungen vom 21.9.
 *
 * Sechs Dinge auf einmal, weil sie dieselben Artikel betreffen und eine
 * halbe Wanderung schlimmer ist als keine:
 *
 *  1. `NPC`, `Companion` und `Retainer` sind keine Artikelarten mehr. Eine
 *     Kreatur ist die Art, und `Creature.kind` sagt, was für eine — npc,
 *     companion, retainer. Ein freies Wort, damit eine neue Sorte ein
 *     Eintrag ist und keine Registerzeile.
 *  2. Die Karte `Skills` heisst `Proficiencies` und trägt jetzt auch
 *     Rüstungen, Waffen und Wissensgebiete.
 *  3. `StatblockInfo.languages`, `.saves` und `.skills` fallen weg: sie
 *     standen als freier Text neben denselben Listen an `Proficiencies`.
 *     Was dort steht, wird aufgezählt und nicht stillschweigend gelöscht.
 *  4. `Status.status` kennt drei Wörter statt vier: `planned` wird
 *     `prepared`, `used` wird `ready`. Dass etwas gespielt wurde, ist ein
 *     Ereignis und gehört ins Kampagnenlog, nicht in ein Feld, das danach
 *     für immer „benutzt" sagt.
 *  5. Die Schwierigkeit ist eine Stufe von 1 bis 20 im eigenen Typ
 *     `Difficulty`. Aus fünf Wörtern werden Zahlen: trivial 4, easy 8,
 *     medium 12, hard 16, deadly 20.
 *  6. Drei Felder hiessen `state` und meinten Verschiedenes:
 *     `Quest.state` wird `Quest.progress`, `Encounter.state` wird
 *     `Encounter.phase`, `Story.state` fällt weg (`Status` sagt den
 *     Vorbereitungsstand, `played` das Datum).
 *
 * Zwei Betriebsarten, weil die Daten an zwei Orten liegen:
 *
 *   node kreatur-und-uebungen.mjs <verzeichnis-mit-entities>
 *   node kreatur-und-uebungen.mjs <export.json> [ziel.json]
 *
 * Die Ausfuhr trägt **auch das Register**. Darum wird es beim Wandern einer
 * Ausfuhr durch das aktuelle ersetzt (aus `prototype/test/dbdump/registry`):
 * das Register steht einmal, und eine gewanderte Datei mit den alten Zeilen
 * wäre ein Bestand, den seine eigenen Typen nicht erklären.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const REGISTRY_DIR = resolve(HIER, '..', 'test', 'dbdump', 'registry');

/** Alte Artikelart → das Wort, das jetzt in `kind` steht. */
const ART_ZU_KIND = { NPC: 'npc', Companion: 'companion', Retainer: 'retainer' };
const STATUS = { planned: 'prepared', used: 'ready', discarded: 'idea' };
const SCHWERE = { trivial: 4, easy: 8, medium: 12, hard: 16, deadly: 20 };

/** Was die Wanderung getan hat — gezählt, damit ein Lauf prüfbar ist. */
function neueZaehlung() {
  return {
    artikel: 0,
    kreaturen: 0,
    uebungen: 0,
    status: 0,
    schwere: 0,
    fortschritt: 0,
    phase: 0,
    geschichte: 0,
    /* Werte, die niemand mehr trägt. Sie werden ausgegeben: ein stiller
       Verlust sieht aus wie ein leeres Feld. */
    verloren: [],
  };
}

export function wandereArtikel(e, z) {
  let beruehrt = false;
  const karten = e.components ?? {};

  /* 1. Die drei Arten werden eine Art und ein Wort. */
  const arten = Array.isArray(e.interfaces) ? e.interfaces : [];
  const alt = arten.find((a) => a in ART_ZU_KIND);
  if (alt) {
    e.interfaces = arten.map((a) => (a in ART_ZU_KIND ? 'Creature' : a))
      .filter((a, i, xs) => xs.indexOf(a) === i);
    const karte = { ...(karten.Creature ?? {}) };
    /* Ein `kind`, das schon dasteht, gewinnt: die Art war der Rückfall und
       nicht die Wahrheit. */
    if (!karte.kind) karte.kind = ART_ZU_KIND[alt];
    karten.Creature = karte;
    z.kreaturen += 1;
    beruehrt = true;
  }

  /* 2. Die Karte heisst anders. Trägt der Artikel beide, gewinnt die neue
        und die alte wird aufgezählt — zwei Karten für eine Sache sind
        genau die Lage, die niemand von Hand auflösen will. */
  if (karten.Skills) {
    if (karten.Proficiencies) {
      z.verloren.push(`${e.id}: Skills neben Proficiencies — Skills verworfen`);
    } else {
      karten.Proficiencies = karten.Skills;
      z.uebungen += 1;
    }
    delete karten.Skills;
    beruehrt = true;
  }

  /* 3. Die drei Freitexte am Statblock. */
  const sb = karten.StatblockInfo;
  if (sb) {
    for (const feld of ['languages', 'saves', 'skills']) {
      if (sb[feld] === undefined) continue;
      const wert = String(sb[feld]).trim();
      /* „—" ist kein Inhalt, sondern ein Strich, den jemand gesetzt hat,
         weil das Feld dastand. */
      if (wert && wert !== '—' && wert !== '-') {
        z.verloren.push(`${e.id}: StatblockInfo.${feld} = ${wert}`);
      }
      delete sb[feld];
      beruehrt = true;
    }
  }

  /* 4. Vier Wörter werden drei. */
  const st = karten.Status;
  if (st && typeof st.status === 'string' && st.status in STATUS) {
    st.status = STATUS[st.status];
    z.status += 1;
    beruehrt = true;
  }

  /* 5. Die Schwierigkeit zieht in ihren eigenen Typ und wird eine Zahl. */
  for (const art of ['Encounter', 'Scene']) {
    const karte = karten[art];
    if (!karte || karte.difficulty === undefined) continue;
    const roh = karte.difficulty;
    const zahl = typeof roh === 'number' ? roh : SCHWERE[String(roh).toLowerCase()]
      ?? (Number.isFinite(Number(roh)) && String(roh).trim() !== '' ? Number(roh) : undefined);
    if (zahl === undefined) {
      if (String(roh).trim()) z.verloren.push(`${e.id}: ${art}.difficulty = ${roh}`);
    } else {
      const spanne = Math.min(20, Math.max(1, Math.round(zahl)));
      karten.Difficulty = { ...(karten.Difficulty ?? {}), difficulty: spanne };
      z.schwere += 1;
    }
    delete karte.difficulty;
    beruehrt = true;
  }

  /* 6. Drei Felder hiessen gleich und meinten Verschiedenes. */
  const quest = karten.Quest;
  if (quest && quest.state !== undefined) {
    if (quest.progress === undefined) quest.progress = quest.state;
    delete quest.state;
    z.fortschritt += 1;
    beruehrt = true;
  }
  const enc = karten.Encounter;
  if (enc && enc.state !== undefined) {
    if (enc.phase === undefined) enc.phase = enc.state;
    delete enc.state;
    z.phase += 1;
    beruehrt = true;
  }
  const story = karten.Story;
  if (story && story.state !== undefined) {
    /* `Status` sagt den Vorbereitungsstand, `played` das Datum. Ein
       Zustand, den kein Schirm las, geht ohne Ersatz. */
    delete story.state;
    z.geschichte += 1;
    beruehrt = true;
  }

  if (beruehrt) z.artikel += 1;
  return beruehrt;
}

/** Das Register, wie es jetzt im Paket steht. */
function aktuellesRegister() {
  const teile = ['interfaces', 'relations', 'views', 'units', 'enums', 'vars', 'settings'];
  const reg = {};
  for (const teil of teile) {
    const datei = join(REGISTRY_DIR, `${teil}.json`);
    if (existsSync(datei)) reg[teil] = JSON.parse(readFileSync(datei, 'utf8'));
  }
  /* Die Ausfuhr trägt `components` als zweiten Namen für `interfaces` —
     ein Erbe aus der Zeit, als es beides gab. Die Einfuhr liest ihn noch. */
  if (reg.interfaces) reg.components = reg.interfaces;
  return reg;
}

function bericht(z) {
  console.log(
    `${z.artikel} Artikel gewandert · ${z.kreaturen} Kreaturen (kind), `
    + `${z.uebungen} Übungskarten, ${z.status} Status, ${z.schwere} Schwierigkeiten, `
    + `${z.fortschritt} Quest.progress, ${z.phase} Encounter.phase, `
    + `${z.geschichte} Story.state entfernt`,
  );
  for (const v of z.verloren) console.log(`  ! ${v}`);
}

const [, , ziel, ausgabe] = process.argv;
if (!ziel) {
  console.log('node kreatur-und-uebungen.mjs <verzeichnis-mit-entities | export.json> [ziel.json]');
  process.exit(0);
}

const z = neueZaehlung();
if (statSync(ziel).isDirectory()) {
  const dateien = readdirSync(ziel).filter((f) => f.endsWith('.json'));
  for (const datei of dateien) {
    const pfad = join(ziel, datei);
    const e = JSON.parse(readFileSync(pfad, 'utf8'));
    if (wandereArtikel(e, z)) writeFileSync(pfad, `${JSON.stringify(e, null, 2)}\n`);
  }
  console.log(`${dateien.length} Dateien gelesen.`);
  bericht(z);
} else {
  const daten = JSON.parse(readFileSync(ziel, 'utf8'));
  for (const e of daten.entities ?? []) wandereArtikel(e, z);
  daten.registry = aktuellesRegister();
  const raus = ausgabe ?? ziel.replace(/\.json$/, '') + '-gewandert.json';
  writeFileSync(raus, `${JSON.stringify(daten, null, 1)}\n`);
  console.log(`${(daten.entities ?? []).length} Artikel gelesen, Register ersetzt, geschrieben nach ${raus}.`);
  bericht(z);
}
