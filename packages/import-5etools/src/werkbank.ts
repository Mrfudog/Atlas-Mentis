/**
 * **Die Werkbank:** was jede Zuordnung braucht — Artikel anlegen, Nummern
 * ausgeben, Verweise auflösen, Text umschreiben und zählen, was dabei
 * liegen bleibt.
 *
 * Gebaut wird in zwei Gängen, weil ein Text auf Artikel zeigt, die erst
 * später angelegt würden (`{@spell fireball}` in einem Monster, `{@creature
 * goblin}` in einem Zauber): im ersten Gang bekommt jeder Eintrag seinen
 * Artikel mit Namen und Nummer, im zweiten werden die Felder gefüllt. Die
 * Reihenfolge der Arten ist die aus Abgleich §4.2 — sie bestimmt die
 * Nummern, nicht die Auflösung.
 */

import { createHash } from 'node:crypto';
import type { Entity, Registry, Relation } from '@nw/model';
import { idPrefix, typeChain } from '@nw/model';
import type { Knoten } from './copy.js';
import { quelleVon } from './lesen.js';
import { inline, markdown } from './text.js';
import type { TextKontext } from './text.js';

/** Was der Bericht je 5e.tools-Art festhält. */
export interface ArtBericht {
  gelesen: number;
  /** Grund → Quelle → Anzahl. */
  ausgeschlossen: Map<string, Map<string, number>>;
  /** Unsere Art → Anzahl angelegter Artikel. */
  artikel: Map<string, number>;
  /** 5e.tools-Schlüssel, die kein Feld trägt. */
  liegen: Map<string, number>;
  /** Was sonst auffiel: übersprungene Einträge, Bearbeitungen, die nicht griffen. */
  notizen: Map<string, number>;
}

export interface Bericht {
  arten: Map<string, ArtBericht>;
  /** Marke → Ziel → Anzahl: Verweise, deren Ziel nicht hereinkam. */
  insLeere: Map<string, Map<string, number>>;
  /** Eintragsarten und Marken, die der Importer nicht kennt. */
  unbekannt: Map<string, number>;
  /** Quellen, die in keiner Bücher- oder Abenteuerliste stehen, aber hereinkamen. */
  fremdeQuellen: Map<string, number>;
  /** Unsere Art → Anzahl. */
  typen: Map<string, number>;
  /** Gleichlautende Merkmale, die einmal angelegt und mehrfach verwendet werden. */
  geteilt: { merkmale: number; verwendungen: number };
}

export function neuerBericht(): Bericht {
  return {
    arten: new Map(),
    insLeere: new Map(),
    unbekannt: new Map(),
    fremdeQuellen: new Map(),
    typen: new Map(),
    geteilt: { merkmale: 0, verwendungen: 0 },
  };
}

export function zaehle<K>(m: Map<K, number>, k: K, n = 1): void {
  m.set(k, (m.get(k) ?? 0) + n);
}

/** Schlüssel, die überall bewusst wegbleiben — Fundstellen, Flaggen, Indizes. */
const WEG_UEBERALL = new Set([
  'source', 'page', 'srd', 'srd52', 'basicRules', 'basicRules2024', 'reprintedAs',
  'otherSources', 'additionalSources', 'referenceSources', 'hasFluff', 'hasFluffImages',
  'hasToken', 'tokenCredit', 'tokenCustom', 'tokenHref', 'soundClip', 'altArt', 'edition', 'legacy',
  '_copy', '__kopieVon', 'fluff', 'foundryImg', 'isReprinted', 'tokenUrl',
]);

/* Vorgerechnete Filterschlüssel (Abgleich §3: „Keine Filter-Tags") — bei
   uns eine Abfrage über die Felder. */
const FILTER = /Tags(Spell|Legendary)?$|^foundry|^(conditionInflict|savingThrowForced|damageTags|summonedBy)|^(affectsCreatureType|abilityCheck|damageResist|damageImmune|damageVulnerable)$/;

/** Quellen, auf die eine Marke ohne Quelle zeigt — die Vorgabe von 5e.tools. */
const VORGABE_QUELLE: Record<string, string> = {
  creature: 'MM', spell: 'PHB', item: 'DMG', condition: 'PHB', status: 'PHB', disease: 'DMG',
  skill: 'PHB', sense: 'PHB', action: 'PHB', class: 'PHB', subclass: 'PHB', race: 'PHB',
  background: 'PHB', feat: 'PHB', deity: 'PHB', table: 'DMG', variantrule: 'DMG',
  language: 'PHB', itemProperty: 'PHB', reward: 'DMG', hazard: 'DMG', trap: 'DMG',
  object: 'DMG', cult: 'MTF', boon: 'MTF', charoption: 'MOT', legroup: 'MM',
  optfeature: 'PHB', classFeature: 'PHB', subclassFeature: 'PHB', tableGroup: 'DMG',
};

const klein = (s: unknown) => String(s ?? '').trim().toLowerCase();

export class Werkbank {
  readonly entities: Entity[] = [];
  readonly bericht: Bericht = neuerBericht();
  private readonly nummern = new Map<string, number>();
  private readonly nachSchluessel = new Map<string, Entity>();
  private readonly nachName = new Map<string, Entity[]>();
  /** Die Systemebene, in der alles liegt (Arbeitsplan §1). */
  ebene: Entity | undefined;
  /** Die Art, die gerade gefüllt wird — für Zählungen aus dem Text. */
  aktuelleArt = '';

  constructor(readonly registry: Registry) {}

  artBericht(art: string): ArtBericht {
    let b = this.bericht.arten.get(art);
    if (!b) {
      b = { gelesen: 0, ausgeschlossen: new Map(), artikel: new Map(), liegen: new Map(), notizen: new Map() };
      this.bericht.arten.set(art, b);
    }
    return b;
  }

  notiz(was: string, art = this.aktuelleArt): void {
    zaehle(this.artBericht(art).notizen, was);
  }

  /** Was von einem Eintrag liegen blieb. */
  liegen(art: string, e: Knoten, genutzt: Iterable<string>): void {
    const g = new Set(genutzt);
    for (const k of Object.keys(e)) {
      if (g.has(k) || WEG_UEBERALL.has(k) || FILTER.test(k)) continue;
      zaehle(this.artBericht(art).liegen, k);
    }
  }

  /**
   * Ein neuer Artikel. Die Peg-Id ist undurchsichtig (D15) und doch je
   * Eintrag gleich, damit zwei Läufe dieselbe Datei schreiben; die Nummer
   * zählt je Art hoch.
   */
  anlegen(typ: string, name: string, herkunft: string, eintrag?: Knoten): Entity {
    const prefix = idPrefix(typ);
    const n = (this.nummern.get(prefix) ?? 0) + 1;
    this.nummern.set(prefix, n);
    const nummer = `${prefix}-${String(n).padStart(4, '0')}`;
    const peg = `e5_${createHash('sha1').update(`${typ}|${herkunft}`).digest('hex').slice(0, 12)}`;
    const e: Entity = {
      id: peg,
      interfaces: [typ],
      name,
      components: {
        Identity: { name, id: nummer },
        Status: { status: 'ready' },
      },
      relations: [],
    };
    if (eintrag) this.quelle(e, eintrag);
    if (this.ebene) this.kante(e, 'inLayer', this.ebene.id);
    this.entities.push(e);
    zaehle(this.bericht.typen, typ);
    return e;
  }

  /** `Source`: Buch, Seite, Lizenzflagge — als Text, ohne Link (Arbeitsplan §2.5). */
  quelle(e: Entity, eintrag: Knoten): void {
    const quelle = quelleVon(eintrag);
    const i = (eintrag['inherits'] as Knoten | undefined) ?? {};
    const seite = eintrag['page'] ?? i['page'];
    const srd = Boolean(eintrag['srd'] || eintrag['srd52'] || i['srd'] || i['srd52']);
    const karte: Record<string, unknown> = {};
    if (quelle) karte['publication'] = quelle;
    if (seite !== undefined && seite !== 0) karte['page'] = String(seite);
    karte['srd'] = srd;
    /* Eine Art ohne `Source` (die Fraktion eines Kults) bekommt die
       Fundstelle als Notiz — weglassen hiesse, das Buch zu vergessen. */
    const kette = new Set(typeChain(this.registry, e.interfaces[0] ?? ''));
    if (kette.has('Source')) e.components['Source'] = karte;
    else if (kette.has('Notes') && quelle) {
      e.components['Notes'] = { note: [{ id: 'source', value: `Source: ${quelle}${karte['page'] ? `, p. ${String(karte['page'])}` : ''}` }] };
    }
  }

  karte(e: Entity, typ: string): Record<string, unknown> {
    return (e.components[typ] ??= {}) as Record<string, unknown>;
  }

  /** Setzt ein Feld nur, wenn es etwas sagt. */
  feld(e: Entity, typ: string, feld: string, wert: unknown): void {
    if (wert === undefined || wert === null || wert === '') return;
    if (Array.isArray(wert) && !wert.length) return;
    if (typeof wert === 'number' && !Number.isFinite(wert)) return;
    this.karte(e, typ)[feld] = wert;
  }

  kante(e: Entity, typ: string, ziel: string, props?: Relation['props']): void {
    const liste = (e.relations ??= []);
    if (liste.some((r) => r.type === typ && r.to === ziel && JSON.stringify(r.props ?? {}) === JSON.stringify(props ?? {}))) return;
    const r: Relation = { id: `${typ}-${liste.length + 1}`, type: typ, to: ziel };
    if (props && Object.keys(props).length) r.props = props;
    liste.push(r);
  }

  marke(e: Entity, ...marken: (string | undefined)[]): void {
    const tags = new Set((this.karte(e, 'Tags')['tags'] as string[] | undefined) ?? []);
    for (const m of marken) if (m && m.trim()) tags.add(m.trim().toLowerCase());
    if (tags.size) this.karte(e, 'Tags')['tags'] = [...tags];
  }

  // ------------------------------------------------------------ Verweise

  /** Ein Artikel wird unter einem Markenschlüssel auffindbar. */
  merke(e: Entity, tag: string, ...teile: unknown[]): void {
    const s = [tag, ...teile].map(klein).join('|');
    if (!this.nachSchluessel.has(s)) this.nachSchluessel.set(s, e);
    const n = `${tag}|${klein(teile[0])}`;
    const liste = this.nachName.get(n) ?? [];
    if (!liste.includes(e)) liste.push(e);
    this.nachName.set(n, liste);
  }

  hole(tag: string, ...teile: unknown[]): Entity | undefined {
    return this.nachSchluessel.get([tag, ...teile].map(klein).join('|'));
  }

  /** Der Artikel zu einer Marke `{@tag teile}`. */
  finde(tag: string, t: string[]): Entity | undefined {
    const [roh = '', a = '', b = '', c = '', , f = ''] = t;
    /* `burning hands#2`: der Grad, auf dem gewirkt wird — der Zauber ist derselbe. */
    const name = tag === 'spell' ? roh.replace(/#.*$/, '') : roh;
    let treffer: Entity | undefined;
    switch (tag) {
      case 'classFeature':
        /* name|Klasse|Klassenquelle|Stufe|Quelle */
        treffer = this.hole('classFeature', name, a, c);
        break;
      case 'subclassFeature':
        /* name|Klasse|Klassenquelle|Unterklasse|Unterklassenquelle|Stufe|Quelle */
        treffer = this.hole('subclassFeature', name, a, c, f);
        break;
      case 'subclass':
        treffer = this.hole('subclass', name, a);
        break;
      case 'deity':
        /* name|Pantheon|Quelle — derselbe Name steht in mehreren Pantheons. */
        treffer = this.hole('deity', name, a || 'Forgotten Realms', b || VORGABE_QUELLE['deity'])
          ?? this.hole('deity', name, b || VORGABE_QUELLE['deity']);
        break;
      default:
        treffer = this.hole(tag, name, a || VORGABE_QUELLE[tag] || '');
    }
    if (treffer) return treffer;
    /* Ohne Treffer an der Vorgabe: nur ein eindeutiger Name hilft weiter.
       Bei zweien wäre der erste der falsche (M11). */
    const quelleGenannt = tag === 'deity' ? b : ['classFeature', 'subclassFeature', 'subclass'].includes(tag) ? '' : a;
    if (quelleGenannt) return undefined;
    const namen = this.nachName.get(`${tag}|${klein(name)}`);
    if (namen && namen.length === 1) return namen[0];
    return undefined;
  }

  /** Der Textkontext für die Art, die gerade gefüllt wird. */
  get ctx(): TextKontext {
    return {
      finde: (tag, t) => {
        const e = this.finde(tag, t);
        return e ? (e.components['Identity'] as { id: string }).id : undefined;
      },
      insLeere: (tag, ziel) => {
        const m = this.bericht.insLeere.get(tag) ?? new Map<string, number>();
        zaehle(m, ziel);
        this.bericht.insLeere.set(tag, m);
      },
      unbekannt: (was) => zaehle(this.bericht.unbekannt, was),
    };
  }

  text(entries: unknown, ebene = 2): string {
    return markdown(entries, this.ctx, ebene).trim();
  }

  zeile(s: unknown): string {
    return typeof s === 'string' ? inline(s, this.ctx).trim() : '';
  }

  /** Der Regeltext eines Artikels als ein Eintrag in `Prose.paragraph`. */
  prosa(e: Entity, text: string): void {
    if (!text) return;
    const alt = (this.karte(e, 'Prose')['paragraph'] as { id: string; value: string }[] | undefined) ?? [];
    alt.push({ id: alt.length ? `p${alt.length + 1}` : 'text', value: text });
    this.karte(e, 'Prose')['paragraph'] = alt;
  }

  /** Begleittext (`*Fluff`) als `Lore.lore`. */
  lore(e: Entity, text: string): void {
    if (!text) return;
    this.karte(e, 'Lore')['lore'] = [{ id: 'lore', value: text }];
  }

  /** Gleichlautende Merkmale der Statblöcke (Arbeitsplan §2.5). */
  readonly geteilt = new Map<string, Entity>();
  readonly geteiltGezaehlt = new Set<string>();
  /** Wie viele Einträge in einem Artikel aufgingen (`Zuordnung.vereinen`). */
  readonly vereint = new Map<string, number>();
  /** Je legendärer Gruppe ihre Teile, für `composedOf` vom Statblock. */
  readonly legendaer = new Map<string, Entity[]>();

  /** Begleittext je Art (`monsterFluff` …), nach `name|source`. */
  readonly fluffe = new Map<string, Map<string, Knoten>>();

  fluff(art: string, name: string, quelle: string): Knoten | undefined {
    return this.fluffe.get(art)?.get(`${klein(name)}|${klein(quelle)}`);
  }

  nummer(e: Entity): string {
    return (e.components['Identity'] as { id: string }).id;
  }
}
