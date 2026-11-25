/**
 * Icons im Register (T-461, REQ-460): die Zeile `icon` an einer Art geht
 * durch `PUT /api/registry/interfaces` und kommt aus `GET /api/registry`
 * zurück — auch an einem Feld —, der Seed trägt Vorgaben je Art, und
 * ein Artikel darf unter `Identity.icon` sein eigenes nennen; die
 * Spielerin bekommt es wie jedes Feld, gesiebt.
 */
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { iconOf, typeIcon, type Entity, type Registry } from '@nw/model';
import { tisch } from './hilfen/tisch.js';

const KAMPAGNE = 'camp_icons';
const EBENE = 'layer_icons';
const ORT = 'place_hafen';

const ebene: Entity = {
  id: EBENE,
  interfaces: ['Layer'],
  components: { Identity: { name: 'Icons', id: 'layer-0001' }, Status: { status: 'ready' } },
  relations: [],
};
const kampagne: Entity = {
  id: KAMPAGNE,
  interfaces: ['Campaign'],
  components: { Identity: { name: 'Nebel', id: 'campaign-0001' }, Status: { status: 'ready' } },
  relations: [
    { id: 'r-l', type: 'inLayer', to: EBENE, props: {} },
    { id: 'r-act', type: 'activates', to: EBENE, props: { order: 5 } },
  ],
};
const hafen: Entity = {
  id: ORT,
  interfaces: ['Place'],
  components: { Identity: { name: 'Hafen', id: 'place-0001', icon: 'globe' }, Status: { status: 'ready' } },
  relations: [{ id: 'r-h', type: 'inLayer', to: EBENE, props: {} }],
};

async function aufbau() {
  return tisch({
    kampagne: KAMPAGNE,
    artikel: [ebene, kampagne, hafen],
    konten: { Mira: { admin: true, roles: { [KAMPAGNE]: 'gm' } }, Sela: { roles: { [KAMPAGNE]: 'player' } } },
  });
}

describe('icons in the registry (T-461)', () => {
  it('the seed gives every area type an icon, inherited down the chain', () => {
    expect(typeIcon(seedRegistry, 'Place')).toBe('map-pin');
    expect(typeIcon(seedRegistry, 'Shop')).toBe('map-pin');
    expect(typeIcon(seedRegistry, 'PlayerCharacter')).toBe('user');
    const ohne = Object.values(seedRegistry.interfaces)
      .filter((i) => !i.abstract && i.area && !typeIcon(seedRegistry, i.name))
      .map((i) => i.name);
    expect(ohne).toEqual([]);
    expect(seedRegistry.interfaces['Identity']!.schema!.properties['icon']).toMatchObject({ type: 'string', format: 'icon' });
  });

  it('a type icon and a field icon survive the round trip through the API', async () => {
    const t = await aufbau();
    const reg = await t.json<Registry>('Mira', 'GET', '/api/registry');
    const ifs = { ...reg.interfaces };
    ifs['Place'] = { ...ifs['Place']!, icon: 'compass' };
    const place = ifs['Place']!;
    place.schema = {
      ...place.schema!,
      properties: { ...place.schema!.properties, kind: { ...place.schema!.properties['kind']!, icon: 'tags' } },
    };
    const put = await t.als('Mira', 'PUT', '/api/registry/interfaces', { payload: ifs });
    expect(put.statusCode, put.body).toBe(200);
    const nachher = await t.json<Registry>('Mira', 'GET', '/api/registry');
    expect(nachher.interfaces['Place']!.icon).toBe('compass');
    expect(nachher.interfaces['Shop']!.icon).toBeUndefined();
    expect(typeIcon(nachher, 'Shop')).toBe('compass');
    expect(nachher.interfaces['Place']!.schema!.properties['kind']!.icon).toBe('tags');
  });

  it('refuses an icon that is not a name', async () => {
    const t = await aufbau();
    const reg = await t.json<Registry>('Mira', 'GET', '/api/registry');
    const ifs = { ...reg.interfaces, Place: { ...reg.interfaces['Place']!, icon: 42 as unknown as string } };
    const put = await t.als('Mira', 'PUT', '/api/registry/interfaces', { payload: ifs });
    expect(put.statusCode).toBe(400);
  });

  it('an article’s own icon reaches the GM and the player alike', async () => {
    const t = await aufbau();
    for (const wer of ['Mira', 'Sela']) {
      const res = await t.als(wer, 'GET', `/api/entities/${ORT}`);
      expect(res.statusCode, wer).toBe(200);
      const e = res.json() as Entity;
      expect(iconOf(seedRegistry, e), wer).toBe('globe');
    }
    /* Die Spielerin schreibt ein Icon in einen fremden Artikel nicht — wie jedes Feld. */
    const put = await t.als('Sela', 'PUT', `/api/entities/${ORT}`, {
      payload: { ...hafen, components: { ...hafen.components, Identity: { ...hafen.components['Identity'], icon: 'sword' } } },
    });
    expect(put.statusCode).toBeGreaterThanOrEqual(400);
  });
});
