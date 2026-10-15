/**
 * **Wie im Buch** (W2, Entscheidung der Leitung 13.10.2026): ein Statblock,
 * ein Zauber, ein Gegenstand lesen sich so, wie sie im Regelbuch stehen —
 * Werte nebeneinander und als Kopfzeilen, nicht jedes Feld in einer eigenen
 * Zeile einer Tabelle.
 *
 * Hier steht **was** dasteht, als Zeilen mit Inline-Markdown (Würfel als
 * `{{2d6}}`, Verweise als `[[…]]`); **wie** es aussieht, zeichnet die
 * Oberfläche. Ohne Framework, damit Prototyp, Oberfläche und Prüfungen
 * dieselben Sätze bauen.
 *
 * Welche Art so gezeichnet wird, sagt das Register: die Layout-Elemente
 * `statblock`, `spell` und `item` stehen an `Statblock`, `Spell` und `Item`
 * (`InterfaceDef.views`) und werden geerbt wie jede Anordnung. Jedes
 * Element zeichnet **alle** Felder seiner Karten (`BOOK_CARDS`): was es
 * nicht an eine Stelle des Buchs setzt, steht als Zusatzzeile darunter
 * (`extra`) — ein Feld, das morgen dazukommt, steht damit irgendwo, ohne
 * dass hier jemand nachzieht. Die Feldtabelle derselben Anordnung nimmt
 * diese Karten mit `except` heraus.
 *
 * **Masse werden beim Lesen umgerechnet** (D8, `units.ts`): „Range 150"
 * ohne Einheit gibt es nicht; ein Feld mit `unit` steht als Mass da, in
 * dem System, das `unitsFor` für die Art nennt.
 */

import { abilityMod, formatValue } from './calc.js';
import { attackLine, attackNumbers } from './attack.js';
import { isDice } from './dice.js';
import { entityName, fieldTitle, primaryInterface, relationDef } from './entity.js';
import type { VarScopes } from './inline.js';
import { convertText, formatMeasure, unitsFor, type UnitMode } from './units.js';
import type { Entity, LayoutElementKind, PropertySchema, Registry } from './types.js';

type Card = Record<string, unknown>;
type BookRegistry = Pick<Registry, 'interfaces' | 'relations' | 'units' | 'settings'>;

/** Die Buch-Elemente und die Karten, deren Felder jedes selbst zeichnet. */
export const BOOK_CARDS: Partial<Record<LayoutElementKind, readonly string[]>> = {
  statblock: ['Statblock', 'Abilities', 'Proficiencies'],
  spell: ['Spell'],
  item: ['Item', 'Weapon', 'Armor', 'Material'],
  /* Die Übersichten (T-191) zeichnen Übungen und Wahlen selbst; die
     Karte der Art nicht ganz (Zauberprogression, Unterklassentitel …), also
     bleibt sie in der Feldtabelle. */
  classOverview: ['Proficiencies', 'Choices'],
  originOverview: ['Proficiencies', 'Choices'],
};

/** Eine Zeile wie „**Armor Class** 15 (leather armor)". `text` ist Inline-Markdown. */
export interface BookLine {
  label: string;
  text: string;
  /** `Typ.feld`, woher der Wert kommt — wo es genau eines ist. */
  ref?: string;
}

// ------------------------------------------------------------------ Kleinzeug

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

/** Grossschreibung am Anfang: „small" → „Small". */
export function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th, 21st. */
export function ordinal(n: number): string {
  const zehner = n % 100;
  if (zehner >= 11 && zehner <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

/** +3, −1 — mit dem echten Minuszeichen, wie das Buch es setzt. */
export function signedBook(n: number): string {
  return n < 0 ? `−${-n}` : `+${n}`;
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string {
  return v === undefined || v === null ? '' : String(v).trim();
}

function list(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String).filter(Boolean) : [];
}

/**
 * Erfahrungspunkte je Herausforderungsgrad (MM 2014, S. 9). Eine Tabelle
 * der Regeln und keine Einstellung: sie steht so in jedem Buch.
 */
const XP_BY_CR: Record<string, number> = {
  '0': 10, '1/8': 25, '1/4': 50, '1/2': 100, '1': 200, '2': 450, '3': 700, '4': 1100,
  '5': 1800, '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900, '11': 7200,
  '12': 8400, '13': 10000, '14': 11500, '15': 13000, '16': 15000, '17': 18000,
  '18': 20000, '19': 22000, '20': 25000, '21': 33000, '22': 41000, '23': 50000,
  '24': 62000, '25': 75000, '26': 90000, '27': 105000, '28': 120000, '29': 135000,
  '30': 155000,
};

export function xpForCr(cr: string): number | null {
  return XP_BY_CR[cr.trim()] ?? null;
}

/**
 * Ein Feld, wie es dasteht: ein Mass in Einheiten (umgerechnet), sonst wie
 * `formatValue`. Eine Zahl mit `unit` ist ein Mass, auch ohne
 * `format: 'measure'` — die Reichweite eines Zaubers (`Spell.range`) ist
 * eine Zahl in Fuss, und ohne Einheit stünde sie als „150" da.
 */
export function fieldText(
  registry: Pick<Registry, 'units'>,
  prop: PropertySchema | undefined,
  raw: unknown,
  mode: UnitMode,
): string {
  if (raw === undefined || raw === null || raw === '') return '';
  if (prop?.unit && typeof raw === 'number') return formatMeasure(registry, raw, prop.unit, mode);
  if ((prop?.unit || prop?.format === 'measure') && typeof raw === 'string') {
    return convertText(registry, raw, mode, prop.unit);
  }
  if (prop?.type === 'boolean' || typeof raw === 'boolean') return raw === true ? 'yes' : 'no';
  return formatValue(prop, raw);
}

/**
 * Der Text eines Artikels, wie das Buch ihn unter den Namen setzt: die
 * Beschreibung und die Absätze (`Prose.paragraph`), in dieser Reihenfolge.
 */
export function bodyOf(entity: Entity | undefined): string {
  const c = entity?.components ?? {};
  const beschreibung = str((c['Description'] as Card | undefined)?.['description']);
  const absaetze = (c['Prose'] as Card | undefined)?.['paragraph'];
  const teile = Array.isArray(absaetze)
    ? absaetze.map((a) => (a && typeof a === 'object' ? str((a as Card)['value']) : str(a)))
    : [];
  return [beschreibung, ...teile].filter(Boolean).join('\n\n');
}

/**
 * **Die Zusatzzeilen eines Buch-Elements:** jedes Feld seiner Karten, das
 * einen Wert hat und an keiner Stelle des Buchs steht. Gerechnete Felder
 * und gemalte Formen (`grid`) bleiben weg — jene stehen neben ihrem
 * Ausgangswert, diese zeichnet das Inventar.
 */
function extras(
  registry: BookRegistry,
  entity: Entity,
  cards: readonly string[],
  placed: ReadonlySet<string>,
  mode: UnitMode,
): BookLine[] {
  const out: BookLine[] = [];
  const typ = primaryInterface(entity);
  for (const card of cards) {
    const werte = entity.components?.[card] as Card | undefined;
    if (!werte) continue;
    const props = registry.interfaces[card]?.schema?.properties ?? {};
    for (const [key, raw] of Object.entries(werte)) {
      if (placed.has(`${card}.${key}`) || placed.has(card)) continue;
      const prop = props[key];
      if (prop?.derived || prop?.format === 'grid') continue;
      const text = fieldText(registry, prop, raw, mode);
      if (!text) continue;
      out.push({
        label: prop ? fieldTitle(registry, typ, { type: card, key, prop }) : key,
        text,
        ref: `${card}.${key}`,
      });
    }
  }
  return out;
}

// ------------------------------------------------------------------ Statblock

export interface AbilityCell {
  key: string;
  label: string;
  score: number | null;
  /** „(+2)", „(−1)" — leer ohne Wert. */
  mod: string;
}

export interface StatblockBook {
  /** „Small humanoid (goblinoid), neutral evil" — kursiv unter dem Namen. */
  byline: string;
  /** Armor Class, Hit Points, Speed. */
  top: BookLine[];
  abilities: AbilityCell[];
  /** Saving Throws bis Challenge, in der Reihenfolge des Buchs. */
  details: BookLine[];
  extra: BookLine[];
}

export interface StatblockContext {
  /** Auf welches Attribut eine Fertigkeit rechnet — aus ihrem `Skill`-Artikel. */
  skillAbility?: (name: string) => string | undefined;
  /** Welche Art ein Name aus `proficient` ist (`Skill`, `Language` …). */
  kindOf?: (name: string) => string | undefined;
  /** Der Name eines Verweisziels (`conditionImmunities`, T-078). */
  nameOf?: (id: string) => string | undefined;
}

const STATBLOCK_PLACED = new Set([
  'Statblock.size', 'Statblock.creatureType', 'Statblock.alignment', 'Statblock.ac',
  'Statblock.acNote', 'Statblock.hp', 'Statblock.hpFormula', 'Statblock.speed', 'Statblock.cr',
  'Statblock.prof', 'Statblock.senses', 'Statblock.languageNote', 'Statblock.resistances',
  'Statblock.vulnerabilities', 'Statblock.immunities', 'Statblock.conditionImmunities',
  'Statblock.bonuses', 'Statblock.legendaryActions',
  'Abilities', 'Proficiencies.proficient', 'Proficiencies.expertise', 'Proficiencies.saves',
]);

/**
 * Der Kopf eines Statblocks: alles über den Merkmalen. Gerechnet wird beim
 * Lesen (D8) — Modifikatoren aus den Werten, Rettungswürfe und
 * Fertigkeiten aus Übung und Übungsbonus, ausser das Buch nennt eine feste
 * Zahl (`bonuses`).
 */
export function statblockBook(
  registry: BookRegistry,
  entity: Entity,
  ctx: StatblockContext = {},
): StatblockBook {
  const sb = (entity.components?.['Statblock'] ?? {}) as Card;
  const ab = (entity.components?.['Abilities'] ?? {}) as Card;
  const pr = (entity.components?.['Proficiencies'] ?? {}) as Card;
  const mode = unitsFor(registry, primaryInterface(entity));
  const props = registry.interfaces['Statblock']?.schema?.properties ?? {};
  const abilityProps = registry.interfaces['Abilities']?.schema?.properties ?? {};

  const prof = num(sb['prof']);
  const bonuses = (sb['bonuses'] && typeof sb['bonuses'] === 'object' ? sb['bonuses'] : {}) as Card;
  const modOf = (a: string): number | null => {
    const s = num(ab[a]);
    return s === null ? null : abilityMod(s);
  };

  const art = [capitalize(str(sb['size'])), str(sb['creatureType'])].filter(Boolean).join(' ');
  const gesinnung = str(sb['alignment']);
  const byline = [art, gesinnung].filter(Boolean).join(', ');

  const top: BookLine[] = [];
  if (num(sb['ac']) !== null) {
    const note = str(sb['acNote']);
    top.push({ label: 'Armor Class', text: `${num(sb['ac'])}${note ? ` (${note})` : ''}`, ref: 'Statblock.ac' });
  }
  if (num(sb['hp']) !== null) {
    const formel = str(sb['hpFormula']);
    const wurf = formel ? (isDice(formel) ? ` ({{${formel}}})` : ` (${formel})`) : '';
    top.push({ label: 'Hit Points', text: `${num(sb['hp'])}${wurf}`, ref: 'Statblock.hp' });
  }
  if (str(sb['speed'])) {
    top.push({ label: 'Speed', text: fieldText(registry, props['speed'], sb['speed'], mode), ref: 'Statblock.speed' });
  }

  const abilities: AbilityCell[] = ABILITIES.map((key) => {
    const score = num(ab[key]);
    return {
      key,
      label: abilityProps[key]?.title ?? key.toUpperCase(),
      score,
      mod: score === null ? '' : `(${signedBook(abilityMod(score))})`,
    };
  });

  const details: BookLine[] = [];
  const bonusFuer = (name: string, ability: string | undefined, faktor: number): number | null => {
    const fest = num(bonuses[name]);
    if (fest !== null) return fest;
    const m = ability ? modOf(ability) : null;
    return m === null || prof === null ? null : m + prof * faktor;
  };

  const saves = list(pr['saves']).filter((s) => (ABILITIES as readonly string[]).includes(s));
  if (saves.length) {
    details.push({
      label: 'Saving Throws',
      text: saves
        .map((s) => {
          const b = bonusFuer(s, s, 1);
          return `${capitalize(s)}${b === null ? '' : ` ${signedBook(b)}`}`;
        })
        .join(', '),
      ref: 'Proficiencies.saves',
    });
  }

  const expertise = new Set(list(pr['expertise']));
  const alle = [...new Set([...list(pr['proficient']), ...expertise])];
  const kind = (n: string) => ctx.kindOf?.(n) ?? (ctx.skillAbility?.(n) ? 'Skill' : undefined);
  const fertigkeiten = alle.filter((n) => kind(n) === 'Skill').sort((a, b) => a.localeCompare(b));
  const sprachen = alle.filter((n) => kind(n) === 'Language');
  const sonst = alle.filter((n) => kind(n) !== 'Skill' && kind(n) !== 'Language');

  const fertigkeitBonus = (n: string) => bonusFuer(n, ctx.skillAbility?.(n), expertise.has(n) ? 2 : 1);
  if (fertigkeiten.length) {
    details.push({
      label: 'Skills',
      text: fertigkeiten
        .map((n) => {
          const b = fertigkeitBonus(n);
          return b === null ? n : `${n} ${signedBook(b)}`;
        })
        .join(', '),
      ref: 'Proficiencies.proficient',
    });
  }
  if (sonst.length) details.push({ label: 'Proficiencies', text: sonst.join(', ') });

  const satz = (label: string, key: string) => {
    const t = str(sb[key]);
    if (t) details.push({ label, text: fieldText(registry, props[key], t, mode), ref: `Statblock.${key}` });
  };
  satz('Damage Vulnerabilities', 'vulnerabilities');
  satz('Damage Resistances', 'resistances');
  satz('Damage Immunities', 'immunities');
  /* Verweise auf `Condition`-Artikel (T-078); was keinen Namen bekommt,
     steht, wie es dasteht — ein alter Name aus einer Sicherung liest sich
     so weiter. */
  const zustaende = list(sb['conditionImmunities']).map((z) => ctx.nameOf?.(z) ?? z);
  if (zustaende.length) {
    details.push({ label: 'Condition Immunities', text: zustaende.join(', '), ref: 'Statblock.conditionImmunities' });
  }

  const passiv = passivePerception(entity, ctx);
  const sinne = [
    str(sb['senses']) ? convertText(registry, str(sb['senses']), mode, props['senses']?.unit) : '',
    passiv === null ? '' : `passive Perception ${passiv}`,
  ].filter(Boolean);
  if (sinne.length) details.push({ label: 'Senses', text: sinne.join(', '), ref: 'Statblock.senses' });

  const sprachZeile = [sprachen.join(', '), str(sb['languageNote'])].filter(Boolean).join('; ');
  details.push({ label: 'Languages', text: sprachZeile || '—' });

  const cr = str(sb['cr']);
  if (cr) {
    const xp = xpForCr(cr);
    details.push({
      label: 'Challenge',
      text: xp === null ? cr : `${cr} (${xp.toLocaleString('en-US')} XP)`,
      ref: 'Statblock.cr',
    });
  }
  if (prof !== null) details.push({ label: 'Proficiency Bonus', text: signedBook(prof), ref: 'Statblock.prof' });

  return {
    byline,
    top,
    abilities,
    details,
    extra: extras(registry, entity, BOOK_CARDS.statblock ?? [], STATBLOCK_PLACED, mode),
  };
}

/**
 * **Die passive Wahrnehmung** rechnet die Fertigkeit mit: 10 plus der
 * Bonus auf Perception, wo der Statblock darin geübt ist (oder eine feste
 * Zahl nennt), sonst plus WIS. Eine Rechnung für den Bogen und die
 * Kennzahlen (T-206).
 */
export function passivePerception(entity: Entity, ctx: StatblockContext = {}): number | null {
  const sb = (entity.components?.['Statblock'] ?? {}) as Card;
  const ab = (entity.components?.['Abilities'] ?? {}) as Card;
  const pr = (entity.components?.['Proficiencies'] ?? {}) as Card;
  const bonuses = (sb['bonuses'] && typeof sb['bonuses'] === 'object' ? sb['bonuses'] : {}) as Card;
  const wis = num(ab['wis']);
  const wisMod = wis === null ? null : abilityMod(wis);
  const expertise = list(pr['expertise']);
  const name = [...list(pr['proficient']), ...expertise].find((n) => n.toLowerCase() === 'perception');
  if (name) {
    const fest = num(bonuses[name]);
    if (fest !== null) return 10 + fest;
    const prof = num(sb['prof']);
    /* Eine andere Grundlage als WIS sagt der Fertigkeitsartikel. */
    const grund = ctx.skillAbility?.(name) ?? 'wis';
    const s = num(ab[grund]);
    if (s !== null && prof !== null) return 10 + abilityMod(s) + prof * (expertise.includes(name) ? 2 : 1);
  }
  return wisMod === null ? null : 10 + wisMod;
}

// ------------------------------------------------------------ Kennzahlen

/** Eine Kachel der Kennzahlen: „AC 15". */
export interface KeyStat {
  key: 'ac' | 'hp' | 'speed' | 'initiative' | 'passivePerception' | 'cr';
  label: string;
  value: string;
  /** Was die Kachel genauer sagt: der Rüstungsvermerk, die Trefferwürfel. */
  note?: string;
  /** `Typ.feld`, woher der Wert kommt. */
  ref?: string;
}

export interface KeyStats {
  tiles: KeyStat[];
  /** Die Zustände der Figur (`Vitals.conditions`): Id und Name, der Name die Id, wo keiner kam. */
  conditions: { id: string; name: string }[];
}

/**
 * **Die Kennzahlen eines Statblocks** (T-206, Leitung 15.10.): was man am
 * Tisch in einem Blick braucht — Rüstungsklasse, Trefferpunkte, Bewegung,
 * Initiative, passive Wahrnehmung, Herausforderung — als eine Reihe
 * Kacheln. Das Element `stats` zeichnet sie in der Kurzansicht (`quick`);
 * der Bogen (`statblock`) bleibt der Artikelseite.
 *
 * Hängt der Statblock an einer Figur (`belongsTo`, gelesen wie ein Feld),
 * zählt ihr Stand: die Trefferpunkte als „jetzt/Maximum" aus `Vitals`
 * (dort der Stand, am Statblock das Maximum) und ihre Zustände. Gerechnet
 * wird beim Lesen (D8), nichts davon wird gespeichert.
 *
 * Welche Kennzahlen es sind, steht hier und nicht als Feldliste in der
 * Ansicht — wie beim Bogen ist das eine Frage der Darstellung, nicht des
 * Registers: die Werte stammen aus drei Karten (`Statblock`, `Abilities`,
 * `Proficiencies`) und zwei davon sind gerechnet.
 */
export function keyStats(
  registry: BookRegistry,
  statblock: Entity | undefined,
  owner?: Entity,
  ctx: StatblockContext = {},
): KeyStats {
  const tiles: KeyStat[] = [];
  const vitals = (owner?.components?.['Vitals'] ?? {}) as Card;
  if (statblock) {
    const sb = (statblock.components?.['Statblock'] ?? {}) as Card;
    const ab = (statblock.components?.['Abilities'] ?? {}) as Card;
    const bonuses = (sb['bonuses'] && typeof sb['bonuses'] === 'object' ? sb['bonuses'] : {}) as Card;
    const props = registry.interfaces['Statblock']?.schema?.properties ?? {};
    const mode = unitsFor(registry, primaryInterface(statblock));

    const ac = num(sb['ac']);
    if (ac !== null) tiles.push({ key: 'ac', label: 'AC', value: String(ac), note: str(sb['acNote']) || undefined, ref: 'Statblock.ac' });

    const max = num(sb['hp']);
    const jetzt = num(vitals['hp']);
    const temp = num(vitals['hpTemp']);
    if (max !== null || jetzt !== null) {
      const wert = jetzt !== null ? `${jetzt}${max !== null ? `/${max}` : ''}` : String(max);
      tiles.push({
        key: 'hp',
        label: 'HP',
        value: temp ? `${wert} +${temp}` : wert,
        note: str(sb['hpFormula']) || undefined,
        ref: jetzt !== null ? 'Vitals.hp' : 'Statblock.hp',
      });
    }

    if (str(sb['speed'])) {
      tiles.push({ key: 'speed', label: 'Speed', value: fieldText(registry, props['speed'], sb['speed'], mode), ref: 'Statblock.speed' });
    }

    /* Die Initiative ist der DEX-Modifikator (`Abilities.initiative`),
       ausser das Buch nennt eine feste Zahl. */
    const dex = num(ab['dex']);
    const init = num(bonuses['initiative']) ?? (dex === null ? null : abilityMod(dex));
    if (init !== null) tiles.push({ key: 'initiative', label: 'Initiative', value: signedBook(init), ref: 'Abilities.initiative' });

    const pp = passivePerception(statblock, ctx);
    if (pp !== null) tiles.push({ key: 'passivePerception', label: 'Passive Perception', value: String(pp), ref: 'Abilities.passivePerception' });

    const cr = str(sb['cr']);
    if (cr) tiles.push({ key: 'cr', label: 'CR', value: cr, ref: 'Statblock.cr' });
  } else if (num(vitals['hp']) !== null) {
    /* Ohne Statblock keine Zahlen — ausser dem Stand, den die Figur trägt. */
    tiles.push({ key: 'hp', label: 'HP', value: String(num(vitals['hp'])), ref: 'Vitals.hp' });
  }
  const conditions = list(vitals['conditions']).map((id) => ({ id, name: ctx.nameOf?.(id) ?? id }));
  return { tiles, conditions };
}

// ------------------------------------------------------------ Abschnitte

export interface BookEntry {
  /** Die Kante. */
  id: string;
  /** Der Artikel, auf den sie zeigt. */
  target: string;
  /** „Fire Breath (Recharge 5–6)". */
  name: string;
  /** Angriffszeile, Text und Satz der Kante als Markdown. */
  text: string;
  /** Woraus `{VAR}` aufgelöst wird: Kante, Teil, Kampagne (REQ-174). */
  scopes: VarScopes;
  /** Der Teil ist nicht da — es gibt ihn nicht, oder nicht für diesen Betrachter. */
  missing?: boolean;
}

export interface BookSection {
  key: string;
  /** Leer bei den Merkmalen: die stehen im Buch ohne Überschrift. */
  title: string;
  /** Der Satz vor dem Abschnitt („The dragon can take 3 legendary actions …"). */
  intro?: string;
  entries: BookEntry[];
}

export interface SectionContext {
  /** Der ganze Teil, wenn er geholt ist. */
  part: (id: string) => Entity | undefined;
  /** Der Name eines Artikels aus der Kurzfassung (die Aktionsart, ein fehlender Teil). */
  nameOf: (id: string) => string | undefined;
  /** Die Platzhalter der Kampagne. */
  campaign?: Record<string, string> | undefined;
}

/* Merkmale, die im Buch einen eigenen Abschnitt haben. Alles andere ist ein
   Merkmal ohne Überschrift oben im Block. */
const FEATURE_SECTIONS: Record<string, string> = { regional: 'Regional Effects' };

/**
 * Wie der Statblock seine Kreatur nennt: „the goblin". Beide Fassungen der
 * Bindung gelten — die alte trägt nur das Wort („goblin", der Text sagt
 * „The {CREATURE}"), die neue den Artikel mit („the dragon", „Venomfang";
 * W1). Eine Bindung mit Artikel oder Grossbuchstaben nimmt die neue.
 */
export function creatureRef(binding: string | undefined, name: string): string {
  const b = str(binding);
  if (!b) return `the ${name.toLowerCase()}`;
  if (/^the\s/i.test(b) || /^[A-Z]/.test(b)) return b;
  return `the ${b}`;
}

/** „Action" → „Actions", „Legendary Action" → „Legendary Actions". */
function plural(name: string): string {
  return /s$/i.test(name) ? name : `${name}s`;
}

/**
 * **Die Abschnitte eines zusammengesetzten Artikels** — die Kanten mit
 * `section` (`composedOf`), gruppiert wie im Buch: zuerst die Merkmale ohne
 * Überschrift, dann je Aktionsart ein Abschnitt („Actions", „Bonus
 * Actions", „Reactions", „Legendary Actions" …) in der Reihenfolge, in der
 * die Kanten stehen. Die Überschrift ist der Name der Aktionsart und steht
 * nirgends im Code.
 *
 * Angriffe rechnen am Besitzer (D51, `attackNumbers`): Übung und Attribut
 * stehen an ihm, was er anders macht, an seiner Kante. `{CREATURE}` bindet
 * die Kante (`props.vars`), nie der gespeicherte Text.
 */
export function bookSections(
  registry: BookRegistry,
  owner: Entity,
  ctx: SectionContext,
): BookSection[] {
  const mode = unitsFor(registry, primaryInterface(owner));
  const fuss = (wert: string) => convertText(registry, wert, mode, 'ft');
  const stats: Card = {
    ...((owner.components?.['Abilities'] ?? {}) as Card),
    ...((owner.components?.['Statblock'] ?? {}) as Card),
  };
  const sections = new Map<string, BookSection>();
  sections.set('trait', { key: 'trait', title: '', entries: [] });
  let bindung: string | undefined;

  for (const r of owner.relations ?? []) {
    if (!relationDef(registry, r.type).section) continue;
    const props = (r.props ?? {}) as Card;
    const vars = (props['vars'] && typeof props['vars'] === 'object' ? props['vars'] : undefined) as
      | Record<string, string>
      | undefined;
    bindung ??= vars?.['CREATURE'];
    const teil = ctx.part(r.to);
    if (!teil) {
      sections.get('trait')!.entries.push({
        id: r.id,
        target: r.to,
        name: ctx.nameOf(r.to) ?? '',
        text: '',
        scopes: {},
        missing: true,
      });
      continue;
    }
    const action = teil.components?.['Action'] as Card | undefined;
    const feature = teil.components?.['Feature'] as Card | undefined;
    let key = 'trait';
    let title = '';
    if (action && str(action['actionType'])) {
      key = `action:${str(action['actionType'])}`;
      title = plural(ctx.nameOf(str(action['actionType'])) ?? 'Action');
    } else if (feature && FEATURE_SECTIONS[str(feature['featureType'])]) {
      key = `feature:${str(feature['featureType'])}`;
      title = FEATURE_SECTIONS[str(feature['featureType'])]!;
    }
    if (!sections.has(key)) sections.set(key, { key, title, entries: [] });

    let name = entityName(teil);
    const recharge = str(action?.['recharge']);
    if (recharge) name += ` (Recharge ${recharge})`;
    const uses = str(action?.['uses']);
    if (uses && !name.includes(uses)) name += ` (${uses})`;

    const body = bodyOf(teil);
    const zahlen = attackNumbers(action, stats, props);
    let text = body;
    if (zahlen) {
      const zeile = attackLine(zahlen, fuss);
      /* „…slashing damage, or 8 (1d10 + 3) if used with two hands." — der
         Rest des Satzes steht am Teil und schliesst an die Zeile an. */
      text = /^[,;]/.test(body) ? zeile.replace(/\.$/, '') + body : [zeile, body].filter(Boolean).join(' ');
    }
    const note = zahlen ? zahlen.note : str(props['note']);
    if (note) text = [text, note].filter(Boolean).join(' ');

    const eigen = (teil.components?.['Vars'] as Card | undefined)?.['bindings'] as Record<string, string> | undefined;
    sections.get(key)!.entries.push({
      id: r.id,
      target: teil.id,
      name,
      text,
      scopes: { reference: vars, entity: eigen, campaign: ctx.campaign },
    });
  }

  /* Der Satz über den Legendären Aktionen steht im Buch vor ihnen; die Zahl
     ist ein Feld des Statblocks, der Satz ist Regeltext. */
  const anzahl = num((owner.components?.['Statblock'] as Card | undefined)?.['legendaryActions']);
  if (anzahl !== null) {
    const wer = capitalize(creatureRef(bindung, entityName(owner)));
    for (const s of sections.values()) {
      if (!/legendary/i.test(s.title)) continue;
      s.intro =
        `${wer} can take ${anzahl} legendary action${anzahl === 1 ? '' : 's'}, choosing from the options below. ` +
        `Only one legendary action option can be used at a time and only at the end of another creature's turn. ` +
        `${wer} regains spent legendary actions at the start of its turn.`;
    }
  }

  return [...sections.values()].filter((s) => s.entries.length);
}

// ------------------------------------------------------------------ Zauber

export interface SpellBook {
  /** „3rd-level evocation", „Evocation cantrip (ritual)". */
  byline: string;
  /** Casting Time, Range, Components, Duration. */
  lines: BookLine[];
  /** „At Higher Levels" als Markdown, leer wenn es keinen gibt. */
  higherLevels: string;
  extra: BookLine[];
}

const SPELL_PLACED = new Set([
  'Spell.level', 'Spell.school', 'Spell.ritual', 'Spell.castingTime', 'Spell.castingAction',
  'Spell.castingUnit', 'Spell.castingCondition', 'Spell.rangeKind', 'Spell.range', 'Spell.components',
  'Spell.material', 'Spell.duration', 'Spell.durationAmount', 'Spell.durationUnit',
  'Spell.concentration', 'Spell.higherLevels',
]);

/* Reichweiten, die eine Fläche um den Wirkenden sind: „Self (15 ft cone)". */
const UM_SICH = new Set(['radius', 'sphere', 'cone', 'line', 'cube', 'cylinder', 'hemisphere', 'emanation']);

function menge(n: number, wort: string): string {
  return `${n} ${wort}${n === 1 ? '' : 's'}`;
}

/** Der Kopf eines Zaubers, wie im Spielerhandbuch. */
export function spellBook(
  registry: BookRegistry,
  entity: Entity,
  nameOf: (id: string) => string | undefined = () => undefined,
): SpellBook {
  const sp = (entity.components?.['Spell'] ?? {}) as Card;
  const mode = unitsFor(registry, primaryInterface(entity));
  const props = registry.interfaces['Spell']?.schema?.properties ?? {};

  const stufe = num(sp['level']);
  const schule = str(sp['school']);
  let byline =
    stufe === 0
      ? `${capitalize(schule || 'spell')} cantrip`
      : stufe !== null
        ? `${ordinal(stufe)}-level ${schule || 'spell'}`
        : capitalize(schule);
  if (sp['ritual'] === true) byline += ' (ritual)';

  const lines: BookLine[] = [];

  const anzahl = num(sp['castingTime']) ?? 1;
  const einheit = str(sp['castingUnit']);
  const aktion = str(sp['castingAction']);
  const aktionsName = aktion ? (nameOf(aktion) ?? '').toLowerCase() : '';
  let wirkzeit = einheit ? menge(anzahl, einheit) : aktionsName ? menge(anzahl, aktionsName) : '';
  if (wirkzeit && str(sp['castingCondition'])) wirkzeit += `, ${str(sp['castingCondition'])}`;
  if (wirkzeit) lines.push({ label: 'Casting Time', text: wirkzeit, ref: 'Spell.castingTime' });

  const art = str(sp['rangeKind']);
  const weite = num(sp['range']);
  const mass = weite === null ? '' : fieldText(registry, props['range'] ?? { type: 'number', unit: 'ft' }, weite, mode);
  let reichweite = '';
  if (UM_SICH.has(art)) reichweite = mass ? `Self (${mass} ${art})` : 'Self';
  else if (art && art !== 'point') reichweite = capitalize(art);
  else reichweite = mass;
  if (reichweite) lines.push({ label: 'Range', text: reichweite, ref: 'Spell.range' });

  const teile = list(sp['components']).map((c) => c.toUpperCase());
  if (teile.length) {
    const material = str(sp['material']);
    const text = teile.map((c) => (c === 'M' && material ? `M (${material})` : c)).join(', ');
    lines.push({ label: 'Components', text, ref: 'Spell.components' });
  }

  const dauer = str(sp['duration']);
  const konz = sp['concentration'] === true;
  let dauerText = '';
  if (dauer === 'instant') dauerText = 'Instantaneous';
  else if (dauer === 'permanent') dauerText = 'Until dispelled';
  else if (dauer === 'special') dauerText = 'Special';
  else if (dauer === 'timed') {
    const n = num(sp['durationAmount']);
    const u = str(sp['durationUnit']);
    dauerText = u ? (n === null ? capitalize(u) : menge(n, u)) : '';
  }
  if (konz) dauerText = dauerText ? `Concentration, up to ${dauerText}` : 'Concentration';
  if (dauerText) lines.push({ label: 'Duration', text: dauerText, ref: 'Spell.duration' });

  return {
    byline,
    lines,
    higherLevels: str(sp['higherLevels']),
    extra: extras(registry, entity, BOOK_CARDS.spell ?? [], SPELL_PLACED, mode),
  };
}

// --------------------------------------------------------------- Gegenstand

export interface ItemBook {
  /** „Wondrous item, rare (requires attunement by a wizard)". */
  byline: string;
  lines: BookLine[];
  extra: BookLine[];
}

const ITEM_PLACED = new Set([
  'Item.itemType', 'Item.rarity', 'Item.attunement', 'Item.attunementNote', 'Item.appliesTo',
  'Item.charges', 'Item.recharge', 'Item.rechargeAmount', 'Item.bonusWeapon', 'Item.bonusAc',
  'Item.bonusSpellAttack', 'Item.bonusSave', 'Item.copperPrice', 'Item.priceNote', 'Item.weight',
  'Weapon.category', 'Weapon.damage', 'Weapon.damage2', 'Weapon.damageType', 'Weapon.range',
  'Weapon.ammoType', 'Armor.ac', 'Armor.armorType', 'Armor.strength', 'Armor.stealthDisadvantage',
]);

const AUFLADEN: Record<string, string> = {
  dawn: 'at dawn', dusk: 'at dusk', midnight: 'at midnight',
  shortRest: 'after a short rest', longRest: 'after a long rest', special: 'special',
};

/** Kupfer als Münzen, wie das Buch den Preis schreibt: 1500 → „15 gp". */
export function coinText(copper: number): string {
  const fmt = (n: number) => n.toLocaleString('en-US');
  if (copper % 100 === 0) return `${fmt(copper / 100)} gp`;
  if (copper % 10 === 0) return `${fmt(copper / 10)} sp`;
  return `${fmt(copper)} cp`;
}

function wuerfel(expr: string): string {
  return isDice(expr) ? `{{${expr}}}` : expr;
}

/** Der Kopf eines Gegenstands, wie im Spielleiterhandbuch. */
export function itemBook(
  registry: BookRegistry,
  entity: Entity,
  typeLabel = '',
  nameOf: (id: string) => string | undefined = () => undefined,
): ItemBook {
  const it = (entity.components?.['Item'] ?? {}) as Card;
  const wp = entity.components?.['Weapon'] as Card | undefined;
  const ar = entity.components?.['Armor'] as Card | undefined;
  const mode = unitsFor(registry, primaryInterface(entity));
  const props = registry.interfaces['Item']?.schema?.properties ?? {};

  const art = str(it['itemType']) || typeLabel.toLowerCase();
  const passt = list(it['appliesTo']);
  const worte: string[] = [];
  if (str(wp?.['category'])) worte.push(`${str(wp!['category'])} weapon`);
  if (art) worte.push(`${art}${passt.length ? ` (any ${passt.join(' or ')})` : ''}`);
  else if (passt.length) worte.push(`any ${passt.join(' or ')}`);
  const seltenheit = str(it['rarity']);
  if (seltenheit && seltenheit !== 'none' && seltenheit !== 'unknown') worte.push(seltenheit);
  let byline = capitalize(worte.join(', '));
  if (it['attunement'] === true) {
    const wer = str(it['attunementNote']);
    byline += ` (requires attunement${wer ? ` ${wer}` : ''})`;
  }

  const lines: BookLine[] = [];
  if (ar && num(ar['ac']) !== null) {
    const ac = num(ar['ac'])!;
    const sorte = str(ar['armorType']);
    const text =
      sorte === 'shield' ? signedBook(ac)
      : sorte === 'light' ? `${ac} + Dex modifier`
      : sorte === 'medium' ? `${ac} + Dex modifier (max 2)`
      : String(ac);
    lines.push({ label: 'Armor Class', text, ref: 'Armor.ac' });
    if (num(ar['strength']) !== null) lines.push({ label: 'Strength', text: `Str ${num(ar['strength'])}`, ref: 'Armor.strength' });
    if (ar['stealthDisadvantage'] === true) lines.push({ label: 'Stealth', text: 'Disadvantage', ref: 'Armor.stealthDisadvantage' });
  }
  if (wp) {
    const schaden = str(wp['damage']);
    if (schaden) {
      lines.push({ label: 'Damage', text: [wuerfel(schaden), str(wp['damageType'])].filter(Boolean).join(' '), ref: 'Weapon.damage' });
    }
    if (str(wp['damage2'])) lines.push({ label: 'Versatile', text: wuerfel(str(wp['damage2'])), ref: 'Weapon.damage2' });
    if (str(wp['range'])) {
      const p = registry.interfaces['Weapon']?.schema?.properties?.['range'];
      lines.push({ label: 'Range', text: fieldText(registry, p, wp['range'], mode), ref: 'Weapon.range' });
    }
    /* Ein Verweis auf den Munitionsartikel (T-078). */
    const munition = str(wp['ammoType']);
    if (munition) lines.push({ label: 'Ammunition', text: nameOf(munition) ?? munition, ref: 'Weapon.ammoType' });
  }

  const boni: [string, string][] = [
    ['bonusWeapon', 'to attack and damage rolls'],
    ['bonusAc', 'to AC'],
    ['bonusSpellAttack', 'to spell attack rolls'],
    ['bonusSave', 'to saving throws'],
  ];
  const bonusText = boni
    .filter(([k]) => num(it[k]) !== null)
    .map(([k, wofuer]) => `${signedBook(num(it[k])!)} ${wofuer}`);
  if (bonusText.length) lines.push({ label: 'Bonus', text: bonusText.join(', ') });

  if (num(it['charges']) !== null) {
    const zurueck = str(it['recharge']);
    const wieviel = str(it['rechargeAmount']);
    const teile = [String(num(it['charges']))];
    if (zurueck || wieviel) {
      teile.push(`regains ${wieviel ? wuerfel(wieviel) : 'all'}${zurueck ? ` ${AUFLADEN[zurueck] ?? zurueck}` : ''}`);
    }
    lines.push({ label: 'Charges', text: teile.join(', '), ref: 'Item.charges' });
  }
  /* Ein geschätzter Preis sagt es dazu (T-139): „4,000 gp (estimated: DMG 2024 rare)". */
  if (num(it['copperPrice']) !== null) {
    const herkunft = str(it['priceNote']);
    lines.push({ label: 'Cost', text: coinText(num(it['copperPrice'])!) + (herkunft ? ` (${herkunft})` : ''), ref: 'Item.copperPrice' });
  }
  if (num(it['weight']) !== null) {
    lines.push({ label: 'Weight', text: fieldText(registry, props['weight'], num(it['weight']), mode), ref: 'Item.weight' });
  }

  return { byline, lines, extra: extras(registry, entity, BOOK_CARDS.item ?? [], ITEM_PLACED, mode) };
}
