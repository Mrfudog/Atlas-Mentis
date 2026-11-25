/**
 * **Lebens- und Schatztabellen** (T-084, REQ-186, REQ-238).
 *
 * „This Is Your Life" (XGE): je Hintergrund und Klasse eine Tabelle der
 * Gründe, dazu die Ergänzungstabellen der Klassen (Totems, Tätowierungen
 * …) und die Tabelle der Trinkets aus dem PHB. Eine Tabelle ist ein
 * Artikel; Hintergrund und Klasse zeigen mit `tableFor` darauf — dieselbe
 * Kante wie zu den Charakterzug-Tabellen eines Hintergrunds (M3).
 *
 * Schatz (DMG, XDMG, FTD): ein Wurf auf einer Schatztabelle verlangt
 * weitere Würfe auf anderen Tabellen — Edelsteine, Kunstgegenstände,
 * magische Gegenstände. Eine Zeile nennt oft zwei davon zugleich, also
 * steht der verschachtelte Wurf **in der Zeile**, als Verweis auf die
 * Tabelle (M11), und nicht als `entry`-Kante: eine Kante mit Gewicht wäre
 * ein eigener Ausgang des Wurfs, und zwei davon für eine Zeile zählten
 * die Zeile doppelt.
 *
 * Alles hier kam bis T-084 nicht herein und gehört darum **nicht zum
 * Grundstand** (`NEUE_ARTEN`): es bekommt Nummern hinter dessen
 * höchsten, und `--only-new --additions` legt es an.
 */

import type { Entity } from '@nw/model';
import type { Knoten } from '../copy.js';
import type { Werkbank } from '../werkbank.js';
import type { Zuordnung } from '../zuordnung.js';
import { liste, titel, zahl } from '../zuordnung.js';

/** „I became an acolyte because …" — die Gründe stehen in XGE, Kapitel 1. */
const LEBEN = 'XGE';

/** Eine Würfeltabelle aus Sätzen: je Satz eine Zeile, alle gleich schwer. */
function satzTabelle(wb: Werkbank, ent: Entity, saetze: string[], spalte: string, art = 'generic'): void {
  const T = 'Table';
  const w = `1d${saetze.length}`;
  wb.feld(ent, T, 'kind', art);
  wb.feld(ent, T, 'die', w);
  wb.feld(ent, T, 'columns', [`d${saetze.length}`, spalte]);
  wb.feld(
    ent,
    T,
    'rows',
    saetze.map((s, i) => {
      const text = wb.zeile(s);
      return { cells: [String(i + 1), text], text, weight: 1 };
    }),
  );
}

/** „a barbarian", „an acolyte". */
function einE(wort: string): string {
  return `${/^[aeiou]/i.test(wort) ? 'an' : 'a'} ${wort.toLowerCase()}`;
}

/** XGE hat keinen Eintrag „None" — den setzt der Generator von 5e.tools davor. */
function ohneNone(x: unknown): string[] {
  const l = liste(x).map(String);
  return l[0] === 'None' ? l.slice(1) : l;
}

/** Der Hintergrund oder die Klasse, für die eine Lebenstabelle gilt. */
function traeger(wb: Werkbank, tag: 'background' | 'class', name: string, quelle: string): Entity | undefined {
  return wb.finde(tag, [name, quelle]) ?? wb.finde(tag, [name.replace(/\s*\(.*\)$/, ''), quelle]);
}

/** Aus den Lebenseinträgen (Quelle = die des Hintergrunds) Tabellen mit Quelle XGE. */
function lebenVorbereiten(roh: Knoten[]): Knoten[] {
  return roh.map((e) => ({ ...e, source: LEBEN, fuer: { name: e['name'], source: e['source'] } }));
}

const LEBEN_GENUTZT = ['name', 'source', 'fuer', 'reasons', 'other'];

const lebenHintergrund: Zuordnung = {
  art: 'lifeBackground',
  tag: 'table',
  typ: () => 'Table',
  name: (e) => `${String(e['name'])} Reasons`,
  vorbereiten: lebenVorbereiten,
  genutzt: LEBEN_GENUTZT,
  fuellen(wb, ent, e) {
    const f = e['fuer'] as Knoten;
    satzTabelle(wb, ent, liste(e['reasons']).map(String), 'Reason');
    wb.feld(ent, 'Description', 'description', `Why you became ${einE(String(f['name']))} ("This Is Your Life").`);
    wb.marke(ent, 'this is your life');
    const bg = traeger(wb, 'background', String(f['name']), String(f['source']));
    if (bg) wb.kante(bg, 'tableFor', ent.id);
    else wb.ctx.insLeere('background', `${String(f['name'])}|${String(f['source'])}`);
  },
};

const lebenKlasse: Zuordnung = {
  art: 'lifeClass',
  tag: 'table',
  typ: () => 'Table',
  name: (e) => `${String(e['name'])} Reasons`,
  vorbereiten: lebenVorbereiten,
  genutzt: LEBEN_GENUTZT,
  fuellen(wb, ent, e) {
    const f = e['fuer'] as Knoten;
    const name = String(f['name']);
    satzTabelle(wb, ent, liste(e['reasons']).map(String), 'Reason');
    wb.feld(ent, 'Description', 'description', `Why you became ${einE(name)} ("This Is Your Life").`);
    wb.marke(ent, 'this is your life');
    const kl = traeger(wb, 'class', name, String(f['source']));
    if (kl) wb.kante(kl, 'tableFor', ent.id);
    else wb.ctx.insLeere('class', `${name}|${String(f['source'])}`);
    /* Die Ergänzungstabellen der Klasse: je eine eigene Tabelle, wie die
       weiteren Tabellen einer `tableGroup`. */
    for (const [titelText, saetze] of Object.entries((e['other'] as Knoten | undefined) ?? {})) {
      const neu = wb.anlegen('Table', `${name}: ${titelText}`, `lifeClass|${ent.id}|${titelText}`, e);
      satzTabelle(wb, neu, ohneNone(saetze), titelText);
      wb.marke(neu, 'this is your life');
      wb.merke(neu, 'table', neu.name, LEBEN);
      if (kl) wb.kante(kl, 'tableFor', neu.id);
    }
  },
};

const trinkets: Zuordnung = {
  art: 'lifeTrinket',
  tag: 'table',
  typ: () => 'Table',
  name: () => 'Trinkets',
  /* 5e.tools hält die hundert Trinkets als Liste von Sätzen, ohne Kopf:
     es ist die Tabelle aus dem PHB (Kapitel 5). */
  vorbereiten: (roh) => (roh.length ? [{ name: 'Trinkets', source: 'PHB', page: 160, saetze: roh as unknown as string[] }] : []),
  genutzt: ['name', 'source', 'saetze'],
  fuellen(wb, ent, e) {
    satzTabelle(wb, ent, liste(e['saetze']).map(String), 'Trinket', 'loot');
    wb.marke(ent, 'trinket');
  },
};

// ------------------------------------------------------------------ Schatz

const MUENZEN = ['cp', 'sp', 'ep', 'gp', 'pp'];

/** `6d6*100` → „{@dice 6d6} × 100". */
function menge(s: unknown): string {
  const t = String(s ?? '').trim();
  const m = /^(\d*d\d+(?:[+-]\d+)?)(?:\s*\*\s*([\d,]+))?$/.exec(t);
  if (!m) return t;
  return `{@dice ${m[1]!}}${m[2] ? ` × ${Number(m[2].replace(/,/g, '')).toLocaleString('en-US')}` : ''}`;
}

/** „{@dice 6d6} × 100 cp, {@dice 3d6} × 100 sp" */
function muenzen(c: unknown): string {
  const o = (c as Knoten | undefined) ?? {};
  return MUENZEN.filter((k) => o[k] !== undefined).map((k) => `${menge(o[k])} ${k}`).join(', ');
}

/** Der Name der Tabelle, auf der weitergewürfelt wird — aus derselben Quelle, sonst aus dem DMG. */
type Nachschlag = (art: 'gems' | 'artObjects' | 'magicItems', typ: unknown, quelle: string) => string | undefined;

function nachschlag(stand: Map<string, Knoten[]>): Nachschlag {
  return (art, typ, quelle) => {
    const l = stand.get(art) ?? [];
    const passt = (q: string) => l.find((t) => String(t['source']) === q && String(t['type']) === String(typ));
    const t = passt(quelle) ?? passt('DMG');
    return t ? `{@table ${String(t['name'])}|${String(t['source'])}}` : undefined;
  };
}

/** Eine Zeile „2d6 × [[10 gp Gemstones]]". */
function wurfAuf(n: Nachschlag, art: 'gems' | 'artObjects' | 'magicItems', w: Knoten, quelle: string, stufe?: string): string {
  let typ = w['type'];
  if (typ === 'randomByLevel' && stufe) typ = `byLevel.${stufe}`;
  const ziel = n(art, typ, quelle) ?? `${titel(art.replace(/([A-Z])/g, ' $1').toLowerCase())} ${String(typ)}`;
  const anzahl = String(w['amount'] ?? '1');
  return `${/d/.test(anzahl) ? `{@dice ${anzahl}}` : anzahl} × ${ziel}`;
}

/** Eine Zwischentabelle, welche Tabelle es wird: „01–43 [[10 gp]] · 44–99 [[50 gp]]". */
function typTabelle(n: Nachschlag, art: 'gems' | 'artObjects' | 'magicItems', w: Knoten, quelle: string): string {
  const teile = liste(w['typeTable']).map((r) => {
    const o = r as Knoten;
    const min = zahl(o['min']) ?? 0;
    const max = zahl(o['max']) ?? min;
    return `${min === max ? min : `${min}–${max}`} ${n(art, o['type'], quelle) ?? String(o['type'])}`;
  });
  const anzahl = String(w['amount'] ?? '1');
  return `${/d/.test(anzahl) ? `{@dice ${anzahl}}` : anzahl} rolls; for each, roll {@dice d100} for the table: ${teile.join(' · ')}`;
}

/** Die Stufen der 2024-Tabellen „By Level" zu den Herausforderungsgraden des Horts. */
function stufenband(e: Knoten): string {
  const min = zahl(e['crMin']) ?? 0;
  return min >= 17 ? '17-20' : min >= 11 ? '11-16' : min >= 5 ? '5-10' : '1-4';
}

/** „Challenge 0-4" → „Challenge 0–4", wie das DMG die Tabelle nennt. */
function grad(name: string): string {
  return name.replace(/(\d+)-(\d+)/, '$1–$2');
}

/** Die Schreibweisen, unter denen 5e.tools eine Schatztabelle nennt: `—`, `–` und `-`. */
function strichSchluessel(name: string, quelle: unknown): unknown[][] {
  return [...new Set([name, name.replace(/–/g, '—'), name.replace(/–/g, '-')])].map((n) => [n, quelle]);
}

let nach: Nachschlag = () => undefined;

const hort: Zuordnung = {
  art: 'hoard',
  tag: 'table',
  typ: () => 'Table',
  name: (e) => `Treasure Hoard: ${grad(String(e['name']))}`,
  schluessel: (e) => strichSchluessel(`Treasure Hoard: ${grad(String(e['name']))}`, e['source']),
  vorbereiten: (roh, stand) => {
    nach = nachschlag(stand.arten);
    return roh;
  },
  genutzt: ['name', 'source', 'page', 'crMin', 'crMax', 'coins', 'table'],
  fuellen(wb, ent, e) {
    const q = String(e['source']);
    const T = 'Table';
    wb.feld(ent, T, 'kind', 'loot');
    wb.feld(ent, T, 'die', '1d100');
    wb.feld(ent, T, 'columns', ['d100', 'Gems or Art Objects', 'Magic Items']);
    wb.feld(
      ent,
      T,
      'rows',
      liste(e['table']).map((r) => {
        const o = r as Knoten;
        const min = zahl(o['min']) ?? 0;
        const max = zahl(o['max']) ?? min;
        const schatz = [
          o['gems'] ? wurfAuf(nach, 'gems', o['gems'] as Knoten, q) : '',
          o['artObjects'] ? wurfAuf(nach, 'artObjects', o['artObjects'] as Knoten, q) : '',
        ].filter(Boolean);
        const magie = liste(o['magicItems']).map((m) => wurfAuf(nach, 'magicItems', m as Knoten, q, stufenband(e)));
        const zellen = [min === max ? String(min) : `${min}–${max}`, wb.zeile(schatz.join(', ') || '—'), wb.zeile(magie.join(', ') || '—')];
        return { cells: zellen, text: zellen.slice(1).join(' · '), weight: Math.max(1, max - min + 1) };
      }),
    );
    const m = muenzen(e['coins']);
    wb.feld(ent, 'Description', 'description', `Treasure for a hoard of challenge ${String(e['name']).replace(/^Challenge\s*/, '')}.`);
    wb.prosa(ent, `**Coins:** ${wb.zeile(m || '—')}.\n\nRoll once on this table; then roll on each table a row names, as often as it says.`);
    wb.marke(ent, 'treasure', 'hoard');
  },
};

const einzeln: Zuordnung = {
  art: 'individual',
  tag: 'table',
  typ: () => 'Table',
  name: (e) => `Individual Treasure: ${grad(String(e['name']))}`,
  schluessel: (e) => strichSchluessel(`Individual Treasure: ${grad(String(e['name']))}`, e['source']),
  genutzt: ['name', 'source', 'page', 'crMin', 'crMax', 'table'],
  fuellen(wb, ent, e) {
    const T = 'Table';
    wb.feld(ent, T, 'kind', 'loot');
    wb.feld(ent, T, 'die', '1d100');
    wb.feld(ent, T, 'columns', ['d100', 'Coins']);
    wb.feld(
      ent,
      T,
      'rows',
      liste(e['table']).map((r) => {
        const o = r as Knoten;
        const min = zahl(o['min']) ?? 0;
        const max = zahl(o['max']) ?? min;
        const text = wb.zeile(muenzen(o['coins']) || '—');
        return { cells: [min === max ? String(min) : `${min}–${max}`, text], text, weight: Math.max(1, max - min + 1) };
      }),
    );
    wb.feld(ent, 'Description', 'description', `Treasure a single creature of challenge ${String(e['name']).replace(/^Challenge\s*/, '')} carries.`);
    wb.marke(ent, 'treasure', 'individual');
  },
};

const DRACHE_GEGENSTAENDE = 'Dragon Hoard: Mundane Items';

const drachenHort: Zuordnung = {
  art: 'dragon',
  tag: 'table',
  typ: () => 'Table',
  name: (e) => `Dragon Hoard: ${String(e['name'])}`,
  vorbereiten: (roh, stand) => {
    nach = nachschlag(stand.arten);
    return roh;
  },
  genutzt: ['name', 'source', 'page', 'coins', 'dragonMundaneItems', 'gems', 'artObjects', 'magicItems'],
  fuellen(wb, ent, e) {
    const q = String(e['source']);
    const T = 'Table';
    /* Kein Würfel: ein Drachenhort ist eine Liste von Würfen, die alle
       gelten — eine Nachschlagetabelle mit einer Zeile je Wurf. */
    wb.feld(ent, T, 'kind', 'loot');
    wb.feld(ent, T, 'columns', ['Treasure', 'Roll']);
    const zeilen: [string, string][] = [];
    const m = muenzen(e['coins']);
    if (m) zeilen.push(['Coins', m]);
    const mu = e['dragonMundaneItems'] as Knoten | undefined;
    if (mu) zeilen.push(['Mundane items', `{@dice ${String(mu['amount'] ?? '1')}} × {@table ${DRACHE_GEGENSTAENDE}|${q}}`]);
    for (const [art, wort] of [['gems', 'Gemstones'], ['artObjects', 'Art objects']] as const) {
      const w = e[art] as Knoten | undefined;
      if (w) zeilen.push([wort, w['typeTable'] ? typTabelle(nach, art, w, 'DMG') : wurfAuf(nach, art, w, 'DMG')]);
    }
    for (const w of liste(e['magicItems']) as Knoten[]) {
      zeilen.push(['Magic items', w['typeTable'] ? typTabelle(nach, 'magicItems', w, 'DMG') : wurfAuf(nach, 'magicItems', w, 'DMG')]);
    }
    wb.feld(
      ent,
      T,
      'rows',
      zeilen.map(([a, b]) => {
        const text = wb.zeile(b);
        return { cells: [a, text], text: `${a}: ${text}` };
      }),
    );
    wb.feld(ent, 'Description', 'description', `What a ${String(e['name']).toLowerCase()} dragon's hoard holds: every row is rolled.`);
    wb.marke(ent, 'treasure', 'dragon hoard');
  },
};

const drachenKram: Zuordnung = {
  art: 'dragonMundaneItems',
  tag: 'table',
  typ: () => 'Table',
  name: () => DRACHE_GEGENSTAENDE,
  /* 5e.tools hält die Tabelle als nackte Zeilen ohne Kopf. Sie steht im
     selben Kapitel wie die Horte (FTD). */
  vorbereiten: (roh) => (roh.length ? [{ name: DRACHE_GEGENSTAENDE, source: 'FTD', page: 73, table: roh }] : []),
  genutzt: ['name', 'source', 'page', 'table'],
  fuellen(wb, ent, e) {
    const T = 'Table';
    wb.feld(ent, T, 'kind', 'loot');
    wb.feld(ent, T, 'die', '1d100');
    wb.feld(ent, T, 'columns', ['d100', 'Item']);
    wb.feld(
      ent,
      T,
      'rows',
      liste(e['table']).map((r) => {
        const o = r as Knoten;
        const min = zahl(o['min']) ?? 0;
        const max = zahl(o['max']) ?? min;
        const text = wb.zeile(String(o['item'] ?? ''));
        return { cells: [min === max ? String(min) : `${min}–${max}`, text], text, weight: Math.max(1, max - min + 1) };
      }),
    );
    wb.marke(ent, 'treasure', 'dragon hoard');
  },
};

/** Die neuen Arten aus T-084 in der Reihenfolge, in der sie Nummern bekommen. */
export const SCHATZ: Zuordnung[] = [lebenHintergrund, lebenKlasse, trinkets, drachenKram, hort, einzeln, drachenHort];
