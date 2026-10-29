/**
 * **Freie Aktion mit Notiz** (REQ-403, T-453): je Platz eine Kachel
 * „Other …“; sie verbraucht ihren Platz, verlangt eine Notiz und steht im
 * Plan mit ihr. Was sie kostet, sagt die Kachel, nicht die Maske.
 */
import { describe, expect, it } from 'vitest';
import { MANUAL_TILES, cleanStep, isManualTile, planBudget, planText, plannerTiles, tilesFor } from '../src/index.js';

describe('T-453: freie Aktionen', () => {
  it('je Platz eine Kachel, in jeder Leiste', () => {
    expect(MANUAL_TILES.map((t) => [t.id, t.cost])).toEqual([
      ['manual:action', 'action'],
      ['manual:bonus', 'bonus'],
      ['manual:reaction', 'reaction'],
      ['manual:free', 'free'],
    ]);
    expect(tilesFor({}, []).filter((t) => t.group === 'manual')).toHaveLength(4);
    /* Ohne Reaktionen in der Stufe „actions“ auch ohne die freie Reaktion. */
    expect(plannerTiles(MANUAL_TILES, 'actions').map((t) => t.id)).not.toContain('manual:reaction');
  });

  it('erkennt nur die vier Kacheln', () => {
    expect(isManualTile('manual:bonus')).toBe(true);
    expect(isManualTile('manual:extra')).toBe(false);
    expect(isManualTile('std:dash')).toBe(false);
  });

  it('ohne Notiz kein Schritt; der Platz kommt aus der Kachel, nicht aus der Maske', () => {
    expect(cleanStep({ kind: 'act', tile: 'manual:action', name: 'x', cost: 'action', note: '  ' }, 0)).toBeNull();
    const s = cleanStep({ kind: 'act', tile: 'manual:bonus', name: 'Erfunden', cost: 'free', note: ' Shove the cart ' }, 0);
    expect(s).toMatchObject({ kind: 'act', tile: 'manual:bonus', name: 'Other bonus action', cost: 'bonus', note: 'Shove the cart' });
  });

  it('verbraucht den Platz und steht mit der Notiz im Plan', () => {
    const s = cleanStep({ kind: 'act', tile: 'manual:action', note: 'Pull the lever' }, 0)!;
    const z = cleanStep({ kind: 'act', tile: 'manual:action', note: 'Again' }, 1)!;
    expect(planBudget([s], 30).problems).toEqual([]);
    expect(planBudget([s, z], 30).problems).toEqual(['No action left for Other action.']);
    expect(planText([s])).toBe('Other action (Pull the lever)');
  });
});
