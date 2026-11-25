import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { Werkbank } from '../src/werkbank.js';
import { fraktionen, fraktionsUrteile } from '../src/fraktionen.js';

/** Fraktionen benannter Kreaturen (T-183): erfundene Artikel, keine Daten von 5e.tools. */
const e = (id: string, typ: string, nummer: string, relations: Entity['relations'] = [], extra: Record<string, Record<string, unknown>> = {}, name = id): Entity => ({
  id, interfaces: [typ], name, components: { Identity: { name, id: nummer }, ...extra }, relations,
});
const kreatur = (n: number, name: string, lore = '') => [
  e(`sb${n}`, 'Statblock', `statblock-000${n}`, [{ id: `sb${n}~b`, type: 'belongsTo', to: `k${n}` }], lore ? { Lore: { lore: [{ id: 'lore', value: lore }] } } : {}, name),
  e(`k${n}`, 'Creature', `creature-000${n}`, [], {}, name),
];
const fraktion = (n: number, name: string, text = '') => e(`f${n}`, 'Faction', `faction-000${n}`, [], text ? { Prose: { paragraph: [{ id: 'text', value: text }] } } : {}, name);
const mitglied = (wb: Werkbank, id: string) => wb.entities.find((x) => x.id === id)!.relations!.filter((r) => r.type === 'memberOf').map((r) => r.to);

describe('Fraktionen benannter Kreaturen (T-183)', () => {
  it('setzt memberOf, wo genau eine Fraktion die Kreatur nennt oder von ihr genannt wird', () => {
    const wb = new Werkbank(seedRegistry);
    wb.entities.push(
      fraktion(1, 'Order of the Lantern', 'Led by [[statblock-0002|Brann]].'),
      fraktion(2, 'Salt Guild'),
      /* Mira nennt in ihrem Statblock die Gilde. */
      ...kreatur(1, 'Mira', 'Mira keeps the books of the [[faction-0002|Salt Guild]].'),
      /* Brann wird im Text des Ordens genannt. */
      ...kreatur(2, 'Brann'),
      /* Olf nennt den Orden, und die Gilde nennt ihn auch nicht: keine Fraktion. */
      ...kreatur(3, 'Olf'),
    );
    expect(fraktionen(wb)).toEqual({ eindeutig: 2, schutzherr: 0, mehrdeutig: 0, keine: 1 });
    expect(mitglied(wb, 'k1')).toEqual(['f2']);
    expect(mitglied(wb, 'k2')).toEqual(['f1']);
    expect(mitglied(wb, 'k3')).toEqual([]);
  });

  it('macht den Schutzherrn eines Kults nicht zum Mitglied, auch nicht bei Rivalen', () => {
    const wb = new Werkbank(seedRegistry);
    wb.entities.push(
      fraktion(1, 'Cult of Vorlag'),
      fraktion(2, 'Cult of Senn'),
      /* Vorlag nennt seinen Kult und den des Rivalen. */
      ...kreatur(1, 'Vorlag', 'Worshipped by the [[faction-0001|Cult of Vorlag]], hated by the [[faction-0002|Cult of Senn]].'),
    );
    expect(fraktionsUrteile(wb.entities).get('k1')).toEqual({ art: 'schutzherr', fraktionen: ['f1', 'f2'] });
    expect(fraktionen(wb)).toEqual({ eindeutig: 0, schutzherr: 1, mehrdeutig: 0, keine: 0 });
    expect(mitglied(wb, 'k1')).toEqual([]);
  });

  it('rät nicht bei zwei Fraktionen und erkennt den Namen nur als ganzes Wort', () => {
    const wb = new Werkbank(seedRegistry);
    wb.entities.push(
      fraktion(1, 'Salt Guild', 'Members: [[creature-0001|Ann]].'),
      fraktion(2, 'Annals of the Deep'),
      ...kreatur(1, 'Ann', 'She reads the [[faction-0002|Annals of the Deep]].'),
    );
    const u = fraktionsUrteile(wb.entities).get('k1');
    expect(u?.art).toBe('mehrdeutig');
    expect(u && 'fraktionen' in u ? [...u.fraktionen].sort() : []).toEqual(['f1', 'f2']);
  });

  it('lässt eine schon gesetzte Mitgliedschaft stehen und zählt nicht nach Absätzen', () => {
    const wb = new Werkbank(seedRegistry);
    const k = kreatur(1, 'Mira', 'Of the [[faction-0001|Salt Guild]].');
    k[1]!.relations!.push({ id: 'k1~m', type: 'memberOf', to: 'f2' });
    wb.entities.push(
      fraktion(1, 'Salt Guild'),
      fraktion(2, 'Order of the Lantern'),
      ...k,
      ...kreatur(2, 'Brann'),
      /* Ein Abenteuerabsatz nennt Brann und den Orden: keine Mitgliedschaft. */
      e('a1', 'Paragraph', 'paragraph-0001', [], { Prose: { text: 'The [[faction-0002|Order]] hunts [[statblock-0002|Brann]].' } }),
    );
    expect(fraktionen(wb)).toEqual({ eindeutig: 1, schutzherr: 0, mehrdeutig: 0, keine: 1 });
    expect(mitglied(wb, 'k1')).toEqual(['f2']);
    expect(mitglied(wb, 'k2')).toEqual([]);
  });
});
