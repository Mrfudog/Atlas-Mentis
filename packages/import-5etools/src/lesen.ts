/**
 * **Den Datenstand lesen und sieben.** Eine Datei je Art (oder ein
 * Verzeichnis), oben ein Schlüssel mit dem Artnamen, darunter eine Liste.
 * Gelesen wird jede solche Liste unter ihrem Schlüssel, damit eine Art, die
 * 5e.tools in eine neue Datei verschiebt, nicht still wegfällt.
 *
 * Gesiebt wird nach den Entscheidungen des Arbeitsplans (§1, D47):
 * **2014 als Basis** — ohne die 2024-Kernbücher, ohne die Bücher, die seit
 * September 2024 auf den 2024-Regeln stehen, ohne Unearthed Arcana (E2);
 * ohne Vehikel, Bastionen und Decks (E4). Was dabei wegfällt, wird je Art
 * und Quelle gezählt — einschalten ist eine Zeile.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Knoten } from './copy.js';

/** Ab diesem Erscheinungstag steht ein Buch auf den 2024-Regeln (E2). */
export const STICHTAG_2024 = '2024-09-01';

/* Verzeichnisse und Dateien ohne Einträge, die Artikel werden könnten:
   Buchtext (E1: nur die Regeln daraus), Werkzeugdaten der Seite (Abgleich
   §2.7). Der Abenteuertext kommt seit T-082 herein, aber nicht als Liste
   je Art: `liesAbenteuer` liest ihn für sich (`arten/abenteuer.ts`). */
const NICHT_LESEN = /^(adventure|book|foundry.*|changelog|renderdemo|converter|makecards|makebrew-creature|msbcr|encounterbuilder|bookref-.*|gendata-(maps|nav-adventure-book-index|spell-source-lookup|subclass-lookup|tag-redirects)|index|fluff-index|sources|bookref)(\.json)?$/;

/** Arten, die nicht hereinkommen, und warum (Abgleich §2, Arbeitsplan E4). */
export const ARTEN_WEG: Record<string, string> = {
  vehicle: 'später (E4)',
  vehicleUpgrade: 'später (E4)',
  vehicleFluff: 'später (E4)',
  deck: 'später (E4)',
  card: 'später (E4)',
  facility: 'später (E4)',
  facilityFluff: 'später (E4)',
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
  lifeTrinket: 'Tabellen aus „This Is Your Life" — noch nicht zugeordnet',
  lifeBackground: 'Tabellen aus „This Is Your Life" — noch nicht zugeordnet',
  lifeClass: 'Tabellen aus „This Is Your Life" — noch nicht zugeordnet',
  _meta: 'Dateikopf',
  book: 'Buch-Metadaten: eine Systemebene statt einer je Buch (Arbeitsplan §1)',
  adventure: 'Abenteuer-Metadaten: Name und Erscheinen der Ebene (T-082); der Text kommt aus adventure/',
  itemMastery: 'Waffenmeisterschaft gibt es erst 2024',
  languageScript: 'die Schrift steht als Wort an Language.script',
  hoard: 'Schatztabellen mit verschachtelten Würfen — noch nicht zugeordnet',
  individual: 'Schatztabellen mit verschachtelten Würfen — noch nicht zugeordnet',
  dragon: 'Schatztabellen mit verschachtelten Würfen — noch nicht zugeordnet',
  dragonMundaneItems: 'Schatztabellen mit verschachtelten Würfen — noch nicht zugeordnet',
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
  return { arten, quellen, abenteuer: liesAbenteuer(datenPfad) };
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
}

/**
 * Warum ein Eintrag nicht hereinkommt, oder `undefined`, wenn er es tut.
 * Die Gründe sind die Wörter, nach denen der Bericht zählt.
 */
export function ausschluss(e: Knoten, stand: Datenstand, auswahl: Auswahl = {}): string | undefined {
  /* Ein 2014-Merkmal, das an eine 2024-Klasse gehängt ist, gehört zu ihr
     und fällt mit ihr weg. */
  for (const feld of ['classSource', 'raceSource']) {
    const q = e[feld];
    if (typeof q === 'string' && q && q !== quelleVon(e)) {
      const grund = ausschluss({ source: q }, stand, { ...auswahl, nurSrd: false });
      if (grund) return `hängt an einer Klasse oder Abstammung aus ${q} (${grund})`;
    }
  }
  const quelle = quelleVon(e);
  const q = quelle.toLowerCase();
  if (/^ua/.test(q)) return 'Unearthed Arcana';
  const meta = stand.quellen.get(q);
  if (['xphb', 'xmm', 'xdmg'].includes(q)) return '2024-Kernbuch';
  if (meta && meta.published >= STICHTAG_2024) return '2024-Regeln (seit 2024-09)';
  if (auswahl.quellen?.length && !auswahl.quellen.some((s) => s.toLowerCase() === q)) return 'nicht ausgewählt';
  if (auswahl.nurSrd) {
    const i = (e['inherits'] as Knoten | undefined) ?? {};
    if (!e['srd'] && !e['srd52'] && !i['srd'] && !i['srd52']) return 'nicht im SRD';
  }
  return undefined;
}
