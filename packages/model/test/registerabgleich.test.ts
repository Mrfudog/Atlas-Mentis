/**
 * Register-Abgleich (T-123): was am Register einer Datenbank anders steht
 * als in den Startzeilen — ohne die Vorgaben, die die Ablage einsetzt.
 */
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { beschreibeAbweichung, registerAbweichung, runChecks, type Registry } from '../src/index.js';

const kopie = (): Registry => JSON.parse(JSON.stringify(seedRegistry)) as Registry;

describe('registerAbweichung', () => {
  it('findet nichts, wenn nur Vorgaben, Schlüsselreihenfolge und Mengen anders stehen', () => {
    const db = kopie();
    for (const r of Object.values(db.relations)) {
      r.owned ??= false;
      r.from = [...(r.from ?? ['*'])].reverse();
    }
    for (const i of Object.values(db.interfaces)) i.abstract ??= false;
    for (const u of Object.values(db.units)) u.aliases ??= [];
    const kind = db.interfaces['Layer']!.schema!.properties!['kind']!;
    kind.enum = [...(kind.enum as string[])].reverse();
    db.settings = Object.fromEntries(Object.entries(db.settings ?? {}).map(([k, v]) => [k, String(v)]));
    expect(registerAbweichung(db, seedRegistry)).toEqual([]);
  });

  it('nennt fehlende, zusätzliche und geänderte Felder einzeln', () => {
    const db = kopie();
    const props = db.interfaces['Spell']!.schema!.properties!;
    const erstes = Object.keys(props)[0]!;
    delete props[erstes];
    props['hausnotiz'] = { type: 'string', title: 'House note' };
    db.relations['partOf']!.label = 'Teil von';
    delete db.views['quick'];
    const a = registerAbweichung(db, seedRegistry);
    expect(a).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ part: 'interfaces', name: 'Spell', path: erstes, kind: 'missing' }),
        expect.objectContaining({ part: 'interfaces', name: 'Spell', path: 'hausnotiz', kind: 'extra' }),
        expect.objectContaining({ part: 'relations', name: 'partOf', path: 'label', kind: 'different', db: 'Teil von' }),
        expect.objectContaining({ part: 'views', name: 'quick', kind: 'missing' }),
      ]),
    );
    expect(a).toHaveLength(4);
    expect(beschreibeAbweichung(a.find((x) => x.path === 'label')!)).toMatch(/^relations:partOf › label: database "Teil von" ≠ seed /);
  });

  it('steht in der Werkbank, mit dem Weg ins Register', () => {
    const db = kopie();
    db.relations['partOf']!.label = 'Teil von';
    const [r] = runChecks({ registry: db, entities: [], exists: new Map(), seed: seedRegistry }, { only: ['registryDrift'] });
    expect(r!.count).toBe(1);
    expect(r!.hits[0]).toMatchObject({ type: 'relations', name: 'partOf.label', registry: { tab: 'edges', edge: 'partOf' } });
    const ohne = runChecks({ registry: db, entities: [], exists: new Map() }, { only: ['registryDrift'] });
    expect(ohne[0]!.count).toBe(0);
  });
});
