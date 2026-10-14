import { beforeEach, describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { CAMPAIGN_SETTING, type Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

/* Der Fertigungswert am Rezept (T-122): der Server rechnet `craftCheck`
   für die laufende Kampagne und jede eigene Figur und schickt es als
   `refs.craft` mit. Erfundene Artikel. */

const PW = 'nebel-wacht-am-tor';
const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] as string[] } });
const art = (id: string, typ: string, name: string, nr: string, extra: Partial<Entity> = {}): Entity => ({
  id, interfaces: [typ], name, components: { ...ident(name, nr), ...(extra.components ?? {}) }, relations: extra.relations ?? [],
});

const bestand = (): Entity[] => [
  art('kit', 'Item', 'Herbal kit', 'item-0001', { components: { Item: { itemType: 'tool' } } }),
  art('salbe', 'Recipe', 'Salve', 'recipe-0001', { components: { Recipe: { tool: 'Herbal kit', ability: 'int', dc: 12 } } }),
  art('k', 'Campaign', 'Run', 'campaign-0001', { relations: [{ id: 'k~1', type: 'craftsWith', to: 'kit', props: { ability: 'wis' } }] }),
  art('f', 'Creature', 'Ash', 'creature-0001', { relations: [{ id: 'f~1', type: 'craftsWith', to: 'salbe', props: { dc: 15 } }] }),
];

let app: ReturnType<typeof buildApp>;
let cookie = '';

beforeEach(async () => {
  const registry = { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), [CAMPAIGN_SETTING]: 'k' } };
  const repo = new InMemoryRepository(registry, bestand());
  app = buildApp({ repo });
  await repo.putUser({ id: 'u_l', name: 'leitung', passwordHash: await hashPassword(PW), isAdmin: true, actorIds: ['f'], roles: {} });
  const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name: 'leitung', password: PW } });
  cookie = `nw_session=${res.cookies.find((c) => c.name === 'nw_session')?.value ?? ''}`;
});

describe('refs.craft (T-122)', () => {
  it('nennt den Wert am Tisch und je eigener Figur, mit Herkunft', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/entities/salbe', headers: { cookie } });
    expect(r.statusCode).toBe(200);
    const craft = r.json().refs.craft;
    expect(craft.table).toMatchObject({ tool: 'Herbal kit', ability: 'wis', dc: 12 });
    expect(craft.table.source.ability).toMatchObject({ by: 'campaign', name: 'Run', on: 'tool' });
    expect(craft.mine).toEqual([
      expect.objectContaining({ id: 'f', name: 'Ash', check: expect.objectContaining({ ability: 'wis', dc: 15 }) }),
    ]);
  });

  it('fehlt an allem, was kein Rezept ist', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/entities/kit', headers: { cookie } });
    expect(r.json().refs.craft).toBeUndefined();
  });
});
