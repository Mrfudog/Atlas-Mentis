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
import { liste, titel } from '../zuordnung.js';

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
      /* Rettungswurf und SG stehen im Text; der erste genannte gilt. */
      const roh = JSON.stringify(e['entries'] ?? '');
      const sg = /\{@dc (\d+)\}\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)/.exec(roh);
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
      if (typeof e['type'] === 'string') wb.marke(ent, e['type']);
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
    genutzt: ['name', 'entries', 'type', 'goal', 'cultists', 'signaturespells', 'ability'],
    fuellen(wb, ent, e) {
      wb.feld(ent, 'Rule', 'kind', 'boon');
      if (e['type']) wb.marke(ent, String(e['type']));
      wb.prosa(ent, wb.text(e['entries']));
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
    },
  }),
];

/** `Animal Handling` aus `animal handling` — die Namen der Skill-Artikel. */
export function fertigkeit(wort: string): string {
  return titel(wort).replace(/\bOf\b/g, 'of');
}
