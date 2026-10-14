/**
 * **Die bis T-087 zurückgestellten Arten** (E4, REQ-243): Fahrzeuge und
 * ihre Aufrüstungen, Kartendecks und Karten, Bastionsräume (2024) und
 * Waffenmeisterschaften (2024). Jede mit der kleinsten Art, die passt —
 * keine davon trägt Felder, die eine bestehende Art nicht schon hat:
 *
 *  - ein **Fahrzeug** ist ein `Statblock` (RK, TP, Attribute, Immunitäten)
 *    mit `creatureType` „vehicle (ship)" — wie ein Objekt „siege weapon"
 *    ist. Rumpf, Steuerung, Antrieb, Waffen, Besatzung und Laderaum stehen
 *    als Text: das sind Zahlen, mit denen heute nichts rechnet.
 *  - eine **Aufrüstung**, ein **Bastionsraum** und eine **Karte** sind eine
 *    `Rule` mit dem Wort `upgrade`, `facility`, `card` (`RuleKind`) — ein
 *    Untertyp ohne eigene Felder ist ein Wort und keine Zeile.
 *  - ein **Deck** ist eine `Table` mit `kind: 'deck'`: eine Karte ziehen
 *    heisst auf ihr würfeln, je Karte ein `entry` mit ihrer Anzahl als
 *    Gewicht.
 *  - eine **Waffenmeisterschaft** ist eine `ItemProperty` mit der Marke
 *    `mastery`, und die Waffe zeigt mit `hasProperty` darauf — wie auf
 *    „Finesse".
 */

import type { Entity } from '@nw/model';
import type { Knoten } from '../copy.js';
import type { Werkbank } from '../werkbank.js';
import type { Zuordnung } from '../zuordnung.js';
import { liste, titel, zahl } from '../zuordnung.js';
import { statblock, tempo } from './monster.js';

const FAHRZEUG: Record<string, string> = {
  SHIP: 'ship', SPELLJAMMER: 'spelljammer ship', ELEMENTAL_AIRSHIP: 'elemental airship',
  INFWAR: 'infernal war machine', OBJECT: 'object', CREATURE: 'creature',
};

const AUFRUESTUNG: Record<string, [string, string]> = {
  'SHP:H': ['ship upgrade', 'hull'], 'SHP:M': ['ship upgrade', 'movement'], 'SHP:W': ['ship upgrade', 'weapon'],
  'SHP:F': ['ship upgrade', 'figurehead'], 'SHP:O': ['ship upgrade', 'other'],
  'IWM:W': ['infernal war machine upgrade', 'weapon'], 'IWM:A': ['infernal war machine upgrade', 'armor'],
  'IWM:G': ['infernal war machine upgrade', 'gadget'],
};

/** Ein Bauteil eines Fahrzeugs: „**Helm.** AC 16, HP 50 — Move up to …". */
function bauteil(wb: Werkbank, b: Knoten): string {
  const werte = [
    b['count'] ? `×${String(b['count'])}` : '',
    b['ac'] !== undefined ? `AC ${String(b['ac'])}` : '',
    b['hp'] !== undefined ? `HP ${String(b['hp'])}${b['hpNote'] ? ` (${wb.zeile(String(b['hpNote']))})` : ''}` : '',
    b['dt'] !== undefined ? `damage threshold ${String(b['dt'])}` : '',
    b['costs'] ? `cost ${liste(b['costs']).map((c) => String((c as Knoten)['note'] ?? (c as Knoten)['value'] ?? '')).filter(Boolean).join(', ')}` : '',
  ].filter(Boolean).join(', ');
  const tempoText = liste(b['speed'])
    .map((s) => `${String((s as Knoten)['mode'] ?? '')} ${wb.text((s as Knoten)['entries'], 6)}`.trim())
    .filter(Boolean)
    .join('; ');
  const rumpf = [werte, tempoText ? `speed ${tempoText}` : ''].filter(Boolean).join('; ');
  const text = [wb.text(b['entries'], 6), wb.text(b['action'], 6)].filter(Boolean).join(' ');
  return `**${wb.zeile(String(b['name'] ?? ''))}.**${rumpf ? ` ${rumpf}.` : ''}${text ? ` ${text}` : ''}`;
}

const FAHRZEUG_GENUTZT = [
  'name', 'vehicleType', 'size', 'terrain', 'capCrew', 'capCrewNote', 'capPassenger', 'capCargo', 'capCreature',
  'ac', 'hp', 'speed', 'pace', 'dimensions', 'immune', 'conditionImmune', 'str', 'dex', 'con', 'int', 'wis',
  'cha', 'hull', 'control', 'movement', 'weapon', 'station', 'actionStation', 'actionThresholds', 'action',
  'trait', 'reaction', 'entries', 'cost', 'weight', 'type',
];

const fahrzeug: Zuordnung = {
  art: 'vehicle',
  tag: 'vehicle',
  typ: () => 'Statblock',
  name: (e) => String(e['name']),
  genutzt: FAHRZEUG_GENUTZT,
  fuellen(wb, sb, e) {
    const S = 'Statblock';
    const rumpf = (e['hull'] as Knoten | undefined) ?? {};
    const tp = typeof e['hp'] === 'object' && e['hp'] ? (e['hp'] as Knoten) : {};
    /* Die Zahlen, die ein Statblock schon kennt, als seine Felder. */
    statblock(wb, sb, {
      size: e['size'],
      ac: e['ac'] ?? rumpf['ac'],
      hp: typeof e['hp'] === 'number' ? e['hp'] : (tp['hp'] ?? rumpf['hp']),
      speed: typeof e['speed'] === 'number' || (e['speed'] && typeof e['speed'] === 'object') ? e['speed'] : undefined,
      immune: e['immune'],
      conditionImmune: e['conditionImmune'],
      ...Object.fromEntries(['str', 'dex', 'con', 'int', 'wis', 'cha'].map((a) => [a, e[a]])),
    });
    wb.feld(sb, S, 'creatureType', `vehicle (${FAHRZEUG[String(e['vehicleType'])] ?? String(e['vehicleType'] ?? '').toLowerCase()})`);
    wb.marke(sb, 'vehicle', FAHRZEUG[String(e['vehicleType'])]);
    for (const t of liste(e['terrain'])) wb.marke(sb, String(t));

    const daten = [
      e['dimensions'] ? `**Dimensions:** ${liste(e['dimensions']).map(String).join(' by ')}` : '',
      e['capCrew'] !== undefined ? `**Crew:** ${String(e['capCrew'])}${e['capCrewNote'] ? ` (${wb.zeile(String(e['capCrewNote']))})` : ''}` : '',
      e['capPassenger'] !== undefined ? `**Passengers:** ${String(e['capPassenger'])}` : '',
      e['capCreature'] !== undefined ? `**Creatures:** ${String(e['capCreature'])}` : '',
      e['capCargo'] !== undefined ? `**Cargo:** ${typeof e['capCargo'] === 'number' ? `${String(e['capCargo'])} tons` : wb.zeile(String(e['capCargo']))}` : '',
      e['pace'] !== undefined ? `**Travel pace:** ${reisetempo(wb, e['pace'])}` : '',
      typeof e['speed'] === 'string' ? `**Speed:** ${wb.zeile(e['speed'])}` : '',
      rumpf['dt'] !== undefined || tp['dt'] !== undefined ? `**Damage threshold:** ${String(rumpf['dt'] ?? tp['dt'])}` : '',
      tp['mt'] !== undefined ? `**Mishap threshold:** ${String(tp['mt'])}` : '',
      e['cost'] !== undefined ? `**Cost:** ${typeof e['cost'] === 'number' ? `${String(e['cost'] / 100)} gp` : wb.zeile(String(e['cost']))}` : '',
      e['weight'] !== undefined ? `**Weight:** ${typeof e['weight'] === 'number' ? `${String(e['weight'])} lb.` : wb.zeile(String(e['weight']))}` : '',
    ].filter(Boolean);
    if (daten.length) wb.prosa(sb, daten.map((d) => `- ${d}`).join('\n'));
    wb.prosa(sb, wb.text(e['entries'], 4));
    for (const t of liste(e['trait'])) if (t && typeof t === 'object') wb.prosa(sb, bauteil(wb, t as Knoten));
    if (e['action']) wb.prosa(sb, `#### Actions\n\n${wb.text(e['action'], 5)}`);
    for (const [schluessel, titelText] of [['control', 'Control'], ['movement', 'Movement'], ['weapon', 'Weapons'], ['station', 'Stations'], ['actionStation', 'Action stations'], ['reaction', 'Reactions']] as const) {
      const teile = liste(e[schluessel]).filter((b) => b && typeof b === 'object').map((b) => bauteil(wb, b as Knoten));
      if (teile.length) wb.prosa(sb, `#### ${titelText}\n\n${teile.join('\n\n')}`);
    }
    const f = wb.fluff('vehicleFluff', String(e['name']), String(e['source']));
    if (f) wb.lore(sb, wb.text(f['entries']));
    if (typeof e['speed'] === 'object' && e['speed'] && !tempo(e['speed'])) wb.notiz('Fahrzeugtempo ohne Bewegungsart');
  },
};

const aufruestung: Zuordnung = {
  art: 'vehicleUpgrade',
  tag: 'vehupgrade',
  typ: () => 'Rule',
  name: (e) => String(e['name']),
  genutzt: ['name', 'upgradeType', 'entries'],
  fuellen(wb, ent, e) {
    wb.feld(ent, 'Rule', 'kind', 'upgrade');
    for (const u of liste(e['upgradeType'])) {
      const [fuer, teil] = AUFRUESTUNG[String(u)] ?? ['vehicle upgrade', String(u).toLowerCase()];
      wb.marke(ent, fuer, teil);
    }
    wb.prosa(ent, wb.text(e['entries']));
  },
};

/** Eine Karte: `name|set|source` — derselbe Name steht in mehreren Decks. */
const karte: Zuordnung = {
  art: 'card',
  tag: 'card',
  typ: () => 'Rule',
  name: (e) => String(e['name']),
  schluessel: (e) => [[e['name'], e['set'], e['source']], [e['name'], e['set']]],
  herkunft: (e) => String(e['set'] ?? ''),
  genutzt: ['name', 'set', 'suit', 'value', 'valueName', 'face', 'back', 'entries'],
  fuellen(wb, ent, e) {
    wb.feld(ent, 'Rule', 'kind', 'card');
    wb.feld(ent, 'Rule', 'autolink', false);
    wb.marke(ent, 'card', e['set'] ? String(e['set']) : undefined);
    const wert = [e['valueName'] ? String(e['valueName']) : e['value'] !== undefined ? String(e['value']) : '', e['suit'] ? `of ${String(e['suit'])}` : ''].filter(Boolean).join(' ');
    const kopf = [`Card of the ${String(e['set'] ?? 'deck')}`, wert].filter(Boolean).join(' · ');
    wb.prosa(ent, [`*${kopf}*`, wb.text(e['entries'])].filter(Boolean).join('\n\n'));
  },
};

/** Ein Deck: eine Tabelle, auf der eine Karte gezogen wird. */
const deck: Zuordnung = {
  art: 'deck',
  tag: 'deck',
  typ: () => 'Table',
  name: (e) => String(e['name']),
  genutzt: ['name', 'cards', 'entries', 'back', 'hasCardArt', 'spreads'],
  fuellen(wb, ent, e) {
    wb.feld(ent, 'Table', 'kind', 'deck');
    wb.marke(ent, 'deck');
    let n = 0;
    for (const c of liste(e['cards'])) {
      const roh = typeof c === 'string' ? c : String((c as Knoten)['uid'] ?? '');
      const [name = '', set = String(e['name']), quelle = String(e['source'])] = roh.split('|');
      const ziel = wb.hole('card', name, set || String(e['name']), quelle || String(e['source']));
      if (!ziel) {
        wb.ctx.insLeere('card', roh);
        continue;
      }
      const anzahl = typeof c === 'object' && c ? zahl((c as Knoten)['count']) ?? 1 : 1;
      n += anzahl;
      wb.kante(ent, 'entry', ziel.id, anzahl !== 1 ? { weight: anzahl } : undefined);
    }
    if (n) wb.feld(ent, 'Table', 'die', `1d${n}`);
    wb.prosa(ent, wb.text(e['entries']));
    if (Array.isArray(e['spreads']) && e['spreads'].length) wb.notiz('Legemuster (spreads) nicht übernommen');
  },
};

const RAUM: Record<string, string> = { cramped: 'Cramped', roomy: 'Roomy', vast: 'Vast' };

/** Ein Bastionsraum (2024): Stufe, Voraussetzung, Platz, Bedienstete, Befehle. */
const bastion: Zuordnung = {
  art: 'facility',
  tag: 'facility',
  typ: () => 'Rule',
  name: (e) => String(e['name']),
  genutzt: ['name', 'facilityType', 'level', 'prerequisite', 'space', 'hirelings', 'orders', 'entries'],
  fuellen(wb, ent, e) {
    wb.feld(ent, 'Rule', 'kind', 'facility');
    wb.marke(ent, 'bastion', `${String(e['facilityType'] ?? 'basic')} facility`);
    for (const o of liste(e['orders'])) wb.marke(ent, `order: ${String(o)}`);
    const voraus = liste(e['prerequisite'])
      .map((p) => Object.entries((p as Knoten) ?? {}).map(([k, v]) => `${k} ${liste(v).map((x) => wb.zeile(typeof x === 'string' ? x : JSON.stringify(x))).join(' or ')}`).join(', '))
      .filter(Boolean);
    const leute = liste(e['hirelings'])
      .map((h) => {
        const o = h as Knoten;
        if (o['exact'] !== undefined) return String(o['exact']);
        if (o['min'] !== undefined) return `${String(o['min'])}${o['max'] !== undefined ? `–${String(o['max'])}` : '+'}`;
        return '';
      })
      .filter(Boolean);
    const kopf = [
      e['level'] !== undefined ? `Level ${String(e['level'])}` : '',
      voraus.length ? `Prerequisite: ${voraus.join('; ')}` : '',
      liste(e['space']).length ? `Space: ${liste(e['space']).map((s) => RAUM[String(s)] ?? titel(String(s))).join(', ')}` : '',
      leute.length ? `Hirelings: ${leute.join(', ')}` : '',
      liste(e['orders']).length ? `Orders: ${liste(e['orders']).map((o) => titel(String(o))).join(', ')}` : '',
    ].filter(Boolean);
    wb.prosa(ent, [kopf.length ? `*${kopf.join(' · ')}*` : '', wb.text(e['entries'])].filter(Boolean).join('\n\n'));
    /* Eine Regel trägt keinen Begleittext (`Lore`); er steht unter dem Regeltext. */
    const f = wb.fluff('facilityFluff', String(e['name']), String(e['source']));
    if (f) wb.prosa(ent, wb.text(f['entries']));
  },
};

/** Eine Waffenmeisterschaft (2024) — eine Eigenschaft wie „Finesse", mit der Marke `mastery`. */
const meisterschaft: Zuordnung = {
  art: 'itemMastery',
  tag: 'itemMastery',
  typ: () => 'ItemProperty',
  name: (e) => String(e['name']),
  genutzt: ['name', 'entries'],
  fuellen(wb, ent: Entity, e) {
    wb.marke(ent, 'mastery');
    wb.prosa(ent, wb.text(e['entries']));
  },
};

/** In der Reihenfolge, in der sie aufeinander zeigen: die Karte vor dem Deck. */

/**
 * Die Reisegeschwindigkeit eines Fahrzeugs: eine Zahl, ein Text oder je
 * Fortbewegung eine (`{fly: 4, swim: 3}` bei den Spelljammer-Schiffen). Als
 * Objekt stand sie einmal als „[object Object]" im Text (T-089).
 */
function reisetempo(wb: Werkbank, pace: unknown): string {
  if (typeof pace === 'number') return `${String(pace)} miles per hour`;
  if (pace && typeof pace === 'object') {
    const teile = Object.entries(pace as Knoten).map(([art, v]) => `${art === 'walk' ? '' : `${art} `}${String(v)} miles per hour`);
    return teile.join(', ');
  }
  return wb.zeile(String(pace));
}

export const NEUES: Zuordnung[] = [meisterschaft, fahrzeug, aufruestung, karte, deck, bastion];
