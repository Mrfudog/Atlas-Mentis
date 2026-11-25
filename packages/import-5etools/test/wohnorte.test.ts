import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { Werkbank } from '../src/werkbank.js';
import { wohnorte } from '../src/wohnorte.js';

/** Wohnorte (T-182) — erfundene Artikel, keine Daten von 5e.tools. */
const e = (id: string, typ: string, nummer: string, relations: Entity['relations'] = [], extra: Record<string, Record<string, unknown>> = {}): Entity => ({
  id, interfaces: [typ], name: id, components: { Identity: { name: id, id: nummer }, ...extra }, relations,
});
const absatz = (id: string, szene: string, text: string, rank = 1) => e(id, 'Paragraph', `paragraph-${id}`, [{ id: `${id}~p`, type: 'partOf', to: szene, props: { rank } }], { Prose: { text } });
const ueberschrift = (id: string, szene: string, rank: number) => e(id, 'Heading', `heading-${id}`, [{ id: `${id}~p`, type: 'partOf', to: szene, props: { rank } }]);
const benannt = (n: number) => [
  e(`sb${n}`, 'Statblock', `statblock-00${n}`, [{ id: `sb${n}~b`, type: 'belongsTo', to: `k${n}` }]),
  e(`k${n}`, 'Creature', `creature-00${n}`),
];

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
    expect(wohnorte(wb)).toEqual({ eindeutig: 2, mehrdeutig: 1, sammelstelle: 0, nirgends: 0 });
    const wo = (id: string) => wb.entities.find((x) => x.id === id)!.relations!.filter((r) => r.type === 'livesIn').map((r) => r.to);
    expect(wo('k1')).toEqual(['ort1']);
    expect(wo('k2')).toEqual([]);
    expect(wo('k3')).toEqual(['ort2']);
  });

  it('eine Überschrift wechselt den Ort; eine Sammelstelle ist kein Zuhause', () => {
    const wb = new Werkbank(seedRegistry);
    wb.entities.push(
      e('stadt', 'Place', 'place-0001'),
      e('turm', 'Place', 'place-0002', [{ id: 'turm~d', type: 'describedIn', to: 'h1' }]),
      e('sz', 'Scene', 'scene-0001', [{ id: 'sz~h', type: 'happensAt', to: 'stadt' }]),
      ...benannt(11), ...benannt(12), ...benannt(13), ...benannt(14), ...benannt(15), ...benannt(16),
      /* Vier in der Stadt — zu viele; einer im Turm; einer nach einer Überschrift ohne Ort. */
      absatz('a1', 'sz', '[[statblock-0011|A]] [[statblock-0012|B]] [[statblock-0013|C]] [[statblock-0014|D]]', 1),
      ueberschrift('h1', 'sz', 2),
      absatz('a2', 'sz', '[[statblock-0015|E]] lives up here.', 3),
      ueberschrift('h2', 'sz', 4),
      absatz('a3', 'sz', '[[statblock-0016|F]] is somewhere.', 5),
    );
    expect(wohnorte(wb)).toEqual({ eindeutig: 1, mehrdeutig: 0, sammelstelle: 4, nirgends: 1 });
    expect(wb.entities.find((x) => x.id === 'k15')!.relations!.filter((r) => r.type === 'livesIn').map((r) => r.to)).toEqual(['turm']);
  });
});
