/**
 * **Collection als Artikel** (T-425, REQ-438, E-174): die Mitglieder einer
 * Collection kommen nach Regel über `GET /api/list` und von Hand über die
 * Rückbezüge (`inCollection`), beides gesiebt — die Leitung sieht die
 * geheime Waffe, die Spielerin nicht; eine Kante mit `exclude` nimmt aus.
 */
import { describe, expect, it } from 'vitest';
import { collectionHits, collectionRuleQuery } from '@nw/model';
import type { Entity, IncomingEdge, LayoutElement, Registry } from '@nw/model';
import { tisch } from './hilfen/tisch.js';

const id = (name: string, nr: string) => ({ Identity: { name, id: nr, aliases: [] }, Status: { status: 'ready' } });
const in_ = (x: string) => ({ id: `${x}~in`, type: 'inLayer', to: 'ly_a', props: {} });
const waffe = (x: string, name: string, nr: string, mehr: Partial<Entity> = {}): Entity => ({
  id: x,
  name,
  interfaces: ['Weapon'],
  components: { ...id(name, nr), ...(mehr.components ?? {}) },
  relations: [in_(x), ...(mehr.relations ?? [])],
});

const ARTIKEL: Entity[] = [
  { id: 'ly_a', name: 'Runde A', interfaces: ['Layer'], components: { ...id('Runde A', 'layer-0001'), Layer: { kind: 'campaign', order: 50 } }, relations: [] },
  { id: 'camp_a', name: 'Nebel', interfaces: ['Campaign'], components: id('Nebel', 'campaign-0001'), relations: [{ id: 'camp_a~ac', type: 'activates', to: 'ly_a', props: { order: 10 } }] },
  { id: 'col_w', name: 'Our weapons', interfaces: ['Collection'], components: { ...id('Our weapons', 'collection-0001'), Collection: { types: ['Weapon'] } }, relations: [in_('col_w')] },
  waffe('w_dolch', 'Dagger', 'weapon-0001'),
  waffe('w_geheim', 'Sunblade', 'weapon-0002', { components: { Visibility: { audience: 'gm' } } }),
  waffe('w_keule', 'Club', 'weapon-0003', { relations: [{ id: 'w_keule~c', type: 'inCollection', to: 'col_w', props: { exclude: true } }] }),
  { id: 'i_seil', name: 'Rope', interfaces: ['Item'], components: id('Rope', 'item-0001'), relations: [in_('i_seil'), { id: 'i_seil~c', type: 'inCollection', to: 'col_w', props: {} }] },
];

describe('a collection article lists its members (T-425, E-174)', () => {
  it('by rule and by hand, sieved per viewer, the excluded one out', async () => {
    const t = await tisch({
      kampagne: 'camp_a',
      artikel: ARTIKEL,
      konten: { Basil: { roles: { camp_a: 'gm' } }, Sela: { roles: { camp_a: 'player' } } },
    });
    const el: LayoutElement = { id: 'm', el: 'collection', source: 'members', sort: { by: 'name' } };
    const fuer = async (wer: string) => {
      const c = await t.json<Entity>(wer, 'GET', '/api/entities/col_w');
      const q = collectionRuleQuery(c)!;
      const liste = await t.json<{ rows: { id: string }[] }>(wer, 'GET', `/api/list?of=${q.of!.join(',')}&limit=${q.limit}`);
      const rueck = await t.json<{ relation: { type: string; props?: Record<string, unknown> }; from: { id: string } }[]>(wer, 'GET', '/api/entities/col_w/backlinks');
      const incoming: IncomingEdge[] = rueck.map((b) => ({ type: b.relation.type, from: b.from.id, props: b.relation.props }));
      const ids = [...new Set([...liste.rows.map((z) => z.id), ...incoming.map((k) => k.from)])];
      const geholt = new Map<string, Entity>();
      for (const x of ids) {
        const res = await t.als(wer, 'GET', `/api/entities/${x}`);
        if (res.statusCode === 200) geholt.set(x, res.json() as Entity);
      }
      const found = liste.rows.map((z) => geholt.get(z.id)).filter((e): e is Entity => !!e);
      const registry = await t.json<Registry>(wer, 'GET', '/api/registry');
      return collectionHits(registry, c, el, {
        get: (x) => geholt.get(x),
        incoming: (x) => (x === 'col_w' ? incoming : []),
        found,
      }).map((h) => h.entity.name);
    };
    expect(await fuer('Basil')).toEqual(['Dagger', 'Rope', 'Sunblade']);
    expect(await fuer('Sela')).toEqual(['Dagger', 'Rope']);
  });
});
