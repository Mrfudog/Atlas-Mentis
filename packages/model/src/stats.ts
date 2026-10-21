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
 *
 * **Die Wirkungen wirken** (T-275, Punkt 1): die RK rechnet aus der
 * getragenen Rüstung und dem Schild, wo die Figur welche trägt (sonst gilt
 * die Zahl am Statblock), jedes Tempo nimmt `add`, `set` und `limit`, die
 * Resistenzen, Immunitäten und Verwundbarkeiten sammeln Statblock,
 * Herkunft und Wirkungen (`defenses`), und die Schwelle des kritischen
 * Treffers steht in `critThreshold`. Quellen sind auch die Zustände
 * (`Vitals.conditions`, die Einträge der Initiative über `options`) und was
 * ein Statblock über `equips` führt.
 */

import { abilityMod, proficiencyBonus } from './calc.js';
import { characterLevel, choicesAtCharacter, choiceSources } from './choices.js';
import { spellcastingOf } from './spellcasting.js';
import { effectsAt, effectTotals, itemsAt, type ActiveEffect, type EffectTotals } from './effects.js';
import { speedModes } from './movement.js';
import { hitPointLevels, maxHitPoints } from './hitpoints.js';
import { proficienciesOf, proficiencyNames } from './proficiency.js';
import type { Entity, EntityId } from './types.js';
import { entityName, primaryInterface } from './entity.js';
import { resolvedLookup } from './instance.js';

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
  /** Ab welchem W20 ein Angriff kritisch trifft: 20, oder was eine Wirkung setzt. */
  critThreshold: StatValue;
  /** Resistenzen, Immunitäten, Verwundbarkeiten, Zustandsimmunitäten — je Wort, woher. */
  defenses: Defenses;
  /** Die Wirkungen, die gerade gelten, und was sie zusammen ergeben. */
  effects: ActiveEffect[];
  totals: EffectTotals;
  /** Der gelesene Statblock: Endwerte statt Grundwerte. Ohne Statblock `undefined`. */
  statblock: Entity | undefined;
}

/** Ein Wort einer Abwehr („fire") oder ein Satz vom Statblock, mit seiner Quelle. */
export interface DefenseWord {
  word: string;
  source?: EntityId;
  /** `statblock`, `hasAncestry`, `effect`. */
  via: string;
}

export interface Defenses {
  resist: DefenseWord[];
  immune: DefenseWord[];
  vulnerable: DefenseWord[];
  conditionImmune: DefenseWord[];
}

/** Was `characterStats` ausser Figur und Statblock noch liest. */
export interface CharacterStatsOptions {
  /** Zustände aus der Initiative, die nicht in `Vitals.conditions` stehen. */
  conditions?: readonly EntityId[];
  /** Allgemeine Aktionen, deren Eintrag gerade gilt (Dodge, Help, Hide; T-275). */
  actions?: readonly string[];
}

const zahl = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const ABILITY_LABEL: Record<StatAbility, string> = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };

/** Woher eine Wirkung kommt, in den Wörtern der Teile: ein Gegenstand bleibt `effect`, ein Zustand `condition`, ein Merkmal `grants`. */
function wegVon(via: string): string {
  return via === 'holds' ? 'effect' : via;
}

/** Die Wirkungen auf ein Ziel, als Teile: `add` als Bonus, `set` als Untergrenze. */
function wirkungen(effekte: readonly ActiveEffect[], ziele: readonly string[]): { add: StatPart[]; set: StatPart[] } {
  const add: StatPart[] = [];
  const set: StatPart[] = [];
  for (const { effect, source, via } of effekte) {
    if (!ziele.includes(effect.target)) continue;
    const n = zahl(effect.value);
    if (n === null) continue;
    if (effect.op === 'add') add.push({ kind: 'bonus', value: n, source, via: wegVon(via) });
    else if (effect.op === 'set') set.push({ kind: 'set', value: n, source, via: wegVon(via) });
  }
  return { add, set };
}

/**
 * Alle gerechneten Werte einer Figur. `statblock` ist ihr Statblock, schon
 * aufgelöst (`resolveInstance`); ohne einen bleibt, was Klasse und Herkunft
 * allein sagen.
 */
export function characterStats(
  character: Entity,
  statblock: Entity | undefined,
  byId: ReadonlyMap<EntityId, Entity>,
  options: CharacterStatsOptions = {},
): CharacterStats {
  const sb = (statblock?.components?.['Statblock'] ?? {}) as Record<string, unknown>;
  const ab = (statblock?.components?.['Abilities'] ?? {}) as Record<string, unknown>;
  const bonuses = (sb['bonuses'] && typeof sb['bonuses'] === 'object' ? sb['bonuses'] : {}) as Record<string, unknown>;
  const effekte = effectsAt(character, byId, { ...(statblock ? { statblock } : {}), ...(options.conditions ? { conditions: options.conditions } : {}), ...(options.actions ? { actions: options.actions } : {}) });
  const totals = effectTotals(effekte);
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
      if (istAttribut(a)) teile[a].push({ kind: 'bonus', value: n, source: at.source.entity.id, via: 'choice', note: at.source.grant ? `${at.choice.id}, level ${at.source.grant.level}` : at.choice.id });
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

  /* ---- Übungsbonus: am Statblock gegeben, sonst aus der Stufe (C3) —
     dieselbe Regel wie im Register (`proficiencyBonus`, T-275). */
  const stufe = characterLevel(character);
  const profFest = zahl(sb['prof']);
  const profWert = profFest ?? (hatKlasse ? proficiencyBonus(stufe) : null);
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

  /* ---- Rüstungsklasse (T-275): trägt die Figur Rüstung oder Schild im
     Inventar, rechnet die RK daraus — leicht mit ganzer, mittel mit
     höchstens +2 GE, schwer ohne; sonst der Statblock, sonst 10 + GE.
     Was ein Statblock über `equips` führt, steckt in seiner Zahl schon
     drin (das Buch nennt die RK mit Rüstung) und zählt hier nicht. */
  const acFest = zahl(sb['ac']);
  const acTeile: StatPart[] = [];
  const getragen = itemsAt(character, byId).filter((x) => x.state.worn && x.item.components?.['Armor']);
  const ruestTyp = (e: Entity) => String(e.components?.['Armor']?.['armorType'] ?? '').toLowerCase();
  const ruestung = getragen
    .filter((x) => ['light', 'medium', 'heavy'].includes(ruestTyp(x.item)) && zahl(x.item.components?.['Armor']?.['ac']) !== null)
    .sort((a, b) => zahl(b.item.components!['Armor']!['ac'])! - zahl(a.item.components!['Armor']!['ac'])!)[0];
  const schild = getragen.find((x) => ruestTyp(x.item) === 'shield');
  const dexMod = mod('dex');
  if (ruestung) {
    const art = ruestTyp(ruestung.item);
    acTeile.push({ kind: 'base', value: zahl(ruestung.item.components!['Armor']!['ac'])!, source: ruestung.item.id, via: 'holds', note: `${art} armor` });
    if (dexMod !== null && art !== 'heavy') acTeile.push({ kind: 'dex', value: art === 'medium' ? Math.min(2, dexMod) : dexMod, note: art === 'medium' ? 'DEX, at most +2' : 'DEX' });
  } else if (acFest !== null && !schild) {
    acTeile.push({ kind: 'base', value: acFest, ...(statblock ? { source: statblock.id } : {}), via: 'statblock', ...(typeof sb['acNote'] === 'string' && sb['acNote'] ? { note: sb['acNote'] } : {}) });
  } else if (dexMod !== null) {
    acTeile.push({ kind: 'base', value: 10, note: 'unarmored' }, { kind: 'dex', value: dexMod, note: 'DEX' });
  }
  if (schild && acTeile.length) acTeile.push({ kind: 'bonus', value: zahl(schild.item.components!['Armor']!['ac']) ?? 2, source: schild.item.id, via: 'holds', note: 'shield' });
  const acW = wirkungen(effekte, ['ac']);
  acTeile.push(...acW.add);
  let acWert: number | null = acTeile.length ? acTeile.reduce((s, t) => s + Number(t.value), 0) : null;
  for (const s of acW.set) {
    acTeile.push(s);
    if (acWert === null || Number(s.value) > acWert) acWert = Number(s.value);
  }
  const ac: StatValue = {
    key: 'ac',
    label: 'Armor class',
    value: acWert,
    text: acWert === null ? '—' : String(acWert),
    parts: acTeile,
    ...((ruestung || schild) && acFest !== null && acWert !== null && acFest !== acWert
      ? { note: `The statblock says ${acFest}; the armor worn gives ${acWert}.` }
      : {}),
  };

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
  /* Je Bewegungsart (T-275): `speed.*` gilt für alle, `speed.walk` …
     für eine; `set` hebt (ein Wort: so schnell wie diese Art), `limit`
     deckelt (gepackt: 0). Ohne Wirkung bleibt der Text, wie er dasteht. */
  const tempoZiele = Object.keys({ ...totals.add, ...totals.set, ...totals.limit }).filter((k) => k.startsWith('speed.'));
  for (const { effect, source, via } of effekte) {
    if (!effect.target.startsWith('speed.') || effect.op === 'grant') continue;
    tempoTeile.push({ kind: effect.op === 'add' ? 'bonus' : effect.op, value: typeof effect.value === 'number' ? effect.value : (zahl(effect.value) ?? String(effect.value ?? '')), source, via: wegVon(via), note: effect.target.slice('speed.'.length) });
  }
  let tempoEnd = tempoText;
  const modes = speedModes(tempoText);
  if (tempoZiele.length && (Object.keys(modes).length || tempoZiele.some((k) => totals.set[k] !== undefined))) {
    const fuer = (art: string, basis: number | undefined): number | undefined => {
      let n = basis;
      const add = (totals.add['speed.*'] ?? 0) + (totals.add[`speed.${art}`] ?? 0);
      if (n !== undefined) n += add;
      for (const k of [`speed.${art}`, 'speed.*']) {
        const s = totals.set[k];
        const z = typeof s === 'number' ? s : typeof s === 'string' ? modes[s] : undefined;
        if (z !== undefined) n = Math.max(n ?? 0, z);
      }
      const deckel = Math.min(totals.limit['speed.*'] ?? Infinity, totals.limit[`speed.${art}`] ?? Infinity);
      if (n !== undefined && deckel < n) n = deckel;
      return n === undefined ? undefined : Math.max(0, n);
    };
    const arten = [...new Set(['walk', ...Object.keys(modes), ...tempoZiele.map((k) => k.slice('speed.'.length)).filter((a) => a !== '*')])];
    const teile: string[] = [];
    for (const art of arten) {
      const n = fuer(art, modes[art]);
      if (n === undefined) continue;
      teile.push(art === 'walk' ? `${n} ft.` : `${art} ${n} ft.`);
    }
    tempoEnd = teile.join(', ');
  }
  const ersteZahl = /\d+/.exec(tempoEnd);
  const speed: StatValue = { key: 'speed', label: 'Speed', value: ersteZahl ? Number(ersteZahl[0]) : null, text: tempoEnd || '—', parts: tempoTeile };

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

  /* ---- Abwehr (T-275): der Statblock (Sätze), die Herkunft (Schadensarten), die Wirkungen. */
  const defenses: Defenses = { resist: [], immune: [], vulnerable: [], conditionImmune: [] };
  const sbQuelle = statblock ? { source: statblock.id } : {};
  const satz = (k: keyof Defenses, v: unknown) => {
    if (typeof v === 'string' && v.trim()) defenses[k].push({ word: v.trim(), ...sbQuelle, via: 'statblock' });
  };
  satz('resist', sb['resistances']);
  satz('immune', sb['immunities']);
  satz('vulnerable', sb['vulnerabilities']);
  for (const id of Array.isArray(sb['conditionImmunities']) ? sb['conditionImmunities'] : []) {
    if (typeof id === 'string' && id) defenses.conditionImmune.push({ word: byId.has(id) ? entityName(byId.get(id)) : id, source: id, via: 'statblock' });
  }
  const genannt = (k: keyof Defenses, w: string) => defenses[k].some((d) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(d.word));
  for (const q of herkunft) {
    const r = q.entity.components?.['Ancestry']?.['resistances'];
    for (const w of Array.isArray(r) ? r : []) if (typeof w === 'string' && w && !genannt('resist', w)) defenses.resist.push({ word: w, source: q.entity.id, via: 'hasAncestry' });
  }
  const ABWEHR: Record<string, keyof Defenses> = { resist: 'resist', immune: 'immune', vulnerable: 'vulnerable', conditionImmune: 'conditionImmune' };
  for (const { effect, source, via } of effekte) {
    const k = ABWEHR[effect.target];
    if (!k || effect.op !== 'grant' || effect.value === undefined || effect.value === '') continue;
    const w = String(effect.value);
    if (!genannt(k, w)) defenses[k].push({ word: w, source, via: wegVon(via) });
  }

  /* ---- Kritischer Treffer: 20, oder die kleinste Schwelle einer Wirkung. */
  const kritTeile: StatPart[] = [{ kind: 'base', value: 20 }];
  let krit = 20;
  for (const { effect, source, via } of effekte) {
    const n = zahl(effect.value);
    if (effect.target !== 'critThreshold' || effect.op !== 'set' || n === null) continue;
    kritTeile.push({ kind: 'crit', value: n, source, via: wegVon(via) });
    krit = Math.min(krit, Math.max(2, n));
  }
  const critThreshold: StatValue = { key: 'critThreshold', label: 'Critical hit', value: krit, text: krit >= 20 ? '20' : `${krit}–20`, parts: kritTeile };

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
    if (acWert !== null && (acFest !== null || ruestung || schild || acW.add.length || acW.set.length)) neu['ac'] = acWert;
    if (tempoEnd) neu['speed'] = tempoEnd;
    if (sinneEnd) neu['senses'] = sinneEnd;
    /* Die Abwehr als Satz, wie das Buch sie schreibt: was dasteht, dann was dazukommt. */
    const abwehrSatz = (k: keyof Defenses) => defenses[k].map((d) => d.word).join(', ');
    if (defenses.resist.length) neu['resistances'] = abwehrSatz('resist');
    if (defenses.immune.length) neu['immunities'] = abwehrSatz('immune');
    if (defenses.vulnerable.length) neu['vulnerabilities'] = abwehrSatz('vulnerable');
    /* Das Zauberwirken aus den Klassen (T-309), wo der Statblock nichts festlegt. */
    const zw = spellcastingOf(character, statblock, byId);
    if (zw.ability && !(typeof sb['spellAbility'] === 'string' && sb['spellAbility'])) neu['spellAbility'] = zw.ability;
    if (zw.slots.some((n) => n > 0) && !(Array.isArray(sb['spellSlots']) && sb['spellSlots'].length)) neu['spellSlots'] = zw.slots;
    if (zw.casterLevel > 0 && zahl(sb['casterLevel']) === null) neu['casterLevel'] = zw.casterLevel;
    gelesen = { ...statblock, components: { ...statblock.components, Statblock: neu, Abilities: abil, Proficiencies: pr } };
  }

  return { abilities, prof, ac, hp, initiative, speed, senses, critThreshold, defenses, effects: effekte, totals, statblock: gelesen };
}

/**
 * **Die Abwehr und der kritische Treffer als Zeilen** (T-275) — für die
 * Aufschlüsselung (T-272): je Wort ein Teil mit seiner Quelle. Leer, was
 * nichts sagt (keine Resistenz, Krit erst bei 20).
 */
export function extraStatRows(st: CharacterStats): StatValue[] {
  const zeilen: StatValue[] = [];
  const LABEL: Record<keyof Defenses, string> = {
    resist: 'Resistances',
    immune: 'Immunities',
    vulnerable: 'Vulnerabilities',
    conditionImmune: 'Condition immunities',
  };
  for (const k of Object.keys(LABEL) as (keyof Defenses)[]) {
    const w = st.defenses[k];
    if (!w.length) continue;
    zeilen.push({
      key: k,
      label: LABEL[k],
      value: null,
      text: w.map((d) => d.word).join(', '),
      parts: w.map((d) => ({ kind: 'grant', value: d.word, ...(d.source ? { source: d.source } : {}), via: d.via })),
    });
  }
  if (st.critThreshold.value !== null && st.critThreshold.value < 20) zeilen.push(st.critThreshold);
  return zeilen;
}

/** Der Statblock einer Kreatur (`belongsTo`), oder sie selbst, wenn sie einer ist. */
export function statblockOfCreature(creature: Entity, byId: ReadonlyMap<EntityId, Entity>): Entity | undefined {
  if (primaryInterface(creature) === 'Statblock') return creature;
  for (const o of byId.values()) {
    if (primaryInterface(o) === 'Statblock' && (o.relations ?? []).some((r) => r.type === 'belongsTo' && r.to === creature.id)) return o;
  }
  return undefined;
}

/**
 * **Die Werte einer Kreatur am Tisch** (T-275): ihr Statblock, aufgelöst,
 * und `characterStats` darüber — mit Rüstung, Wirkungen und Zuständen. Eine
 * Rechnung für Initiative, Zugplan und Schaden; der Bogen fragt dieselbe.
 * `byId` darf roh sein: gelesen wird aufgelöst (`resolvedLookup`).
 */
export function creatureStats(creature: Entity, byId: ReadonlyMap<EntityId, Entity>, options: CharacterStatsOptions = {}): CharacterStats {
  const alle = resolvedLookup(byId);
  const sb = statblockOfCreature(creature, byId);
  return characterStats(alle.get(creature.id) ?? creature, sb ? alle.get(sb.id) : undefined, alle, options);
}

/** Ein Teil als kurzer Text, ohne den Namen seines Artikels: „+1", „set to 19", „3 × d12: 25". */
export function statPartText(p: StatPart): string {
  switch (p.kind) {
    case 'base':
      return typeof p.value === 'number' ? String(p.value) : p.value;
    case 'set':
      return `at least ${p.value}`;
    case 'limit':
      return `at most ${p.value}`;
    case 'crit':
      return `${p.value}–20`;
    case 'grant':
      return String(p.value);
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
