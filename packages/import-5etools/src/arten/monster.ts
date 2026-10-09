/**
 * **Statblöcke** (Abgleich §4.2, Schritt 11; M5): Monster und Objekte.
 *
 * Ein Monster aus dem Buch ist bei uns der Zahlenblock, aus dem Figuren
 * ihre Instanzen lesen (D82). Seine Aktionen und Merkmale sind eigene
 * `Action`- und `Feature`-Artikel über `composedOf` (Arbeitsplan §2.5):
 * dieselbe Aktionsart, dieselben Angriffsfelder, mit denen die Initiative
 * rechnen kann statt Text zu lesen.
 *
 * **Gleichlautende Merkmale gibt es einmal.** „Pack Tactics" steht bei
 * fünfzig Monstern und sagt jedes Mal dasselbe, nur mit einem anderen
 * Namen darin („The wolf has advantage …"). Der Importer schreibt den
 * Namen als `{CREATURE}` und legt die Bindung an die Kante
 * (`composedOf.props.vars`) — die Vorlage bleibt die Vorlage (REQ-174).
 */

import type { Entity } from '@nw/model';
import type { Knoten } from '../copy.js';
import { profAusCr } from '../copy.js';
import { inline, OHNE, zauberwirken } from '../text.js';
import type { Werkbank } from '../werkbank.js';
import type { Zuordnung } from '../zuordnung.js';
import { ATTRIBUTE, gesinnung, GROESSE, liste, zahl } from '../zuordnung.js';
import { aktionsart, fertigkeit } from './regeln.js';

const ATTR_VON_SKILL: Record<string, string> = {
  acrobatics: 'dex', 'animal handling': 'wis', arcana: 'int', athletics: 'str', deception: 'cha',
  history: 'int', insight: 'wis', intimidation: 'cha', investigation: 'int', medicine: 'wis',
  nature: 'int', perception: 'wis', performance: 'cha', persuasion: 'cha', religion: 'int',
  'sleight of hand': 'dex', stealth: 'dex', survival: 'wis',
};

const ANGRIFF: Record<string, string[]> = {
  mw: ['melee weapon'], rw: ['ranged weapon'], ms: ['melee spell'], rs: ['ranged spell'],
  'mw,rw': ['melee weapon', 'ranged weapon'], 'ms,rs': ['melee spell', 'ranged spell'],
};

/* Die Abschnitte eines Statblocks und ihre Aktionsart. `trait` ist ein
   Merkmal, alles andere eine Aktion. */
const ABSCHNITTE: [string, string | undefined][] = [
  ['trait', undefined],
  ['action', 'action'],
  ['bonus', 'bonus'],
  ['reaction', 'reaction'],
  ['legendary', 'legendary'],
  ['mythic', 'mythic'],
];

const mod = (wert: number) => Math.floor((wert - 10) / 2);

/** `{"walk": 30, "fly": {"number": 60, "condition": "(hover)"}}` → „30 ft., fly 60 ft. (hover)". */
export function tempo(roh: unknown): string {
  if (typeof roh === 'number') return `${roh} ft.`;
  if (!roh || typeof roh !== 'object') return '';
  const teile: string[] = [];
  for (const art of ['walk', 'burrow', 'climb', 'fly', 'swim']) {
    const v = (roh as Knoten)[art];
    if (v === undefined) continue;
    const zahlTeil = typeof v === 'object' && v ? `${String((v as Knoten)['number'])} ft.${(v as Knoten)['condition'] ? ` ${inline(String((v as Knoten)['condition']), OHNE)}` : ''}` : v === true ? 'equal to walking speed' : `${String(v)} ft.`;
    teile.push(art === 'walk' ? zahlTeil : `${art} ${zahlTeil}`);
  }
  const alt = (roh as Knoten)['alternate'];
  if (alt) teile.push('(alternate forms)');
  return teile.join(', ');
}

/** Resistenzen und Immunitäten als Satz, mit Bedingungen. */
function schadenSatz(wb: Werkbank, roh: unknown, feld: string): string {
  return liste(roh)
    .map((x) => {
      if (typeof x === 'string') return x;
      const o = x as Knoten;
      if (o['special']) return wb.zeile(String(o['special']));
      const innen = schadenSatz(wb, o[feld], feld);
      return [o['preNote'] ? wb.zeile(String(o['preNote'])) : '', innen, o['note'] ? wb.zeile(String(o['note'])) : ''].filter(Boolean).join(' ');
    })
    .join('; ');
}

/** Name einer Aktion ohne Marken und ohne Aufladung; die Aufladung als Wert. */
function aktionsname(roh: string): { name: string; recharge?: string; uses?: string } {
  let recharge: string | undefined;
  const r = /\{@recharge ?(\d?)\}/.exec(roh);
  if (r) recharge = r[1] ? (r[1] === '6' ? '6' : `${r[1]}–6`) : '6';
  const ohne = roh.replace(/\s*\{@recharge ?\d?\}/, '');
  const name = inline(ohne, OHNE).replace(/\*+/g, '').trim();
  const u = /\((\d+\/(?:Day|Turn|Short Rest|Long Rest|Rest)(?: each)?)\)/i.exec(name);
  return { name, recharge, uses: u?.[1] };
}

/** Die Felder einer Angriffsaktion aus ihrem ersten Satz. */
function angriff(wb: Werkbank, ent: Entity, entries: unknown): void {
  const roh = JSON.stringify(entries ?? '');
  const atk = /\{@atkr? ([a-z,]+)\}/.exec(roh);
  if (!atk) return;
  const A = 'Action';
  const art = ANGRIFF[atk[1]!] ?? (atk[1] === 'm' ? ['melee weapon'] : atk[1] === 'r' ? ['ranged weapon'] : undefined);
  wb.feld(ent, A, 'attack', art);
  const hit = /\{@hit ([+-]?\d+)/.exec(roh);
  if (hit) wb.feld(ent, A, 'toHit', Number(hit[1]));
  const reach = /reach (\d+) ft/.exec(roh);
  if (reach) wb.feld(ent, A, 'reach', Number(reach[1]));
  const range = /range (\d+(?:\/\d+)?) ft/.exec(roh);
  if (range) wb.feld(ent, A, 'range', range[1]);
  const dmg = /\{@damage ([^}|]+)\}\)?\s+(\w+) damage/.exec(roh);
  if (dmg) {
    wb.feld(ent, A, 'damage', dmg[1]!.trim());
    const typ = dmg[2]!.toLowerCase();
    if (['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder'].includes(typ)) {
      wb.feld(ent, A, 'damageType', typ);
    }
  }
}

/** Ersetzt den Namen des Monsters im Text durch `{CREATURE}`. */
function platzhalter(text: string, namen: string[]): string {
  let out = text;
  for (const n of namen.filter((x) => x.length > 2).sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`\\b([Tt]he) ${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    out = out.replace(re, '$1 {CREATURE}');
  }
  return out;
}

/**
 * Ein Merkmal oder eine Aktion des Statblocks — neu oder, wenn derselbe
 * Text unter demselben Namen schon steht, derselbe Artikel noch einmal.
 */
function teil(
  wb: Werkbank,
  sb: Entity,
  e: Knoten,
  roh: Knoten,
  wort: string | undefined,
  namen: string[],
  geteilt: Map<string, Entity>,
): void {
  const typ = wort ? 'Action' : 'Feature';
  const { name, recharge, uses } = aktionsname(String(roh['name'] ?? (wort ? 'Action' : 'Trait')));
  const text = platzhalter(wb.text(roh['entries'] ?? roh['entry'], 5), namen);
  const benutzt = text.includes('{CREATURE}');
  const schluessel = `${typ}|${wort ?? ''}|${name}|${text}`;
  let ziel = geteilt.get(schluessel);
  if (ziel) {
    wb.bericht.geteilt.verwendungen += 1;
    /* Steht derselbe Text in einem SRD-Monster, ist er SRD-Text. */
    if (e['srd'] || e['srd52']) wb.karte(ziel, 'Source')['srd'] = true;
    if (!wb.geteiltGezaehlt.has(ziel.id)) {
      wb.bericht.geteilt.merkmale += 1;
      wb.geteiltGezaehlt.add(ziel.id);
    }
  } else {
    ziel = wb.anlegen(typ, name, `${typ}|${wort ?? ''}|${name}|${text}`, e);
    if (wort) {
      wb.feld(ziel, 'Action', 'actionType', aktionsart(wb, wort).id);
      wb.feld(ziel, 'Action', 'recharge', recharge);
      wb.feld(ziel, 'Action', 'uses', uses);
      angriff(wb, ziel, roh['entries']);
    } else wb.feld(ziel, 'Feature', 'featureType', 'monster');
    wb.prosa(ziel, text);
    if (benutzt) wb.feld(ziel, 'Vars', 'bindings', { CREATURE: 'creature' });
    geteilt.set(schluessel, ziel);
  }
  const vars: Record<string, string> = {};
  if (benutzt) vars['CREATURE'] = namen[0] ?? sb.name.toLowerCase();
  wb.kante(sb, 'composedOf', ziel.id, Object.keys(vars).length ? { vars } : undefined);
}

/** Zauberwirken: Felder am Statblock, `casts` je Zauber, der Text als Merkmal. */
function zauber(wb: Werkbank, sb: Entity, e: Knoten, namen: string[]): void {
  const S = 'Statblock';
  for (const [i, sc] of (liste(e['spellcasting']) as Knoten[]).entries()) {
    if (i === 0) {
      if (sc['ability']) wb.feld(sb, S, 'spellAbility', sc['ability']);
      const kopf = JSON.stringify(sc['headerEntries'] ?? '');
      const stufe = /(\d+)(?:st|nd|rd|th)-level spellcaster/.exec(kopf);
      if (stufe) wb.feld(sb, S, 'casterLevel', Math.min(20, Number(stufe[1])));
      const grade = (sc['spells'] as Record<string, Knoten> | undefined) ?? {};
      const plaetze: number[] = [];
      for (let g = 1; g <= 9; g++) plaetze.push(Number(grade[String(g)]?.['slots'] ?? 0));
      while (plaetze.length && plaetze[plaetze.length - 1] === 0) plaetze.pop();
      wb.feld(sb, S, 'spellSlots', plaetze);
    }
    const angeboren = /innate/i.test(String(sc['name'] ?? ''));
    const kante = (s: unknown, props: Record<string, unknown>) => {
      if (typeof s !== 'string') return;
      const m = /\{@spell ([^}]*)\}/.exec(s);
      if (!m) return;
      const [n = '', q = ''] = m[1]!.split('|');
      const ziel = wb.finde('spell', [n, q]);
      if (ziel) wb.kante(sb, 'casts', ziel.id, { mode: angeboren ? 'innate' : 'prepared', ...props });
      else wb.ctx.insLeere('spell', `${n}|${q}`);
    };
    for (const s of liste(sc['will'])) kante(s, { uses: 'at will' });
    for (const s of liste(sc['constant'])) kante(s, { uses: 'constant' });
    for (const feld of ['daily', 'rest', 'restLong', 'weekly', 'monthly', 'yearly'] as const) {
      const wort: Record<string, string> = { daily: 'day', rest: 'rest', restLong: 'long rest', weekly: 'week', monthly: 'month', yearly: 'year' };
      for (const [k, v] of Object.entries((sc[feld] as Knoten | undefined) ?? {})) {
        for (const s of liste(v)) kante(s, { uses: `${k.replace(/e$/, '')}/${wort[feld]}` });
      }
    }
    for (const [g, gr] of Object.entries((sc['spells'] as Record<string, Knoten> | undefined) ?? {})) {
      for (const s of liste(gr['spells'])) kante(s, { level: Number(g) });
    }
    /* Der Text bleibt als Merkmal: er sagt, was die Felder nicht sagen
       (Fussnoten, „bevor der Kampf beginnt …"). Gezählt wird er nicht als
       geteilt — zwei Magier mit derselben Liste sind selten. */
    const f = wb.anlegen('Feature', aktionsname(String(sc['name'] ?? 'Spellcasting')).name, `spellcasting|${sb.id}|${i}`, e);
    wb.feld(f, 'Feature', 'featureType', 'spellcasting');
    const text = platzhalter(zauberwirken(sc, wb.ctx), namen);
    wb.prosa(f, text);
    if (text.includes('{CREATURE}')) {
      wb.feld(f, 'Vars', 'bindings', { CREATURE: 'creature' });
      wb.kante(sb, 'composedOf', f.id, { vars: { CREATURE: namen[0] ?? sb.name.toLowerCase() } });
    } else wb.kante(sb, 'composedOf', f.id);
  }
}

/** Die Abschnitte eines Statblocks über `composedOf`, in der Reihenfolge des Buchs. */
function abschnitte(wb: Werkbank, sb: Entity, e: Knoten, namen: string[], geteilt: Map<string, Entity>): void {
  for (const [feld, wort] of ABSCHNITTE) {
    /* Das Zauberwirken steht bei 5e.tools zwischen den Merkmalen und den
       Aktionen, und dort steht es auch hier. */
    if (feld === 'action') zauber(wb, sb, e, namen);
    for (const roh of liste(e[feld])) {
      if (!roh || typeof roh !== 'object') continue;
      teil(wb, sb, e, roh as Knoten, wort, namen, geteilt);
    }
  }
  /* Was vor einem Abschnitt steht („The dragon can take 3 legendary
     actions …"), gehört zum Abschnitt und nicht zu einer Aktion. Die Zahl
     ist ein Feld; der Satz bleibt am Statblock. */
  const kopf: string[] = [];
  for (const k of ['actionHeader', 'bonusHeader', 'reactionHeader', 'legendaryHeader', 'mythicHeader']) {
    if (e[k]) kopf.push(platzhalter(wb.text(e[k], 5), namen).replace(/\{CREATURE\}/g, namen[0] ?? 'creature'));
  }
  if (kopf.length) wb.prosa(sb, kopf.join('\n\n'));
}

const GENUTZT_MONSTER = [
  'name', 'shortName', 'size', 'type', 'alignment', 'alignmentPrefix', 'ac', 'hp', 'speed', 'str', 'dex', 'con', 'int', 'wis',
  'cha', 'save', 'skill', 'senses', 'passive', 'languages', 'cr', 'pbNote', 'trait', 'action', 'bonus',
  'reaction', 'legendary', 'mythic', 'legendaryHeader', 'mythicHeader', 'actionHeader',
  'bonusHeader', 'reactionHeader', 'legendaryActions', 'legendaryActionsLair', 'spellcasting',
  'environment', 'attachedItems', 'resist', 'immune', 'vulnerable', 'conditionImmune',
  'legendaryGroup', 'variant', 'isNpc', 'isNamedCreature', 'familiar', 'dragonCastingColor',
  'dragonAge', 'group', 'level', 'entries', 'initiative', 'gear', 'treasure',
];

/** Monster und Objekte als Statblock. */
function statblock(wb: Werkbank, sb: Entity, e: Knoten): void {
  const S = 'Statblock';
  wb.feld(sb, S, 'size', GROESSE[String(liste(e['size'])[0] ?? '')]);
  const typ = e['type'];
  if (typeof typ === 'string') wb.feld(sb, S, 'creatureType', typ);
  else if (typ && typeof typ === 'object') {
    const t = typ as Knoten;
    const art = typeof t['type'] === 'object' ? liste((t['type'] as Knoten)['choose']).join(' or ') : String(t['type'] ?? '');
    const marken = liste(t['tags']).map((x) => (typeof x === 'string' ? x : String((x as Knoten)['tag'] ?? '')));
    wb.feld(sb, S, 'creatureType', `${t['swarmSize'] ? `swarm of ${GROESSE[String(t['swarmSize'])] ?? ''} ${art}s` : art}${marken.length ? ` (${marken.join(', ')})` : ''}`);
    wb.marke(sb, ...marken);
  }
  wb.feld(sb, S, 'alignment', [e['alignmentPrefix'] ? String(e['alignmentPrefix']) : '', gesinnung(e['alignment'])].join('').trim());

  const ac = liste(e['ac']);
  const erste = ac[0];
  const acZahl = typeof erste === 'number' ? erste : zahl((erste as Knoten | undefined)?.['ac']);
  wb.feld(sb, S, 'ac', acZahl);
  const noten = ac
    .map((a, i) => {
      if (typeof a === 'number') return i === 0 ? '' : String(a);
      const o = a as Knoten;
      if (o['special']) return wb.zeile(String(o['special']));
      const von = liste(o['from']).map((x) => wb.zeile(x)).join(', ');
      const bed = o['condition'] ? wb.zeile(String(o['condition'])) : '';
      return i === 0 ? [von, bed].filter(Boolean).join(' ') : `${String(o['ac'])} ${[von, bed].filter(Boolean).join(' ')}`.trim();
    })
    .filter(Boolean);
  wb.feld(sb, S, 'acNote', noten.join('; '));

  const hp = (e['hp'] as Knoten | undefined) ?? {};
  if (typeof e['hp'] === 'number') wb.feld(sb, S, 'hp', e['hp']);
  wb.feld(sb, S, 'hp', zahl(hp['average']));
  wb.feld(sb, S, 'hpFormula', hp['formula'] ?? (hp['special'] ? wb.zeile(String(hp['special'])) : undefined));
  wb.feld(sb, S, 'speed', tempo(e['speed']));

  const cr = e['cr'];
  const crText = typeof cr === 'object' && cr ? String((cr as Knoten)['cr']) : cr !== undefined ? String(cr) : undefined;
  wb.feld(sb, S, 'cr', crText);
  const prof = profAusCr(cr);
  if (crText !== undefined) wb.feld(sb, S, 'prof', prof);

  wb.feld(sb, S, 'senses', liste(e['senses']).map((s) => wb.zeile(s)).join(', '));
  wb.feld(sb, S, 'resistances', schadenSatz(wb, e['resist'], 'resist'));
  wb.feld(sb, S, 'immunities', schadenSatz(wb, e['immune'], 'immune'));
  wb.feld(sb, S, 'vulnerabilities', schadenSatz(wb, e['vulnerable'], 'vulnerable'));
  const zustaende: string[] = [];
  const zustandNoten: string[] = [];
  for (const c of liste(e['conditionImmune'])) {
    if (typeof c === 'string') zustaende.push(wb.finde('condition', [c])?.name ?? c.replace(/^./, (x) => x.toUpperCase()));
    else {
      const o = c as Knoten;
      for (const x of liste(o['conditionImmune'])) zustaende.push(wb.finde('condition', [String(x)])?.name ?? String(x));
      if (o['note']) zustandNoten.push(wb.zeile(String(o['note'])));
    }
  }
  wb.feld(sb, S, 'conditionImmunities', [...new Set(zustaende)]);
  if (zustandNoten.length) wb.notiz('Zustandsimmunität mit Bedingung (Bedingung entfällt)');
  wb.feld(sb, S, 'legendaryActions', zahl(e['legendaryActions']) ?? (e['legendary'] ? 3 : undefined));

  /* Werte, Rettungswürfe, Fertigkeiten. Was nicht aus Übung und
     Übungsbonus folgt, steht als fester Bonus (S1). */
  const A = 'Abilities';
  for (const a of ATTRIBUTE) wb.feld(sb, A, a, zahl(e[a]));
  const geuebt: string[] = [];
  const experte: string[] = [];
  const boni: Record<string, number> = {};
  const saves: string[] = [];
  for (const [a, b] of Object.entries((e['save'] as Knoten | undefined) ?? {})) {
    if (!ATTRIBUTE.includes(a as (typeof ATTRIBUTE)[number])) continue;
    saves.push(a);
    const bonus = zahl(b);
    if (bonus !== undefined && bonus !== mod(Number(e[a] ?? 10)) + prof) boni[a] = bonus;
  }
  for (const [k, b] of Object.entries((e['skill'] as Knoten | undefined) ?? {})) {
    if (k === 'other') continue;
    const name = wb.finde('skill', [k])?.name ?? fertigkeit(k);
    const bonus = zahl(b);
    const basis = mod(Number(e[ATTR_VON_SKILL[k] ?? 'dex'] ?? 10));
    if (bonus === basis + 2 * prof) experte.push(name);
    else {
      geuebt.push(name);
      if (bonus !== undefined && bonus !== basis + prof) boni[name] = bonus;
    }
  }
  const sprachen: string[] = [];
  const sprachNoten: string[] = [];
  for (const l of liste(e['languages'])) {
    const s = String(l);
    const treffer = wb.finde('language', [s]);
    if (treffer) sprachen.push(treffer.name);
    else sprachNoten.push(wb.zeile(s));
  }
  wb.feld(sb, 'Proficiencies', 'proficient', [...geuebt, ...sprachen]);
  wb.feld(sb, 'Proficiencies', 'expertise', experte);
  wb.feld(sb, 'Proficiencies', 'saves', saves);
  if (Object.keys(boni).length) wb.feld(sb, S, 'bonuses', boni);
  wb.feld(sb, S, 'languageNote', sprachNoten.join(', '));

  for (const u of liste(e['environment'])) wb.marke(sb, String(u));
  for (const g of liste(e['attachedItems'])) {
    const [n = '', q = ''] = String(g).split('|');
    const ziel = wb.finde('item', [n, q]);
    if (ziel) wb.kante(sb, 'equips', ziel.id);
    else wb.ctx.insLeere('item', String(g));
  }
}

/** Die Namen, unter denen ein Monster in seinem eigenen Text steht. */
function selbstnamen(e: Knoten): string[] {
  const namen = [String(e['name']).toLowerCase()];
  if (typeof e['shortName'] === 'string') namen.push(e['shortName'].toLowerCase());
  else if (e['shortName'] === true || e['isNamedCreature']) namen.push(String(e['name']).toLowerCase());
  return [...new Set(namen)];
}

export const MONSTER: Zuordnung[] = [
  {
    art: 'monster',
    tag: 'creature',
    typ: () => 'Statblock',
    name: (e) => String(e['name']),
    genutzt: GENUTZT_MONSTER,
    fuellen(wb, sb, e) {
      const geteilt = wb.geteilt;
      statblock(wb, sb, e);
      const namen = selbstnamen(e);
      abschnitte(wb, sb, e, namen, geteilt);
      /* Spielarten („Variant: Familiars") bleiben Text am Statblock. */
      if (e['variant']) wb.prosa(sb, wb.text(e['variant'], 4));
      if (e['entries']) wb.prosa(sb, wb.text(e['entries'], 4));
      const lg = e['legendaryGroup'] as Knoten | undefined;
      if (lg) {
        const gruppe = wb.hole('legroup', lg['name'], lg['source']);
        const teile = gruppe ? wb.legendaer.get(gruppe.id) : undefined;
        if (teile) for (const t of teile) wb.kante(sb, 'composedOf', t.id);
        else wb.ctx.insLeere('legroup', `${String(lg['name'])}|${String(lg['source'])}`);
      }
      const f = wb.fluff('monsterFluff', String(e['name']), String(e['source']));
      if (f) wb.lore(sb, wb.text(f['entries']));
      if (e['_versions']) wb.notiz('Spielarten (_versions) nicht ausgeschrieben');
    },
  },
  {
    art: 'object',
    tag: 'object',
    typ: () => 'Statblock',
    name: (e) => String(e['name']),
    genutzt: [...GENUTZT_MONSTER, 'objectType', 'actionEntries'],
    fuellen(wb, sb, e) {
      statblock(wb, sb, e);
      const OBJ: Record<string, string> = { SW: 'siege weapon', GEN: 'object', U: 'unknown' };
      wb.feld(sb, 'Statblock', 'creatureType', OBJ[String(e['objectType'])] ?? 'object');
      wb.prosa(sb, wb.text(e['entries']));
      for (const a of liste(e['actionEntries'])) {
        if (a && typeof a === 'object') teil(wb, sb, e, a as Knoten, 'action', [String(e['name']).toLowerCase()], wb.geteilt);
      }
    },
  },
];

/**
 * Legendäre Gruppen: Hortaktionen und Regionaleffekte eines Drachen, die
 * sich alle Altersstufen teilen. Je Gruppe eine `Action` (Lair Action) und
 * ein `Feature` (regional); die Statblöcke zeigen über `composedOf` darauf.
 */
export const LEGENDAER: Zuordnung = {
  art: 'legendaryGroup',
  tag: 'legroup',
  typ: () => 'Rule',
  name: (e) => `${String(e['name'])} (legendary group)`,
  schluessel: (e) => [[e['name'], e['source']]],
  genutzt: ['name', 'lairActions', 'regionalEffects', 'mythicEncounter', '_versions'],
  fuellen(wb, ent, e) {
    wb.feld(ent, 'Rule', 'kind', 'rule');
    wb.marke(ent, 'legendary group');
    const teile: Entity[] = [];
    const neu = (typ: string, name: string, roh: unknown, wort?: string) => {
      const x = wb.anlegen(typ, name, `legroup|${ent.id}|${name}`, e);
      if (wort) wb.feld(x, 'Action', 'actionType', aktionsart(wb, wort).id);
      else wb.feld(x, 'Feature', 'featureType', 'regional');
      wb.prosa(x, wb.text(roh, 5));
      teile.push(x);
    };
    if (e['lairActions']) neu('Action', `Lair Actions (${String(e['name'])})`, e['lairActions'], 'lair');
    if (e['regionalEffects']) neu('Feature', `Regional Effects (${String(e['name'])})`, e['regionalEffects']);
    if (e['mythicEncounter']) neu('Feature', `Mythic Encounter (${String(e['name'])})`, e['mythicEncounter']);
    wb.legendaer.set(ent.id, teile);
    wb.prosa(ent, teile.map((t) => `- [[${wb.nummer(t)}|${t.name}]]`).join('\n'));
  },
};
