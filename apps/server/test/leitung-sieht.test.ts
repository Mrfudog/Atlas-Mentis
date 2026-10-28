import { beforeEach, describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { CAMPAIGN_SETTING, type Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

/* Die Leitung liest die Artikel ihrer Kampagne ungekürzt (T-447, E-204):
   ein Konto mit gm oder co-gm, ohne Verwaltungsrolle und ohne Figur,
   bekam bisher weder Lösung noch Hinweise noch Geheimnisse seiner eigenen
   Runde. Die Leitung einer anderen Kampagne und die Spielerin bleiben
   Betrachter wie bisher. Erfundene Artikel. */

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
const get = (wer: string, url: string) => app.inject({ method: 'GET', url, headers: { cookie: cookies[wer] ?? '' } });

beforeEach(async () => {
  const registry = { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), [CAMPAIGN_SETTING]: 'k' } };
  repo = new InMemoryRepository(registry, [
    { ...art('ly-k', 'Layer', 'Run layer', 'layer-0001'), relations: [] },
    { ...art('k', 'Campaign', 'Run', 'campaign-0001'), relations: [{ id: 'k~1', type: 'activates', to: 'ly-k', props: {} }] },
    art('brak', 'PlayerCharacter', 'Brak', 'playercharacter-0001'),
    art('treffen', 'Encounter', 'At the toll gate', 'encounter-0001', {
      components: {
        Encounter: { kind: ['puzzle'], solution: 'Show the forged seal.', hint: [{ id: 'h-seal', value: 'The seal is forged.' }] },
        Secrets: { secret: [{ id: 's-1', value: 'The reeve is paid by the guild.' }] },
      },
    }),
  ]);
  app = buildApp({ repo });
  const konto = async (id: string, name: string, actorIds: string[], roles: Record<string, 'gm' | 'co-gm' | 'player'>) =>
    repo.putUser({ id, name, passwordHash: await hashPassword(PW), isAdmin: false, actorIds, roles });
  await konto('u_l', 'leitung', [], { k: 'gm' });
  await konto('u_m', 'mitleitung', [], { k: 'co-gm' });
  await konto('u_b', 'brak', ['brak'], { k: 'player' });
  await konto('u_f', 'fremd', [], { k2: 'gm' });
  for (const n of ['leitung', 'mitleitung', 'brak', 'fremd']) {
    const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name: n, password: PW } });
    cookies[n] = `nw_session=${res.cookies.find((c) => c.name === 'nw_session')?.value ?? ''}`;
  }
});

describe('the GM reads the articles of their campaign whole (T-447, E-204)', () => {
  it('gives GM and co-GM without a character of their own the fields of the GM; not the player, not the GM of another campaign', async () => {
    const lies = async (wer: string) => (await get(wer, '/api/entities/treffen')).json().components as Record<string, Record<string, unknown> | undefined>;
    for (const wer of ['leitung', 'mitleitung']) {
      const c = await lies(wer);
      expect(c['Encounter']?.['solution']).toBe('Show the forged seal.');
      expect((c['Encounter']?.['hint'] as { id: string }[]).map((h) => h.id)).toEqual(['h-seal']);
      expect((c['Secrets']?.['secret'] as { id: string }[]).map((h) => h.id)).toEqual(['s-1']);
    }
    for (const wer of ['brak', 'fremd']) {
      const c = await lies(wer);
      expect(c['Encounter']?.['solution']).toBeUndefined();
      expect(c['Encounter']?.['hint']).toBeUndefined();
      expect(c['Secrets']?.['secret']).toBeUndefined();
    }
  });
});
