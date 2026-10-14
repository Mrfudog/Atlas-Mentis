/**
 * **Wirkungen als Feld** (REQ-238, REQ-063, E-025 a): was ein Gegenstand
 * (später auch Klasse, Abstammung, Talent, Merkmal) an der Figur
 * verändert, steht als Eintrag in `Effects.effects` am Artikel — Ziel,
 * Art, Wert, Bedingung. Handschuhe der Ogerstärke setzen STR auf 19, ein
 * Ring gibt Resistenz, Stiefel erhöhen die Geschwindigkeit.
 *
 * **Gerechnet wird beim Lesen** (D8): `effectsAt` sammelt, was an der Figur
 * gerade gilt — aus dem Inventar (`carries` → `holds`, mit `tier`, `slot`
 * und `attuned` an der Kante) und aus den Quellen, die auch ihre Wahlen
 * stellen (`choiceSources`). In den Statblock wird nichts geschrieben:
 * abgelegte Handschuhe nehmen die 19 sofort wieder weg.
 *
 * Die alten Zahlenfelder am Gegenstand (`bonusAc`, `bonusWeapon`,
 * `bonusSpellAttack`, `bonusSave`) bleiben vorerst und zählen beim Lesen als
 * Wirkung mit (`effectsOf`).
 */

import { choiceSources } from './choices.js';
import type { Entity, EntityId } from './types.js';

export const EFFECT_OPS = ['add', 'set', 'grant'] as const;
export type EffectOp = (typeof EFFECT_OPS)[number];

/** Wann eine Wirkung eines Gegenstands gilt. Die Liste steht am Feld. */
export const EFFECT_WHEN = ['worn', 'attuned', 'carried', 'self'] as const;
export type EffectWhen = (typeof EFFECT_WHEN)[number];

/**
 * **Die Ziele, die die Rechnung kennt** — eine Auskunft für Anzeige und
 * Maske, keine Aufzählung am Feld: ein neues Ziel ist ein neuer Wert, und
 * was die Rechnung nicht kennt, steht trotzdem in `effectTotals`.
 */
export const EFFECT_TARGETS: Record<string, string> = {
  'ability.str': 'Strength',
  'ability.dex': 'Dexterity',
  'ability.con': 'Constitution',
  'ability.int': 'Intelligence',
  'ability.wis': 'Wisdom',
  'ability.cha': 'Charisma',
  ac: 'AC',
  'speed.*': 'all speeds',
  'speed.walk': 'walking speed',
  'speed.fly': 'flying speed',
  'speed.swim': 'swimming speed',
  'speed.climb': 'climbing speed',
  'speed.burrow': 'burrowing speed',
  spellSaveDc: 'spell save DC',
  spellAttack: 'spell attack rolls',
  save: 'saving throws',
  weapon: 'attack and damage rolls with this weapon',
  resist: 'resistance',
  immune: 'immunity',
  vulnerable: 'vulnerability',
  conditionImmune: 'immunity to the condition',
  critThreshold: 'critical hit',
  carry: 'carrying capacity',
  capacity: 'holds',
};

/** Ein Eintrag von `Effects.effects`. */
export interface Effect {
  /** Aus dem Text, nicht durchgezählt (`str`, `resist-fire`). */
  id: string;
  target: string;
  op: EffectOp | string;
  /** Eine Zahl (19, 1, 10) oder ein Wort (`fire`, `walk`). */
  value?: number | string;
  when?: EffectWhen | string;
  note?: string;
}

/* Die alten Zahlenfelder am Gegenstand, gelesen als Wirkung (E-025 a). */
const ALTE_BONI: [string, string, EffectWhen | undefined][] = [
  ['bonusAc', 'ac', undefined],
  ['bonusWeapon', 'weapon', 'self'],
  ['bonusSpellAttack', 'spellAttack', undefined],
  ['bonusSave', 'save', undefined],
];

/** Die gespeicherten Einträge von `Effects.effects`, in ihrer Reihenfolge. */
export function storedEffects(e: Entity | undefined): Effect[] {
  const roh = e?.components?.['Effects']?.['effects'];
  return (Array.isArray(roh) ? roh : []).filter(
    (x): x is Effect =>
      !!x && typeof x === 'object' && typeof (x as Effect).id === 'string' && !!(x as Effect).id && typeof (x as Effect).target === 'string',
  );
}

/**
 * Die Wirkungen eines Artikels: die gespeicherten, dazu die alten
 * Zahlenfelder des Gegenstands, solange kein Eintrag dieselbe Id trägt.
 */
export function effectsOf(e: Entity | undefined): Effect[] {
  const raus = storedEffects(e);
  const it = e?.components?.['Item'];
  if (!it) return raus;
  const ids = new Set(raus.map((x) => x.id));
  for (const [feld, target, when] of ALTE_BONI) {
    const n = Number(it[feld]);
    if (it[feld] === undefined || it[feld] === null || it[feld] === '' || !Number.isFinite(n) || ids.has(feld)) continue;
    raus.push({ id: feld, target, op: 'add', value: n, ...(when ? { when } : {}) });
  }
  return raus;
}

/**
 * **Die Bedingung einer Wirkung**: was dasteht, sonst eingestimmt, wenn der
 * Gegenstand Einstimmung verlangt, sonst getragen (E-025 a).
 */
export function effectWhen(effect: Effect, item: Entity | undefined): EffectWhen | string {
  if (effect.when) return effect.when;
  return item?.components?.['Item']?.['attunement'] === true ? 'attuned' : 'worn';
}

/** Wie ein Stück an der Figur ist: aus der Kante `holds` gelesen. */
export interface ItemState {
  /** Nicht zu Hause, nicht am Boden. */
  carried: boolean;
  /** Getragen oder in der Hand (`tier` held/worn, oder ein Körperplatz). */
  worn: boolean;
  attuned: boolean;
}

/** Gilt eine Wirkung bei diesem Zustand? `self` gilt nie für eine Figur. */
export function effectApplies(when: EffectWhen | string, s: ItemState): boolean {
  switch (when) {
    case 'carried':
      return s.carried;
    case 'worn':
      return s.worn;
    case 'attuned':
      return s.attuned && s.worn;
    default:
      return false;
  }
}

/** Eine Wirkung, die an der Figur gilt, mit dem Artikel, der sie bringt. */
export interface ActiveEffect {
  effect: Effect;
  source: EntityId;
  /** `holds` (ein Gegenstand) oder wie bei `choiceSources`: `hasClass`, `hasAncestry`, … */
  via: string;
}

/**
 * **Was an der Figur gerade wirkt** — beim Lesen (D8). Gegenstände über
 * `carries` → Inventar → `holds`, mit dem Zustand der Kante; ein Behälter
 * mit eigenem Inventar reicht seinen Inhalt als „dabei, nicht getragen"
 * weiter. Klasse, Abstammung, Hintergrund, Talente und gewährte Merkmale
 * bringen ihre Wirkungen ohne Bedingung mit, sobald sie an der Figur gelten.
 *
 * `byId` hält die Artikel schon aufgelöst (eine Instanz mit ihrer Vorlage
 * darunter, `resolveInstance`) — die Rechnung liest nur.
 */
export function effectsAt(character: Entity, byId: ReadonlyMap<EntityId, Entity>): ActiveEffect[] {
  const raus: ActiveEffect[] = [];
  const gesehen = new Set<EntityId>([character.id]);

  const inventar = (traeger: Entity, aussen: ItemState | null) => {
    for (const c of traeger.relations ?? []) {
      if (c.type !== 'carries') continue;
      const inv = byId.get(c.to);
      if (!inv || gesehen.has(inv.id)) continue;
      gesehen.add(inv.id);
      for (const h of inv.relations ?? []) {
        if (h.type !== 'holds') continue;
        const item = byId.get(h.to);
        if (!item || gesehen.has(item.id)) continue;
        gesehen.add(item.id);
        const tier = String(h.props?.['tier'] ?? 'pack');
        const dabei = tier !== 'ground' && tier !== 'stored';
        const zustand: ItemState = aussen
          ? { carried: aussen.carried && dabei, worn: false, attuned: false }
          : {
              carried: dabei,
              worn: tier === 'held' || tier === 'worn' || (dabei && typeof h.props?.['slot'] === 'string' && !!h.props['slot']),
              attuned: h.props?.['attuned'] === true,
            };
        for (const effect of effectsOf(item)) {
          if (effectApplies(effectWhen(effect, item), zustand)) raus.push({ effect, source: item.id, via: 'holds' });
        }
        inventar(item, zustand);
      }
    }
  };
  inventar(character, null);

  /* Was die Figur ist und kann: dieselben Quellen wie ihre Wahlen, dazu,
     was diese auf ihrer Stufe gewähren. `self` gilt auch hier nicht. */
  const dazu = (e: Entity | undefined, via: string) => {
    if (!e || gesehen.has(e.id)) return;
    gesehen.add(e.id);
    for (const effect of effectsOf(e)) if (effect.when !== 'self') raus.push({ effect, source: e.id, via });
  };
  for (const q of choiceSources(character, byId)) {
    dazu(q.entity, q.via);
    for (const r of q.entity.relations ?? []) {
      if (r.type === 'grants' && (Number(r.props?.['level']) || 1) <= q.level) dazu(byId.get(r.to), 'grants');
    }
  }
  return raus;
}

/** Was die Wirkungen zusammen ergeben. */
export interface EffectTotals {
  /** Je Attribut: was dazukommt und auf welchen Wert es mindestens steht. */
  abilities: Record<string, { add: number; set?: number }>;
  /** Je Ziel die Summe (`ac`, `speed.walk`, `spellSaveDc`, `save`, `save.dex` …). */
  add: Record<string, number>;
  /**
   * Je Ziel der gesetzte Wert: eine Zahl (die höchste; beim kritischen
   * Treffer die kleinste) oder ein Wort (`speed.fly: 'walk'` — so schnell
   * wie zu Fuss).
   */
  set: Record<string, number | string>;
  /** Je Ziel die gewährten Wörter (`resist: ['fire']`). */
  grants: Record<string, string[]>;
}

export function effectTotals(effects: readonly ActiveEffect[]): EffectTotals {
  const raus: EffectTotals = { abilities: {}, add: {}, set: {}, grants: {} };
  for (const { effect: e } of effects) {
    const zahl = typeof e.value === 'number' ? e.value : Number(e.value);
    const istZahl = e.value !== undefined && e.value !== '' && Number.isFinite(zahl);
    if (e.target.startsWith('ability.')) {
      const a = e.target.slice('ability.'.length);
      const z = (raus.abilities[a] ??= { add: 0 });
      if (e.op === 'add' && istZahl) z.add += zahl;
      if (e.op === 'set' && istZahl) z.set = Math.max(z.set ?? -Infinity, zahl);
      continue;
    }
    if (e.op === 'add' && istZahl) raus.add[e.target] = (raus.add[e.target] ?? 0) + zahl;
    else if (e.op === 'set' && e.value !== undefined && e.value !== '') {
      const alt = raus.set[e.target];
      if (!istZahl) raus.set[e.target] ??= String(e.value);
      else if (typeof alt !== 'number') raus.set[e.target] = zahl;
      else raus.set[e.target] = e.target === 'critThreshold' ? Math.min(alt, zahl) : Math.max(alt, zahl);
    } else if (e.op === 'grant' && e.value !== undefined && e.value !== '') {
      const liste = (raus.grants[e.target] ??= []);
      if (!liste.includes(String(e.value))) liste.push(String(e.value));
    }
  }
  return raus;
}

/**
 * **Ein Attributswert mit Wirkungen**: Grundwert und Boni (aus Wahlen,
 * `chosenResult.abilityBonus`, und aus `add`), danach höchstens hinauf auf
 * einen gesetzten Wert — Handschuhe der Ogerstärke tun nichts, wenn die
 * Stärke schon 19 oder höher ist.
 */
export function abilityWithEffects(base: number | null, ability: string, totals: EffectTotals, bonus = 0): number | null {
  const t = totals.abilities[ability];
  if (base === null && t?.set === undefined) return null;
  const summe = base === null ? null : base + bonus + (t?.add ?? 0);
  if (t?.set === undefined) return summe;
  return summe === null ? t.set : Math.max(summe, t.set);
}

/**
 * **Eine Wirkung als Satz** — für Ansichten, die sie nur nennen: „Strength
 * becomes 19", „+1 AC", „resistance to fire", „flying speed equal to
 * walking speed", „critical hit on 19–20".
 */
export function effectText(e: Effect): string {
  const name = EFFECT_TARGETS[e.target] ?? e.target;
  const v = e.value === undefined ? '' : String(e.value);
  const n = Number(v);
  const vorzeichen = Number.isFinite(n) && v !== '' ? `${n >= 0 ? '+' : '−'}${Math.abs(n)}` : v;
  let satz: string;
  if (e.target === 'critThreshold' && e.op === 'set') satz = `critical hit on ${v}–20`;
  else if (e.target === 'capacity') satz = `holds ${v} lb.`;
  else if (e.target.startsWith('speed.') && e.op === 'set' && !Number.isFinite(n)) satz = `${name} equal to ${EFFECT_TARGETS[`speed.${v}`] ?? v}`;
  else if (e.target.startsWith('speed.') && e.op === 'add') satz = `${vorzeichen} ft. ${name}`;
  else if (e.target.startsWith('speed.') && e.op === 'set') satz = `${name} ${v} ft.`;
  else if (e.op === 'set') satz = `${name} becomes ${v}`;
  else if (e.op === 'add') satz = `${vorzeichen} ${e.target === 'ac' ? name : `to ${name}`}`;
  else if (e.op === 'grant') satz = e.target === 'conditionImmune' ? `immunity to ${v}` : `${name} to ${v}`;
  else satz = `${name} ${e.op} ${v}`.trim();
  const zusatz = [e.when === 'attuned' ? 'while attuned' : e.when === 'carried' ? 'while carried' : '', e.note ?? ''].filter(Boolean).join('; ');
  return zusatz ? `${satz} (${zusatz})` : satz;
}

/** Eine Id aus Ziel und Wert (`ability-str`, `resist-fire`), frei gemacht wie bei den Wahlen. */
export function effectId(target: string, value: unknown, taken: Iterable<string> = []): string {
  const basis =
    `${target}${typeof value === 'string' && value ? `-${value}` : ''}`
      .toLowerCase()
      .replace(/\*/g, 'all')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'effect';
  const belegt = new Set(taken);
  if (!belegt.has(basis)) return basis;
  for (let i = 2; ; i++) if (!belegt.has(`${basis}-${i}`)) return `${basis}-${i}`;
}
