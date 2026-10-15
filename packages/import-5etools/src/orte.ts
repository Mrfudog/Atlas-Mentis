/**
 * **Orte aus dem Buchtext** (T-175): ein Abschnitt, der einen Ort
 * beschreibt, bekommt neben seinem Text einen `Place` in derselben Ebene.
 * Der Text bleibt, wo er ist; der Ort zeigt mit `describedIn` auf den
 * Abschnitt (Überschrift oder Szene), und die Leseansicht zeigt ihn dort
 * als Verweis. Kopiert wird nichts.
 *
 * **Erkannt wird, ohne zu erfinden** — ein Ort ist, was das Buch selbst so
 * auszeichnet:
 *
 *  - ein **Raum mit Schlüssel** im Abenteuer („K1. Front Courtyard",
 *    „12a. Vault"): `kind: 'Raum'`;
 *  - ein Abschnitt, der **Räume mit Schlüssel enthält** oder **eine eigene
 *    Karte** hat: ein Ort, die Art bleibt offen, solange der Text sie nicht
 *    sagt;
 *  - ein benannter Abschnitt, dessen **erster Satz ihn als Ort nennt**:
 *    „Ravensgate is a walled city …", „The Mirewood, a forest of …" — das
 *    Subjekt ist der Name der Überschrift, und das Hauptwort danach ist ein
 *    Ortswort (`ORTSWORT`). Daraus kommt auch die Art.
 *
 * Steht ein Ortswort im ersten Satz, ohne dass der Satz den Abschnitt
 * meint („Its ruler lives in a tower …"), ist das ein **Kandidat**: er
 * wird gezählt und nicht angelegt.
 */

import type { Entity } from '@nw/model';
import type { Werkbank } from './werkbank.js';
import { zaehle } from './werkbank.js';

/** Ortswort → `Place.kind` (die Werte der Liste stehen deutsch, sie sind Daten). */
const ORTSWORT: Record<string, string | undefined> = {
  kingdom: 'Reich', realm: 'Reich', nation: 'Reich', empire: 'Reich', domain: 'Reich', country: 'Reich',
  duchy: 'Reich', principality: 'Reich', 'city-state': 'Stadt', province: 'Reich',
  city: 'Stadt', town: 'Stadt', village: 'Stadt', hamlet: 'Stadt', capital: 'Stadt', metropolis: 'Stadt',
  settlement: 'Stadt', outpost: 'Stadt', port: 'Stadt',
  district: 'Distrikt', ward: 'Distrikt', quarter: 'Distrikt', neighborhood: 'Distrikt',
  alley: 'Gasse', street: 'Gasse', lane: 'Gasse',
  castle: 'Gebäude', keep: 'Gebäude', fortress: 'Gebäude', citadel: 'Gebäude', tower: 'Gebäude',
  temple: 'Gebäude', shrine: 'Gebäude', monastery: 'Gebäude', abbey: 'Gebäude', manor: 'Gebäude',
  mansion: 'Gebäude', palace: 'Gebäude', tavern: 'Gebäude', inn: 'Gebäude', fort: 'Gebäude',
  stronghold: 'Gebäude', estate: 'Gebäude', windmill: 'Gebäude', mill: 'Gebäude', lighthouse: 'Gebäude',
  forest: 'Wildnis', wood: 'Wildnis', woods: 'Wildnis', swamp: 'Wildnis', marsh: 'Wildnis', desert: 'Wildnis',
  island: 'Wildnis', mountain: 'Wildnis', mountains: 'Wildnis', valley: 'Wildnis', region: 'Wildnis',
  plain: 'Wildnis', plains: 'Wildnis', lake: 'Wildnis', river: 'Wildnis', sea: 'Wildnis', jungle: 'Wildnis',
  hills: 'Wildnis', wasteland: 'Wildnis', badlands: 'Wildnis', canyon: 'Wildnis', glacier: 'Wildnis',
  /* Ein Ort, dessen Art die Liste nicht kennt: angelegt, `kind` leer. */
  dungeon: undefined, ruin: undefined, ruins: undefined, cave: undefined, caves: undefined, cavern: undefined,
  crypt: undefined, tomb: undefined, mine: undefined, lair: undefined, landmark: undefined, location: undefined,
  site: undefined, plane: undefined, demiplane: undefined, layer: undefined,
};

/** Ein Raum mit Schlüssel: „1. Cave Mouth", „12a. Vault", „K1. Front Courtyard". */
export const RAUM = /^([A-Z]{0,2}\d+[a-z]?)\.\s/;

/** Was die Erkennung über einen Abschnitt sagt. */
export interface OrtBefund {
  /** Ein Ort — anlegen. */
  ort: boolean;
  /** `Place.kind`, wenn der Text oder der Schlüssel sie sagt. */
  kind?: string;
  /** Ein Ortswort im ersten Satz, das nicht sicher den Abschnitt meint. */
  kandidat?: boolean;
}

const klein = (s: string): string => s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();

/** Der Text ohne 5e.tools-Marken: `{@creature goblin|MM|goblins}` → „goblins" ist hier gleich, gebraucht wird nur Klartext. */
export function klartext(s: string): string {
  let t = s;
  for (let i = 0; i < 4 && /\{@/.test(t); i += 1) {
    t = t.replace(/\{@\w+\s+([^{}]*)\}/g, (_m, inhalt: string) => {
      const teile = inhalt.split('|');
      return (teile.length >= 3 && teile[2] ? teile[2] : teile[0] ?? '').trim();
    });
  }
  return t.replace(/\s+/g, ' ').trim();
}

/** Der erste Satz eines Texts (bis zum ersten Punkt mit Leerzeichen danach). */
function ersterSatz(t: string): string {
  const m = /^(.*?[.!?])(\s|$)/.exec(t);
  return (m ? m[1]! : t).slice(0, 300);
}

const WORTE = Object.keys(ORTSWORT).sort((a, b) => b.length - a.length).map((w) => w.replace('-', '\\-')).join('|');
/** Artikel, bis zu drei Beiwörter (nicht „of"), dann das Ortswort. */
const NACH_SUBJEKT = new RegExp(
  `^(?:,[^,]{0,80},\\s*)?(?:(?:is|was|are|were)\\s+)?(?:a|an|the|one of the)\\s+((?:(?!of\\b|and\\b|who\\b|that\\b)[\\w'-]+\\s+){0,3}?)(${WORTE})\\b`,
  'i',
);
const IRGENDWO = new RegExp(`\\b(${WORTE})\\b`, 'i');

/**
 * Nennt der erste Satz den Abschnitt `name` als Ort? `text` ist der erste
 * Absatz in Klartext (siehe `klartext`). Erkannt wird „<Name> is a …
 * <Ortswort>" und „<Name>, a … <Ortswort>", auch mit „The" davor.
 */
export function ortAusText(name: string, text: string): OrtBefund {
  const satz = ersterSatz(klartext(text));
  if (!satz) return { ort: false };
  const n = klein(name).replace(/^the /, '');
  const s = klein(satz);
  const start = s.startsWith(n) ? n.length : s.startsWith(`the ${n}`) ? n.length + 4 : -1;
  if (start >= 0 && n.length > 1) {
    /* „Ravensgate, a walled city" — die Apposition ohne „is". */
    const rest = s.slice(start).trim().replace(/^,\s*(?=(?:a|an|the|one of the)\s)/, '');
    const m = NACH_SUBJEKT.exec(rest);
    if (m) {
      const wort = m[2]!.toLowerCase();
      const kind = ORTSWORT[wort];
      return { ort: true, ...(kind ? { kind } : {}) };
    }
  }
  /* Ein Ortswort in den ersten Worten, aber nicht als Aussage über den
     Abschnitt: zählen, nicht anlegen. */
  const anfang = s.split(' ').slice(0, 15).join(' ');
  return IRGENDWO.test(anfang) ? { ort: false, kandidat: true } : { ort: false };
}

/** Der erste Absatz eines Abschnitts (die erste Zeichenkette in seinem Text), sonst leer. */
export function ersterAbsatz(entries: unknown): string {
  if (!Array.isArray(entries)) return '';
  for (const x of entries) {
    if (typeof x === 'string') return x;
    /* Ein Vorlesetext steht oft zuerst; beschrieben wird der Ort danach. */
    if (x && typeof x === 'object' && !Array.isArray(x) && (x as { type?: unknown }).type === 'insetReadaloud') continue;
    return '';
  }
  return '';
}

/**
 * Der Befund für einen benannten Abschnitt: Raum mit Schlüssel, Abschnitt
 * mit Räumen oder Karte, sonst der erste Satz.
 */
export function ortBefund(name: string, entries: unknown, o: { raeume?: boolean; karte?: boolean } = {}): OrtBefund {
  if (RAUM.test(name)) return { ort: true, kind: 'Raum' };
  const t = ortAusText(name, ersterAbsatz(entries));
  if (t.ort) return t;
  if (o.raeume || o.karte) return { ort: true };
  return t;
}

/** Was ein angelegter Ort mitbekommt. */
export interface OrtAnlage {
  /** Der Abschnitt, der ihn beschreibt (Überschrift oder Szene) — `describedIn`. */
  abschnitt: Entity;
  /** Der Ort, in dem er liegt — `partOf`. */
  eltern?: Entity | undefined;
  befund: OrtBefund;
  quelle: string;
  seite?: unknown;
  /** Bericht-Art (`bookData`, `adventureData`). */
  art: string;
  /** Die Herkunft für die Peg-Id; ohne sie die des Abschnitts. */
  herkunft?: string;
}

/**
 * Einen Ort anlegen (T-175): `Place` mit Name und Art, `describedIn` der
 * Abschnitt, `partOf` der umgebende Ort. Die Peg-Id hängt an der des
 * Abschnitts — zwei Läufe legen ihn nicht zweimal an. `arrival` bleibt
 * leer: ein Vorlesetext am Ort steht im Abschnitt, auf den der Ort zeigt,
 * und eine Kopie liefe auseinander.
 */
export function legeOrtAn(wb: Werkbank, name: string, a: OrtAnlage): Entity {
  const seite = a.seite !== undefined && a.seite !== 0 ? { page: a.seite } : {};
  const ort = wb.anlegen('Place', name, a.herkunft ?? `place|${a.abschnitt.id}`, { source: a.quelle, ...seite });
  if (a.befund.kind) wb.feld(ort, 'Place', 'kind', a.befund.kind);
  wb.kante(ort, 'describedIn', a.abschnitt.id);
  if (a.eltern) wb.kante(ort, 'partOf', a.eltern.id);
  zaehle(wb.artBericht(a.art).artikel, 'Place');
  return ort;
}

/** Einen Kandidaten zählen (ein Ortswort, aber kein sicherer Ort). */
export function ortKandidat(wb: Werkbank, art: string): void {
  wb.notiz('Ortskandidat: Ortswort im ersten Satz, nicht angelegt (T-175)', art);
}

type Knoten = Record<string, unknown>;

/** Hat ein Abschnitt Unterabschnitte, die Räume mit Schlüssel sind? */
export function hatRaeume(entries: unknown): boolean {
  return Array.isArray(entries) && entries.some((k) => !!k && typeof k === 'object' && typeof (k as Knoten)['name'] === 'string' && RAUM.test(((k as Knoten)['name'] as string).trim()));
}

/**
 * Hat ein Abschnitt eine eigene Karte — in seinem Text, nicht in einem
 * Raum oder Unterkapitel, die selbst Orte werden?
 */
export function hatKarte(entries: unknown): boolean {
  const such = (x: unknown): boolean => {
    if (Array.isArray(x)) return x.some(such);
    if (!x || typeof x !== 'object') return false;
    const k = x as Knoten;
    if (k['type'] === 'image') return k['imageType'] === 'map';
    if (k['type'] === 'section' || (typeof k['name'] === 'string' && RAUM.test(k['name'].trim()))) return false;
    return such(k['images']) || such(k['entries']);
  };
  return such(entries);
}

/**
 * Die Frage der Teile (`TeileOptionen.ort`) für Überschriften: ist der
 * Abschnitt ein Ort, wird er angelegt. `angelegt` bekommt den neuen Ort
 * (das Abenteuer setzt `audience: 'gm'`).
 */
export function ortFuerUeberschrift(wb: Werkbank, quelle: string, art: string, angelegt?: (e: Entity) => void) {
  return (k: Knoten, abschnitt: Entity, eltern: Entity | undefined): Entity | undefined => {
    const n = typeof k['name'] === 'string' ? klartext(k['name']) : '';
    if (!n) return undefined;
    const befund = ortBefund(n, k['entries'], { raeume: hatRaeume(k['entries']) });
    if (!befund.ort) {
      if (befund.kandidat) ortKandidat(wb, art);
      return undefined;
    }
    const ort = legeOrtAn(wb, n, { abschnitt, eltern, befund, quelle, seite: k['page'], art });
    angelegt?.(ort);
    return ort;
  };
}
