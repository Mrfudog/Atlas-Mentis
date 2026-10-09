/**
 * **Zauber** (Abgleich §4.2, Schritt 7; M2). Grad, Schule, Wirkzeit,
 * Reichweite, Komponenten, Dauer werden Felder; der Text und „At Higher
 * Levels" bleiben Markdown mit Würfeln darin.
 *
 * Die Klassenlisten (welche Klasse welchen Zauber kennt) stehen bei
 * 5e.tools in einer eigenen Nachschlagedatei und bei uns an keiner Kante —
 * `casts` geht von Statblock, Figur, Gegenstand, Unterklasse und Abstammung
 * aus, nicht von der Klasse. Sie bleiben offen (Bericht).
 */

import type { Zuordnung } from '../zuordnung.js';
import { ATTRIBUT_NAME, liste, zahl } from '../zuordnung.js';
import type { Knoten } from '../copy.js';
import { aktionsart } from './regeln.js';

const SCHULE: Record<string, string> = {
  A: 'abjuration', C: 'conjuration', D: 'divination', E: 'enchantment', V: 'evocation',
  I: 'illusion', N: 'necromancy', T: 'transmutation',
};

const BEREICHE = new Set(['radius', 'sphere', 'cone', 'line', 'cube', 'cylinder', 'hemisphere', 'emanation']);

export const ZAUBER: Zuordnung = {
  art: 'spell',
  tag: 'spell',
  typ: () => 'Spell',
  name: (e) => String(e['name']),
  genutzt: [
    'name', 'entries', 'level', 'school', 'time', 'range', 'components', 'duration', 'meta',
    'entriesHigherLevel', 'savingThrow', 'spellAttack', 'damageInflict', 'scalingLevelDice',
  ],
  fuellen(wb, ent, e) {
    const S = 'Spell';
    wb.feld(ent, S, 'level', zahl(e['level']));
    const schule = SCHULE[String(e['school'])];
    if (schule) wb.feld(ent, S, 'school', schule);
    else wb.notiz(`Schule ${String(e['school'])}`);

    const zeit = liste(e['time'])[0] as Knoten | undefined;
    if (liste(e['time']).length > 1) wb.notiz('mehrere Wirkzeiten (erste übernommen)');
    if (zeit) {
      wb.feld(ent, S, 'castingTime', zahl(zeit['number']));
      const einheit = String(zeit['unit'] ?? '');
      if (['action', 'bonus', 'reaction'].includes(einheit)) wb.feld(ent, S, 'castingAction', aktionsart(wb, einheit).id);
      else if (einheit === 'minute' || einheit === 'hour') wb.feld(ent, S, 'castingUnit', einheit);
      else wb.notiz(`Wirkzeit in ${einheit}`);
      if (zeit['condition']) wb.feld(ent, S, 'castingCondition', wb.zeile(zeit['condition']));
    }

    const r = (e['range'] as Knoten | undefined) ?? {};
    const art = String(r['type'] ?? '');
    const weite = (r['distance'] as Knoten | undefined) ?? {};
    const wt = String(weite['type'] ?? '');
    const fuss = wt === 'feet' ? zahl(weite['amount']) : wt === 'miles' ? (zahl(weite['amount']) ?? 0) * 5280 : undefined;
    if (art === 'point') {
      if (['self', 'touch', 'sight', 'unlimited'].includes(wt)) wb.feld(ent, S, 'rangeKind', wt);
      else {
        wb.feld(ent, S, 'rangeKind', 'point');
        wb.feld(ent, S, 'range', fuss);
      }
    } else if (BEREICHE.has(art)) {
      wb.feld(ent, S, 'rangeKind', art);
      wb.feld(ent, S, 'range', fuss);
    } else if (art === 'special') wb.feld(ent, S, 'rangeKind', 'special');
    else if (art) wb.notiz(`Reichweite ${art}`);

    const k = (e['components'] as Knoten | undefined) ?? {};
    const komp = (['v', 's', 'm'] as const).filter((x) => k[x]);
    wb.feld(ent, S, 'components', komp);
    if (k['r']) wb.notiz('Komponente R (2024)');
    const m = k['m'];
    if (typeof m === 'string') wb.feld(ent, S, 'material', m);
    else if (m && typeof m === 'object') {
      const mo = m as Knoten;
      wb.feld(ent, S, 'material', mo['text']);
      wb.feld(ent, S, 'materialCost', zahl(mo['cost']));
      if (mo['consume']) wb.feld(ent, S, 'materialConsumed', true);
    }

    const dauer = liste(e['duration'])[0] as Knoten | undefined;
    if (liste(e['duration']).length > 1) wb.notiz('mehrere Dauern (erste übernommen)');
    if (dauer) {
      const typ = String(dauer['type'] ?? '');
      if (['instant', 'timed', 'permanent', 'special'].includes(typ)) wb.feld(ent, S, 'duration', typ);
      const d = (dauer['duration'] as Knoten | undefined) ?? {};
      wb.feld(ent, S, 'durationAmount', zahl(d['amount']));
      const einheit = String(d['type'] ?? '');
      if (['round', 'minute', 'hour', 'day'].includes(einheit)) wb.feld(ent, S, 'durationUnit', einheit);
      else if (einheit) wb.notiz(`Dauer in ${einheit}`);
      if (dauer['concentration']) wb.feld(ent, S, 'concentration', true);
    }
    const meta = (e['meta'] as Knoten | undefined) ?? {};
    if (meta['ritual']) wb.feld(ent, S, 'ritual', true);

    /* „At Higher Levels" ohne die eigene Überschrift — der Feldname sagt es. */
    const hoeher = liste(e['entriesHigherLevel']).flatMap((x) =>
      x && typeof x === 'object' && (x as Knoten)['entries'] ? liste((x as Knoten)['entries']) : [x],
    );
    wb.feld(ent, S, 'higherLevels', wb.text(hoeher));
    wb.feld(ent, S, 'save', liste(e['savingThrow']).map((s) => ATTRIBUT_NAME[String(s)] ?? '').filter(Boolean));
    const angriff = liste(e['spellAttack']).map(String);
    if (angriff.length) wb.feld(ent, S, 'attack', angriff[0] === 'M' ? 'melee' : 'ranged');
    wb.feld(ent, S, 'damageTypes', liste(e['damageInflict']).map(String));
    wb.prosa(ent, wb.text(e['entries']));
  },
};
