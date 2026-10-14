/**
 * **Den Datenstand lesen und sieben.** Eine Datei je Art (oder ein
 * Verzeichnis), oben ein Schlüssel mit dem Artnamen, darunter eine Liste.
 * Gelesen wird jede solche Liste unter ihrem Schlüssel, damit eine Art, die
 * 5e.tools in eine neue Datei verschiebt, nicht still wegfällt.
 *
 * **Gesiebt wird nicht mehr nach Regelstand** (T-087, REQ-243; löst E2
 * und E4 ab): 2024, Unearthed Arcana, Fahrzeuge, Kartendecks und
 * Bastionen kommen herein, jede Quelle in ihre Ebene, und aufgeschaltet
 * wird, was die Kampagne will. Der Regelstand (`regelstandVon`) sagt
 * jetzt, wohin ein Eintrag gehört, und was **vorher** schon hereinkam,
 * heisst der Grundstand (`imGrundstand`) — an ihm ändert sich nichts.
 * Weg bleibt, was keine Art ist (`ARTEN_WEG`); gezählt wird es je Art.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Knoten } from './copy.js';

/** Ab diesem Erscheinungstag steht ein Buch auf den 2024-Regeln (E2). */
export const STICHTAG_2024 = '2024-09-01';

/** Der Regelstand einer Quelle und einer Ebene (T-087). */
export type Regelstand = '2014' | '2024' | 'UA';

/**
 * Die Arten, die bis T-087 zurückgestellt waren (E4): sie kommen herein,
 * gehören aber nie zum Grundstand — auch ein Fahrzeug aus einem
 * 2014-Abenteuer ist neu und darf keinen Artikel von vorher verschieben.
 */
export const NEUE_ARTEN = new Set(['vehicle', 'vehicleUpgrade', 'deck', 'card', 'facility', 'itemMastery']);

/**
 * **Die Nachträge** (T-084): Arten und Einträge, die erst nach T-087
 * hereinkommen — Lebens- und Schatztabellen, die Spielarten der Monster
 * und Abstammungen (`SPIELART`), die ausgeschriebenen +N-Gegenstände.
 * Sie gehören weder zum Grundstand noch zu dem, was T-087 brachte: beide
 * stehen auf dev schon mit ihren Nummern, und ein Nachtrag davor
 * verschöbe sie — und mit ihnen die Peg-Ids der geteilten Merkmale, deren
 * Text Nummern nennt. Darum rechnet `lauf` drei Gänge und die Nachträge
 * zuletzt; ihre Teilung ist eine eigene (`Werkbank.teilung`).
 */
export const NACHTRAG_ARTEN = new Set([
  'lifeBackground', 'lifeClass', 'lifeTrinket', 'hoard', 'individual', 'dragon', 'dragonMundaneItems', 'specificVariant',
]);

/** Woran eine ausgeschriebene Spielart (`_versions`) zu erkennen ist (T-084). */
export const SPIELART = '__spielart';

export function istNachtrag(e: Knoten, art: string): boolean {
  return NACHTRAG_ARTEN.has(art) || Boolean(e[SPIELART]);
}

/* Verzeichnisse und Dateien ohne Einträge, die Artikel werden könnten:
   Werkzeugdaten der Seite (Abgleich §2.7). Buch- und Abenteuertext kommen
   herein (T-082, T-108), aber nicht als Liste je Art: `liesAbenteuer` und
   `liesBuecher` lesen sie für sich (`arten/abenteuer.ts`, `arten/buch.ts`). */
const NICHT_LESEN = /^(adventure|book|foundry.*|changelog|renderdemo|converter|makecards|makebrew-creature|msbcr|encounterbuilder|bookref-.*|gendata-(maps|nav-adventure-book-index|spell-source-lookup|subclass-lookup|tag-redirects)|index|fluff-index|sources|bookref)(\.json)?$/;

/** Arten, die nicht hereinkommen, und warum (Abgleich §2). Fahrzeuge, Decks,
 *  Bastionen und Waffenmeisterschaften standen hier bis T-087 (E4). */
export const ARTEN_WEG: Record<string, string> = {
  recipe: 'Kochrezepte, kein Handwerk (Abgleich §2.5)',
  recipeFluff: 'Kochrezepte',
  crochetPattern: 'Häkelmuster',
  crochetPatternFluff: 'Häkelmuster',
  psionic: 'Unearthed Arcana, nie erschienen',
  encounterShape: 'Schablonen des Begegnungsbauers',
  itemEntry: 'Textschablonen, beim Lesen eingesetzt',
  itemTypeAdditionalEntries: 'Textschablonen',
  itemType: 'eine Aufzählung am Feld Item.itemType, kein Artikel',
  legendaryGroupTemplate: 'Schablone',
  spellFluff: 'nur Bilder (E5)',
  featFluff: 'nur Bilder (E5)',
  itemFluff: 'nur Bilder (E5)',
  trapFluff: 'nur Bilder (E5)',
  hazardFluff: 'nur Bilder (E5)',
  optionalfeatureFluff: 'nur Bilder (E5)',
  rewardFluff: 'nur Bilder (E5)',
  languageFluff: 'nur Bilder (E5)',
  conditionFluff: 'nur Bilder (E5)',
  diseaseFluff: 'nur Bilder (E5)',
  statusFluff: 'nur Bilder (E5)',
  objectFluff: 'nur Bilder (E5)',
  charoptionFluff: 'nur Bilder (E5)',
  _meta: 'Dateikopf',
  book: 'Buch-Metadaten: eine Systemebene statt einer je Buch (Arbeitsplan §1)',
  adventure: 'Abenteuer-Metadaten: Name und Erscheinen der Ebene (T-082); der Text kommt aus adventure/',
  languageScript: 'die Schrift steht als Wort an Language.script',
};

/**
 * Quellen, die nicht hereinkommen (T-087): Kochbücher und das Häkelbuch.
 * Ihre Rezepte und Muster bleiben weg wie `recipe` und `crochetPattern`,
 * und mit ihnen ihr Buchtext und das Rezept-Deck. Was davon vor T-087
 * schon hereinkam (Heroes' Feast, 2020), bleibt — der Grundstand ändert
 * sich nicht.
 */
export const QUELLEN_WEG: Record<string, string> = {
  hflott: 'Kochbuch (Heroes\' Feast Legends of the Table)',
  hfdomm: 'Kochrezepte als Karten (Deck of Many Morsels)',
  cabomp: 'Häkelmuster (Crochet: A Book of Many Patterns)',
};

export interface Quelle {
  id: string;
  name: string;
  published: string;
  art: 'book' | 'adventure';
  /** Die Gruppe in 5e.tools (`core`, `supplement`, `setting`, `prerelease`, `screen` …) — für die Gruppen-Ebenen (T-088). */
  group?: string;
  author?: string;
  /** Bei einem Abenteuer: der Handlungsstrang und die Stufen (T-088). */
  storyline?: string;
  level?: { start?: number; end?: number };
}

export interface Datenstand {
  /** Je 5e.tools-Art alle Einträge, ungesiebt. */
  arten: Map<string, Knoten[]>;
  quellen: Map<string, Quelle>;
  /** Je Abenteuer (Kürzel, klein) sein Textbaum aus `adventure/` (T-082). */
  abenteuer?: Map<string, Abenteuer>;
  /** Je Buch (Kürzel, klein) sein Textbaum aus `book/` (T-108). */
  buecher?: Map<string, Abenteuer>;
}

/** Ein Abenteuer aus `adventure/adventure-*.json` mit seinem Kopf aus `adventures.json`. */
export interface Abenteuer {
  id: string;
  /** Der Kopf: Name, Stufen, Erscheinen, `contents` mit den Ordnungszahlen der Kapitel. */
  kopf: Knoten;
  /** Die Kapitel, wie 5e.tools sie hält (`data`). */
  daten: Knoten[];
}

function sammle(dir: string, out: string[]): void {
  for (const f of readdirSync(dir).sort()) {
    if (NICHT_LESEN.test(f)) continue;
    const p = join(dir, f);
    if (statSync(p).isDirectory()) sammle(p, out);
    else if (f.endsWith('.json')) out.push(p);
  }
}

/** Alle Listen aus `data/`. */
export function lies(datenPfad: string): Datenstand {
  const dateien: string[] = [];
  sammle(datenPfad, dateien);
  const arten = new Map<string, Knoten[]>();
  for (const p of dateien) {
    let j: unknown;
    try {
      j = JSON.parse(readFileSync(p, 'utf8'));
    } catch {
      continue;
    }
    if (!j || typeof j !== 'object' || Array.isArray(j)) continue;
    for (const [k, v] of Object.entries(j as Knoten)) {
      if (!Array.isArray(v)) continue;
      const liste = arten.get(k) ?? [];
      for (const e of v) if (e && typeof e === 'object') liste.push(e as Knoten);
      arten.set(k, liste);
    }
  }
  const quellen = new Map<string, Quelle>();
  const meta = (datei: string, schluessel: string, art: Quelle['art']) => {
    try {
      const j = JSON.parse(readFileSync(join(datenPfad, datei), 'utf8')) as Record<string, Knoten[]>;
      for (const b of j[schluessel] ?? []) {
        const id = String(b['source'] ?? b['id'] ?? '');
        if (!id || quellen.has(id.toLowerCase())) continue;
        const stufen = b['level'] as { start?: unknown; end?: unknown } | undefined;
        const zahl = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : undefined);
        quellen.set(id.toLowerCase(), {
          id,
          name: String(b['name'] ?? id),
          published: String(b['published'] ?? ''),
          art,
          ...(typeof b['group'] === 'string' ? { group: b['group'] } : {}),
          ...(typeof b['author'] === 'string' ? { author: b['author'] } : {}),
          ...(typeof b['storyline'] === 'string' ? { storyline: b['storyline'] } : {}),
          ...(stufen && typeof stufen === 'object' ? { level: { start: zahl(stufen.start), end: zahl(stufen.end) } } : {}),
        });
      }
    } catch {
      /* ohne Bücherliste wird nur nach UA gesiebt */
    }
  };
  meta('books.json', 'book', 'book');
  meta('adventures.json', 'adventure', 'adventure');
  return { arten, quellen, abenteuer: liesAbenteuer(datenPfad), buecher: liesBuecher(datenPfad) };
}

/**
 * Die Abenteuer (T-082, REQ-240): je Datei in `adventure/` ein Textbaum,
 * dazu der Kopf aus `adventures.json`. Ohne Verzeichnis keine — ein
 * Datenstand ohne Abenteuer ist kein Fehler.
 */
export function liesAbenteuer(datenPfad: string): Map<string, Abenteuer> {
  const out = new Map<string, Abenteuer>();
  const koepfe = new Map<string, Knoten>();
  try {
    const j = JSON.parse(readFileSync(join(datenPfad, 'adventures.json'), 'utf8')) as Record<string, Knoten[]>;
    for (const a of j['adventure'] ?? []) koepfe.set(String(a['id'] ?? '').toLowerCase(), a);
  } catch {
    return out;
  }
  let dateien: string[];
  try {
    dateien = readdirSync(join(datenPfad, 'adventure')).filter((f) => /^adventure-.*\.json$/.test(f)).sort();
  } catch {
    return out;
  }
  for (const f of dateien) {
    let j: Record<string, Knoten[]>;
    try {
      j = JSON.parse(readFileSync(join(datenPfad, 'adventure', f), 'utf8')) as Record<string, Knoten[]>;
    } catch {
      continue;
    }
    for (const a of j['adventureData'] ?? []) {
      const id = String(a['id'] ?? a['source'] ?? '');
      const kopf = koepfe.get(id.toLowerCase());
      if (!id || !kopf || !Array.isArray(a['data'])) continue;
      out.set(id.toLowerCase(), { id: String(kopf['id'] ?? id), kopf, daten: a['data'] as Knoten[] });
    }
  }
  return out;
}

/**
 * Die Bücher (T-108, E-028): je Datei in `book/` ein Textbaum, dazu der
 * Kopf aus `books.json` — dieselbe Form wie ein Abenteuer (`Abenteuer`).
 * Ohne Verzeichnis keine.
 */
export function liesBuecher(datenPfad: string): Map<string, Abenteuer> {
  return liesTexte(datenPfad, 'books.json', 'book', 'book', 'bookData');
}

function liesTexte(datenPfad: string, kopfDatei: string, kopfSchluessel: string, ordner: string, datenSchluessel: string): Map<string, Abenteuer> {
  const out = new Map<string, Abenteuer>();
  const koepfe = new Map<string, Knoten>();
  try {
    const j = JSON.parse(readFileSync(join(datenPfad, kopfDatei), 'utf8')) as Record<string, Knoten[]>;
    for (const a of j[kopfSchluessel] ?? []) koepfe.set(String(a['id'] ?? '').toLowerCase(), a);
  } catch {
    return out;
  }
  let dateien: string[];
  try {
    dateien = readdirSync(join(datenPfad, ordner)).filter((f) => f.startsWith(`${ordner}-`) && f.endsWith('.json')).sort();
  } catch {
    return out;
  }
  for (const f of dateien) {
    let j: Record<string, Knoten[]>;
    try {
      j = JSON.parse(readFileSync(join(datenPfad, ordner, f), 'utf8')) as Record<string, Knoten[]>;
    } catch {
      continue;
    }
    for (const a of j[datenSchluessel] ?? []) {
      const id = String(a['id'] ?? a['source'] ?? '');
      const kopf = koepfe.get(id.toLowerCase());
      if (!id || !kopf || !Array.isArray(a['data'])) continue;
      out.set(id.toLowerCase(), { id: String(kopf['id'] ?? id), kopf, daten: a['data'] as Knoten[] });
    }
  }
  return out;
}

/** Die Quelle eines Eintrags. Magische Varianten tragen sie in `inherits`. */
export function quelleVon(e: Knoten): string {
  const s = e['source'] ?? (e['inherits'] as Knoten | undefined)?.['source'];
  return typeof s === 'string' ? s : '';
}

export interface Auswahl {
  /** Nur Einträge mit SRD-Flagge. */
  nurSrd?: boolean;
  /** Nur diese Quellen (Kürzel). */
  quellen?: string[];
  /** Nur der Grundstand, wie vor T-087: ohne 2024, UA und die neuen Arten. */
  nurGrundstand?: boolean;
  /** Ohne die Nachträge aus T-084: der Stand, den T-087 schrieb (`NACHTRAG_ARTEN`). */
  ohneNachtrag?: boolean;
}

/** Der Regelstand einer Quelle: UA am Kürzel, 2024 an den Kernbüchern und am Erscheinen (E2). */
export function regelstandDerQuelle(quelle: string, stand: Pick<Datenstand, 'quellen'>): Regelstand {
  const q = quelle.toLowerCase();
  if (/^ua/.test(q)) return 'UA';
  if (['xphb', 'xmm', 'xdmg'].includes(q)) return '2024';
  const meta = stand.quellen.get(q);
  if (meta && meta.published >= STICHTAG_2024) return '2024';
  return '2014';
}

/** Die Klasse oder Abstammung, an der ein Eintrag hängt, wenn sie aus einer anderen Quelle kommt. */
function haengtAn(e: Knoten): string[] {
  const out: string[] = [];
  for (const feld of ['classSource', 'raceSource']) {
    const q = e[feld];
    if (typeof q === 'string' && q && q !== quelleVon(e)) out.push(q);
  }
  return out;
}

/**
 * **Der Regelstand eines Eintrags** (T-087). Ein Merkmal oder eine
 * Unterklasse aus einem 2014-Buch, die 5e.tools an eine 2024-Klasse hängt,
 * gehört zu ihr: der Regelstand der Klasse gilt, wenn er ein anderer ist.
 */
export function regelstandVon(e: Knoten, stand: Pick<Datenstand, 'quellen'>): Regelstand {
  const eigen = regelstandDerQuelle(quelleVon(e), stand);
  for (const q of haengtAn(e)) {
    const r = regelstandDerQuelle(q, stand);
    if (r !== '2014') return r;
  }
  return eigen;
}

/**
 * **In welcher Ebene ein Eintrag liegt** (T-087): in der seiner Quelle —
 * ausser er hängt an einer Klasse oder Abstammung eines anderen
 * Regelstands, dann in deren. Sonst stünde der 2014-Champion, den
 * 5e.tools dem 2024-Kämpfer gibt, ein zweites Mal im Player's Handbook
 * und käme in jeder Kampagne ins Spiel, die es aufschaltet.
 */
export function ebeneQuelle(e: Knoten, stand: Pick<Datenstand, 'quellen'>): string {
  const eigen = quelleVon(e);
  const r = regelstandDerQuelle(eigen, stand);
  for (const q of haengtAn(e)) if (regelstandDerQuelle(q, stand) !== r) return q;
  return eigen;
}

/**
 * **Der Grundstand** (T-087): was bis T-087 allein hereinkam — 2014-Regeln
 * ohne die zurückgestellten Arten. Er teilt nichts mit dem Rest: keinen
 * Angriff, kein Merkmal, keine Fassung, damit ein Lauf mit 2024 an ihm
 * nichts anders schreibt als einer ohne.
 */
export function imGrundstand(e: Knoten, art: string, stand: Pick<Datenstand, 'quellen'>): boolean {
  return !NEUE_ARTEN.has(art) && !istNachtrag(e, art) && regelstandVon(e, stand) === '2014';
}

/**
 * Warum ein Eintrag nicht hereinkommt, oder `undefined`, wenn er es tut.
 * Die Gründe sind die Wörter, nach denen der Bericht zählt. Seit T-087
 * siebt nur noch die Auswahl, nicht der Regelstand.
 */
export function ausschluss(e: Knoten, stand: Datenstand, auswahl: Auswahl = {}, art = ''): string | undefined {
  /* Ein Merkmal, das an einer Klasse hängt, die nicht hereinkommt, fällt mit ihr weg. */
  for (const q of haengtAn(e)) {
    const grund = ausschluss({ source: q }, stand, { ...auswahl, nurSrd: false });
    if (grund) return `hängt an einer Klasse oder Abstammung aus ${q} (${grund})`;
  }
  const quelle = quelleVon(e);
  const q = quelle.toLowerCase();
  if (QUELLEN_WEG[q]) return QUELLEN_WEG[q];
  if ((auswahl.nurGrundstand || auswahl.ohneNachtrag) && istNachtrag(e, art)) return 'Nachtrag (T-084)';
  if (auswahl.nurGrundstand) {
    if (NEUE_ARTEN.has(art)) return 'neue Art (T-087)';
    const r = regelstandDerQuelle(quelle, stand);
    if (r === 'UA') return 'Unearthed Arcana';
    if (['xphb', 'xmm', 'xdmg'].includes(q)) return '2024-Kernbuch';
    if (r === '2024') return '2024-Regeln (seit 2024-09)';
  }
  if (auswahl.quellen?.length && !auswahl.quellen.some((s) => s.toLowerCase() === q)) return 'nicht ausgewählt';
  if (auswahl.nurSrd) {
    const i = (e['inherits'] as Knoten | undefined) ?? {};
    if (!e['srd'] && !e['srd52'] && !i['srd'] && !i['srd52']) return 'nicht im SRD';
  }
  return undefined;
}
