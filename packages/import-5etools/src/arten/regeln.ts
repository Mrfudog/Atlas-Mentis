/**
 * **Regeln** (Abgleich §4.2, Schritt 5 und 6): Aktionsarten, Zustände,
 * Status, Krankheiten, Sinne, Aktionen, Waffeneigenschaften,
 * Variantregeln, Belohnungen, Gaben, Fertigkeiten, Sprachen.
 *
 * Die Wirkungen zwischen Zuständen (`affects`) legt der Importer **nicht**
 * an (Arbeitsplan §2.4): dass ein Zustand im Text einen anderen nennt,
 * heisst nicht, dass er ihn bewirkt.
 */

import type { Entity } from '@nw/model';
import type { Knoten } from '../copy.js';
import type { Werkbank } from '../werkbank.js';
import type { Zuordnung } from '../zuordnung.js';
import { beiwort, signaturZauber } from './welt.js';
import { ATTRIBUTE, GROESSE, liste, titel } from '../zuordnung.js';

/**
 * Die Aktionsarten. 5e.tools führt sie nicht als Einträge — sie stehen als
 * Wort an der Wirkzeit eines Zaubers und als Abschnitt eines Statblocks.
 * Bei uns sind sie Artikel, auf die `Action.actionType` zeigt (D48).
 */
export const AKTIONSARTEN: { wort: string; name: string; per?: string; count?: number; text: string }[] = [
  { wort: 'action', name: 'Action', per: 'turn', count: 1, text: 'On your turn, you can take one action.' },
  { wort: 'bonus', name: 'Bonus Action', per: 'turn', count: 1, text: 'You can take a bonus action only when a special ability, spell, or other feature states that you can do something as a bonus action.' },
  { wort: 'reaction', name: 'Reaction', per: 'round', count: 1, text: 'A reaction is an instant response to a trigger of some kind. You can take one reaction per round; when you take it, you can\'t take another until the start of your next turn.' },
  { wort: 'free', name: 'Free Object Interaction', per: 'turn', count: 1, text: 'You can interact with one object or feature of the environment for free, during either your move or your action.' },
  { wort: 'legendary', name: 'Legendary Action', text: 'A legendary creature can take a number of special actions outside its turn, one at a time and only at the end of another creature\'s turn. It regains spent legendary actions at the start of its turn.' },
  { wort: 'mythic', name: 'Mythic Action', text: 'A mythic action is taken like a legendary action, once the creature\'s mythic trait has been triggered.' },
  { wort: 'lair', name: 'Lair Action', per: 'round', count: 1, text: 'On initiative count 20 (losing initiative ties), a creature in its lair can take a lair action.' },
];

export function legeAktionsartenAn(wb: Werkbank): void {
  for (const a of AKTIONSARTEN) {
    const e = wb.anlegen('ActionType', a.name, `actionType|${a.wort}`);
    e.components['Source'] = { srd: true };
    wb.feld(e, 'ActionType', 'per', a.per);
    wb.feld(e, 'ActionType', 'count', a.count);
    wb.prosa(e, a.text);
    wb.marke(e, 'importer');
    wb.merke(e, 'actionType', a.wort);
  }
}

/** Die Aktionsart zu einem Wort aus 5e.tools (`action`, `bonus`, `reaction` …). */
export function aktionsart(wb: Werkbank, wort: string): Entity {
  return wb.hole('actionType', wort) ?? wb.hole('actionType', 'action')!;
}

const regel = (art: string, tag: string, typ: string, extra: Partial<Zuordnung> = {}): Zuordnung => ({
  art,
  tag,
  typ: () => typ,
  name: (e) => String(e['name']),
  genutzt: ['name', 'entries'],
  fuellen(wb, ent, e) {
    wb.prosa(ent, wb.text(e['entries']));
  },
  ...extra,
});

/** Erschöpfung als Grundzustand und sechs Stufen (Arbeitsplan §2.3). */
function erschoepfung(wb: Werkbank, ent: Entity, e: Knoten): void {
  wb.feld(ent, 'Condition', 'recovery', 'longRestStep');
  const tab = findeTabelle(e['entries']);
  if (!tab) {
    wb.notiz('Erschöpfung ohne Stufentabelle');
    return;
  }
  for (const zeile of liste(tab['rows'])) {
    const zellen = liste(Array.isArray(zeile) ? zeile : (zeile as Knoten)['row']);
    const stufe = Number(String(zellen[0] ?? '').trim());
    if (!Number.isInteger(stufe) || stufe < 1) continue;
    const s = wb.anlegen('Condition', `${ent.name} ${stufe}`, `condition|${ent.name}|${stufe}|${String(e['source'])}`, e);
    wb.feld(s, 'Condition', 'stage', stufe);
    wb.feld(s, 'Condition', 'kind', 'condition');
    wb.feld(s, 'Condition', 'recovery', 'longRestStep');
    wb.prosa(s, wb.zeile(String(zellen[1] ?? '')));
    wb.kante(s, 'stageOf', ent.id);
    wb.merke(s, 'condition', s.name, String(e['source']));
  }
}

function findeTabelle(x: unknown): Knoten | undefined {
  if (Array.isArray(x)) {
    for (const y of x) {
      const t = findeTabelle(y);
      if (t) return t;
    }
  } else if (x && typeof x === 'object') {
    const o = x as Knoten;
    if (o['type'] === 'table') return o;
    return findeTabelle(o['entries']);
  }
  return undefined;
}

const ATTR_WORT: Record<string, string> = {
  Strength: 'str', Dexterity: 'dex', Constitution: 'con', Intelligence: 'int', Wisdom: 'wis', Charisma: 'cha',
};

/** Die Abkürzungen von 5e.tools, die eine Wirkung am Bogen haben (`ItemFeature.mechanics`, T-324). */
const WIRKUNG: Record<string, string> = { '2H': 'two-handed', V: 'versatile', L: 'light', F: 'finesse' };

export const REGELN: Zuordnung[] = [
  regel('condition', 'condition', 'Condition', {
    fuellen(wb, ent, e) {
      wb.feld(ent, 'Condition', 'kind', 'condition');
      wb.prosa(ent, wb.text(e['entries']));
      if (/^exhaustion$/i.test(String(e['name']))) erschoepfung(wb, ent, e);
    },
  }),
  regel('status', 'status', 'Condition', {
    fuellen(wb, ent, e) {
      wb.feld(ent, 'Condition', 'kind', 'status');
      wb.prosa(ent, wb.text(e['entries']));
    },
  }),
  regel('disease', 'disease', 'Disease', {
    fuellen(wb, ent, e) {
      const text = wb.text(e['entries']);
      wb.prosa(ent, text);
      /* Rettungswurf und SG stehen im Text; der erste genannte gilt — und
         nur ein **Rettungswurf**: „DC 15 Strength check" bei Spider Eggs
         ist das Befreien aus dem Kokon, nicht der Wurf gegen die Krankheit
         (T-089). */
      const roh = JSON.stringify(e['entries'] ?? '');
      const sg = /\{@dc (\d+)\}\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw/.exec(roh);
      if (sg) {
        wb.feld(ent, 'Disease', 'dc', Number(sg[1]));
        wb.feld(ent, 'Disease', 'save', ATTR_WORT[sg[2]!]);
      }
    },
  }),
  regel('sense', 'sense', 'Rule', {
    fuellen(wb, ent, e) {
      wb.feld(ent, 'Rule', 'kind', 'sense');
      wb.prosa(ent, wb.text(e['entries']));
    },
  }),
  regel('skill', 'skill', 'Skill', {
    genutzt: ['name', 'entries', 'ability'],
    fuellen(wb, ent, e) {
      wb.feld(ent, 'Skill', 'ability', e['ability']);
      wb.prosa(ent, wb.text(e['entries']));
    },
  }),
  regel('language', 'language', 'Language', {
    genutzt: ['name', 'entries', 'type', 'script', 'typicalSpeakers', 'dialects', 'origin'],
    fuellen(wb, ent, e) {
      const typ = String(e['type'] ?? '');
      wb.feld(ent, 'Language', 'languageType', ['standard', 'exotic', 'rare', 'secret'].includes(typ) ? typ : undefined);
      if (typ && !['standard', 'exotic', 'rare', 'secret'].includes(typ)) wb.notiz(`Sprachart ${typ}`);
      wb.feld(ent, 'Language', 'script', typeof e['script'] === 'string' ? e['script'] : undefined);
      wb.feld(ent, 'Language', 'typicalSpeakers', liste(e['typicalSpeakers']).map((s) => wb.zeile(s)).join(', '));
      const teile = [wb.text(e['entries'])];
      if (Array.isArray(e['dialects'])) teile.push(`**Dialects:** ${liste(e['dialects']).map((d) => wb.zeile(d)).join(', ')}`);
      if (e['origin']) teile.push(`**Origin:** ${wb.zeile(e['origin'])}`);
      wb.prosa(ent, teile.filter(Boolean).join('\n\n'));
    },
  }),
  regel('action', 'action', 'Action', {
    genutzt: ['name', 'entries', 'time', 'seeAlsoAction', 'fromVariant'],
    fuellen(wb, ent, e) {
      const zeit = liste(e['time'])[0];
      const einheit = typeof zeit === 'object' && zeit ? String((zeit as Knoten)['unit'] ?? 'action') : 'action';
      wb.feld(ent, 'Action', 'actionType', aktionsart(wb, einheit).id);
      const teile = [wb.text(e['entries'])];
      const siehe = liste(e['seeAlsoAction']).map((s) => wb.zeile(`{@action ${String(s)}}`));
      if (siehe.length) teile.push(`*See also:* ${siehe.join(', ')}`);
      wb.prosa(ent, teile.filter(Boolean).join('\n\n'));
    },
  }),
  {
    art: 'itemProperty',
    tag: 'itemProperty',
    typ: () => 'ItemProperty',
    name: (e) => String(e['name'] ?? (liste(e['entries'])[0] as Knoten | undefined)?.['name'] ?? e['abbreviation']),
    schluessel: (e) => [
      [String(e['abbreviation']), String(e['source'])],
      [String(e['name'] ?? (liste(e['entries'])[0] as Knoten | undefined)?.['name'] ?? e['abbreviation']), String(e['source'])],
    ],
    genutzt: ['name', 'abbreviation', 'entries', 'entriesTemplate', 'template'],
    fuellen(wb, ent, e) {
      wb.feld(ent, 'ItemProperty', 'abbreviation', e['abbreviation']);
      /* **Was sie am Bogen bewirkt** (T-324, E-163): aus der Abkürzung von
         5e.tools, damit der Bogen später die Daten fragt und nicht den
         Namen. Was keine der vier Wirkungen ist, bleibt leer. */
      wb.feld(ent, 'ItemFeature', 'mechanics', WIRKUNG[String(e['abbreviation'] ?? '').split('|')[0]!] ? [WIRKUNG[String(e['abbreviation']).split('|')[0]!]] : undefined);
      /* Der Eintrag ist ein benannter Block mit dem Namen der Eigenschaft;
         der Name steht schon als Überschrift des Artikels. */
      const erster = liste(e['entries'])[0] as Knoten | undefined;
      const rumpf = erster && typeof erster === 'object' && erster['name'] ? erster['entries'] : e['entries'];
      wb.prosa(ent, wb.text(rumpf));
    },
  },
  regel('variantrule', 'variantrule', 'Rule', {
    genutzt: ['name', 'entries', 'ruleType', 'type'],
    fuellen(wb, ent, e) {
      wb.feld(ent, 'Rule', 'kind', 'rule');
      const art: Record<string, string> = { C: 'core', O: 'optional', V: 'variant', VO: 'variant optional', VV: 'variant' };
      if (e['ruleType']) wb.marke(ent, art[String(e['ruleType'])] ?? String(e['ruleType']).toLowerCase());
      /* `type` ist hier die Darstellungsart des Eintrags (`section`,
         `entries`), keine Sorte Regel — als Marke sagte sie nichts (T-089). */
      if (typeof e['type'] === 'string' && !DARSTELLUNG.has(e['type'])) wb.marke(ent, e['type']);
      wb.prosa(ent, wb.text(e['entries']));
    },
  }),
  regel('reward', 'reward', 'Rule', {
    genutzt: ['name', 'entries', 'type', 'rarity', 'additionalSpells', 'ability', 'prerequisite'],
    fuellen(wb, ent, e) {
      wb.feld(ent, 'Rule', 'kind', 'reward');
      if (e['type']) wb.marke(ent, String(e['type']));
      const teile = [wb.text(e['entries'])];
      if (e['rarity']) wb.marke(ent, String(e['rarity']));
      wb.prosa(ent, teile.filter(Boolean).join('\n\n'));
    },
  }),
  regel('boon', 'boon', 'Rule', {
    genutzt: ['name', 'entries', 'type', 'abilityEntry', 'signatureSpells'],
    fuellen(wb, ent, e) {
      wb.feld(ent, 'Rule', 'kind', 'boon');
      if (e['type']) wb.marke(ent, String(e['type']));
      /* Attribute und Signaturzauber des Segens (T-084) — bis dahin unter
         falschem Schlüssel gesucht und nie gefunden. */
      const teile = [wb.text(e['entries'])];
      if (e['abilityEntry']) teile.push(`**Ability Score Adjustment:** ${wb.text(beiwort(e['abilityEntry']))}`);
      teile.push(signaturZauber(wb, ent, e['signatureSpells']));
      wb.prosa(ent, teile.filter(Boolean).join('\n\n'));
    },
  }),
  regel('charoption', 'charoption', 'Rule', {
    genutzt: ['name', 'entries', 'optionType', 'prerequisite'],
    fuellen(wb, ent, e) {
      wb.feld(ent, 'Rule', 'kind', 'option');
      for (const t of liste(e['optionType'])) wb.marke(ent, String(t));
      wb.prosa(ent, wb.text(e['entries']));
    },
  }),
  regel('monsterTemplate', 'monsterTemplate', 'Rule', {
    genutzt: ['name', 'entries', 'apply', 'ref'],
    fuellen(wb, ent, e) {
      /* Die Schablone als Regeltext; ihre Anwendung (`apply`) ist eine
         Handlung am Tisch, kein Artikel (Abgleich §2.1). */
      wb.feld(ent, 'Rule', 'kind', 'rule');
      wb.marke(ent, 'monster template');
      wb.prosa(ent, wb.text(e['entries']));
      /* Keine Schablone in 5e.tools hat `entries` — was sie tut, steht
         nur in `apply`. Ohne diese Zeilen waren alle 66 leer (T-089). */
      wb.prosa(ent, schablonenText(wb, e));
    },
  }),
];

/** Eintragsarten von 5e.tools, die an `type` stehen und keine Sorte sind. */
const DARSTELLUNG = new Set(['entries', 'section', 'inset', 'insetReadaloud', 'variant', 'variantInner']);

const GROESSE_NAME: Record<string, string> = { ...GROESSE, F: 'fine', D: 'diminutive', C: 'colossal' };

/** Platzhalter der Schablone: sie gilt für jedes Monster, also „die Kreatur". */
function ohnePlatzhalter(x: unknown): unknown {
  if (typeof x === 'string') {
    return x
      .replace(/<\$title_short_name\$>/g, 'The creature')
      .replace(/<\$short_name\$>/g, 'the creature')
      .replace(/<\$spell_dc__(\w+)\$>/g, (_, a: string) => `8 + PB + ${a.toUpperCase()}`)
      .replace(/<\$to_hit__(\w+)\$>/g, (_, a: string) => `PB + ${a.toUpperCase()}`)
      .replace(/<\$damage_mod__(\w+)\$>/g, (_, a: string) => a.toUpperCase())
      .replace(/<\$[a-z_]+\$>/g, 'the creature');
  }
  if (Array.isArray(x)) return x.map(ohnePlatzhalter);
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, ohnePlatzhalter(v)]));
  return x;
}

const MOD_TITEL: Record<string, string> = {
  languages: 'Languages', resist: 'Damage resistances', immune: 'Damage immunities',
  vulnerable: 'Damage vulnerabilities', conditionImmune: 'Condition immunities',
};
const ABSCHNITT: Record<string, string> = {
  trait: 'Traits', action: 'Actions', reaction: 'Reactions', bonus: 'Bonus actions', legendary: 'Legendary actions',
  spellcasting: 'Spellcasting', lairActions: 'Lair actions', variant: 'Variants',
};
const WERT_TITEL: Record<string, string> = { hp: 'Hit points', save: 'Saving throws', skill: 'Skills', _: 'XP' };

/**
 * **Was eine Monsterschablone ändert, als Text** (T-089): Voraussetzung,
 * Grösse, Art, Bewegung, Sinne, Sprachen, Resistenzen und die Merkmale und
 * Aktionen, die sie hinzufügt. Eine Änderung, die nur ein Statblock
 * ausrechnen kann (Treffer −2, halbe Trefferpunkte), steht als Satz da.
 */
export function schablonenText(wb: Werkbank, e: Knoten): string {
  const zeilen: string[] = [];
  const bloecke: string[] = [];
  const groesse = (s: unknown) => titel(GROESSE_NAME[String(s)] ?? String(s));
  if (typeof e['ref'] === 'string') zeilen.push(`**Applies:** ${wb.zeile(e['ref'])}`);
  const vor = e['prerequisite'] as Knoten | undefined;
  if (vor) {
    const teile: string[] = [];
    const g = vor['size'] as Knoten | undefined;
    if (g?.['max']) teile.push(`size ${groesse(g['max'])} or smaller`);
    const t = vor['type'] as Knoten | undefined;
    if (t?.['oneOf']) teile.push(liste(t['oneOf']).map(String).join(' or '));
    for (const a of ATTRIBUTE) {
      const w = vor[a] as Knoten | undefined;
      if (w?.['max'] !== undefined) teile.push(`${a.toUpperCase()} ${String(w['max'])} or lower`);
      if (w?.['min'] !== undefined) teile.push(`${a.toUpperCase()} ${String(w['min'])} or higher`);
    }
    if (teile.length) zeilen.push(`**Prerequisite:** ${teile.join('; ')}`);
  }
  if (e['crMin'] !== undefined) zeilen.push(`**Minimum challenge rating:** ${String(e['crMin'])}`);
  const apply = (e['apply'] as Knoten | undefined) ?? {};
  const wurzel = (apply['_root'] as Knoten | undefined) ?? {};
  if (wurzel['size']) zeilen.push(`**Size:** ${liste(wurzel['size']).map(groesse).join(' or ')}`);
  const typ = wurzel['type'] as Knoten | string | undefined;
  if (typ) {
    const art = typeof typ === 'string' ? typ : String(typ['type'] ?? '');
    const marken = typeof typ === 'string' ? [] : liste(typ['tags']).map((x) => (typeof x === 'string' ? x : String((x as Knoten)['tag'] ?? '')));
    zeilen.push(`**Type:** ${art}${marken.length ? ` (${marken.join(', ')})` : ''}`);
  }
  const tempo = wurzel['speed'] as Knoten | undefined;
  if (tempo) {
    zeilen.push(`**Speed:** ${Object.entries(tempo).map(([k, v]) => `${k === 'walk' ? '' : `${k} `}${typeof v === 'object' ? String((v as Knoten)['number']) : String(v)} ft.`).join(', ')}`);
  }
  for (const a of ATTRIBUTE) if (typeof wurzel[a] === 'number') zeilen.push(`**${a.toUpperCase()}:** ${String(wurzel[a])}`);
  const mods = (apply['_mod'] as Knoten | undefined) ?? {};
  for (const [schluessel, roh] of Object.entries(mods)) {
    for (const mod of liste(roh) as Knoten[]) {
      const modus = String(mod['mode'] ?? '');
      if (schluessel === '_' && modus === 'addSenses') {
        zeilen.push(`**Senses:** ${liste(mod['senses']).map((s) => `${String((s as Knoten)['type'])} ${String((s as Knoten)['range'])} ft.`).join(', ')}`);
      } else if (schluessel === '_' && modus === 'addSkills') {
        zeilen.push(`**Skills:** ${Object.keys((mod['skills'] as Knoten | undefined) ?? {}).map(fertigkeit).join(', ')} (proficient)`);
      } else if (schluessel === '_' && modus === 'maxSize') {
        zeilen.push(`**Size:** at most ${groesse(mod['max'])}`);
      } else if (MOD_TITEL[schluessel] && modus.startsWith('append')) {
        /* Zustände als Verweis, wie im Statblock. */
        const wort = (x: unknown) => wb.zeile(schluessel === 'conditionImmune' ? `{@condition ${String(x)}}` : String(x));
        zeilen.push(`**${MOD_TITEL[schluessel]}:** ${liste(mod['items']).map(wort).join(', ')}`);
      } else if (ABSCHNITT[schluessel] && (modus === 'appendArr' || modus === 'prependArr')) {
        const eintraege = liste(mod['items']).map((x) => ohnePlatzhalter(x) as Knoten);
        const text = wb.text(
          eintraege.map((x) => (x['type'] ? x : { type: 'entries', ...x })),
          4,
        );
        if (text) bloecke.push(`### ${ABSCHNITT[schluessel]}\n\n${text}`);
      } else if (modus === 'removeArr') {
        zeilen.push(`**Removes:** ${liste(mod['names']).map(String).join(', ')}`);
      } else if (modus === 'scalarAddHit' || modus === 'scalarAddDc') {
        const n = Number(mod['scalar']);
        zeilen.push(`**${modus === 'scalarAddHit' ? 'Attack bonus' : 'Save DC'} (${ABSCHNITT[schluessel] ?? schluessel}):** ${n > 0 ? '+' : ''}${n}`);
      } else if (modus === 'scalarAddProp') {
        const n = Number(mod['scalar']);
        zeilen.push(`**${WERT_TITEL[schluessel] ?? titel(schluessel)}:** ${n > 0 ? '+' : ''}${n} to each`);
      } else if (modus === 'scalarMultProp' || modus === 'scalarMultXp') {
        zeilen.push(`**${WERT_TITEL[schluessel] ?? titel(schluessel)}:** × ${String(mod['scalar'])}${mod['floor'] ? ', rounded down' : ''}`);
      } else if (modus === 'replaceTxt') {
        zeilen.push(`**Text:** “${String(mod['replace'])}” becomes “${String(mod['with'])}”`);
      } else if (!(schluessel === 'hp' && modus === 'prefixSuffixStringProp') && schluessel !== 'miscTags') {
        wb.notiz(`Schablone: ${schluessel}.${modus} nicht als Text`);
      }
    }
  }
  return [zeilen.map((z) => `- ${z}`).join('\n'), ...bloecke].filter(Boolean).join('\n\n');
}

/** `Animal Handling` aus `animal handling` — die Namen der Skill-Artikel. */
export function fertigkeit(wort: string): string {
  return titel(wort).replace(/\bOf\b/g, 'of');
}
