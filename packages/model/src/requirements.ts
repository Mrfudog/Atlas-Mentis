/**
 * **Voraussetzungen als prüfbare Form** (T-180): „level 4, STR 13; or
 * level 4, DEX 13" an einem Talent, „by a cleric or paladin" an einem
 * Gegenstand, „STR 13 or DEX 13" für den Einstieg in eine Klasse. Der Text
 * bleibt, wie er ist; gelesen wird er beim Rechnen (D8), nie gespeichert.
 *
 * Welches Feld ein solcher Satz ist, sagt das Register
 * (`facet: {as: 'requirement'}`), nicht eine Liste je Art. Was die Form
 * nicht kennt („Dragonlance campaign", „Fighting Style"), bleibt als
 * `unknown` stehen — und wird bei „usable by" nicht still ausgeschlossen.
 *
 * Die Form ist eine Oder-Liste von Und-Listen: `[[A, B], [C]]` heisst
 * „A und B, oder C".
 */

import { ancestryLine, characterLevel, choiceSources, answersOf } from './choices.js';
import { entityName, primaryInterface } from './entity.js';
import { resolveInstance } from './instance.js';
import { proficienciesOf, proficiencyNames } from './proficiency.js';
import type { Entity, EntityId } from './types.js';

export type Condition =
  | { kind: 'level'; min: number; class?: string }
  | { kind: 'ability'; ability: string; min: number }
  | { kind: 'spellcasting' }
  | { kind: 'proficiency'; what: string }
  | { kind: 'class'; name: string }
  | { kind: 'ancestry'; name: string }
  /** Ein genannter Artikel (`[[feat-0088|…]]`): die Figur muss ihn haben. */
  | { kind: 'has'; id: string; name: string }
  | { kind: 'unknown'; text: string }
  /** Eine Oder-Gruppe innerhalb einer Bedingung („Elf or Half-Elf"). */
  | { kind: 'any'; of: Condition[] }
  /**
   * **Auf der Zauberliste** (T-212): eine dieser Klassen oder Unterklassen
   * hat den Zauber auf ihrer Liste (`spellList`), und die Figur wirkt dort
   * Zauber dieses Grads. Kein Satz an einem Feld, sondern aus den Kanten
   * gerechnet (`spellListRequirement`).
   */
  | { kind: 'spellList'; of: EntityId[]; level: number };

/** Oder über Und: eine leere Liste heisst „keine Voraussetzung". */
export type Requirement = Condition[][];

/** Was der Zerleger an Namen kennt: die sichtbaren Klassen und Abstammungen. */
export interface RequirementContext {
  classes: ReadonlySet<string>;
  ancestries: ReadonlySet<string>;
}

const ATTRIBUTE: Record<string, string> = {
  str: 'str', strength: 'str',
  dex: 'dex', dexterity: 'dex',
  con: 'con', constitution: 'con',
  int: 'int', intelligence: 'int',
  wis: 'wis', wisdom: 'wis',
  cha: 'cha', charisma: 'cha',
};

/** Die Namen, die der Zerleger braucht, aus einem Bestand. */
export function requirementContext(entities: Iterable<Entity>): RequirementContext {
  const classes = new Set<string>();
  const ancestries = new Set<string>();
  for (const e of entities) {
    const t = primaryInterface(e);
    const n = entityName(e).trim().toLowerCase();
    if (!n) continue;
    if (t === 'Class' || t === 'Subclass') classes.add(n);
    else if (t === 'Ancestry') ancestries.add(n);
  }
  return { classes, ancestries };
}

/** Eine Abstammung trifft auch über ihre Grundart: „Elf (drow)" kennt der Bestand oft als „Elf". */
function abstammung(name: string, ctx: RequirementContext): boolean {
  if (ctx.ancestries.has(name)) return true;
  const grund = /^(.+?)\s*\(/.exec(name)?.[1];
  return !!grund && ctx.ancestries.has(grund);
}

/** Einzahl, grob: „clerics" → „cleric" — nur, wenn die Einzahl bekannt ist. */
function bekannt(name: string, set: ReadonlySet<string>): string | undefined {
  if (set.has(name)) return name;
  if (name.endsWith('s') && set.has(name.slice(0, -1))) return name.slice(0, -1);
  return undefined;
}

function bedingung(teil: string, ctx: RequirementContext): Condition {
  const t = teil.replace(/[*_]/g, '').replace(/\.$/, '').trim();
  const klein = t.toLowerCase();
  const link = /^\[\[([^|\]]+)\|([^\]]+)\]\]$/.exec(t);
  if (link) return { kind: 'has', id: link[1]!, name: link[2]! };
  let m = /^(?:(.+?)\s+)?level\s+(\d+)(?:\+|\s+or\s+higher)?$/i.exec(t);
  if (m) {
    const klasse = m[1]?.toLowerCase();
    return { kind: 'level', min: Number(m[2]), ...(klasse ? { class: klasse } : {}) };
  }
  m = /^(\d+)(?:st|nd|rd|th)[-\s]level(?:\s+(.+))?$/i.exec(t);
  if (m) {
    const klasse = m[2]?.toLowerCase();
    return { kind: 'level', min: Number(m[1]), ...(klasse ? { class: klasse } : {}) };
  }
  m = /^([a-z]+)\s+(\d+)(?:\+|\s+or\s+higher)?$/i.exec(t);
  if (m && ATTRIBUTE[m[1]!.toLowerCase()]) return { kind: 'ability', ability: ATTRIBUTE[m[1]!.toLowerCase()]!, min: Number(m[2]) };
  if (/ability to cast at least one spell|^spellcast(?:ing|er)s?\b|pact magic/i.test(t)) return { kind: 'spellcasting' };
  m = /^proficiency with (?:an? )?(.+)$/i.exec(t);
  if (m) {
    /* „martial weaponGroup", „heavy armor", „shield armor" — das Wort,
       das die Übungen nennen. */
    const what = m[1]!.toLowerCase().replace(/\s+(armou?r|weapons?|weapongroup)$/i, '').trim();
    return { kind: 'proficiency', what };
  }
  const klasse = bekannt(klein, ctx.classes);
  if (klasse) return { kind: 'class', name: klasse };
  if (abstammung(klein, ctx)) return { kind: 'ancestry', name: klein };
  return { kind: 'unknown', text: t };
}

/** Eine Bedingung, in der „or" stehen darf: „Elf or Half-Elf". */
function oderTeil(teil: string, ctx: RequirementContext): Condition {
  const ganz = bedingung(teil, ctx);
  if (ganz.kind !== 'unknown' || !/\sor\s/i.test(teil)) return ganz;
  const of = teil.split(/\s+or\s+/i).map((x) => bedingung(x, ctx));
  return of.length > 1 ? { kind: 'any', of } : ganz;
}

/**
 * **Einen Satz zerlegen.** `; or` trennt Möglichkeiten, das Komma Teile
 * einer Möglichkeit. Zwei Attribute nebeneinander („INT 13, WIS 13") sind
 * eine Wahl: so schreibt 5e.tools „Intelligence or Wisdom 13", und ein
 * Talent, das zwei Werte zugleich verlangt, gibt es nicht. „by a cleric,
 * druid, or wizard" am Gegenstand ist eine Oder-Liste.
 */
export function parseRequirement(text: string | undefined | null, ctx: RequirementContext): Requirement {
  const satz = String(text ?? '').trim();
  if (!satz) return [];
  const by = /^by\s+(?:an?\s+)?(.+)$/i.exec(satz);
  if (by) {
    const of = by[1]!
      .split(/\s*,\s*(?:or\s+)?|\s+or\s+/i)
      .map((x) => x.replace(/^(?:an?\s+)/i, '').trim())
      .filter(Boolean)
      .map((x) => bedingung(x, ctx));
    return [[of.length === 1 ? of[0]! : { kind: 'any', of }]];
  }
  return satz
    .split(/\s*;\s*or\s+|\s*;\s*/i)
    .filter((x) => x.trim())
    .map((moeglichkeit) => {
      const teile = moeglichkeit.split(/\s*,\s*/).filter(Boolean).map((x) => oderTeil(x, ctx));
      const werte = teile.filter((c) => c.kind === 'ability');
      if (werte.length < 2) return teile;
      return [...teile.filter((c) => c.kind !== 'ability'), { kind: 'any', of: werte } as Condition];
    });
}

/** Mehrere Felder zusammen: jedes muss gelten. */
export function allOf(reqs: readonly Requirement[]): Requirement {
  let raus: Requirement = [[]];
  for (const r of reqs) {
    if (!r.length) continue;
    raus = raus.flatMap((a) => r.map((b) => [...a, ...b]));
  }
  return raus.length === 1 && !raus[0]!.length ? [] : raus;
}

const ABK: Record<string, string> = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };

/** Ein Wort je Bedingung — der Wert der Facette (`level:4`, `ability:str:13`). */
export function conditionKeys(c: Condition): string[] {
  switch (c.kind) {
    case 'level':
      return [c.class ? `level:${c.class}:${c.min}` : `level:${c.min}`];
    case 'ability':
      return [`ability:${c.ability}:${c.min}`];
    case 'spellcasting':
      return ['spellcasting'];
    case 'proficiency':
      return [`prof:${c.what}`];
    case 'class':
      return [`class:${c.name}`];
    case 'ancestry':
      return [`ancestry:${c.name}`];
    case 'has':
      return [`has:${c.id}`];
    case 'spellList':
      return [`spellList:${c.level}`];
    case 'unknown':
      return ['unknown'];
    case 'any':
      return c.of.flatMap(conditionKeys);
  }
}

/** Die Werte einer Voraussetzung für die Facette; ohne Voraussetzung `none`. */
export function requirementKeys(r: Requirement): string[] {
  if (!r.length) return ['none'];
  return [...new Set(r.flatMap((a) => a.flatMap(conditionKeys)))];
}

const gross = (s: string) => s.replace(/(^|[\s(-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());

/** Die Beschriftung eines Werts der Facette; `name` löst eine Id auf. */
export function requirementLabel(key: string, name: (id: string) => string | undefined = () => undefined): string {
  if (key === 'none') return 'None';
  if (key === 'unknown') return 'Other (text only)';
  if (key === 'spellcasting') return 'Spellcasting';
  const [art, a, b] = key.split(':');
  switch (art) {
    case 'level':
      return b === undefined ? `Level ${a}+` : `${gross(a!)} level ${b}+`;
    case 'ability':
      return `${ABK[a!] ?? a} ${b}+`;
    case 'prof':
      return `Proficiency: ${key.slice(5)}`;
    case 'class':
      return `Class: ${gross(key.slice(6))}`;
    case 'ancestry':
      return `Ancestry: ${gross(key.slice(9))}`;
    case 'has':
      return `Has: ${name(key.slice(4)) ?? key.slice(4)}`;
    case 'spellList':
      return a === '0' ? 'On a class list (cantrip)' : `On a class list (level ${a})`;
    default:
      return key;
  }
}

// ------------------------------------------------------------------ Figur

/** Was an einer Figur gegen eine Voraussetzung geprüft wird. */
export interface CharacterProfile {
  id: EntityId;
  name: string;
  level: number;
  /** Klassen und Unterklassen, klein, mit ihrer Stufe. */
  classes: { name: string; level: number }[];
  /** Die Abstammung samt Grundarten, klein. Leer: unbekannt. */
  ancestries: string[];
  /** Die sechs Werte am Statblock; fehlt einer, ist er unbekannt. */
  abilities: Partial<Record<string, number>>;
  /** Übungen am Statblock, klein. Leer: unbekannt. */
  proficient: string[];
  spellcasting: boolean;
  /**
   * Je Klasse und Unterklasse der Figur der höchste Grad, den sie dort
   * wirkt (T-212) — `-1`: dort zaubert sie nicht. Leer: keine Klasse
   * bekannt.
   */
  casting: { id: EntityId; max: number }[];
  /** Was die Figur hat: Klassen, Herkünfte, gewählte und gewährte Artikel. */
  has: EntityId[];
}

/**
 * **Wie eine Klasse oder Unterklasse zaubert** (`ClassCasting`, in die Karte
 * der Art gemischt): `full`, `half`, `third`, `pact`, `artificer` — oder
 * nichts. Gelesen aus der Karte der Art und, für alte Bestände, aus einer
 * eigenen Karte `ClassCasting`.
 */
export function casterProgression(e: Entity | undefined): string | undefined {
  for (const k of ['Class', 'Subclass', 'ClassCasting']) {
    const v = (e?.components?.[k] as { casterProgression?: unknown } | undefined)?.casterProgression;
    if (typeof v === 'string' && v) return v;
  }
  return undefined;
}

/**
 * **Der höchste Zaubergrad auf einer Klassenstufe** (T-212), nach der
 * Tabelle der Zauberplätze: voll ab 1 (Grad 9 ab 17), halb ab 2, ein
 * Drittel ab 3 (Grad 4 ab 19), Pakt bis Grad 5, der Artificer halb ab 1.
 * Zaubertricks (Grad 0) gehen, sobald die Klasse überhaupt zaubert. `-1`:
 * keine Zauber.
 */
export function maxSpellLevel(progression: string | undefined, classLevel: number): number {
  const l = Math.max(0, Math.min(20, Math.floor(classLevel)));
  if (l < 1) return -1;
  switch (progression) {
    case 'full':
      return Math.min(9, Math.ceil(l / 2));
    case 'half':
      return l < 2 ? 0 : Math.min(5, Math.ceil(l / 4));
    case 'third':
      return l < 3 ? 0 : Math.min(4, Math.ceil(l / 6));
    case 'pact':
      return Math.min(5, Math.ceil(l / 2));
    case 'artificer':
      return Math.min(5, Math.ceil(l / 4));
    default:
      return -1;
  }
}

/**
 * **Die Zauberliste als Voraussetzung** (T-212): die Klassen und
 * Unterklassen, auf deren Liste ein Zauber steht, und sein Grad. Ohne Liste
 * keine Voraussetzung — ein Zauber, den keine Klasse kennt, wird bei
 * „usable by" nicht still ausgeschlossen.
 */
export function spellListRequirement(of: readonly EntityId[], level: number): Requirement {
  return of.length ? [[{ kind: 'spellList', of: [...new Set(of)], level }]] : [];
}

/**
 * **Die Figur, wie eine Voraussetzung sie sieht** — aus Kanten und
 * Statblock, beim Lesen. `byId` hält, was der Betrachter sehen darf: was
 * fehlt, zählt als unbekannt, nicht als „nein".
 */
export function characterProfile(character: Entity, byId: ReadonlyMap<EntityId, Entity>): CharacterProfile {
  const level = characterLevel(character);
  const classes: CharacterProfile['classes'] = [];
  let spellcasting = false;
  const casting: CharacterProfile['casting'] = [];
  const ancestries: string[] = [];
  for (const r of character.relations ?? []) {
    if (r.type === 'hasClass') {
      const l = Number(r.props?.['level']) || 1;
      const k = byId.get(r.to);
      if (k) classes.push({ name: entityName(k).toLowerCase(), level: l });
      const sub = typeof r.props?.['subclass'] === 'string' ? byId.get(r.props['subclass']) : undefined;
      if (sub) classes.push({ name: entityName(sub).toLowerCase(), level: l });
      /* Die Unterklasse zaubert für die Klasse mit (der Eldritch Knight
         den Kämpfer), sonst die Klasse für die Unterklasse (der Paktgeber
         des Hexenmeisters erweitert dessen Liste). */
      const prog = casterProgression(sub) ?? casterProgression(k);
      if (prog) spellcasting = true;
      const max = maxSpellLevel(prog, l);
      casting.push({ id: r.to, max });
      if (typeof r.props?.['subclass'] === 'string') casting.push({ id: r.props['subclass'], max });
    } else if (r.type === 'hasAncestry') {
      for (const id of ancestryLine(r.to, byId)) ancestries.push(entityName(byId.get(id)).toLowerCase());
    }
  }
  const has = new Set<EntityId>();
  for (const q of choiceSources(character, byId)) {
    has.add(q.entity.id);
    for (const r of q.entity.relations ?? []) {
      if (r.type === 'grants' && (Number(r.props?.['level']) || 1) <= q.level) has.add(r.to);
    }
  }
  for (const a of answersOf(character)) for (const p of a.picks) has.add(p);
  /* Der Statblock: zeigt mit `belongsTo` auf die Figur. */
  let abilities: CharacterProfile['abilities'] = {};
  let statblock: Entity | undefined;
  for (const e of byId.values()) {
    if (!(e.relations ?? []).some((r) => r.type === 'belongsTo' && r.to === character.id)) continue;
    const ab = (e.components?.['Abilities'] ?? {}) as Record<string, unknown>;
    abilities = Object.fromEntries(
      ['str', 'dex', 'con', 'int', 'wis', 'cha'].filter((k) => typeof ab[k] === 'number').map((k) => [k, ab[k] as number]),
    );
    statblock = e;
    break;
  }
  /* Übungen aus allen Quellen, nicht nur der Statblock-Karte (T-239). */
  const proficient = proficiencyNames(proficienciesOf(character, statblock ? resolveInstance(byId, statblock) : undefined, byId)).map((x) => x.toLowerCase());
  return { id: character.id, name: entityName(character), level, classes, ancestries, abilities, proficient, spellcasting, casting, has: [...has] };
}

export type Verdict = 'yes' | 'no' | 'unknown';

function pruefe(c: Condition, p: CharacterProfile): Verdict {
  switch (c.kind) {
    case 'level':
      if (c.class) {
        const k = p.classes.find((x) => x.name === c.class);
        return k ? (k.level >= c.min ? 'yes' : 'no') : 'no';
      }
      return p.level >= c.min ? 'yes' : 'no';
    case 'ability': {
      const w = p.abilities[c.ability];
      return w === undefined ? 'unknown' : w >= c.min ? 'yes' : 'no';
    }
    case 'spellcasting':
      return p.spellcasting ? 'yes' : 'no';
    case 'proficiency':
      if (!p.proficient.length) return 'unknown';
      return p.proficient.some((x) => x === c.what || x.split(/\s+/).includes(c.what)) ? 'yes' : 'no';
    case 'class':
      return p.classes.some((x) => x.name === c.name) ? 'yes' : 'no';
    case 'ancestry': {
      if (!p.ancestries.length) return 'unknown';
      const grund = /^(.+?)\s*\(([^)]*)\)/.exec(c.name);
      const trifft = p.ancestries.some((a) =>
        a === c.name || (grund ? a.includes(grund[1]!) && a.includes(grund[2]!) : false),
      );
      return trifft ? 'yes' : 'no';
    }
    case 'has':
      return p.has.includes(c.id) ? 'yes' : 'no';
    case 'spellList': {
      if (!p.casting.length) return 'unknown';
      return p.casting.some((x) => c.of.includes(x.id) && x.max >= c.level) ? 'yes' : 'no';
    }
    case 'unknown':
      return 'unknown';
    case 'any':
      return oder(c.of.map((x) => pruefe(x, p)));
  }
}

function oder(v: Verdict[]): Verdict {
  return v.includes('yes') ? 'yes' : v.includes('unknown') ? 'unknown' : 'no';
}

/** **Erfüllt die Figur das?** Eine Möglichkeit genügt; unbekannt bleibt unbekannt. */
export function meetsRequirement(r: Requirement, p: CharacterProfile): Verdict {
  if (!r.length) return 'yes';
  return oder(
    r.map((und) => {
      const v = und.map((c) => pruefe(c, p));
      return v.includes('no') ? 'no' : v.includes('unknown') ? 'unknown' : 'yes';
    }),
  );
}
