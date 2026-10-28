import { describe, expect, it } from 'vitest';
import type { Entity } from '@nw/model';
import type { Knoten } from '../src/copy.js';
import type { Datenstand } from '../src/lesen.js';
import { lauf } from '../src/lauf.js';

/* Erfundene Monster, kein Text aus 5e.tools (T-437). */
function datenstand(): Datenstand {
  const legendaer = [{ name: 'Swipe', entries: ['The beast swipes.'] }];
  const monster: Knoten[] = [
    /* Neue Schreibweise: „3 (4 in Lair)". */
    { name: 'Fog Wyrm', source: 'XMM', cr: '15', str: 20, dex: 10, legendary: legendaer, legendaryActions: 3, legendaryActionsLair: 4 },
    /* Nur die Lair-Zahl, die Grundzahl fällt auf 3. */
    { name: 'Mist Wyrm', source: 'XMM', cr: '12', str: 18, dex: 10, legendary: legendaer, legendaryActionsLair: 4 },
    /* Alte Schreibweise: keine Lair-Zahl. */
    { name: 'Old Wyrm', source: 'XMM', cr: '10', str: 18, dex: 10, legendary: legendaer },
  ];
  return {
    arten: new Map([['monster', monster]]),
    quellen: new Map([['xmm', { id: 'XMM', name: 'XMM', published: '2025-02-18', art: 'book' }]]),
  };
}

const sb = (es: Entity[], name: string) => es.find((e) => e.interfaces[0] === 'Statblock' && e.name === name)!;

describe('Legendary Actions im Lair (T-437)', () => {
  const es = lauf(datenstand()).datei.entities;

  it('schreibt legendaryActionsLair neben legendaryActions', () => {
    expect(sb(es, 'Fog Wyrm').components['Statblock']).toMatchObject({ legendaryActions: 3, legendaryActionsLair: 4 });
    expect(sb(es, 'Mist Wyrm').components['Statblock']).toMatchObject({ legendaryActions: 3, legendaryActionsLair: 4 });
  });

  it('lässt das Feld weg, wo die Quelle keine Lair-Zahl nennt', () => {
    expect(sb(es, 'Old Wyrm').components['Statblock']).not.toHaveProperty('legendaryActionsLair');
  });
});
