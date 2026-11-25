import { beforeEach, describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { CAMPAIGN_SETTING, type Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

/* Begegnungen Teil 3 (T-215, REQ-085): an einer Begegnung stehen die
   Beteiligten (`features`) mit ihrer Haltung zur Gruppe der Kampagne —
   die `regards`-Kante der Kreatur, als Abfrage, gesiebt wie jeder Artikel —
   und die Leitung sieht, welche Hinweise schon freigegeben sind.
   Erfundene Artikel. */

const PW = 'nebel-wacht-am-tor';
const art = (id: string, typ: string, name: string, nr: string, extra: Partial<Entity> = {}): Entity => ({
  id,
  interfaces: [typ],
  name,
  components: { Identity: { name, id: nr, aliases: [] as string[] }, Status: { status: 'ready' }, ...(extra.components ?? {}) },
  relations: [{ id: `${id}~ly`, type: 'inLayer', to: 'ly-k', props: {} }, ...(extra.relations ?? [])],
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

interface Haltung {
  id: string;
  name: string;
  type: string;
  toward: { id: string; name: string; tags: string[]; note?: string }[];
}

beforeEach(async () => {
  const registry = { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), [CAMPAIGN_SETTING]: 'k' } };
  repo = new InMemoryRepository(registry, [
    { ...art('ly-k', 'Layer', 'Run layer', 'layer-0001'), relations: [] },
    { ...art('k', 'Campaign', 'Run', 'campaign-0001'), relations: [{ id: 'k~1', type: 'activates', to: 'ly-k', props: {} }] },
    art('wacht', 'Party', 'The Watch', 'party-0001', { relations: [{ id: 'p~1', type: 'partyOf', to: 'k', props: {} }] }),
    art('fremd', 'Party', 'Other band', 'party-0002'),
    art('brak', 'PlayerCharacter', 'Brak', 'playercharacter-0001', { relations: [{ id: 'b~1', type: 'memberOfParty', to: 'wacht', props: {} }] }),
    art('vogt', 'Creature', 'Reeve Ansel', 'creature-0001', {
      relations: [
        { id: 'v~1', type: 'regards', to: 'wacht', props: { tags: ['distrusts'], note: 'They broke the toll gate' } },
        { id: 'v~2', type: 'regards', to: 'fremd', props: { tags: ['owes'] } },
      ],
    }),
    art('gilde', 'Faction', 'Salt guild', 'faction-0001', { relations: [{ id: 'g~1', type: 'regards', to: 'wacht', props: { tags: ['curious'] } }] }),
    art('spion', 'Creature', 'Masked listener', 'creature-0002', {
      components: { Visibility: { audience: 'gm' } },
      relations: [{ id: 's~1', type: 'regards', to: 'wacht', props: { tags: ['hunts'] } }],
    }),
    art('stumm', 'Creature', 'Mule', 'creature-0003'),
    art('falle', 'Hazard', 'Loose flagstone', 'hazard-0001'),
    art('treffen', 'Encounter', 'At the toll gate', 'encounter-0001', {
      components: {
        Encounter: {
          kind: ['social', 'puzzle'],
          hint: [
            { id: 'h-coin', value: 'The reeve keeps a ledger.' },
            { id: 'h-seal', value: 'The seal is forged.' },
          ],
        },
      },
      relations: ['vogt', 'gilde', 'spion', 'stumm', 'falle'].map((to, i) => ({ id: `t~${i}`, type: 'features', to, props: {} })),
    }),
  ]);
  app = buildApp({ repo });
  await repo.putUser({ id: 'u_l', name: 'leitung', passwordHash: await hashPassword(PW), isAdmin: false, actorIds: [], roles: { k: 'gm' } });
  await repo.putUser({ id: 'u_b', name: 'brak', passwordHash: await hashPassword(PW), isAdmin: false, actorIds: ['brak'], roles: { k: 'player' } });
  await repo.putUser({ id: 'u_m', name: 'mitleitung', passwordHash: await hashPassword(PW), isAdmin: false, actorIds: [], roles: { k: 'co-gm' } });
  await repo.putUser({ id: 'u_f', name: 'fremd', passwordHash: await hashPassword(PW), isAdmin: false, actorIds: [], roles: { k2: 'gm' } });
  for (const n of ['leitung', 'brak', 'mitleitung', 'fremd']) cookies[n] = await anmelden(n);
});

describe('stances at an encounter (T-215)', () => {
  it('lists who takes part and what they think of the party of this campaign, not of another band', async () => {
    const r = await get('leitung', '/api/entities/treffen');
    expect(r.statusCode, r.body).toBe(200);
    const st = r.json().refs.encounter.stances as Haltung[];
    expect(st.map((s) => s.name)).toEqual(['Masked listener', 'Mule', 'Reeve Ansel', 'Salt guild']);
    expect(st.find((s) => s.id === 'vogt')).toEqual({
      id: 'vogt',
      name: 'Reeve Ansel',
      type: 'Creature',
      toward: [{ id: 'wacht', name: 'The Watch', tags: ['distrusts'], note: 'They broke the toll gate' }],
    });
    expect(st.find((s) => s.id === 'stumm')?.toward).toEqual([]);
    /* Die Falle ist kein Gegenüber — sie hat keine Haltung. */
    expect(st.some((s) => s.id === 'falle')).toBe(false);
  });

  it('holds back a participant the player does not see, and the hints she may not know', async () => {
    const r = (await get('brak', '/api/entities/treffen')).json();
    expect((r.refs.encounter.stances as Haltung[]).map((s) => s.name)).toEqual(['Mule', 'Reeve Ansel', 'Salt guild']);
    expect(r.refs.encounter.revealed).toBeUndefined();
  });

  it('tells the GM which hints the party already knows, one at a time', async () => {
    expect((await get('leitung', '/api/entities/treffen')).json().refs.encounter.revealed).toEqual([]);
    const f = await post('leitung', '/api/knowledge/of/treffen/reveal', { fields: ['Encounter.hint#h-seal'], name: 'At the toll gate: hint 2' });
    expect(f.statusCode, f.body).toBe(200);
    expect((await get('leitung', '/api/entities/treffen')).json().refs.encounter.revealed).toEqual(['Encounter.hint#h-seal']);
    /* Brak liest jetzt genau diesen Hinweis. */
    const hint = (await get('brak', '/api/entities/treffen')).json().components.Encounter?.hint as { id: string }[] | undefined;
    expect(hint?.map((h) => h.id)).toEqual(['h-seal']);
  });

  it('has nothing to say at an article that is not an encounter', async () => {
    expect((await get('leitung', '/api/entities/vogt')).json().refs.encounter).toBeUndefined();
  });
});
