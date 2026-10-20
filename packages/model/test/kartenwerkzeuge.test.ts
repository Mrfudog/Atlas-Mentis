import { describe, expect, it } from 'vitest';
import { defaultMapTools, mapKindOf, mapToolTable, mapToolsOf, withMapTool, type Entity } from '../src/index.js';

/* Werkzeuge je Kartentyp (T-320): die Vorgabe der Leitung, die Einstellung
   an der Kampagne, und was eine fehlende Art heisst. */

const kampagne = (mapTools?: unknown): Entity => ({ id: 'c', interfaces: ['Campaign'], components: { Campaign: mapTools === undefined ? {} : { mapTools } } });
const karte = (kind?: string): Entity => ({ id: 'm', interfaces: ['Map'], components: { Map: kind ? { kind } : {} } });

describe('mapToolsOf (T-320)', () => {
  it('without a setting: walls, fog and light on battle maps, sub-map links on the others', () => {
    expect([...mapToolsOf(kampagne(), 'battle')]).toEqual(['walls', 'fog', 'light', 'grid', 'tokens', 'assets', 'markers']);
    expect([...mapToolsOf(kampagne(), 'world')]).toEqual(['frames', 'markers', 'assets']);
    expect(defaultMapTools('building')).not.toContain('walls');
  });
  it('a map without kind is a region map, as the register says', () => {
    expect(mapKindOf(karte())).toBe('region');
    expect(mapKindOf(karte('battle'))).toBe('battle');
  });
  it('the campaign setting wins per kind; an empty list means none; unknown groups drop out', () => {
    const k = kampagne({ world: ['fog', 'frames', 'zorp'], battle: [] });
    expect([...mapToolsOf(k, 'world')]).toEqual(['fog', 'frames']);
    expect([...mapToolsOf(k, 'battle')]).toEqual([]);
    expect([...mapToolsOf(k, 'region')]).toEqual(['frames', 'markers', 'assets']);
  });
  it('withMapTool switches one group for one kind and keeps the others', () => {
    const k = withMapTool(kampagne(), 'region', 'fog', true);
    expect(mapToolTable(k).region).toEqual(['fog', 'assets', 'frames', 'markers']);
    expect(mapToolTable(k).battle).toEqual(['walls', 'fog', 'light', 'grid', 'tokens', 'assets', 'markers']);
    const aus = withMapTool(k, 'region', 'assets', false);
    expect(mapToolTable(aus).region).toEqual(['fog', 'frames', 'markers']);
  });
});
