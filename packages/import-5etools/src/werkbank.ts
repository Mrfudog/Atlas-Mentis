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
import type { Regelstand } from './lesen.js';
import { inline, markdown } from './text.js';
import type { TextKontext } from './text.js';
import type { Verwendung } from './arten/angriff.js';

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
  /** Art → Artikel, die mit einem gleichen vereint wurden (`doppel.ts`). */
  vereint: Map<string, number>;
  /** Art → Fassungen, die Variante einer geltenden wurden (`doppel.ts`). */
  fassungen: Map<string, number>;
  /** Monstermerkmale, die auf ihr Volksmerkmal zeigen (`doppel.ts`). */
  herkunft: number;
  /** Je Ebene: Kürzel, Regelstand, Artikel darin und wie viele davon nicht zum Grundstand gehören (T-087). */
  ebenen: { name: string; kuerzel: string; stand: string; art: string; artikel: number; neu: number }[];
  /** Angriffe der Statblöcke, einer für alle (`arten/angriff.ts`, D51). */
  angriffe: { artikel: number; verwendungen: number; buchTreffer: number; buchSchaden: number; alsText: number; jeName: Map<string, number> };
}

export function neuerBericht(): Bericht {
  return {
    arten: new Map(),
    insLeere: new Map(),
    unbekannt: new Map(),
    fremdeQuellen: new Map(),
    typen: new Map(),
    geteilt: { merkmale: 0, verwendungen: 0 },
    vereint: new Map(),
    fassungen: new Map(),
    herkunft: 0,
    ebenen: [],
    angriffe: { artikel: 0, verwendungen: 0, buchTreffer: 0, buchSchaden: 0, alsText: 0, jeName: new Map() },
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
  '_copy', '__kopieVon', '_versions', '__spielart', 'fluff', 'foundryImg', 'isReprinted', 'tokenUrl',
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
  /* Die Arten von T-087, mit den Vorgaben der Seite. */
  vehicle: 'GoS', vehupgrade: 'GoS', deck: 'DMG', facility: 'XDMG', itemMastery: 'XPHB',
};

const klein = (s: unknown) => String(s ?? '').trim().toLowerCase();

/**
 * Die Peg-Id der Ebene eines Buchs (T-081): aus dem Kürzel und nicht aus
 * einem Hash, damit die Server-Migration (`026_ebene_je_buch.sql`) dieselbe
 * Id bildet — sonst legte ein späteres `--only-new` jedes Buch ein zweites
 * Mal an.
 */
export function buchEbeneId(quelle: string): string {
  return `e5_book_${quelle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
}

/** Die Id einer Gruppen-Ebene (T-088) — dieselbe in der Migration, damit ein Lauf sie wiederfindet. */
export function gruppeEbeneId(gruppe: string): string {
  return `e5_group_${gruppe}`;
}

/** Die Id der Ebene für das, was kein 2014-Buch nennt (T-109) — dieselbe in der Migration. */
export function ohneBuchEbeneId(): string {
  return 'e5_unsourced_2014';
}

/** Die Id einer Herausgeber-Gruppe (T-094) — dieselbe in der Migration. */
export function herausgeberEbeneId(herausgeber: string): string {
  return `e5_publisher_${herausgeber}`;
}

/**
 * Arten, deren Peg-Id noch mit dem alten Typnamen gerechnet wird: ein
 * Kapitel war bis E-026 eine `Story` (`kind: 'chapter'`) und ist jetzt ein
 * `Arc`. Die Migration 041 ändert nur die Art, nicht die Id — mit dem neuen
 * Namen im Hash legte `--only-new` jedes Kapitel ein zweites Mal an.
 */
const PEG_TYP: Record<string, string> = { Arc: 'Story' };

export class Werkbank {
  readonly entities: Entity[] = [];
  readonly bericht: Bericht = neuerBericht();
  private readonly nummern = new Map<string, number>();
  /** Je Schlüssel alle Artikel, die darunter gemerkt wurden, in der Reihenfolge des Merkens. */
  private readonly nachSchluessel = new Map<string, Entity[]>();
  /**
   * Die Nummer, die jeder Artikel bekam — nach seiner ersten Peg-Id (vor
   * einer Ebenen-Id). Ein Lauf mit 2024 übernimmt die des Grundstands
   * (`vorgabe`, T-087): sonst verschöbe jeder neue Eintrag die Nummern
   * danach, und mit ihnen die Peg-Ids der geteilten Merkmale, deren Text
   * Verweise auf Nummern trägt.
   */
  readonly vergeben = new Map<string, string>();
  private vorgabe: Map<string, string> | undefined;
  private readonly nachName = new Map<string, Entity[]>();
  /** Peg → Bücher, in die der Eintrag neu gedruckt wurde (`reprintedAs`, `doppel.ts`). */
  readonly nachdrucke = new Map<string, string[]>();
  /** Die Ebene für das, was keine Quelle nennt (die Aktionsarten, Arbeitsplan §1; seit T-109 nicht mehr die Gruppe der 2014-Regeln). */
  ebene: Entity | undefined;
  /** Die Ebene des Buchs, aus dem ein Eintrag kommt (T-081, E-017); angelegt beim ersten Eintrag. */
  buchEbene: ((quelle: string) => Entity | undefined) | undefined;
  /** Die Art, die gerade gefüllt wird — für Zählungen aus dem Text. */
  aktuelleArt = '';
  /** Aus welcher Quelle die Ebene eines Eintrags kommt (`ebeneQuelle`, T-087); ohne: seine Quelle. */
  ebeneFuer: ((eintrag: Knoten) => string) | undefined;
  /**
   * Der Regelstand des Eintrags, der gerade angelegt oder gefüllt wird, und
   * ob er zum Grundstand gehört (T-087). Was dabei angelegt wird, trägt
   * beides (`standJe`) — ein Angriff, den ein 2024-Monster anlegt, ist
   * ein 2024-Angriff.
   */
  stand: Regelstand = '2014';
  grund = true;
  /** Ob gerade ein Nachtrag aus T-084 angelegt oder gefüllt wird (`istNachtrag`). */
  nachtrag = false;
  /**
   * Ob der Grundstand gerade auch den Rest sieht: beim Buch- und
   * Abenteuertext ja (T-087) — dessen Peg-Ids hängen an der Stelle im
   * Buch, nicht am Text, und ein Verweis auf das Fahrzeug oder das Deck
   * eines 2014-Abenteuers findet so sein Ziel.
   */
  grundSiehtAlles = false;
  readonly standJe = new Map<string, { stand: Regelstand; grund: boolean; nachtrag?: boolean }>();

  constructor(readonly registry: Registry, vorgabe?: Map<string, string>) {
    if (!vorgabe) return;
    this.vorgabe = vorgabe;
    /* Neue Nummern zählen über den Grundstand hinaus. */
    for (const nummer of vorgabe.values()) {
      const m = /^(.*)-(\d+)$/.exec(nummer);
      if (m) this.nummern.set(m[1]!, Math.max(this.nummern.get(m[1]!) ?? 0, Number(m[2])));
    }
  }

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
  anlegen(typ: string, name: string, herkunft: string, eintrag?: Knoten, peg?: string): Entity {
    const id = peg ?? `e5_${createHash('sha1').update(`${PEG_TYP[typ] ?? typ}|${herkunft}`).digest('hex').slice(0, 12)}`;
    let nummer = this.vorgabe?.get(id);
    if (!nummer) {
      const prefix = idPrefix(typ);
      const n = (this.nummern.get(prefix) ?? 0) + 1;
      this.nummern.set(prefix, n);
      nummer = `${prefix}-${String(n).padStart(4, '0')}`;
    }
    this.vergeben.set(id, nummer);
    const e: Entity = {
      id,
      interfaces: [typ],
      name,
      components: {
        Identity: { name, id: nummer },
        Status: { status: 'ready' },
      },
      relations: [],
    };
    /* Ein Kapitel und seine Teile (T-108) tragen keinen Vorbereitungsstand —
       ohne Status-Karte zählt ein Artikel als fertig. */
    if (!this.mitStatus(typ)) delete e.components['Status'];
    if (eintrag) this.quelle(e, eintrag);
    /* Je Buch eine Ebene (E-017): eine Kampagne schaltet die Bücher auf,
       die sie nutzt. Ohne Quelle bleibt es die Systemebene. */
    if (this.ebene && typ !== 'Layer') {
      const buch = eintrag ? this.buchEbene?.(this.ebeneFuer?.(eintrag) ?? quelleVon(eintrag)) : undefined;
      this.kante(e, 'inLayer', (buch ?? this.ebene).id);
    }
    this.entities.push(e);
    this.standJe.set(id, { stand: this.stand, grund: this.grund, ...(this.nachtrag ? { nachtrag: true } : {}) });
    zaehle(this.bericht.typen, typ);
    return e;
  }

  /**
   * Was der Grundstand mit niemandem teilt (T-087): leer für ihn, sonst der
   * Regelstand. Ein Schlüssel, der Gleiches zu einem Artikel macht
   * (geteilte Angriffe, vereinte Merkmale), bekommt es vorangestellt —
   * so bleibt der Schlüssel des Grundstands, wie er war, und mit ihm
   * seine Peg-Ids.
   */
  get teilung(): string {
    /* Ein Nachtrag teilt nichts mit dem, was vor ihm schon da war (T-084). */
    return this.grund ? '' : this.nachtrag ? `${this.stand}+` : this.stand;
  }

  /** Die Teilung eines angelegten Artikels. */
  teilungVon(id: string): string {
    const s = this.standJe.get(id);
    return !s || s.grund ? '' : s.nachtrag ? `${s.stand}+` : s.stand;
  }

  private readonly statusJe = new Map<string, boolean>();
  private mitStatus(typ: string): boolean {
    let ja = this.statusJe.get(typ);
    if (ja === undefined) {
      ja = typeChain(this.registry, typ).includes('Status');
      this.statusJe.set(typ, ja);
    }
    return ja;
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

  /** Eine Notiz am Artikel (`Notes.note`), für was kein Feld fasst. */
  anmerkung(e: Entity, id: string, text: string): void {
    const karte = this.karte(e, 'Notes');
    const liste = Array.isArray(karte['note']) ? (karte['note'] as { id: string; value: string }[]) : [];
    karte['note'] = [...liste.filter((n) => n.id !== id), { id, value: text }];
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
    const unter = this.nachSchluessel.get(s) ?? [];
    if (!unter.includes(e)) unter.push(e);
    this.nachSchluessel.set(s, unter);
    const n = `${tag}|${klein(teile[0])}`;
    const liste = this.nachName.get(n) ?? [];
    if (!liste.includes(e)) liste.push(e);
    this.nachName.set(n, liste);
  }

  /**
   * Der Artikel unter einem Schlüssel: der zuerst gemerkte. **Der
   * Grundstand sieht nur sich selbst** (T-087) — er soll schreiben, was er
   * ohne 2024 geschrieben hätte. Der Rest nimmt zuerst einen aus seiner
   * Teilung, dann einen aus seinem Regelstand, dann den ersten.
   */
  hole(tag: string, ...teile: unknown[]): Entity | undefined {
    return this.waehle(this.nachSchluessel.get([tag, ...teile].map(klein).join('|')), false);
  }

  private waehle(alle: Entity[] | undefined, eindeutig: boolean): Entity | undefined {
    /* Was vor den Nachträgen da war, sieht sie nicht (T-084) — wie der
       Grundstand den Rest nicht sieht: sonst schriebe es seinen Text
       anders als auf dev. Buch- und Abenteuertext sieht alles. */
    const kandidaten = this.nachtrag || this.grundSiehtAlles ? alle : alle?.filter((x) => !this.standJe.get(x.id)?.nachtrag);
    if (!kandidaten?.length) return undefined;
    if (this.grund) {
      const grund = kandidaten.filter((x) => !this.teilungVon(x.id));
      if (grund.length || !this.grundSiehtAlles) return eindeutig && grund.length !== 1 ? undefined : grund[0];
      return eindeutig && kandidaten.length !== 1 ? undefined : kandidaten[0];
    }
    if (kandidaten.length === 1) return kandidaten[0];
    const gleich = kandidaten.filter((x) => this.teilungVon(x.id) === this.teilung);
    if (gleich.length === 1 || (!eindeutig && gleich.length)) return gleich[0];
    const stand = kandidaten.filter((x) => this.standJe.get(x.id)?.stand === this.stand);
    if (stand.length === 1 || (!eindeutig && stand.length)) return stand[0];
    return eindeutig ? undefined : kandidaten[0];
  }

  /** Der Artikel zu einer Marke `{@tag teile}`. */
  finde(tag: string, t: string[]): Entity | undefined {
    const [roh = '', a = '', b = '', c = '', , f = ''] = t;
    /* `burning hands#2`: der Grad, auf dem gewirkt wird — der Zauber ist derselbe. */
    const name = tag === 'spell' ? roh.replace(/#.*$/, '') : roh;
    let treffer: Entity | undefined;
    switch (tag) {
      /* Mit der Klassenquelle zuerst (T-087): der Kämpfer steht 2014 und
         2024 da, mit gleichnamigen Merkmalen auf derselben Stufe. Ohne sie
         gilt die Klasse aus dem PHB, wie 5e.tools es meint. */
      case 'classFeature':
        /* name|Klasse|Klassenquelle|Stufe|Quelle */
        treffer = this.hole('classFeature', name, a, b || 'PHB', c) ?? this.hole('classFeature', name, a, c);
        break;
      case 'subclassFeature':
        /* name|Klasse|Klassenquelle|Unterklasse|Unterklassenquelle|Stufe|Quelle */
        treffer = this.hole('subclassFeature', name, a, b || 'PHB', c, t[4] || 'PHB', f) ?? this.hole('subclassFeature', name, a, c, f);
        break;
      case 'subclass':
        /* name|Klasse|Klassenquelle|Quelle */
        treffer = (b ? this.hole('subclass', name, a, b, c || 'PHB') : undefined) ?? this.hole('subclass', name, a);
        break;
      case 'deity':
        /* name|Pantheon|Quelle — derselbe Name steht in mehreren Pantheons. */
        treffer = this.hole('deity', name, a || 'Forgotten Realms', b || VORGABE_QUELLE['deity'])
          ?? this.hole('deity', name, b || VORGABE_QUELLE['deity']);
        break;
      case 'card':
        /* name|Deck|Quelle (T-087) — derselbe Name steht in mehreren Decks. */
        /* Ohne Quelle das Deck allein: 5e.tools nennt sie oft nicht. */
        treffer = b ? this.hole('card', name, a, b) : this.hole('card', name, a);
        break;
      default:
        treffer = this.hole(tag, name, a || VORGABE_QUELLE[tag] || '');
    }
    if (treffer) return treffer;
    /* Ohne Treffer an der Vorgabe: nur ein eindeutiger Name hilft weiter.
       Bei zweien wäre der erste der falsche (M11). */
    const quelleGenannt = tag === 'deity' || tag === 'card' ? b : ['classFeature', 'subclassFeature', 'subclass'].includes(tag) ? '' : a;
    if (quelleGenannt) return undefined;
    /* Mehrere: nur einer aus derselben Teilung oder demselben Regelstand
       (T-087) — ein 2024-Text meint die 2024-Fassung. */
    return this.waehle(this.nachName.get(`${tag}|${klein(name)}`), true);
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
  /** Jede Verwendung eines gemeinsamen Angriffs — nach dem Füllen vereint (D51). */
  readonly angriffe: Verwendung[] = [];
  /** Wie viele Einträge in einem Artikel aufgingen (`Zuordnung.vereinen`). */
  readonly vereint = new Map<string, number>();
  /** Je legendärer Gruppe ihre Teile, für `composedOf` vom Statblock. */
  readonly legendaer = new Map<string, Entity[]>();
  /** Die Kreaturen benannter Statblöcke (T-169) — Neuzugänge auch aus dem Grundstand. */
  readonly benannt = new Set<string>();

  /** Begleittext je Art (`monsterFluff` …), nach `name|source`. */
  readonly fluffe = new Map<string, Map<string, Knoten>>();

  /**
   * Die Textschablonen der Gegenstände (`itemEntry`), nach `name|source`.
   * 5e.tools setzt sie beim Lesen ein (`{#itemEntry Ring of Resistance}`);
   * wir beim Einlesen, sonst stünde die Marke im Text (T-089).
   */
  readonly schablonen = new Map<string, Knoten>();

  fluff(art: string, name: string, quelle: string): Knoten | undefined {
    return this.fluffe.get(art)?.get(`${klein(name)}|${klein(quelle)}`);
  }

  nummer(e: Entity): string {
    return (e.components['Identity'] as { id: string }).id;
  }
}
