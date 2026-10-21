import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { Werkbank } from '../src/werkbank.js';
import { wohnorte } from '../src/wohnorte.js';

/** Wohnorte (T-182) — erfundene Artikel, keine Daten von 5e.tools. */
const e = (id: string, typ: string, nummer: string, relations: Entity['relations'] = [], extra: Record<string, Record<string, unknown>> = {}): Entity => ({
  id, interfaces: [typ], name: id, components: { Identity: { name: id, id: nummer }, ...extra }, relations,
});
const absatz = (id: string, szene: string, text: string) => e(id, 'Paragraph', `paragraph-${id}`, [{ id: `${id}~p`, type: 'partOf', to: szene, props: { rank: 1 } }], { Prose: { text } });

describe('Wohnorte benannter Kreaturen (T-182)', () => {
  it('setzt livesIn nur, wo genau ein Ort die Kreatur nennt', () => {
    const wb = new Werkbank(seedRegistry);
    wb.entities.push(
      e('ort1', 'Place', 'place-0001'),
      e('ort2', 'Place', 'place-0002'),
      e('sz1', 'Scene', 'scene-0001', [{ id: 'sz1~h', type: 'happensAt', to: 'ort1' }]),
      e('sz2', 'Scene', 'scene-0002', [{ id: 'sz2~h', type: 'happensAt', to: 'ort2' }]),
      e('sz3', 'Scene', 'scene-0003'),
      /* Mira wird in Raum 1 genannt und im Kapiteltext ohne Ort: sie wohnt in Raum 1. */
      e('sb1', 'Statblock', 'statblock-0001', [{ id: 'sb1~b', type: 'belongsTo', to: 'k1' }]),
      e('k1', 'Creature', 'creature-0001'),
      /* Olf wird in zwei Orten genannt: kein Wohnort. */
      e('sb2', 'Statblock', 'statblock-0002', [{ id: 'sb2~b', type: 'belongsTo', to: 'k2' }]),
      e('k2', 'Creature', 'creature-0002'),
      /* Ulla steht als Embed in Raum 2. */
      e('sb3', 'Statblock', 'statblock-0003', [{ id: 'sb3~b', type: 'belongsTo', to: 'k3' }]),
      e('k3', 'Creature', 'creature-0003'),
      absatz('a1', 'sz1', 'Here sits [[statblock-0001|Mira]] with [[statblock-0002|Olf]].'),
      absatz('a2', 'sz2', '[[statblock-0002|Olf]] visits.'),
      absatz('a3', 'sz3', '[[statblock-0001|Mira]] is mentioned in passing.'),
      e('em', 'Embed', 'embed-0001', [{ id: 'em~p', type: 'partOf', to: 'sz2', props: { rank: 2 } }], { Embed: { target: 'sb3' } }),
    );
    expect(wohnorte(wb)).toEqual({ eindeutig: 2, mehrdeutig: 1, nirgends: 0 });
    const wo = (id: string) => wb.entities.find((x) => x.id === id)!.relations!.filter((r) => r.type === 'livesIn').map((r) => r.to);
    expect(wo('k1')).toEqual(['ort1']);
    expect(wo('k2')).toEqual([]);
    expect(wo('k3')).toEqual(['ort2']);
  });
});
