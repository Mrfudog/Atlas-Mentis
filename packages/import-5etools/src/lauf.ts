/**
 * **Ein Lauf** (Abgleich §4.2): lesen, sieben, `_copy` auflösen, Artikel
 * anlegen, füllen, prüfen. Ein Prüffehler bricht den Lauf — eine Datei,
 * die die Einfuhr ablehnen würde, soll gar nicht erst entstehen.
 */

import type { Entity, Registry } from '@nw/model';
import { stageBases, validateEntity } from '@nw/model';
import { seedRegistry } from '@nw/registry';
import { legeAktionsartenAn, REGELN } from './arten/regeln.js';
import { ZAUBER } from './arten/zauber.js';
import { GEGENSTAENDE } from './arten/gegenstaende.js';
import { CHARAKTERBAU } from './arten/charakterbau.js';
import { LEGENDAER, MONSTER } from './arten/monster.js';
import { WELT } from './arten/welt.js';
import { abenteuer } from './arten/abenteuer.js';
import { buch } from './arten/buch.js';
import type { Knoten } from './copy.js';
import { fassungen, herkunft, vereineGleiche } from './doppel.js';
import { angriffeVereinen } from './arten/angriff.js';
import { KOPIE_VON, loeseKopien, spielarten } from './copy.js';
import type { Auswahl, Datenstand, Quelle, Regelstand } from './lesen.js';
import { ARTEN_WEG, ausschluss, ebeneQuelle, imGrundstand, istNachtrag, SPIELART, quelleVon, regelstandDerQuelle, regelstandVon, STICHTAG_2024 } from './lesen.js';
import { NEUES } from './arten/neu.js';
import { SCHATZ } from './arten/schatz.js';
import type { Bericht } from './werkbank.js';
import { buchEbeneId, gruppeEbeneId, herausgeberEbeneId, ohneBuchEbeneId, Werkbank, zaehle } from './werkbank.js';
import type { Zuordnung } from './zuordnung.js';
import type { Bildplan } from './bilder.js';
import { bildplan } from './bilder.js';
import { zauberlisten, zauberlistenPlan, type ZauberlistenPlan } from './arten/zauberlisten.js';
import { fraktionen } from './fraktionen.js';
import { wohnorte } from './wohnorte.js';

/** Die Reihenfolge aus Abgleich §4.2 — jede spätere Art zeigt auf frühere. */
export const ZUORDNUNGEN: Zuordnung[] = [
  ...REGELN,
  ZAUBER,
  ...GEGENSTAENDE,
  ...CHARAKTERBAU,
  LEGENDAER,
  ...MONSTER,
  ...WELT,
  ...NEUES,
  ...SCHATZ,
];

/** Die Gruppe aller offiziellen 2014-Bücher (T-109, E-022 b). Bis T-109
 *  die Systemebene (Arbeitsplan §1, M9), in der lag, was kein Buch nennt —
 *  und ohne Herausgeber hiess sie „Homebrew". Aufgeschaltet bringt sie
 *  jedes Buch darin; die Id bleibt, damit eine Kampagne, die sie
 *  aufschaltet, weiter alles hat. */
export const EBENE = 'D&D 5e (2014)';

/** Die Ebene für das, was kein Buch nennt (die Aktionsarten) — unter
 *  Official und in der Gruppe `EBENE` (T-109). */
/** Was vom Buchtext eines Regelbuchs Neuzugang ist (T-145): das Kapitel und seine Teile. */
const BUCHTEXT = new Set(['Chapter', 'Heading', 'Paragraph', 'ReadAloudText', 'Embed', 'Illustration']);

export const OHNE_BUCH = 'D&D 5e (2014) — no book given';

/** Die drei Grundregelwerke — je eine Ebene wie jedes Buch, gruppiert als `core`. */
export const KERN = ['PHB', 'MM', 'DMG'];

/**
 * **Die Gruppen der Buchebenen** (T-088, E-022 b): je Gruppe eine Ebene
 * mit `kind: 'group'`, an der die Bücher mit `partOf` hängen. Die
 * Reihenfolge ist die der Kampagnenseite. Schlüssel, Name und ein Satz,
 * was darin steht.
 */
export const GRUPPEN: [string, string, string][] = [
  ['core', 'Core rules', "The three core rulebooks: Player's Handbook, Monster Manual and Dungeon Master's Guide."],
  ['supplement', 'Supplements', 'Rule books that add options, monsters and items to the core rules.'],
  ['setting', 'Settings', 'Books that describe a world or a plane, with the rules that belong to it.'],
  ['adventure', 'Adventures', 'Published adventures: chapters, scenes, encounters and maps.'],
  ['ua', 'Unearthed Arcana', 'Playtest material, not final rules.'],
  ['2024', '2024 rules', 'The revised fifth edition of 2024 and the books built on it.'],
  ['other', 'Screens & other', 'Screens, recipes and everything else that fits no other group.'],
  /* Die Kategorien der Content Blocklist in 5e.tools, die oben fehlen
     (T-094): ein Buch steht zusätzlich darin. „5e ('14)" braucht keine —
     2024-Bücher kommen nicht herein, also wäre es jedes Buch. */
  ['nonstandard', 'Non-standard', 'Free web supplements, charity adventures, Plane Shift and crossovers: official, but outside the standard books (5e.tools: UA/Etc.).'],
  ['comedy', 'Comedy', 'Books meant as a joke or a crossover for fun (5e.tools: Comedy Sources).'],
  ['non-fr', 'Outside the Forgotten Realms', 'Books set in another world than the Forgotten Realms (5e.tools: Non-Forgotten Realms).'],
];

/*
 * Die Listen aus `5etools-src/js/parser.js` (Stand 10/2026), wörtlich: die
 * Daten selbst sagen es nicht, die Seite führt sie im Code
 * (`SOURCES_NON_STANDARD_WOTC` mit den Präfixen `PS`/`MCV`, `SOURCES_COMEDY`,
 * `SOURCES_NON_FR`). Ein neues Buch fehlt hier, bis jemand nachzieht —
 * dann steht es nur in seiner Kategorie, und das ist kein Fehler.
 */
const NICHT_STANDARD = new Set(['OGA', 'LLK', 'AZfyT', 'LR', 'TLK', 'TTP', 'AWM', 'IMR', 'SADS', 'MFF', 'XMtS', 'RtG', 'AitFR', 'AitFR-ISF', 'AitFR-THP', 'AitFR-AVT', 'AitFR-DN', 'AitFR-FCD', 'DoD', 'MaBJoV', 'NRH', 'NRH-TCMC', 'NRH-AVitW', 'NRH-ASS', 'NRH-CoI', 'NRH-TLT', 'NRH-AWoL', 'NRH-AT', 'MGELFT', 'VD', 'SjA', 'HAT-TG', 'HAT-LMI', 'GotSF', 'MCV3MC', 'MCV4EC', 'MisMV1', 'LK', 'AATM', 'CoA', 'PiP', 'HFStCM', 'UtHftLH', 'ScoEE', 'HBTD', 'BQGT', 'RWG'].map((x) => x.toLowerCase()));
const KOMIK = new Set(['AI', 'OoW', 'RMR', 'RMBRE', 'HftT', 'AWM', 'MGELFT', 'HAT-TG', 'HAT-LMI', 'MCV3MC', 'MisMV1', 'LK', 'PiP', 'LRDT', 'UtHftLH', 'ScoEE', 'HBTD', 'BQGT', 'WttHC'].map((x) => x.toLowerCase()));
const NICHT_FR = new Set(['GGR', 'KKW', 'ERLW', 'EFR', 'EGW', 'ToR', 'DD', 'FS', 'US', 'MOT', 'XMtS', 'AZfyT', 'SCC', 'SCC-CK', 'SCC-HfMT', 'SCC-TMM', 'SCC-ARiR', 'CRCotN', 'SjA', 'SAiS', 'AAG', 'BAM', 'LoX', 'DSotDQ', 'PAitM', 'SatO', 'ToFW', 'MPP', 'MCV4EC', 'LK', 'LRDT', 'UtHftLH', 'ScoEE', 'HBTD', 'BQGT', 'WttHC', 'LFL', 'EFA', 'FFotR'].map((x) => x.toLowerCase()));

/** Die Blocklist-Kategorien, in denen ein Buch zusätzlich steht (T-094). */
export function blocklistGruppen(q: string): string[] {
  const k = q.toLowerCase();
  return [
    NICHT_STANDARD.has(k) || /^(ps|mcv)/.test(k) ? 'nonstandard' : '',
    KOMIK.has(k) ? 'comedy' : '',
    NICHT_FR.has(k) ? 'non-fr' : '',
  ].filter(Boolean);
}

/**
 * **Die Herausgeber** (T-094, REQ-249): je Herausgeber eine Gruppe mit
 * `groupBy: 'publisher'`. Third party und Homebrew legt der Importer nie
 * an: in `5etools-src` steht kein Buch eines fremden Verlags, und Homebrew
 * liegt dort gar nicht — was in keiner Herausgeber-Gruppe steht, ist
 * Homebrew (`publisherOf`).
 */
export const HERAUSGEBER: [string, string, string][] = [['official', 'Official', 'Published by Wizards of the Coast.']];

/**
 * **Partner-Bücher sind Official** (E-193, 28.10.2026): `SOURCES_PARTNERED_WOTC`
 * in `5etools-src/js/parser.js` ist seit Dez. 2025 leer — D&D Beyond führt
 * diese Bücher als „Official", und die Leitung will es ebenso. Erkennen will
 * sie Partner-Inhalte trotzdem: „Partnered" bleibt als **Kategorie** (ohne
 * `groupBy`, unter seiner alten Id `e5_publisher_partnered`), und die alte
 * Liste sagt, wer hineinkommt. Unklare Fälle zählt docs/5etools-Abgleich.md auf.
 */
const PARTNER = new Set(['RMBRE', 'RMR', 'EGW', 'ToR', 'DD', 'FS', 'US', 'CRCotN', 'HftT', 'LRDT', 'TD'].map((x) => x.toLowerCase()));
const PARTNER_TEXT = 'Made with a partner of Wizards of the Coast (Critical Role, Rick and Morty, LEGO …); published as official D&D.';

/** Ob ein Buch mit einem Partner entstand (E-193) — die Kategorie „Partnered". */
export function istPartner(q: string): boolean {
  return PARTNER.has(q.toLowerCase());
}

/** Wer ein Buch aus 5e.tools herausgibt (T-094): seit E-193 immer Wizards. */
export function herausgeberVon(_q: string): string {
  return 'official';
}

/** In welche Gruppe ein Buch gehört — aus der Gruppe in 5e.tools, dem Erscheinen und dem Kürzel. */
export function gruppeVon(q: string, meta: Quelle | undefined): string {
  const k = q.toLowerCase();
  if (meta?.art === 'adventure') return 'adventure';
  if (/^ua/.test(k) || meta?.group === 'prerelease') return 'ua';
  if (['xphb', 'xmm', 'xdmg'].includes(k) || (meta?.published ?? '') >= STICHTAG_2024) return '2024';
  if (KERN.includes(meta?.id ?? q) || meta?.group === 'core') return 'core';
  if (meta?.group === 'setting' || meta?.group === 'setting-alt') return 'setting';
  if (!meta?.group || meta.group === 'supplement' || meta.group === 'supplement-alt') return 'supplement';
  return 'other';
}

/** „1–5" aus den Stufen eines Abenteuers. */
const stufenText = (l: Quelle['level']): string =>
  l?.start ? (l.end && l.end !== l.start ? `${l.start}–${l.end}` : String(l.start)) : '';

/** Begleittexte, die an einen Artikel gehen (`Lore`). */
const FLUFF = ['monsterFluff', 'raceFluff', 'backgroundFluff', 'classFluff', 'subclassFluff', 'vehicleFluff', 'facilityFluff'];

const kl = (s: unknown) => String(s ?? '').trim().toLowerCase();

/** Woran `_copy` einen Eintrag erkennt — je Art etwas anders. */
function kopieSchluessel(art: string): (e: Knoten) => string {
  switch (art) {
    case 'subclass':
      return (e) => `${kl(e['name'] ?? e['shortName'])}|${kl(e['source'])}|${kl(e['className'])}|${kl(e['classSource'])}`;
    case 'classFeature':
      return (e) => `${kl(e['name'])}|${kl(e['source'])}|${kl(e['className'])}|${kl(e['classSource'])}|${kl(e['level'])}`;
    case 'subclassFeature':
      return (e) => `${kl(e['name'])}|${kl(e['source'])}|${kl(e['className'])}|${kl(e['classSource'])}|${kl(e['subclassShortName'])}|${kl(e['level'])}`;
    case 'subrace':
      return (e) => `${kl(e['name'])}|${kl(e['source'])}|${kl(e['raceName'])}`;
    case 'deity':
      return (e) => `${kl(e['name'])}|${kl(e['source'])}|${kl(e['pantheon'])}`;
    default:
      return (e) => `${kl(e['name'])}|${kl(quelleVon(e))}`;
  }
}

export interface Ergebnis {
  datei: {
    format: string;
    registry: Registry & { components?: unknown };
    entities: Entity[];
    /** Die Neuzugänge (T-087): was nicht zum Grundstand gehört, mit seinen Ebenen und deren Gruppen, dazu der Text der 2014-Regelbücher (T-145). `import --only-new --additions` legt nur sie an. */
    additions?: string[];
  };
  bericht: Bericht;
  /** Welches Bild aus 5e.tools an welchen Artikel gehört (T-144) — nicht in der Ausfuhrdatei, Bilder gehen über die API. */
  bilder?: Bildplan;
  /** Je Klasse ihre Zauberliste (T-212) — für den Ergänzungslauf auf einem Server, der die Klassen schon hat. */
  zauberlisten?: ZauberlistenPlan;
}

/** Der Text einer Buchebene: was sie ist, in einem Satz (T-088). */
function buchProsa(name: string, kuerzel: string, meta: Quelle | undefined, regeln: Regelstand): string {
  const art = meta?.art === 'adventure' ? 'an adventure' : 'a book';
  const teile = [
    meta?.published ? `published ${meta.published}` : '',
    meta?.author ? `by ${meta.author}` : '',
    regeln === 'UA' ? 'playtest material (Unearthed Arcana), not final rules' : `${regeln} rules`,
    meta?.level?.start ? `for levels ${stufenText(meta.level)}` : '',
    meta?.storyline ? `storyline ${meta.storyline}` : '',
  ].filter(Boolean);
  return `${name} (${kuerzel}) is ${art}, ${teile.join(', ')}. Taken over from 5e.tools; articles from it name ${kuerzel} as their source. Turn it on for a campaign to bring its articles into play.`;
}

export class Prueffehler extends Error {
  constructor(readonly fehler: string[]) {
    super(`${fehler.length} Artikel bestehen die Prüfung nicht:\n${fehler.slice(0, 40).join('\n')}`);
  }
}

/** Leere Karten und Listen weg — eine leere Karte trägt nichts (D27). */
function aufraeumen(e: Entity): void {
  for (const [k, v] of Object.entries(e.components)) {
    if (v && typeof v === 'object' && !Object.keys(v).length) delete e.components[k];
  }
  if (e.relations && !e.relations.length) delete e.relations;
}

/**
 * **Ein Lauf in drei Gängen** (T-087, T-084): erst der Grundstand allein,
 * dann was T-087 brachte, dann alles — jeder Gang mit den Nummern des
 * vorigen, damit die Nachträge (`NACHTRAG_ARTEN`) hinten zählen. Nur so schreibt ein Lauf mit 2024, UA und den
 * neuen Arten den Grundstand mit denselben Ids, Nummern und Namen, wie ihn
 * einer ohne geschrieben hätte — die Peg-Id eines geteilten Merkmals hängt
 * an seinem Text, und der nennt Nummern. Anders steht danach nur Buch- und
 * Abenteuertext, der jetzt auch Fahrzeuge und Decks findet.
 */
export function lauf(stand: Datenstand, auswahl: Auswahl = {}, registry: Registry = seedRegistry): Ergebnis {
  if (auswahl.nurGrundstand) return bauen(stand, auswahl, registry).ergebnis;
  const grund = bauen(stand, { ...auswahl, nurGrundstand: true }, registry, undefined, false);
  /* Dritter Gang (T-084): erst der Stand von T-087 mit dessen Nummern,
     dann die Nachträge dahinter. */
  const vorher = bauen(stand, { ...auswahl, ohneNachtrag: true }, registry, grund.vergeben, false);
  return bauen(stand, auswahl, registry, vorher.vergeben).ergebnis;
}

function bauen(
  stand: Datenstand,
  auswahl: Auswahl,
  registry: Registry,
  vorgabe?: Map<string, string>,
  pruefen = true,
): { ergebnis: Ergebnis; vergeben: Map<string, string> } {
  const wb = new Werkbank(registry, vorgabe);

  /* 1. Die Ebenen. Kein `inLayer` an ihnen selbst. Die alte Systemebene
     ist eine Gruppe (T-109); was kein Buch nennt, liegt in einer eigenen
     Ebene darin. */
  const ebene = wb.anlegen('Layer', EBENE, 'layer|5e-2014');
  delete ebene.components['Source'];
  wb.feld(ebene, 'Layer', 'kind', 'group');
  wb.feld(ebene, 'Layer', 'order', 0);
  wb.feld(ebene, 'Layer', 'version', '2014');
  wb.feld(ebene, 'Description', 'description', 'Every official book of the 2014 rules.');
  wb.prosa(ebene, 'The 2014 rules of the fifth edition, taken over from 5e.tools: a group of every official book built on them. Turning it on for a campaign puts every book in it into play; a single book inside can still be turned off.');
  const ohneBuch = wb.anlegen('Layer', OHNE_BUCH, 'layer|5e-2014-none');
  ohneBuch.id = ohneBuchEbeneId();
  delete ohneBuch.components['Source'];
  wb.feld(ohneBuch, 'Layer', 'kind', 'system');
  wb.feld(ohneBuch, 'Layer', 'order', 0);
  wb.feld(ohneBuch, 'Layer', 'version', '2014');
  wb.prosa(ohneBuch, 'What the 2014 rules of 5e.tools bring without naming a book (the action types). Every book has its own layer; which page an article comes from is in its source.');
  wb.ebene = ohneBuch;
  /* Jede Quelle ihre Ebene; was an einer Klasse eines anderen
     Regelstands hängt, liegt bei ihr (T-087, `ebeneQuelle`). */
  wb.ebeneFuer = (e) => ebeneQuelle(e, stand);

  /* Je Buch eine Ebene (T-081, E-017), angelegt beim ersten Eintrag
     daraus. Der Name kommt aus `books.json`/`adventures.json`; die Marke
     sagt der Kampagnenseite, unter welcher Gruppe das Buch steht. */
  const buecher = new Map<string, Entity>();
  wb.buchEbene = (q) => {
    if (!q) return undefined;
    const k = q.toLowerCase();
    let l = buecher.get(k);
    if (l) return l;
    const meta = stand.quellen.get(k);
    /* Ohne Kopf in books/adventures der Titel aus `js/parser.js` (T-420), erst dann das Kürzel. */
    const name = meta?.name ?? stand.quellenNamen?.get(k) ?? q;
    l = wb.anlegen('Layer', name, `book|${k}`);
    l.id = buchEbeneId(q);
    /* Ein Abenteuer ist eine eigene Art Ebene (T-082): es bringt seine
       Kapitel und Abschnitte, nicht nur Regeln. */
    wb.feld(l, 'Layer', 'kind', meta?.art === 'adventure' ? 'adventure' : 'book');
    wb.feld(l, 'Layer', 'order', 0);
    /* Die Ebene beschreibt sich selbst (T-088, REQ-245): das Kürzel, unter
       dem ihre Artikel die Quelle nennen, und was 5e.tools über das Buch weiss. */
    const kuerzel = meta?.id ?? q;
    /* Der Regelstand an der Ebene (T-087): 2014, 2024 oder UA. */
    const regeln = regelstandDerQuelle(q, stand);
    wb.feld(l, 'Layer', 'abbreviation', kuerzel);
    wb.feld(l, 'Layer', 'published', meta?.published);
    wb.feld(l, 'Layer', 'author', meta?.author);
    wb.feld(l, 'Layer', 'version', regeln);
    wb.feld(l, 'Layer', 'levels', stufenText(meta?.level));
    wb.feld(l, 'Layer', 'storyline', meta?.storyline);
    wb.feld(l, 'Description', 'description', `${kuerzel} — ${name}`);
    wb.feld(l, 'Tags', 'tags', [KERN.includes(kuerzel) ? 'core' : meta?.art === 'adventure' ? 'adventure' : 'sourcebook']);
    wb.prosa(l, buchProsa(name, kuerzel, meta, regeln));
    buecher.set(k, l);
    return l;
  };
  legeAktionsartenAn(wb);

  /* Begleittexte, nach Name und Quelle. Sie stehen selbst manchmal als
     Kopie da. */
  for (const art of FLUFF) {
    const roh = stand.arten.get(art) ?? [];
    wb.artBericht(art).gelesen += roh.length;
    const gelöst = loeseKopien(roh, kopieSchluessel(art), (was) => wb.notiz(was, art));
    wb.fluffe.set(art, new Map(gelöst.map((f) => [`${kl(f['name'])}|${kl(f['source'])}`, f])));
  }
  for (const t of stand.arten.get('itemEntry') ?? []) wb.schablonen.set(`${kl(t['name'])}|${kl(t['source'])}`, t);
  const vorlagen = new Map((stand.arten.get('monsterTemplate') ?? []).map((t) => [`${kl(t['name'])}|${kl(t['source'])}`, t]));

  /* Was keine Zuordnung hat und nicht bewusst wegbleibt, steht im Bericht. */
  const bekannt = new Set([...ZUORDNUNGEN.map((z) => z.art), ...FLUFF, ...Object.keys(ARTEN_WEG)]);
  for (const [art, liste] of stand.arten) {
    if (bekannt.has(art)) continue;
    const b = wb.artBericht(art);
    b.gelesen += liste.length;
    zaehle(b.notizen, 'keine Zuordnung', liste.length);
  }
  for (const [art, grund] of Object.entries(ARTEN_WEG)) {
    const n = stand.arten.get(art)?.length ?? 0;
    if (!n || art === '_meta') continue;
    const b = wb.artBericht(art);
    b.gelesen += n;
    zaehle(b.notizen, `weggelassen: ${grund}`, n);
  }

  /* 2. Erster Gang: jeder Eintrag bekommt seinen Artikel und seine Nummer. */
  const zuFuellen: [Zuordnung, Entity, Knoten][] = [];
  /* Was einen Artikel bekam, mit seinem 5e.tools-Eintrag — für den Bildplan (T-144). */
  const angelegt: [string, Knoten, Entity][] = [];
  /* Je Art: Kopierschlüssel → Artikel, damit eine aufgelöste Kopie ihr
     Original findet (`variantOf`, Abgleich §4.2 Schritt 3). */
  const nachKopie = new Map<string, Entity>();
  const pegs = new Set<string>(wb.entities.map((e) => e.id));
  for (const z of ZUORDNUNGEN) {
    const roh0 = stand.arten.get(z.art) ?? [];
    const b = wb.artBericht(z.art);
    b.gelesen += roh0.length;
    /* Die Spielarten (`_versions`) werden Kopien ihres Eintrags (T-084). */
    const roh = spielarten(z.vorbereiten ? z.vorbereiten(roh0, stand) : roh0, SPIELART, (was) => wb.notiz(was, z.art));
    const gelöst = loeseKopien(roh, kopieSchluessel(z.art), (was) => wb.notiz(was, z.art), vorlagen);
    const vereint = new Map<string, Entity>();
    /* Die Kernbücher zuerst, dann nach Erscheinen: so trägt der Goblin aus
       dem Monster Manual die kleinere Nummer, und ein Merkmal, das viele
       teilen, nennt als Fundstelle das Buch, in dem es zuerst stand. */
    const rang = (e: Knoten): string => {
      const q = quelleVon(e);
      const kern = ['PHB', 'MM', 'DMG'].indexOf(q);
      if (kern >= 0) return `0${kern}`;
      return `1${stand.quellen.get(q.toLowerCase())?.published ?? '9999'}`;
    };
    const geordnet = gelöst.map((e, i) => [rang(e), i, e] as const).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]));
    for (const [, , e] of geordnet) {
      const grund = ausschluss(e, stand, auswahl, z.art);
      if (grund) {
        const m = b.ausgeschlossen.get(grund) ?? new Map<string, number>();
        zaehle(m, quelleVon(e) || '(ohne)');
        b.ausgeschlossen.set(grund, m);
        continue;
      }
      const q = quelleVon(e);
      if (q && !stand.quellen.has(q.toLowerCase())) zaehle(wb.bericht.fremdeQuellen, q);
      wb.stand = regelstandVon(e, stand);
      wb.grund = imGrundstand(e, z.art, stand);
      wb.nachtrag = istNachtrag(e, z.art);
      if (e[SPIELART]) wb.notiz('Spielart (_versions) ausgeschrieben', z.art);
      const typ = z.typ(e, wb);
      if (!typ) continue;
      /* Vereint wird nur innerhalb einer Teilung (T-087): ein 2024-Merkmal
         mit dem Text des 2014-Merkmals ist trotzdem ein 2024-Merkmal. */
      const v0 = z.vereinen?.(e);
      const v = v0 && wb.teilung ? `${wb.teilung}|${v0}` : v0;
      let ent = v ? vereint.get(v) : undefined;
      if (!ent) {
        /* Mit der Teilung (T-087): der 2014-Champion, den 5e.tools dem
           2024-Kämpfer gibt, hat dieselbe Quelle und Klasse wie der im
           Grundstand. Der Grundstand selbst behält seine Peg-Ids. */
        const herkunft = `${z.art}|${kl(z.name(e))}|${kl(q)}|${z.herkunft?.(e) ?? ''}${wb.teilung ? `|${wb.teilung}` : ''}`;
        const neu = wb.anlegen(typ, z.name(e), herkunft, e);
        if (pegs.has(neu.id)) {
          /* Derselbe Eintrag zweimal (dieselbe Art, derselbe Name, dieselbe
             Quelle): der zweite fällt weg und wird gezählt. Nach Id, nicht
             nach Stelle — davor kann eben eine Buchebene dazugekommen sein. */
          wb.entities.splice(wb.entities.lastIndexOf(neu), 1);
          zaehle(wb.bericht.typen, typ, -1);
          wb.notiz('doppelter Eintrag', z.art);
          continue;
        }
        pegs.add(neu.id);
        nachKopie.set(`${z.art}|${kopieSchluessel(z.art)(e)}`, neu);
        ent = neu;
        if (v) vereint.set(v, ent);
        /* Wohin 5e.tools den Eintrag neu gedruckt hat — das Buch zählt
           (`doppel.ts`, welche Fassung gilt). */
        const nachdruck = (Array.isArray(e['reprintedAs']) ? e['reprintedAs'] : [])
          .map((r) => String(typeof r === 'string' ? r : ((r as Knoten)['uid'] ?? '')).split('|')[1] ?? '')
          .filter(Boolean);
        if (nachdruck.length) wb.nachdrucke.set(neu.id, nachdruck);
        zuFuellen.push([z, ent, e]);
        angelegt.push([z.art, e, ent]);
        zaehle(b.artikel, typ);
      } else {
        wb.notiz('mit gleichlautendem Eintrag vereint', z.art);
        wb.vereint.set(ent.id, (wb.vereint.get(ent.id) ?? 1) + 1);
      }
      for (const s of z.schluessel?.(e) ?? [[z.name(e), q]]) wb.merke(ent, z.tag, ...s);
      /* Unter dem Namen, den 5e.tools selbst trägt, auch — für Unterarten. */
      if (z.art === 'subrace') wb.merke(ent, 'race', e['name'], q);
    }
  }

  /* 3. Zweiter Gang: füllen. Jetzt findet jeder Verweis sein Ziel. */
  for (const [z, ent, e] of zuFuellen) {
    wb.aktuelleArt = z.art;
    const st = wb.standJe.get(ent.id);
    wb.stand = st?.stand ?? '2014';
    wb.grund = st?.grund ?? true;
    wb.nachtrag = st?.nachtrag ?? false;
    z.fuellen(wb, ent, e);
    /* Andere Namen, unter denen 5e.tools den Eintrag auch führt. */
    if (Array.isArray(e['alias']) && e['alias'].length) {
      const alt = (wb.karte(ent, 'Identity')['aliases'] as string[] | undefined) ?? [];
      wb.feld(ent, 'Identity', 'aliases', [...new Set([...alt, ...e['alias'].map(String)])]);
    }
    wb.liegen(z.art, e, [...z.genutzt, 'name', 'alias']);
  }

  wb.grundSiehtAlles = true;
  wb.nachtrag = false;
  /* Die Abenteuer (T-082, REQ-240): nach den Buchartikeln, damit jeder
     Verweis im Abenteuertext sein Ziel findet. Gesiebt wird wie jeder
     Eintrag — nach Quelle, 2024 bleibt draussen. */
  for (const a of stand.abenteuer?.values() ?? []) {
    const quelleA = String(a.kopf['source'] ?? a.id);
    const grund = ausschluss({ source: quelleA }, stand, auswahl, 'adventure');
    if (grund) {
      const b = wb.artBericht('adventureData');
      b.gelesen += 1;
      const m = b.ausgeschlossen.get(grund) ?? new Map<string, number>();
      zaehle(m, a.id);
      b.ausgeschlossen.set(grund, m);
      continue;
    }
    wb.stand = regelstandDerQuelle(quelleA, stand);
    wb.grund = wb.stand === '2014';
    abenteuer(wb, a);
  }

  /* Die Bücher als Kapitel aus Teilen (T-108, E-028): nach allen Artikeln,
     damit jeder Verweis und jedes `Embed` sein Ziel findet. Gesiebt wie
     jeder Eintrag. */
  for (const b of stand.buecher?.values() ?? []) {
    const quelleB = String(b.kopf['source'] ?? b.id);
    const grund = ausschluss({ source: quelleB }, stand, auswahl, 'book');
    if (grund) {
      const ber = wb.artBericht('bookData');
      ber.gelesen += 1;
      const m = ber.ausgeschlossen.get(grund) ?? new Map<string, number>();
      zaehle(m, b.id);
      ber.ausgeschlossen.set(grund, m);
      continue;
    }
    wb.stand = regelstandDerQuelle(quelleB, stand);
    wb.grund = wb.stand === '2014';
    const vorher = wb.entities.length;
    buch(wb, b);
    /* Kapitel und Teile eines 2014-Buchs sind Neuzugänge (T-145); die
       Orte aus seinem Text nicht — sie stünden sofort in den Listen jeder
       Kampagne, die „D&D 5e (2014)" aufschaltet (E-062). */
    if (wb.grund) for (const e of wb.entities.slice(vorher)) if (BUCHTEXT.has(e.interfaces[0] ?? '')) wb.buchtext.add(e.id);
  }
  /* Die Zauberlisten (T-212): nach allen Artikeln, über alle Regelstände —
     der 2024-Zauber steht auf der Liste der 2024-Klasse. */
  wb.stand = '2014';
  wb.grund = true;
  zauberlisten(wb, stand.zauberlisten);
  wb.grundSiehtAlles = false;
  /* Die Wohnorte benannter Kreaturen (T-182): nach allen Büchern und
     Abenteuern, denn genannt wird eine Kreatur auch ausserhalb ihres. */
  wohnorte(wb);
  /* Ebenso ihre Fraktionen (T-183): Mitglied nur, wo genau eine genannt ist. */
  fraktionen(wb);

  /* Eine aufgelöste Kopie zeigt auf ihr Original, wenn es hereinkam und
     sie nicht schon auf einen Grundgegenstand zeigt (`variantOf` ist eine
     Kante). */
  for (const [z, ent, e] of zuFuellen) {
    const von = e[KOPIE_VON];
    if (typeof von !== 'string') continue;
    const original = nachKopie.get(`${z.art}|${von}`);
    if (!original || original.id === ent.id) {
      if (!original) wb.notiz('Kopie eines Eintrags, der nicht hereinkam', z.art);
      continue;
    }
    if ((ent.relations ?? []).some((r) => r.type === 'variantOf')) continue;
    wb.kante(ent, 'variantOf', original.id);
  }

  /* Die Angriffe der Statblöcke: je Angriff die Vorgaben, an jeder Kante
     die Abweichung (D51). Vor dem Aufräumen — eine Kante ohne Abweichung
     verliert dabei ihre leere Karte. */
  angriffeVereinen(wb, wb.angriffe);

  for (const e of wb.entities) aufraeumen(e);

  /* Doppel, die erst gefüllt zu erkennen sind: gleiche Merkmale an
     verschiedenen Trägern werden einer, Fassungen aus mehreren Büchern
     Varianten der geltenden (Entscheidung 12.10.2026). */
  const entities = vereineGleiche(wb.entities, wb.bericht, (e) => wb.teilungVon(e.id));
  /* Ohne Spread: über hunderttausend Argumente sprengen den Stapel (T-108). */
  wb.entities.length = 0;
  for (const e of entities) wb.entities.push(e);
  for (const [t, n] of wb.bericht.vereint) zaehle(wb.bericht.typen, t, -n);
  /* Eine Buchebene, deren Einträge alle in andere aufgingen, bringt nichts. */
  const belegt = new Set(wb.entities.flatMap((e) => (e.relations ?? []).filter((r) => r.type === 'inLayer').map((r) => r.to)));
  for (const l of buecher.values()) {
    if (belegt.has(l.id)) continue;
    wb.entities.splice(wb.entities.indexOf(l), 1);
    zaehle(wb.bericht.typen, 'Layer', -1);
  }
  /* Die Gruppen (T-088, E-022 b): je Gruppe, in der ein Buch steht, eine
     Ebene; das Buch hängt mit `partOf` daran. Eine leere Gruppe bringt
     nichts und wird nicht angelegt. */
  const gruppen = new Map<string, Entity>();
  /* Je Buch seine Kategorie, die Blocklist-Kategorien (T-094) und sein
     Herausgeber — alles Gruppen nach E-022 b. Angelegt wird in der
     Reihenfolge der Listen, damit die Nummern stabil bleiben. */
  const gruppeAn = (l: Entity, id: string, anlegen: () => Entity) => {
    let gruppe = gruppen.get(id);
    if (!gruppe) {
      gruppe = anlegen();
      gruppen.set(id, gruppe);
    }
    wb.kante(l, 'partOf', gruppe.id);
  };
  const neueGruppe = (schluessel: string, id: string, name: string, text: string, herausgeber: boolean) => {
    const gruppe = wb.anlegen('Layer', name, schluessel);
    gruppe.id = id;
    wb.feld(gruppe, 'Layer', 'kind', 'group');
    wb.feld(gruppe, 'Layer', 'order', 0);
    if (herausgeber) wb.feld(gruppe, 'Layer', 'groupBy', 'publisher');
    wb.feld(gruppe, 'Description', 'description', text);
    wb.prosa(gruppe, `${text} A group of layers from 5e.tools: turning it on for a campaign puts every book in it into play; a single book inside can still be turned off.`);
    return gruppe;
  };
  const kategorie = (g: string) => () => {
    const [, name, text] = GRUPPEN.find(([x]) => x === g)!;
    return neueGruppe(`group|${g}`, gruppeEbeneId(g), name, text, false);
  };
  const verlag = (h: string) => () => {
    const [, name, text] = HERAUSGEBER.find(([x]) => x === h)!;
    return neueGruppe(`publisher|${h}`, herausgeberEbeneId(h), name, text, true);
  };
  /* Die Ebenen, in denen der Grundstand liegt. */
  const grundEbenen = new Set(
    wb.entities.filter((e) => !wb.teilungVon(e.id)).flatMap((e) => (e.relations ?? []).filter((r) => r.type === 'inLayer').map((r) => r.to)),
  );
  for (const [k, l] of buecher) {
    if (!belegt.has(l.id)) continue;
    const meta = stand.quellen.get(k);
    const q = meta?.id ?? k;
    const g = gruppeVon(q, meta);
    gruppeAn(l, gruppeEbeneId(g), kategorie(g));
    for (const b of blocklistGruppen(q)) gruppeAn(l, gruppeEbeneId(b), kategorie(b));
    const h = herausgeberVon(q);
    gruppeAn(l, herausgeberEbeneId(h), verlag(h));
    /* Partner-Bücher: zusätzlich die Kategorie, unter der alten Id (E-193). */
    if (istPartner(q)) gruppeAn(l, herausgeberEbeneId('partnered'), () => neueGruppe('publisher|partnered', herausgeberEbeneId('partnered'), 'Partnered', PARTNER_TEXT, false));
    /* Die Gruppe der 2014-Regeln (T-109): jedes offizielle Buch darauf —
       das schon vor T-087 hereinkam. Eine Ebene, die erst jetzt dazukommt
       (nur Fahrzeuge oder Kartendecks), ist nicht aufgeschaltet: über die
       Gruppe käme sie in jede Kampagne, die sie aufschaltet. Die Leitung
       hängt sie auf der Ebenenseite dazu, wenn sie will. */
    if (h === 'official' && !istPartner(q) && (l.components['Layer'] as { version?: string } | undefined)?.version === '2014' && grundEbenen.has(l.id)) {
      wb.kante(l, 'partOf', ebene.id);
    }
  }
  /* Was kein Buch nennt: Official und in der Gruppe — oder gar nicht, wenn
     es nichts davon gibt. Eine Gruppe ohne Mitglied bringt nichts. */
  if (belegt.has(ohneBuch.id)) {
    gruppeAn(ohneBuch, herausgeberEbeneId('official'), verlag('official'));
    wb.kante(ohneBuch, 'partOf', ebene.id);
  } else {
    wb.entities.splice(wb.entities.indexOf(ohneBuch), 1);
    zaehle(wb.bericht.typen, 'Layer', -1);
  }
  if (!wb.entities.some((e) => e.relations?.some((r) => r.type === 'partOf' && r.to === ebene.id))) {
    wb.entities.splice(wb.entities.indexOf(ebene), 1);
    zaehle(wb.bericht.typen, 'Layer', -1);
  }

  /* Fassungen über die Regelstände (T-087, E-021 d): die Grundfassung
     ist die des Grundstands; eine aus einer anderen Ebene als ihrer
     Quelle (der 2014-Champion des 2024-Kämpfers) heisst nach beiden. */
  const kuerzel = new Map(wb.entities.filter((e) => e.interfaces[0] === 'Layer').map((l) => [l.id, String((l.components['Layer'] as { abbreviation?: string } | undefined)?.abbreviation ?? '')] as const));
  const kennung = (e: Entity): string => {
    const q = String((e.components['Source'] as { publication?: string } | undefined)?.publication ?? '');
    const l = kuerzel.get((e.relations ?? []).find((r) => r.type === 'inLayer')?.to ?? '') ?? '';
    return l && q && l.toLowerCase() !== q.toLowerCase() ? `${q}, ${l}` : q;
  };
  const doppel = {
    nachdruck: (e: Entity) => wb.nachdrucke.get(e.id) ?? [],
    teilung: (e: Entity) => wb.teilungVon(e.id),
    kennung,
  };
  fassungen(wb.entities, stand, wb.bericht, doppel);
  herkunft(wb.entities, stand, wb.bericht, doppel);

  /* Kanten-Ids über den ganzen Bestand eindeutig: die Werkbank zählt je
     Artikel (`inLayer-1`), der Server hält die Id einer Kante aber als
     Schlüssel der ganzen Tabelle — dreissigtausend Artikel in derselben
     Ebene hiessen alle `inLayer-1`. Vorangestellt wird die Peg-Id; erst
     hier, weil Doppel und Fassungen oben noch Kanten dazulegen. */
  kantenEindeutig(wb.entities);

  /* Die Zählung je Ebene für den Bericht (T-087). */
  const jeEbene = new Map<string, { artikel: number; neu: number }>();
  for (const e of wb.entities) {
    const l = (e.relations ?? []).find((r) => r.type === 'inLayer')?.to;
    if (!l) continue;
    const z = jeEbene.get(l) ?? { artikel: 0, neu: 0 };
    z.artikel += 1;
    if (wb.teilungVon(e.id)) z.neu += 1;
    jeEbene.set(l, z);
  }
  wb.bericht.ebenen = wb.entities
    .filter((e) => e.interfaces[0] === 'Layer' && jeEbene.has(e.id))
    .map((l) => {
      const k = (l.components['Layer'] ?? {}) as { abbreviation?: string; version?: string; kind?: string };
      return { name: l.name, kuerzel: k.abbreviation ?? '', stand: k.version ?? '', art: k.kind ?? '', ...jeEbene.get(l.id)! };
    })
    .sort((a, b) => a.stand.localeCompare(b.stand) || b.artikel - a.artikel || a.name.localeCompare(b.name));

  /* 4. Prüfen, mit Art und Stufen — wie der Server beim Schreiben. Der
     erste Gang für die Nummern prüft nicht: der zweite prüft alles. */
  if (!pruefen) return { ergebnis: { datei: { format: 'nebelwacht/1', registry, entities: wb.entities }, bericht: wb.bericht }, vergeben: wb.vergeben };
  const bekannteArten = new Map(wb.entities.map((e) => [e.id, e.interfaces[0] ?? ''] as const));
  /* Die Ids einmal: ohne sie baut die Prüfung je Artikel ein neues Set
     aus allen Schlüsseln, und das sind bei 28 000 Artikeln Minuten. */
  const bekannteIds = new Set(bekannteArten.keys());
  const stufen = stageBases(wb.entities);
  const fehler: string[] = [];
  if (bekannteArten.size !== wb.entities.length) fehler.push('Zwei Artikel tragen dieselbe Peg-Id.');
  const kanten = wb.entities.flatMap((e) => (e.relations ?? []).map((r) => r.id));
  if (new Set(kanten).size !== kanten.length) fehler.push('Zwei Kanten tragen dieselbe Id.');
  for (const e of wb.entities) {
    const issues = validateEntity(registry, e, { knownTypes: bekannteArten, knownIds: bekannteIds, stageOf: stufen });
    for (const i of issues) fehler.push(`${e.interfaces[0]} „${e.name}" (${(e.components['Identity'] as { id: string }).id}): ${i.message}`);
  }
  if (fehler.length) throw new Prueffehler(fehler);

  return {
    ergebnis: {
      datei: {
        format: 'nebelwacht/1',
        /* `components` ist der zweite Name für `interfaces`, den die Einfuhr
           des Prototyps noch liest (`register-datei.mjs`). */
        registry: { ...registry, components: registry.interfaces },
        entities: wb.entities,
        ...(auswahl.nurGrundstand ? {} : { additions: neuzugaenge(wb) }),
      },
      bericht: wb.bericht,
      bilder: bildplan(registry, stand, angelegt, wb.entities, wb.textbilder),
      zauberlisten: zauberlistenPlan(wb.entities),
    },
    vergeben: wb.vergeben,
  };
}

/**
 * Ein Ausschnitt für den Prüfbestand und das Artefakt (M14): jede Art,
 * die Grenzfälle und ein paar Beispiele, die man von Artikel zu Artikel
 * durchgehen kann — und alles, worauf deren Kanten zeigen, damit jeder
 * Artikel für sich die Prüfung besteht. Ein Name, der nichts trifft, steht
 * in `fehlt`: ein stiller Tippfehler sähe aus wie ein Ausschnitt, der
 * etwas zeigt, was er nicht zeigt.
 */
export function ausschnitt(entities: Entity[], wunsch: Wunsch[]): Entity[] & { fehlt: string[] } {
  const nachId = new Map(entities.map((e) => [e.id, e]));
  const drin = new Map<string, Entity>();
  const nimm = (e: Entity) => {
    if (drin.has(e.id)) return;
    drin.set(e.id, e);
    for (const r of e.relations ?? []) {
      const z = nachId.get(r.to);
      if (z) nimm(z);
    }
    for (const karte of Object.values(e.components)) {
      for (const v of Object.values(karte ?? {})) {
        if (typeof v === 'string' && nachId.has(v)) nimm(nachId.get(v)!);
      }
    }
  };
  const fehlt: string[] = [];
  for (const w of wunsch) {
    const passend = entities.filter((e) => e.interfaces[0] === w.typ);
    if (w.namen) {
      for (const n of w.namen) {
        const treffer = passend.filter((e) => e.name === n);
        if (!treffer.length) fehlt.push(`${w.typ} „${n}"`);
        treffer.forEach(nimm);
      }
    } else passend.slice(0, w.anzahl ?? passend.length).forEach(nimm);
  }
  /* Was eine Stufe ist, braucht ihren Grundzustand — und umgekehrt sollen
     die Stufen da sein, wenn der Grundzustand da ist. */
  for (const e of entities) {
    if ((e.relations ?? []).some((r) => r.type === 'stageOf' && drin.has(r.to))) nimm(e);
  }
  return Object.assign([...drin.values()], { fehlt });
}

export interface Wunsch {
  typ: string;
  namen?: string[];
  anzahl?: number;
}

/**
 * Was der Prüfbestand aus einem Lauf bekommt (Abgleich §4.3, M14;
 * Auswahl 12.10.2026). Drei Sorten, und jede Art kommt vor:
 *
 *  - **Grundbestand:** was am Tisch ständig gebraucht wird — die
 *    Zustände, Fertigkeiten, Aktionsarten, Waffeneigenschaften ganz, dazu
 *    die bekannten Monster, Zauber, Waffen, Abstammungen.
 *  - **Grenzfälle:** Legendär mit Hort (Adult Red Dragon, Beholder),
 *    Schwarm, benannte Figur (Bosco Daggerhand), Zustand mit Stufen
 *    (Exhaustion), Nachdruck und Variante (Duergar Soulblade aus MPMM und
 *    MTF, Aasimar dreimal, Common im Setting), Buchtext ausserhalb des SRD.
 *  - **Durchgängig:** der Zauberer von der Klasse über die Schule bis zu
 *    Fireball, den der Mage und der Zauberstab wirken; der Goblin vom
 *    Statblock über seine Waffen bis zur Sprache und Abstammung; Pack
 *    Tactics an Kobold, Wolf und Riesenratte als ein Artikel; Ability Score
 *    Improvement an drei Klassen als ein Artikel.
 */
export const PROBE: Wunsch[] = [
  /* Grundbestand */
  { typ: 'Condition' },
  { typ: 'Skill' },
  { typ: 'ActionType' },
  { typ: 'ItemProperty' },
  { typ: 'Statblock', namen: ['Goblin', 'Goblin Boss', 'Orc', 'Wolf', 'Bandit', 'Guard', 'Veteran', 'Zombie', 'Skeleton', 'Ogre', 'Owlbear', 'Priest', 'Kobold', 'Giant Rat', 'Bugbear', 'Hobgoblin', 'Ghoul', 'Mage'] },
  { typ: 'Spell', namen: ['Fireball', 'Magic Missile', 'Cure Wounds', 'Shield', 'Mage Armor', 'Fire Bolt', 'Light', 'Detect Magic', 'Misty Step', 'Counterspell', 'Bless', 'Healing Word', 'Sleep', 'Thunderwave', 'Hold Person', 'Invisibility', 'Fly', 'Haste', 'Lightning Bolt', 'Spirit Guardians', 'Guidance', 'Sacred Flame', 'Eldritch Blast', 'Hex', "Hunter's Mark", 'Toll the Dead', 'Booming Blade'] },
  { typ: 'Class', namen: ['Fighter', 'Wizard', 'Rogue'] },
  { typ: 'Subclass', namen: ['Champion', 'Battle Master', 'School of Evocation', 'Arcane Trickster'] },
  { typ: 'Language', namen: ['Common', 'Elvish', 'Dwarvish', 'Goblin', 'Draconic', 'Orc', 'Giant', 'Deep Speech', 'Thieves\' Cant'] },
  { typ: 'Weapon', namen: ['Longsword', 'Shortsword', 'Scimitar', 'Shortbow', 'Dagger', 'Hand Crossbow', 'Staff of Power'] },
  { typ: 'Armor', namen: ['Leather Armor', 'Chain Mail', 'Shield'] },
  { typ: 'Item', namen: ['+1 Weapon', 'Bag of Holding', 'Potion of Healing', 'Hempen Rope (50 feet)', 'Wand of Magic Missiles', "Thieves' Tools"] },
  { typ: 'Ancestry', namen: ['Elf', 'Elf (High)', 'Dwarf', 'Human', 'Tiefling'] },
  { typ: 'Background', namen: ['Acolyte', 'Criminal', 'Haunted One'] },
  { typ: 'Feat', namen: ['Alert', 'Lucky', 'Grappler', 'War Caster'] },
  { typ: 'Rule', namen: ['Darkvision', 'Flanking'] },
  { typ: 'Disease', namen: ['Sewer Plague', 'Sight Rot', 'Cackle Fever'] },
  { typ: 'Hazard', namen: ['Brown Mold', 'Green Slime'] },
  { typ: 'Faction', namen: ['Cult of the Black Earth', 'Cult of Asmodeus'] },
  { typ: 'Table', namen: ['Wild Magic Surge', 'Standard Languages'] },
  { typ: 'Deity', namen: ['Tiamat'] },
  /* Grenzfälle */
  { typ: 'Statblock', namen: ['Adult Red Dragon', 'Beholder', 'Swarm of Rats', 'Gelatinous Cube', 'Mind Flayer', 'Yuan-ti Abomination', 'Drow Mage', 'Bosco Daggerhand', 'Booyahg Booyahg Booyahg'] },
  /* Fassungen: die geltende und ihre Varianten */
  { typ: 'Statblock', namen: ['Duergar Soulblade', 'Duergar Soulblade (MTF)', 'Kobold Inventor', 'Kobold Inventor (VGM)', 'Harpy', 'Harpy (PSX)'] },
  { typ: 'Ancestry', namen: ['Aasimar', 'Aasimar (VGM)', 'Aasimar (DMG)', 'Goblin', 'Goblin (VGM)', 'Goblin (ERLW)'] },
  { typ: 'Language', namen: ['Common (ERLW)', 'Common (GGR)'] },
  { typ: 'Deity', namen: ['Auril', 'Auril (SCAG)', 'Bahamut', 'Bahamut (DMG)'] },
  { typ: 'Rule', namen: ['Inspiration', 'Inspiration (DMG)'] },
  { typ: 'Hazard', namen: ['Avalanche', 'Avalanche (IDRotF)'] },
  { typ: 'Item', namen: ['Trinket', 'Trinket (CoS)'] },
  { typ: 'Table', namen: ['Random Height and Weight', 'Random Height and Weight (GGR)'] },
];

/**
 * **Die Neuzugänge** (T-087): jeder Artikel ausserhalb des Grundstands,
 * dazu die Ebenen, in denen sie liegen, und deren Gruppen. Ein Server, der
 * mit einem älteren Importer geladen wurde, kennt manches aus dem
 * Grundstand unter einer anderen Peg-Id — `--only-new` allein legte es ein
 * zweites Mal an; mit `--additions` kommt nur, was hier steht.
 */
function neuzugaenge(wb: Werkbank): string[] {
  const nachId = new Map(wb.entities.map((e) => [e.id, e] as const));
  const raus = new Set<string>();
  const ebene = (id: string) => {
    if (raus.has(id)) return;
    raus.add(id);
    for (const r of nachId.get(id)?.relations ?? []) if (r.type === 'partOf') ebene(r.to);
  };
  for (const e of wb.entities) {
    if (e.interfaces[0] === 'Layer' || !wb.teilungVon(e.id)) continue;
    raus.add(e.id);
    for (const r of e.relations ?? []) if (r.type === 'inLayer') ebene(r.to);
  }
  /* Die Kreaturen benannter Statblöcke kamen erst mit T-169: auch die zu
     einem Statblock des Grundstands sind neu, und `--additions` legt sie
     an (die Kante am bestehenden Statblock zieht die Einfuhr nach). */
  for (const id of wb.benannt) raus.add(id);
  /* Der Buchtext des Grundstands kam erst mit T-108 (T-145). */
  for (const id of wb.buchtext) {
    raus.add(id);
    for (const r of nachId.get(id)?.relations ?? []) if (r.type === 'inLayer') ebene(r.to);
  }
  return [...raus];
}

/** Jede Kanten-Id mit der Peg-Id ihres Artikels davor, damit sie im ganzen
 *  Bestand nur einmal vorkommt. Wiederholbar: was schon so heisst, bleibt. */
export function kantenEindeutig(entities: Entity[]): void {
  for (const e of entities) {
    for (const r of e.relations ?? []) {
      if (!r.id.startsWith(`${e.id}~`)) r.id = `${e.id}~${r.id}`;
    }
  }
}
