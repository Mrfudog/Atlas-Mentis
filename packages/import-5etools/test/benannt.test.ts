import { describe, expect, it } from 'vitest';
import type { Entity } from '@nw/model';
import { linkedPeg, stageBases, validateEntity } from '@nw/model';
import { seedRegistry } from '@nw/registry';
import type { Knoten } from '../src/copy.js';
import type { Datenstand } from '../src/lesen.js';
import { lauf } from '../src/lauf.js';
import { buchEbeneId } from '../src/werkbank.js';

/* T-169: zu jedem benannten Statblock eine Kreatur. Die Namen sind erfunden. */
function datenstand(): Datenstand {
  const monster: Knoten[] = [
    {
      name: 'Morwen Ashgrove', source: 'XYZ', page: 40, isNamedCreature: true, shortName: 'Morwen', cr: '5', dex: 14,
      _versions: [{ name: 'Morwen Ashgrove (Wraith Form)', source: 'XYZ', _mod: { '*': { mode: 'replaceTxt', replace: 'x', with: 'y' } } }],
    },
    { name: 'Tobin the Bold (Captain)', source: 'XYZ', isNamedCreature: true, cr: '2' },
    { name: 'Bog Hag', source: 'XYZ', shortName: 'Hag', cr: '3' },
    { name: 'Rat', source: 'XYZ', cr: '0' },
  ];
  return {
    arten: new Map([['monster', monster]]),
    quellen: new Map([['xyz', { id: 'XYZ', name: 'Tales of Xyz', published: '2019-01-01', art: 'adventure' }]]),
  };
}

describe('Benannte Kreaturen (T-169)', () => {
  const { datei, bericht } = lauf(datenstand());
  const es = datei.entities;
  const nach = (typ: string) => es.filter((e) => e.interfaces[0] === typ);

  it('legt je benanntem Statblock eine Kreatur an, der er gehört', () => {
    const kreaturen = nach('Creature');
    expect(kreaturen.map((k) => k.name).sort()).toEqual(['Morwen Ashgrove', 'Tobin the Bold']);
    for (const k of kreaturen) {
      const sb = nach('Statblock').find((s) => s.relations?.some((r) => r.type === 'belongsTo' && r.to === k.id))!;
      expect(sb, k.name).toBeDefined();
      expect(k.id).toBe(linkedPeg(sb.id, 'Creature'));
      expect(k.components['Creature']).toEqual({ kind: 'npc' });
      expect(k.components['Source']).toMatchObject({ publication: 'XYZ' });
      expect(k.relations?.find((r) => r.type === 'inLayer')?.to).toBe(buchEbeneId('XYZ'));
      expect(sb.components['Tags']?.['tags']).toContain('named');
    }
  });

  it('gibt der Spielart keine eigene und dem unbenannten keine', () => {
    const form = nach('Statblock').find((s) => s.name === 'Morwen Ashgrove (Wraith Form)')!;
    expect(form.relations?.some((r) => r.type === 'belongsTo')).toBe(false);
    for (const n of ['Bog Hag', 'Rat']) {
      const sb = nach('Statblock').find((s) => s.name === n)!;
      expect(sb.relations?.some((r) => r.type === 'belongsTo')).toBe(false);
    }
    const notizen = bericht.arten.get('monster')!.notizen;
    expect(notizen.get('benannte Kreatur angelegt')).toBe(2);
    expect(notizen.get('shortName gross, ohne isNamedCreature: keine Kreatur')).toBe(1);
  });

  it('nennt die Kreaturen als Neuzugänge, auch aus dem Grundstand', () => {
    for (const k of nach('Creature')) expect(datei.additions).toContain(k.id);
  });

  it('besteht die Prüfung', () => {
    const arten = new Map(es.map((e) => [e.id, e.interfaces[0] ?? ''] as const));
    const stufen = stageBases(es);
    const fehler = es.flatMap((e: Entity) =>
      validateEntity(seedRegistry, e, { knownTypes: arten, knownIds: new Set(arten.keys()), stageOf: stufen }).map((i) => `${e.name}: ${i.message}`),
    );
    expect(fehler).toEqual([]);
  });
});
