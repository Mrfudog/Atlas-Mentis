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
 *  - ein Abschnitt mit **eigener Karte**: der Ort, den die Karte zeigt,
 *    benannt nach ihrem Titel („Map 5.1: Vallaki (Area N)" → „Vallaki"),
 *    die Art offen;
 *  - ein benannter Abschnitt, dessen **erster Satz ihn als Ort nennt**:
 *    „Ravensgate is a walled city …", „The Mirewood, a forest of …" — das
 *    Subjekt ist der Name der Überschrift, und das Hauptwort danach ist ein
 *    Ortswort (`ORTSWORT`). Daraus kommt auch die Art.
 *
 * Steht ein Ortswort im ersten Satz, ohne dass der Satz den Abschnitt
 * meint („Its ruler lives in a tower …"), oder hat ein Abschnitt Räume,
 * aber keine Karte und keinen solchen Satz („Areas of the Village"), ist
 * das ein **Kandidat**: er wird gezählt und nicht angelegt. Räume darin
 * liegen dann im nächsten Ort darüber.
 */

import type { Entity } from '@nw/model';
import type { Werkbank } from './werkbank.js';
import { zaehle } from './werkbank.js';

/** Ortswort → `Place.kind` (die Werte der Liste stehen deutsch, sie sind Daten). */
const ORTSWORT: Record<string, string | undefined> = {
  /* „Realm" und „domain" sagen bei Ebenen und Domänen des Schreckens
     nicht, ob es ein Reich ist: Ort ja, Art offen. */
  kingdom: 'Reich', realm: undefined, nation: 'Reich', empire: 'Reich', domain: undefined, country: 'Reich',
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

/* Dazu die Schreibweisen der neueren Abenteuer (T-182): „D27: Ritual
   Room", „Area 1: Cave Entrance", „1N. Rectory", „M14–M15. Miners'
   Retreat". Nur für den Ort, nicht für die Szenen — welcher Abschnitt eine
   eigene Szene ist, sagt weiter `RAUM` in `abenteuer.ts`, sonst legte ein
   Lauf `only-new` neben den Teilen einer Szene neue Szenen mit demselben
   Text an. */
const SCHLUESSEL = '[A-Z]{0,2}\\d+[A-Za-z]?';
export const RAUM_SCHLUESSEL = new RegExp(`^(?:Areas?\\s+)?${SCHLUESSEL}(?:\\s*[–-]\\s*${SCHLUESSEL})?[.:]\\s`);

/** Was die Erkennung über einen Abschnitt sagt. */
export interface OrtBefund {
  /** Ein Ort — anlegen. */
  ort: boolean;
  /** `Place.kind`, wenn der Text oder der Schlüssel sie sagt. */
  kind?: string;
  /** Ein Ortswort im ersten Satz, das nicht sicher den Abschnitt meint. */
  kandidat?: boolean;
  /** Der Name des Orts, wenn er nicht der des Abschnitts ist (aus dem Titel seiner Karte). */
  name?: string;
  /** Erkannt an der eigenen Karte. */
  karte?: boolean;
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
/* Das Ortswort muss das Hauptwort sein: „a forest people" ist ein Volk.
   Danach kommt ein Satzzeichen, das Ende oder ein Wort, das den Ort
   weiter beschreibt. */
const DANACH = '(?=\\s*(?:[,.;:!?)]|$)|\\s+(?:of|in|on|at|near|that|which|where|and|or|known|built|located|from|with|whose|to|ruled|founded|between|beneath|under|above|across|along|by|for|surrounded|perched|nestled|carved|set|situated|hidden|home|famous|renowned|once|now|lying|deep|high|far)\\b)';
const NACH_SUBJEKT = new RegExp(
  `^(?:,[^,]{0,80},\\s*)?(?:(?:is|was|are|were)\\s+)?(?:a|an|the|one of the)\\s+((?:(?!of\\b|and\\b|who\\b|that\\b)[\\w'-]+\\s+){0,3}?)(${WORTE})s?\\b${DANACH}`,
  'i',
);
const IRGENDWO = new RegExp(`\\b(${WORTE})\\b`, 'i');
/* „This walled city stands …", „These caves are …" (T-182): der Satz
   spricht vom Abschnitt selbst. Das Ortswort muss auch hier das Hauptwort
   sein — danach ein Satzzeichen oder ein Verb, nicht „mountain folk" oder
   „tomb's interior". */
const VERB = '(?:is|was|are|were|has|had|have|lies|lay|lie|stands|stand|sits|sit|serves|serve|houses|house|contains|contain|consists|covers|cover|rises|rise|stretches|extends|occupies|holds|hold|used|once|seems|appears|looks|overlooks|sprawls|clings|hugs|floats|drifts|marks|guards|connects|leads|opens|lead|open)';
const DIESER = new RegExp(
  `^(?:this|these)\\s+((?:(?!of\\b|and\\b|the\\b|an?\\b)[\\w'-]+\\s+){0,3}?)(${WORTE})s?\\b(?=\\s*[,;:—–]|\\s+${VERB}\\b)`,
  'i',
);
/* Unter einer Überschrift wie „Treasure", „Temple Features" oder „Ground
   Floor" meint „This cavern …" den Ort darüber, nicht den Abschnitt. */
const ALLGEMEIN = /\b(?:features?|treasure|overview|background|development|developments|secret|doors?|reason|geography|locations?|adventures?|floor|level|ruins|tactics|encounters?|events?|hooks?|summary|aftermath|conclusion|introduction|running|roleplaying|history)\b/i;

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
  /* „This village …" — der Abschnitt ist das Subjekt, ohne seinen Namen. */
  const dieser = ALLGEMEIN.test(n) ? null : DIESER.exec(s);
  if (dieser) {
    const kind = ORTSWORT[dieser[2]!.toLowerCase()];
    return { ort: true, ...(kind ? { kind } : {}) };
  }
  /* „Darklord Chakuna's home village, Oselo appears …" — die Apposition
     steht vor dem Namen. */
  if (n.length > 1) {
    const vorn = new RegExp(`^(?:[\\w'-]+\\s+){0,5}?(${WORTE}),\\s+(?:the\\s+)?${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').exec(s);
    if (vorn) {
      const kind = ORTSWORT[vorn[1]!.toLowerCase()];
      return { ort: true, ...(kind ? { kind } : {}) };
    }
  }
  /* Ein Gazetteer-Eintrag mit Hauptstadt („Capital: …") ist ein Land. */
  if (/^capital:\s/.test(s)) return { ort: true };
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
 * Der Befund für einen benannten Abschnitt: ein Raum mit Schlüssel, ein
 * erster Satz, der ihn als Ort nennt, sonst der Titel seiner Karte (`karte`,
 * schon bereinigt — `ortAusKarte`): ein Abschnitt „Areas of the Village"
 * mit der Karte „Map 3.1: Village of Barovia" beschreibt den Ort „Village
 * of Barovia", nicht einen Ort, der „Areas of the Village" hiesse.
 * Räume allein machen keinen Ort — „Areas of …" ist eine Liste.
 */
export function ortBefund(name: string, entries: unknown, o: { karte?: string | undefined; raeume?: boolean; schluessel?: boolean } = {}): OrtBefund {
  if (o.schluessel !== false && RAUM_SCHLUESSEL.test(name)) return { ort: true, kind: 'Raum' };
  const t = ortAusText(name, ersterAbsatz(entries));
  if (t.ort) return t;
  if (o.karte) return klein(o.karte) === klein(name) ? { ort: true, karte: true } : { ort: true, karte: true, name: o.karte };
  return o.raeume ? { ort: false, kandidat: true } : t;
}

/**
 * Der Name eines Orts aus dem Titel seiner Karte: „Map 5.1: Vallaki (Area
 * N)" → „Vallaki", „Map 13.1: Amber Temple (Area X) - Upper Level" →
 * „Amber Temple", „Crypt (Battlemap; DM Version)" → „Crypt"; von einer
 * Sammelkarte („Map 11: A & Map 12: B") der erste. Kein Name aus einer
 * Fallenskizze.
 */
export function ortAusKarte(titel: string): string | undefined {
  const t = (klartext(titel).split('&')[0] ?? '')
    .replace(/^maps?\s*[\w.\-–]*\s*:\s*/i, '')
    .replace(/\s*\([^)]*\b(?:battlemap|version)\b[^)]*\)\s*$/i, '')
    .replace(/\s+[-–]\s+.*$/, '')
    .replace(/\s*\((?:area|areas)\b[^)]*\)\s*$/i, '')
    .trim();
  if (!t || /\btraps?\b/i.test(t)) return undefined;
  return t;
}

/**
 * Der Bereich, den ein Kartentitel nennt (T-182): „Map 6.1: Old Bonegrinder
 * (Area O)" → „O". Nur Buchstaben — „(Area N2)" ist ein Raum, kein Bereich.
 */
export function bereichAusKarte(titel: string): string | undefined {
  return /\(areas?\s+([A-Z]{1,2})\)/i.exec(klartext(titel))?.[1]?.toUpperCase();
}

/** Der Bereich der ersten eigenen Karte eines Abschnitts, die einen nennt. */
export function bereichAusKarten(entries: unknown): string | undefined {
  for (const t of kartenTitel(entries)) {
    const b = bereichAusKarte(t);
    if (b) return b;
  }
  return undefined;
}

/** Die Buchstaben vor der Nummer eines Raumschlüssels: „O1. Ground Floor" → „O", „12a. Vault" → „". */
export function schluesselBereich(name: string): string | undefined {
  if (!RAUM_SCHLUESSEL.test(name)) return undefined;
  return /^(?:Areas?\s+)?([A-Z]{0,2})\d/.exec(name)?.[1];
}

/** Ein Eintrag einer Bereichsliste: „N. Town of Vallaki" → „N". */
export function listenBereich(name: string): string | undefined {
  return /^([A-Z]{1,2})\.\s/.exec(name)?.[1];
}

/** Was ein angelegter Ort mitbekommt. */
export interface OrtAnlage {
  /** Der Abschnitt, der ihn beschreibt (Überschrift, Absatz oder Szene) — `describedIn`; steht er noch nicht, setzt ihn der Aufrufer. */
  abschnitt?: Entity | undefined;
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
  const ort = wb.anlegen('Place', name, a.herkunft ?? `place|${a.abschnitt?.id ?? name}`, { source: a.quelle, ...seite });
  if (a.befund.kind) wb.feld(ort, 'Place', 'kind', a.befund.kind);
  if (a.abschnitt) wb.kante(ort, 'describedIn', a.abschnitt.id);
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
  return Array.isArray(entries) && entries.some((k) => !!k && typeof k === 'object' && typeof (k as Knoten)['name'] === 'string' && RAUM_SCHLUESSEL.test(((k as Knoten)['name'] as string).trim()));
}

/**
 * Die Titel der eigenen Karten eines Abschnitts — in seinem Text, nicht in
 * einem Raum oder Unterkapitel, die selbst Orte werden.
 */
export function kartenTitel(entries: unknown): string[] {
  const out: string[] = [];
  const such = (x: unknown): void => {
    if (Array.isArray(x)) {
      for (const y of x) such(y);
      return;
    }
    if (!x || typeof x !== 'object') return;
    const k = x as Knoten;
    if (k['type'] === 'image') {
      if (k['imageType'] === 'map') out.push(typeof k['title'] === 'string' ? k['title'] : '');
      return;
    }
    if (k['type'] === 'section' || (typeof k['name'] === 'string' && RAUM_SCHLUESSEL.test(k['name'].trim()))) return;
    such(k['images']);
    such(k['entries']);
  };
  such(entries);
  return out;
}

/** Der erste brauchbare Ortsname aus den eigenen Karten eines Abschnitts. */
export function ortsnameAusKarten(entries: unknown): string | undefined {
  for (const t of kartenTitel(entries)) {
    const n = ortAusKarte(t);
    if (n) return n;
  }
  return undefined;
}

/**
 * Die Frage der Teile (`TeileOptionen.ort`) für Überschriften: ist der
 * Abschnitt ein Ort, wird er angelegt. `angelegt` bekommt den neuen Ort
 * (das Abenteuer setzt `audience: 'gm'`); `schluessel` nur im Abenteuer —
 * dort ist „3. Den" ein Raum, im Regelbuch „3. Determine Ability Scores"
 * ein Schritt.
 */
export function ortFuerUeberschrift(wb: Werkbank, quelle: string, art: string, angelegt?: (e: Entity) => void, schluessel = false) {
  return (k: Knoten, herkunft: string, eltern: Entity | undefined): Entity | undefined => {
    const n = typeof k['name'] === 'string' ? klartext(k['name']) : '';
    if (!n) return undefined;
    /* Ein Schlüssel zählt nur im Abenteuer: im Regelbuch ist „1. Choose a Race" ein Schritt. */
    const befund = ortBefund(n, k['entries'], { raeume: schluessel && hatRaeume(k['entries']), schluessel });
    if (!befund.ort) {
      if (befund.kandidat) ortKandidat(wb, art);
      return undefined;
    }
    /* Eine nummerierte Überschrift ist nur in einem Ort ein Raum (T-182):
       „1. The Tome of …" in einer Kartenlegung ist eine Aufzählung. */
    if (befund.kind === 'Raum' && !eltern) {
      ortKandidat(wb, art);
      return undefined;
    }
    const ort = legeOrtAn(wb, befund.name ?? n, { herkunft, eltern, befund, quelle, seite: k['page'], art });
    angelegt?.(ort);
    return ort;
  };
}
