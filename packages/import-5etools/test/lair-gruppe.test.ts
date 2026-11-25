import { describe, expect, it } from 'vitest';
import type { Entity } from '@nw/model';
import type { Knoten } from '../src/copy.js';
import type { Datenstand } from '../src/lesen.js';
import { lauf } from '../src/lauf.js';

/* Erfundene Monster und Gruppen, kein Text aus 5e.tools (T-438). */
function datenstand(): Datenstand {
  const monster: Knoten[] = [
    /* Nennt seine Gruppe: wie bisher. */
    { name: 'Fen Wyrm', source: 'XYZ', cr: '15', legendaryGroup: { name: 'Fen Wyrm', source: 'XYZ' } },
    /* Nennt keine, aber eine Gruppe gleichen Namens und gleicher Quelle hat Lair Actions. */
    { name: 'Mire Lord', source: 'XYZ', cr: '20' },
    /* Gleicher Name, andere Quelle: kein Treffer. */
    { name: 'Bog Hag', source: 'ABC', cr: '5' },
    /* Erwähnt Lair Actions nur im Spielart-Kasten: bleibt ohne Kante. */
    { name: 'Fen Wyrmling', source: 'XYZ', cr: '2', variant: [{ type: 'variant', name: 'Lost gifts', entries: ['It has no lair actions.'] }] },
  ];
  const gruppen: Knoten[] = [
    { name: 'Fen Wyrm', source: 'XYZ', lairActions: ['Fog rolls in.'] },
    { name: 'Mire Lord', source: 'XYZ', lairActions: ['The mud rises.'], regionalEffects: ['Frogs croak.'] },
    { name: 'Bog Hag', source: 'XYZ', lairActions: ['Roots grab.'] },
  ];
  return {
    arten: new Map([['monster', monster], ['legendaryGroup', gruppen]]),
    quellen: new Map([
      ['xyz', { id: 'XYZ', name: 'XYZ', published: '2020-01-01', art: 'book' }],
      ['abc', { id: 'ABC', name: 'ABC', published: '2020-01-01', art: 'book' }],
    ]),
  };
}

const sb = (es: Entity[], name: string) => es.find((e) => e.interfaces[0] === 'Statblock' && e.name === name)!;
const teile = (es: Entity[], s: Entity) =>
  (s.relations ?? []).filter((r) => r.type === 'composedOf').map((r) => es.find((e) => e.id === r.to)?.name).sort();

describe('Lair Actions ohne Verweis auf die Gruppe (T-438)', () => {
  const { datei } = lauf(datenstand());
  const es = datei.entities;

  it('verknüpft wie bisher, wenn der Statblock seine Gruppe nennt', () => {
    expect(teile(es, sb(es, 'Fen Wyrm'))).toEqual(['Lair Actions (Fen Wyrm)']);
  });

  it('nimmt die Gruppe gleichen Namens und gleicher Quelle, wenn er keine nennt', () => {
    expect(teile(es, sb(es, 'Mire Lord'))).toEqual(['Lair Actions (Mire Lord)', 'Regional Effects (Mire Lord)']);
  });

  it('rät nicht über die Quelle hinweg und nicht aus dem Text', () => {
    expect(teile(es, sb(es, 'Bog Hag'))).toEqual([]);
    expect(teile(es, sb(es, 'Fen Wyrmling'))).toEqual([]);
  });
});
