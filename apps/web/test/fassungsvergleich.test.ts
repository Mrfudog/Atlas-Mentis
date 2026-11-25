/**
 * Fassungen auf einen Blick und nebeneinander (T-173).
 *
 * Die Leitung sah an „+1 Weapon" den Unterschied nicht: das einzige
 * abweichende Feld fehlte in der anderen Fassung und stand als leerer
 * Text da. Geprüft wird, was die Seite jetzt sagt — der Satz im Kasten,
 * welche Fassung am Tisch gilt, und der Zeilenvergleich nebeneinander.
 */

import { describe, expect, it } from 'vitest';
import { lineDiff } from '@nw/model';
import type { Entity } from '@nw/model';
import { fassungsSatz, geltendeFassung } from '../src/app/artikel/fassungen';
import { nebeneinander } from '../src/app/artikel/vergleich';
import type { Fassungen } from '../src/app/kern/api';

const ding = (id: string, ebene: string): Entity => ({
  id,
  name: '+1 Weapon',
  interfaces: ['Item'],
  components: { Identity: { name: '+1 Weapon', id: `item-${id}`, aliases: [] } },
  relations: [{ id: `${id}_in`, type: 'inLayer', to: ebene, props: {} }],
});
const alt = ding('w14', 'dmg');
const neu = ding('w24', 'xdmg');
const fassungen = (rank: Record<string, number | undefined>): Fassungen => ({
  layers: [
    { id: 'dmg', name: 'Sample Guide', short: 'DMG', compare: false, play: rank['dmg'] !== undefined, ...(rank['dmg'] ? { rank: rank['dmg'] } : {}) },
    { id: 'xdmg', name: 'Sample Guide 2024', short: 'XDMG', compare: false, play: rank['xdmg'] !== undefined, ...(rank['xdmg'] ? { rank: rank['xdmg'] } : {}) },
  ],
  versions: [{ entity: neu, layers: ['xdmg'], play: rank['xdmg'] !== undefined, compare: false, adoptable: false }],
});

describe('versions at a glance (T-173)', () => {
  it('says what differs, and what is missing there', () => {
    expect(fassungsSatz({ same: false, fields: ['Tier'], relations: [], notThere: ['Tier'] })).toBe('Differs in: Tier (not set there)');
    expect(fassungsSatz({ same: true, fields: [], relations: [], notThere: [], source: 'XDMG p. 324' })).toBe(
      'Same text and values — only the source differs (XDMG p. 324)',
    );
  });

  it('names the version in play when both layers are on', () => {
    const g = geltendeFassung(alt, fassungen({ dmg: 1, xdmg: 2 }));
    expect(g?.id).toBe('w24');
    expect(g?.satz).toContain('In play: XDMG. DMG is on too');
    /* Eine Ebene im Spiel: keine Frage, kein Satz. */
    expect(geltendeFassung(alt, fassungen({ dmg: 1 }))).toBeNull();
  });

  it('pairs removed and added lines side by side', () => {
    const p = nebeneinander(lineDiff('a\nold\nc', 'a\nnew\nmore\nc'));
    expect(p.map((x) => [x.l?.op ?? '', x.r?.op ?? ''])).toEqual([
      ['same', 'same'],
      ['del', 'add'],
      ['', 'add'],
      ['same', 'same'],
    ]);
  });
});
