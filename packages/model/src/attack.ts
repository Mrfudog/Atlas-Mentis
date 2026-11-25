/**
 * **Ein Angriff wird am Statblock gerechnet** (D51, Entscheidung 12.10.2026).
 *
 * Ein Biss ist ein Artikel für alle, die beissen: er sagt, welche Sorte
 * Angriff er ist, welche Schadensart er macht, auf welches Attribut er
 * rechnet und welche Würfel er gewöhnlich wirft. Trefferbonus und
 * Schadensbonus gehören dem, der beisst — Übung und Attributmodifikator
 * stehen am Statblock, und dort wird gerechnet:
 *
 *   Treffer = Übung + Mod(Attribut) + toHitBonus
 *   Schaden = Würfel + Mod(Attribut) + damageBonus
 *
 * Was ein Statblock anders macht, steht **an seiner Kante** (`composedOf`)
 * und nur dort: andere Würfel, eine andere Reichweite, ein Zusatzschaden,
 * ein Satz wie „und das Ziel liegt am Boden". Nennt das Buch eine Zahl, die
 * aus der Rechnung nicht folgt, steht **die Buchzahl** an der Kante
 * (`toHit`, `damageFlat`) — gezeigt wird das Buch, und dass es fest steht,
 * sagt `toHitFixed`/`damageFixed`.
 *
 * Abgeleitet heisst hier wie überall (D8): gerechnet beim Lesen, nie
 * gespeichert.
 */

import { abilityMod } from './calc.js';
import { parseDice } from './dice.js';

type Card = Record<string, unknown>;

/** Was ein Angriff an seiner Kante anders machen darf (`composedOf.props`). */
export const ATTACK_EDGE_FIELDS = [
  'ability', 'damageDice', 'damageType', 'reach', 'range', 'target',
  'toHitBonus', 'damageBonus', 'extraDamageDice', 'extraDamageType',
  'toHit', 'damageFlat', 'note',
] as const;

export interface AttackNumbers {
  /** Welche Sorte Angriff (`melee weapon`, `ranged spell` …). */
  kinds: string[];
  /** Das Attribut, auf das gerechnet wurde, oder `null`. */
  ability: string | null;
  /** Der Trefferbonus, oder `null`, wenn der Statblock keine Übung nennt. */
  toHit: number | null;
  /** Steht die Zahl fest (Buchzahl an der Kante) statt gerechnet? */
  toHitFixed: boolean;
  /** Was die Rechnung ergäbe — bei einer festen Zahl zum Vergleich. */
  toHitComputed: number | null;
  damageDice: string;
  damageBonus: number | null;
  damageFixed: boolean;
  /** `1d6 + 2`, wie man ihn würfelt. */
  damage: string;
  /** Der Durchschnitt, abgerundet — die Zahl vor der Klammer im Buch. */
  average: number | null;
  damageType: string;
  extra: { dice: string; type: string; average: number | null } | null;
  reach: number | null;
  range: string | null;
  target: string;
  /** Ein Satz der Kante, nur für diesen Statblock. */
  note: string;
}

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

/** Ist diese Karte ein Angriff? Ein Angriff nennt seine Sorte. */
export function isAttack(action: Card | undefined): boolean {
  return Array.isArray(action?.['attack']) && (action!['attack'] as unknown[]).length > 0;
}

/** Der Durchschnitt eines Würfelausdrucks, abgerundet, oder `null`. */
export function averageOf(expr: string, flat = 0): number | null {
  const terms = parseDice(expr);
  if (!terms) return null;
  let sum = flat;
  for (const t of terms) sum += 'flat' in t ? t.flat : (t.sign * t.count * (t.sides + 1)) / 2;
  return Math.floor(sum);
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * Auf welches Attribut gerechnet wird. `finesse` nimmt das bessere von
 * STR und DEX, `spell` das Zauberattribut des Statblocks. Ohne Angabe
 * rechnet ein Fernkampf auf DEX und alles andere auf STR — die Regel des
 * Spielerhandbuchs.
 */
export function attackAbility(wanted: unknown, kinds: string[], stats: Card): string | null {
  const w = typeof wanted === 'string' ? wanted : '';
  if (ABILITIES.includes(w)) return w;
  if (w === 'spell') {
    const s = stats['spellAbility'];
    return typeof s === 'string' && ABILITIES.includes(s) ? s : null;
  }
  if (w === 'finesse') {
    const str = num(stats['str']);
    const dex = num(stats['dex']);
    return (dex ?? -99) > (str ?? -99) ? 'dex' : 'str';
  }
  if (kinds.some((k) => k.includes('spell'))) return attackAbility('spell', kinds, stats);
  return kinds.some((k) => k.startsWith('ranged')) && !kinds.some((k) => k.startsWith('melee')) ? 'dex' : 'str';
}

function signed(n: number): string {
  return n < 0 ? ` - ${-n}` : ` + ${n}`;
}

/**
 * Die Zahlen eines Angriffs an einem Statblock.
 *
 * @param action  die Karte `Action` des Angriffsartikels
 * @param stats   die Karten des Statblocks als eine (`Statblock` und
 *                `Abilities` — `prof` und `dex` nebeneinander, wie der Bogen
 *                sie liest)
 * @param edge    `composedOf.props` dieses Statblocks: was er anders macht
 */
export function attackNumbers(action: Card | undefined, stats: Card, edge: Card = {}): AttackNumbers | null {
  if (!isAttack(action)) return null;
  const a = action!;
  /* Die Kante gewinnt Feld für Feld — sie trägt nur, was abweicht. */
  const eff = (k: string): unknown => (edge[k] !== undefined && edge[k] !== '' ? edge[k] : a[k]);
  const kinds = (a['attack'] as unknown[]).map(String);
  const ability = attackAbility(eff('ability'), kinds, stats);
  const mod = ability && num(stats[ability]) !== null ? abilityMod(num(stats[ability])!) : null;
  const prof = num(stats['prof']);

  const toHitComputed = prof !== null && mod !== null ? prof + mod + (num(eff('toHitBonus')) ?? 0) : null;
  const fixedHit = num(edge['toHit']);
  const toHit = fixedHit ?? toHitComputed;

  const damageDice = String(eff('damageDice') ?? '').trim();
  const fixedDamage = num(edge['damageFlat']);
  const damageBonus = fixedDamage ?? (mod !== null ? mod + (num(eff('damageBonus')) ?? 0) : null);
  const damage = damageDice ? damageDice + (damageBonus ? signed(damageBonus) : '') : damageBonus !== null ? String(damageBonus) : '';
  const average = damageDice ? averageOf(damageDice, damageBonus ?? 0) : damageBonus;

  const extraDice = String(eff('extraDamageDice') ?? '').trim();
  const extra = extraDice
    ? { dice: extraDice, type: String(eff('extraDamageType') ?? ''), average: averageOf(extraDice) }
    : null;

  return {
    kinds,
    ability,
    toHit,
    toHitFixed: fixedHit !== null,
    toHitComputed,
    damageDice,
    damageBonus,
    damageFixed: fixedDamage !== null,
    damage,
    average,
    damageType: String(eff('damageType') ?? ''),
    extra,
    reach: num(eff('reach')),
    range: eff('range') != null && eff('range') !== '' ? String(eff('range')) : null,
    target: String(eff('target') ?? ''),
    note: String(edge['note'] ?? ''),
  };
}

/**
 * **Was Wirkungen an einem Angriff ändern** (T-355): ein Zauberangriff
 * nimmt `spellAttack` und `spellDamage`, ein Waffenangriff `weapon.attack`,
 * `weapon.damage` und `weapon` (beides). `add` sind die Summen der
 * Wirkungen an der Figur (`effectTotals(…).add`) — Merkmale, Zustände,
 * getragene Stücke. Was an der Waffe selbst steht (`when: self`), kennt die
 * Kachel nicht: sie hängt an einer Aktion, nicht an einem Gegenstand.
 */
export function withEffectBonuses(n: AttackNumbers, add: Readonly<Record<string, number>>): AttackNumbers {
  const zauber = n.kinds.some((k) => k.includes('spell'));
  const waffe = n.kinds.some((k) => k.includes('weapon'));
  const z = (k: string) => add[k] ?? 0;
  const treffer = zauber ? z('spellAttack') : waffe ? z('weapon.attack') + z('weapon') : 0;
  const schaden = zauber ? z('spellDamage') : waffe ? z('weapon.damage') + z('weapon') : 0;
  if (!treffer && !schaden) return n;
  const damageBonus = schaden ? (n.damageBonus ?? 0) + schaden : n.damageBonus;
  const damage = n.damageDice ? n.damageDice + (damageBonus ? signed(damageBonus) : '') : damageBonus !== null ? String(damageBonus) : '';
  return {
    ...n,
    toHit: n.toHit === null ? null : n.toHit + treffer,
    damageBonus,
    damage,
    average: n.damageDice ? averageOf(n.damageDice, damageBonus ?? 0) : damageBonus,
  };
}

const ART: Record<string, string> = {
  'melee weapon': 'Melee Weapon Attack',
  'ranged weapon': 'Ranged Weapon Attack',
  'melee spell': 'Melee Spell Attack',
  'ranged spell': 'Ranged Spell Attack',
};

/**
 * Die Angriffszeile, wie das Buch sie schreibt — als Markdown mit Würfeln
 * (`{{+4}}`, `{{1d6 + 2}}`, M12), damit ein Klick würfelt:
 *
 *   *Melee Weapon Attack:* {{+4}} to hit, reach 5 ft., one target.
 *   *Hit:* 5 ({{1d6 + 2}}) piercing damage.
 */
export function attackLine(n: AttackNumbers, measure?: (feet: string) => string): string {
  /* Reichweite und Entfernung sind Fuss; wer umrechnet (D8, `units.ts`),
     gibt die Umrechnung mit. Ohne steht die Zahl wie im Buch. */
  const fuss = measure ?? ((x: string) => `${x} ft.`);
  const art = n.kinds.map((k) => ART[k] ?? k).join(' or ');
  const teile: string[] = [];
  teile.push(n.toHit !== null ? `{{${n.toHit < 0 ? n.toHit : `+${n.toHit}`}}} to hit` : '— to hit');
  if (n.reach !== null) teile.push(`reach ${fuss(String(n.reach))}`);
  if (n.range) teile.push(`range ${fuss(n.range)}`);
  if (n.target) teile.push(n.target);
  const schaden = n.damage
    ? `${n.average ?? '—'} ({{${n.damage}}})${n.damageType ? ` ${n.damageType}` : ''} damage`
    : '';
  const plus = n.extra
    ? ` plus ${n.extra.average ?? '—'} ({{${n.extra.dice}}})${n.extra.type ? ` ${n.extra.type}` : ''} damage`
    : '';
  return `*${art}:* ${teile.join(', ')}.${schaden ? ` *Hit:* ${schaden}${plus}.` : ''}`;
}
