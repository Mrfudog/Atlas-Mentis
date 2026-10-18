/**
 * **Die gerechneten Werte einer Figur, mit ihren Teilen** (T-272): „DEX 14
 * = 13 base + 1 Artisan". Je Wert das Ergebnis und woraus es besteht, jeder
 * Teil mit dem Artikel, der ihn bringt. Gerechnet beim Lesen (D8), nichts
 * davon wird gespeichert.
 *
 * Der Assistent legt am Statblock die **Grundwerte** ab (C7); die Boni aus
 * Herkunft, Hintergrund und Wahlen rechnete `chosenResult`, aber kein Leser
 * nahm sie — der Bogen zeigte STR 15, wo 16 galt. Darum liefert
 * `characterStats` auch den **gelesenen Statblock** (`statblock`): dieselbe
 * Karte mit den Endwerten, dem Übungsbonus aus der Stufe, den Übungen aus
 * allen Quellen (`proficienciesOf`) und den Trefferpunkten aus den
 * Klassenstufen. Bogen, Statblock an der Figur und „usable by" lesen ihn;
 * geschrieben wird weiter in die gespeicherte Karte.
 *
 * Die Quellen sind dieselben wie bei den Übungen: der Statblock,
 * `choiceSources` (Herkunft samt Grundart mit `Ancestry.abilityBonus`),
 * beantwortete Wahlen der Sorte `ability` (`choicesAtCharacter`) und
 * Wirkungen (`effectsAt`: `ability.*`, `ac`, `speed.*`).
 */

import { abilityMod } from './calc.js';
import { characterLevel, choicesAtCharacter, choiceSources } from './choices.js';
import { effectsAt, type ActiveEffect } from './effects.js';
import { hitPointLevels, maxHitPoints } from './hitpoints.js';
import { proficienciesOf, proficiencyNames } from './proficiency.js';
import type { Entity, EntityId } from './types.js';

export const STAT_ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type StatAbility = (typeof STAT_ABILITIES)[number];

/** Ein Teil eines Werts: „+1 Artisan (choice)". */
export interface StatPart {
  /** Was der Teil ist: `base`, `bonus`, `set`, `level`, `die`, `con`, `dex`, `fixed`. */
  kind: string;
  /** Die Zahl des Teils (bei `set` der Wert, auf den er hebt) oder ein Wort. */
  value: number | string;
  /** Der Artikel, der ihn bringt. */
  source?: EntityId;
  /** Wie bei den Übungen: `statblock`, `hasAncestry`, `choice`, `effect`, `hasClass` … */
  via?: string;
  /** Eine Erklärung, wo die Zahl allein nichts sagt („level 3", „d12"). */
  note?: string;
}

export interface StatValue {
  key: string;
  label: string;
  /** Das Ergebnis; `null`, wenn nichts zu rechnen ist. */
  value: number | null;
  /** Wie es gezeigt wird („16 (+3)", „30", „darkvision 60"). */
  text: string;
  parts: StatPart[];
  /** Was auffällt: der Statblock nennt eine andere Zahl, eine Stufe ist offen. */
  note?: string;
}

export interface CharacterStats {
  abilities: Record<StatAbility, StatValue>;
  prof: StatValue;
  ac: StatValue;
  hp: StatValue;
  initiative: StatValue;
  speed: StatValue;
  senses: StatValue;
  /** Der gelesene Statblock: Endwerte statt Grundwerte. Ohne Statblock `undefined`. */
  statblock: Entity | undefined;
}

const zahl = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const ABILITY_LABEL: Record<StatAbility, string> = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };

/** Die Wirkungen auf ein Ziel, als Teile: `add` als Bonus, `set` als Untergrenze. */
function wirkungen(effekte: readonly ActiveEffect[], ziele: readonly string[]): { add: StatPart[]; set: StatPart[] } {
  const add: StatPart[] = [];
  const set: StatPart[] = [];
  for (const { effect, source } of effekte) {
    if (!ziele.includes(effect.target)) continue;
    const n = zahl(effect.value);
    if (n === null) continue;
    if (effect.op === 'add') add.push({ kind: 'bonus', value: n, source, via: 'effect' });
    else if (effect.op === 'set') set.push({ kind: 'set', value: n, source, via: 'effect' });
  }
  return { add, set };
}

/**
 * Alle gerechneten Werte einer Figur. `statblock` ist ihr Statblock, schon
 * aufgelöst (`resolveInstance`); ohne einen bleibt, was Klasse und Herkunft
 * allein sagen.
 */
export function characterStats(character: Entity, statblock: Entity | undefined, byId: ReadonlyMap<EntityId, Entity>): CharacterStats {
  const sb = (statblock?.components?.['Statblock'] ?? {}) as Record<string, unknown>;
  const ab = (statblock?.components?.['Abilities'] ?? {}) as Record<string, unknown>;
  const bonuses = (sb['bonuses'] && typeof sb['bonuses'] === 'object' ? sb['bonuses'] : {}) as Record<string, unknown>;
  const effekte = effectsAt(character, byId);
  const hatKlasse = (character.relations ?? []).some((r) => r.type === 'hasClass');

  /* ---- Attribute: Grundwert, Boni aus Herkunft und Wahlen, Wirkungen. */
  const teile = Object.fromEntries(STAT_ABILITIES.map((a) => [a, [] as StatPart[]])) as Record<StatAbility, StatPart[]>;
  for (const a of STAT_ABILITIES) {
    const s = zahl(ab[a]);
    if (s !== null) teile[a].push({ kind: 'base', value: s, ...(statblock ? { source: statblock.id } : {}), via: 'statblock' });
  }
  const istAttribut = (x: string): x is StatAbility => (STAT_ABILITIES as readonly string[]).includes(x);
  for (const q of choiceSources(character, byId)) {
    if (q.via !== 'hasAncestry') continue;
    const fest = q.entity.components?.['Ancestry']?.['abilityBonus'];
    if (!fest || typeof fest !== 'object') continue;
    for (const [a, n] of Object.entries(fest)) {
      const z = zahl(n);
      if (istAttribut(a) && z !== null) teile[a].push({ kind: 'bonus', value: z, source: q.entity.id, via: 'hasAncestry' });
    }
  }
  for (const at of choicesAtCharacter(character, byId)) {
    if (at.choice.kind !== 'ability' || !at.picks?.length) continue;
    at.picks.slice(0, at.choice.count ?? 1).forEach((a, i) => {
      const n = at.choice.bonus?.[i] ?? at.choice.bonus?.[0] ?? 1;
      if (istAttribut(a)) teile[a].push({ kind: 'bonus', value: n, source: at.source.entity.id, via: 'choice', note: at.choice.id });
    });
  }
  const abilities = {} as Record<StatAbility, StatValue>;
  for (const a of STAT_ABILITIES) {
    const w = wirkungen(effekte, [`ability.${a}`]);
    teile[a].push(...w.add);
    const basis = teile[a].find((t) => t.kind === 'base');
    let wert: number | null = basis ? teile[a].filter((t) => t.kind !== 'set').reduce((s, t) => s + Number(t.value), 0) : null;
    /* Gesetzt wird höchstens hinauf (Handschuhe der Ogerstärke, E-025 a). */
    for (const s of w.set) {
      teile[a].push(s);
      if (wert === null || Number(s.value) > wert) wert = Number(s.value);
    }
    abilities[a] = {
      key: a,
      label: ABILITY_LABEL[a],
      value: wert,
      text: wert === null ? '—' : `${wert} (${signed(abilityMod(wert))})`,
      parts: teile[a],
    };
  }
  const mod = (a: StatAbility) => (abilities[a].value === null ? null : abilityMod(abilities[a].value!));

  /* ---- Übungsbonus: am Statblock gegeben, sonst aus der Stufe (C3). */
  const stufe = characterLevel(character);
  const profFest = zahl(sb['prof']);
  const profWert = profFest ?? (hatKlasse ? 2 + Math.floor((stufe - 1) / 4) : null);
  const prof: StatValue = {
    key: 'prof',
    label: 'Proficiency bonus',
    value: profWert,
    text: profWert === null ? '—' : signed(profWert),
    parts:
      profFest !== null
        ? [{ kind: 'fixed', value: profFest, ...(statblock ? { source: statblock.id } : {}), via: 'statblock' }]
        : profWert !== null
          ? [{ kind: 'level', value: profWert, note: `level ${stufe}` }]
          : [],
  };

  /* ---- Trefferpunkte: je Klassenstufe ihr Wert plus CON (5e), sonst der Statblock. */
  const stufen = hitPointLevels(character, byId);
  const con = abilities.con.value;
  const gerechnet = stufen.length ? maxHitPoints(stufen, con ?? undefined) : null;
  const gespeichert = zahl(sb['hp']);
  const hpTeile: StatPart[] = [];
  if (gerechnet !== null) {
    const jeKlasse = new Map<EntityId, { summe: number; die?: number; n: number }>();
    for (const l of stufen) {
      const x = jeKlasse.get(l.classId) ?? { summe: 0, n: 0, ...(l.die !== undefined ? { die: l.die } : {}) };
      x.summe += l.value ?? 0;
      x.n += 1;
      jeKlasse.set(l.classId, x);
    }
    for (const [id, x] of jeKlasse) hpTeile.push({ kind: 'die', value: x.summe, source: id, via: 'hasClass', note: `${x.n} × d${x.die ?? '?'}` });
    if (con !== null) hpTeile.push({ kind: 'con', value: abilityMod(con) * stufen.length, note: `CON ${signed(abilityMod(con))} × ${stufen.length}` });
  } else if (gespeichert !== null) {
    hpTeile.push({ kind: 'fixed', value: gespeichert, ...(statblock ? { source: statblock.id } : {}), via: 'statblock' });
  }
  const hpWert = gerechnet ?? gespeichert;
  const hp: StatValue = {
    key: 'hp',
    label: 'Hit point maximum',
    value: hpWert,
    text: hpWert === null ? '—' : String(hpWert),
    parts: hpTeile,
    ...(gerechnet !== null && gespeichert !== null && gerechnet !== gespeichert
      ? { note: `The statblock says ${gespeichert}; the class levels and CON give ${gerechnet}.` }
      : stufen.length && gerechnet === null
        ? { note: 'A class level has no hit points yet — the statblock’s number stands.' }
        : {}),
  };

  /* ---- Rüstungsklasse: der Statblock, sonst 10 + DEX; dazu Wirkungen. */
  const acFest = zahl(sb['ac']);
  const acTeile: StatPart[] = [];
  if (acFest !== null) acTeile.push({ kind: 'base', value: acFest, ...(statblock ? { source: statblock.id } : {}), via: 'statblock', ...(typeof sb['acNote'] === 'string' && sb['acNote'] ? { note: sb['acNote'] } : {}) });
  else if (mod('dex') !== null) acTeile.push({ kind: 'base', value: 10, note: 'unarmored' }, { kind: 'dex', value: mod('dex')!, note: 'DEX' });
  const acW = wirkungen(effekte, ['ac']);
  acTeile.push(...acW.add);
  let acWert: number | null = acTeile.length ? acTeile.reduce((s, t) => s + Number(t.value), 0) : null;
  for (const s of acW.set) {
    acTeile.push(s);
    if (acWert === null || Number(s.value) > acWert) acWert = Number(s.value);
  }
  const ac: StatValue = { key: 'ac', label: 'Armor class', value: acWert, text: acWert === null ? '—' : String(acWert), parts: acTeile };

  /* ---- Initiative: DEX, ausser das Buch nennt eine Zahl. */
  const initFest = zahl(bonuses['initiative']);
  const initWert = initFest ?? mod('dex');
  const initiative: StatValue = {
    key: 'initiative',
    label: 'Initiative',
    value: initWert,
    text: initWert === null ? '—' : signed(initWert),
    parts:
      initFest !== null
        ? [{ kind: 'fixed', value: initFest, ...(statblock ? { source: statblock.id } : {}), via: 'statblock' }]
        : initWert !== null
          ? [{ kind: 'dex', value: initWert, note: 'DEX' }]
          : [],
  };

  /* ---- Bewegung: der Statblock, sonst die Herkunft; Wirkungen auf die erste Zahl. */
  const herkunft = choiceSources(character, byId).filter((q) => q.via === 'hasAncestry');
  const herkunftsTempo = herkunft.map((q) => ({ id: q.entity.id, v: q.entity.components?.['Ancestry']?.['speed'] })).find((x) => typeof x.v === 'string' && x.v);
  const tempoText = typeof sb['speed'] === 'string' && sb['speed'] ? (sb['speed'] as string) : typeof herkunftsTempo?.v === 'string' ? herkunftsTempo.v : '';
  const tempoTeile: StatPart[] = [];
  if (tempoText) {
    tempoTeile.push(
      sb['speed']
        ? { kind: 'base', value: tempoText, ...(statblock ? { source: statblock.id } : {}), via: 'statblock' }
        : { kind: 'base', value: tempoText, source: herkunftsTempo!.id, via: 'hasAncestry' },
    );
  }
  const tempoW = wirkungen(effekte, ['speed.*', 'speed.walk']);
  tempoTeile.push(...tempoW.add, ...tempoW.set);
  let tempoEnd = tempoText;
  const erste = /\d+/.exec(tempoText);
  if (erste && (tempoW.add.length || tempoW.set.length)) {
    let n = Number(erste[0]) + tempoW.add.reduce((s, t) => s + Number(t.value), 0);
    for (const s of tempoW.set) n = Math.max(n, Number(s.value));
    tempoEnd = tempoText.slice(0, erste.index) + String(n) + tempoText.slice(erste.index + erste[0].length);
  }
  const speed: StatValue = { key: 'speed', label: 'Speed', value: erste ? Number(/\d+/.exec(tempoEnd)![0]) : null, text: tempoEnd || '—', parts: tempoTeile };

  /* ---- Sinne: der Statblock, dazu Darkvision der Herkunft, wenn er sie nicht nennt. */
  const sinneText = typeof sb['senses'] === 'string' ? (sb['senses'] as string) : '';
  const sinneTeile: StatPart[] = sinneText ? [{ kind: 'base', value: sinneText, ...(statblock ? { source: statblock.id } : {}), via: 'statblock' }] : [];
  let sinneEnd = sinneText;
  const dv = herkunft.map((q) => ({ id: q.entity.id, n: zahl(q.entity.components?.['Ancestry']?.['darkvision']) })).find((x) => x.n !== null && x.n > 0);
  if (dv && !/darkvision/i.test(sinneText)) {
    sinneTeile.push({ kind: 'bonus', value: `darkvision ${dv.n}`, source: dv.id, via: 'hasAncestry' });
    sinneEnd = [sinneText, `darkvision ${dv.n}`].filter(Boolean).join(', ');
  }
  const senses: StatValue = { key: 'senses', label: 'Senses', value: null, text: sinneEnd || '—', parts: sinneTeile };

  /* ---- Der gelesene Statblock. */
  let gelesen: Entity | undefined;
  if (statblock) {
    const uebungen = proficienciesOf(character, statblock, byId);
    const pr = { ...((statblock.components?.['Proficiencies'] ?? {}) as Record<string, unknown>) };
    for (const k of ['proficient', 'expertise', 'saves'] as const) {
      const namen = proficiencyNames(uebungen, k);
      if (namen.length) pr[k] = namen;
    }
    const abil = { ...ab };
    for (const a of STAT_ABILITIES) if (abilities[a].value !== null) abil[a] = abilities[a].value;
    const neu: Record<string, unknown> = { ...sb };
    if (profWert !== null) neu['prof'] = profWert;
    if (hpWert !== null) neu['hp'] = hpWert;
    if (acWert !== null && (acFest !== null || acW.add.length || acW.set.length)) neu['ac'] = acWert;
    if (tempoEnd) neu['speed'] = tempoEnd;
    if (sinneEnd) neu['senses'] = sinneEnd;
    gelesen = { ...statblock, components: { ...statblock.components, Statblock: neu, Abilities: abil, Proficiencies: pr } };
  }

  return { abilities, prof, ac, hp, initiative, speed, senses, statblock: gelesen };
}

/** Ein Teil als kurzer Text, ohne den Namen seines Artikels: „+1", „set to 19", „3 × d12: 25". */
export function statPartText(p: StatPart): string {
  switch (p.kind) {
    case 'base':
      return typeof p.value === 'number' ? String(p.value) : p.value;
    case 'set':
      return `at least ${p.value}`;
    case 'die':
      return `${p.value}${p.note ? ` (${p.note})` : ''}`;
    case 'con':
    case 'dex':
      return typeof p.value === 'number' ? signed(p.value) : p.value;
    case 'level':
      return `${typeof p.value === 'number' ? signed(p.value) : p.value}${p.note ? ` (${p.note})` : ''}`;
    case 'fixed':
      return String(p.value);
    default:
      return typeof p.value === 'number' ? signed(p.value) : p.value;
  }
}
