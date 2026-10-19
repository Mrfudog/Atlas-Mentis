import { beforeEach, describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { CAMPAIGN_SETTING, type Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

/* Der Reiter Knowledge (T-286) und Wissen über die Herkunft (T-285):
   die Leitung legt an einer Blaupause eine Information an und hängt sie
   an ein Bündel, das der Herkunft „Orc" zugeteilt ist; eine Figur mit
   dieser Herkunft liest das Feld, eine andere nicht. Erfundene Artikel. */

const PW = 'nebel-wacht-am-tor';
const art = (id: string, typ: string, name: string, nr: string, extra: Partial<Entity> = {}): Entity => ({
  id, interfaces: [typ], name, components: { Identity: { name, id: nr, aliases: [] as string[] }, ...(extra.components ?? {}) }, relations: extra.relations ?? [],
});

let app: ReturnType<typeof buildApp>;
let repo: InMemoryRepository;
const cookies: Record<string, string> = {};

async function anmelden(name: string): Promise<string> {
  const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PW } });
  return `nw_session=${res.cookies.find((c) => c.name === 'nw_session')?.value ?? ''}`;
}
const get = (wer: string, url: string) => app.inject({ method: 'GET', url, headers: { cookie: cookies[wer] ?? '' } });
const post = (wer: string, url: string, payload: unknown) => app.inject({ method: 'POST', url, payload: payload as object, headers: { cookie: cookies[wer] ?? '' } });
const put = (wer: string, url: string, payload: unknown) => app.inject({ method: 'PUT', url, payload: payload as object, headers: { cookie: cookies[wer] ?? '' } });
const del = (wer: string, url: string) => app.inject({ method: 'DELETE', url, headers: { cookie: cookies[wer] ?? '' } });

beforeEach(async () => {
  const registry = { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), [CAMPAIGN_SETTING]: 'k' } };
  repo = new InMemoryRepository(registry, [
    art('ly-k', 'Layer', 'Run layer', 'layer-0001'),
    art('k', 'Campaign', 'Run', 'campaign-0001', { relations: [{ id: 'k~1', type: 'activates', to: 'ly-k', props: {} }] }),
    art('orc', 'Ancestry', 'Orc', 'ancestry-0001'),
    art('elf', 'Ancestry', 'Elf', 'ancestry-0002'),
    art('axt', 'Recipe', 'Bone axe', 'recipe-0001', { components: { Recipe: { dc: 14, time: '2 days' } } }),
    art('kn-orcs', 'Knowledge', 'Orc lore', 'knowledge-0001', {
      relations: [{ id: 'kn~1', type: 'knownBy', to: 'orc', props: {} }, { id: 'kn~2', type: 'inLayer', to: 'ly-k', props: {} }],
    }),
    art('brak', 'PlayerCharacter', 'Brak', 'playercharacter-0001', { relations: [{ id: 'b~1', type: 'hasAncestry', to: 'orc' }] }),
    art('lia', 'PlayerCharacter', 'Lia', 'playercharacter-0002', { relations: [{ id: 'l~1', type: 'hasAncestry', to: 'elf' }] }),
  ]);
  app = buildApp({ repo });
  await repo.putUser({ id: 'u_l', name: 'leitung', passwordHash: await hashPassword(PW), isAdmin: false, actorIds: [], roles: { k: 'gm' } });
  await repo.putUser({ id: 'u_b', name: 'brak', passwordHash: await hashPassword(PW), isAdmin: false, actorIds: ['brak'], roles: { k: 'player' } });
  await repo.putUser({ id: 'u_e', name: 'lia', passwordHash: await hashPassword(PW), isAdmin: false, actorIds: ['lia'], roles: { k: 'player' } });
  for (const n of ['leitung', 'brak', 'lia']) cookies[n] = await anmelden(n);
});

describe('the Knowledge tab (T-286)', () => {
  it('lets the GM add an information to a blueprint without changing it, in a bundle given to an ancestry', async () => {
    const r = await post('leitung', '/api/knowledge/of/axt', { name: 'How to knap bone', fields: ['Recipe.dc', 'Recipe.time'], bundles: ['kn-orcs'] });
    expect(r.statusCode, r.body).toBe(200);
    const s = r.json();
    expect(s.infos).toEqual([expect.objectContaining({ name: 'How to knap bone', fields: ['Recipe.dc', 'Recipe.time'], scope: 'article', bundles: [{ id: 'kn-orcs', name: 'Orc lore' }] })]);
    /* Die Blaupause selbst bleibt, wie sie war. */
    expect((await repo.getEntity('axt'))?.relations ?? []).toEqual([]);
    /* Brak (Orc) liest die Felder, Lia (Elf) nicht. */
    expect((await get('brak', '/api/entities/axt')).json().components.Recipe).toMatchObject({ dc: 14, time: '2 days' });
    expect((await get('lia', '/api/entities/axt')).json().components.Recipe).toBeUndefined();
  });

  it('changes fields and bundles, makes a new bundle, and removes the information again', async () => {
    const id = (await post('leitung', '/api/knowledge/of/axt', { fields: ['Recipe.dc'], bundles: [] })).json().infos[0].id as string;
    const r = await put('leitung', `/api/knowledge/info/${id}`, { fields: ['Recipe.time'], newBundle: 'Smithing secrets', article: 'axt' });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().infos[0]).toMatchObject({ fields: ['Recipe.time'], bundles: [expect.objectContaining({ name: 'Smithing secrets' })] });
    expect(r.json().bundles.map((b: { name: string }) => b.name)).toEqual(['Orc lore', 'Smithing secrets']);
    expect((await del('leitung', `/api/knowledge/info/${id}`)).statusCode).toBe(200);
    expect((await get('leitung', '/api/knowledge/of/axt')).json().infos).toEqual([]);
  });

  it('is for the GM only', async () => {
    expect((await get('brak', '/api/knowledge/of/axt')).statusCode).toBe(403);
    expect((await post('brak', '/api/knowledge/of/axt', { fields: ['Recipe.dc'] })).statusCode).toBe(403);
  });
});

describe('the page of a knowledge (T-287)', () => {
  it('writes out what it brings together for whoever knows it, and only that it exists for others', async () => {
    await post('leitung', '/api/knowledge/of/axt', { name: 'How to knap bone', fields: ['Recipe.dc'], bundles: ['kn-orcs'] });
    const brak = (await get('brak', '/api/knowledge/kn-orcs/contents')).json();
    expect(brak.known).toBe(true);
    expect(brak.infos).toEqual([
      expect.objectContaining({ name: 'How to knap bone', articles: [expect.objectContaining({ id: 'axt', cells: [expect.objectContaining({ ref: 'Recipe.dc', text: '14' })] })] }),
    ]);
    /* Nur die abgedeckten Felder, nicht die übrigen der Blaupause. */
    expect(JSON.stringify(brak)).not.toContain('2 days');
    expect((await get('lia', '/api/knowledge/kn-orcs/contents')).json()).toMatchObject({ known: false, infos: [] });
    expect((await get('leitung', '/api/knowledge/kn-orcs/contents')).json().known).toBe(true);
  });

  it('lists the articles an information for a group holds for', async () => {
    await repo.putEntity(art('grok', 'Creature', 'Grok', 'creature-0001', { components: { Creature: { species: 'orc' } }, relations: [] }));
    await repo.putEntity(
      art('info-orc', 'Information', 'Orc names', 'information-0001', {
        components: { Information: { fields: ['Identity.name'], applies: { types: ['Creature'], where: [{ field: 'Creature.species', has: ['orc'] }] } } },
      }),
    );
    const kn = (await repo.getEntity('kn-orcs'))!;
    await repo.putEntity({ ...kn, relations: [...(kn.relations ?? []), { id: 'kn~3', type: 'includes', to: 'info-orc', props: {} }] });
    const w = (await get('brak', '/api/knowledge/kn-orcs/contents')).json();
    const i = w.infos.find((x: { id: string }) => x.id === 'info-orc');
    expect(i.applies).toContain('Creature');
    expect(i.articles.map((a: { id: string }) => a.id)).toEqual(['grok']);
  });
});

