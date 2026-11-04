import { beforeEach, describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { CAMPAIGN_SETTING, type Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

/* Die Leitung liest die Artikel ihrer Kampagne ungesiebt (T-447, T-455;
   E-204 a, E-208 a): ein Konto mit gm oder co-gm, ohne Verwaltungsrolle
   und ohne Figur, bekam bisher weder Lösung noch Hinweise noch Geheimnisse
   noch Taktik seiner eigenen Runde, und vor Kampfbeginn keinen Gegner
   einer Begegnung (`redactParticipants`). Die Leitung einer anderen
   Kampagne und die Spielerin bleiben Betrachter wie bisher. Erfundene
   Artikel. */

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
const put = (wer: string, url: string, payload: unknown) =>
  app.inject({ method: 'PUT', url, payload: payload as object, headers: { cookie: cookies[wer] ?? '' } });

beforeEach(async () => {
  const registry = { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), [CAMPAIGN_SETTING]: 'k' } };
  repo = new InMemoryRepository(registry, [
    { ...art('ly-k', 'Layer', 'Run layer', 'layer-0001'), relations: [] },
    { ...art('k', 'Campaign', 'Run', 'campaign-0001'), relations: [{ id: 'k~1', type: 'activates', to: 'ly-k', props: {} }] },
    { ...art('gruppe', 'Party', 'The Watch', 'party-0001'), relations: [{ id: 'gruppe~l', type: 'inLayer', to: 'ly-k', props: {} }, { id: 'gruppe~of', type: 'partyOf', to: 'k', props: {} }] },
    art('brak', 'PlayerCharacter', 'Brak', 'playercharacter-0001', { relations: [{ id: 'brak~p', type: 'memberOfParty', to: 'gruppe', props: {} }] }),
    art('vogt', 'Creature', 'Reeve Ansel', 'creature-0001', { components: { Identity: { name: 'Reeve Ansel', id: 'creature-0001', aliases: [], cover: 'a man in a grey cloak' } } }),
    art('wache', 'Creature', 'Toll guard', 'creature-0002'),
    /* Eine Begegnung vor dem Kampf: kein Teilnehmer aufgedeckt, Taktik der Leitung. */
    art('hinterhalt', 'Encounter', 'Ambush at the ford', 'encounter-0002', {
      components: { Encounter: { kind: ['combat'] }, Tactics: { tactics: [{ id: 't-1', value: 'The guards hold the ford; the reeve flees.' }] } },
      relations: [
        { id: 'hinterhalt~1', type: 'participates', to: 'vogt', props: { initiative: 12, note: 'runs at half HP' } },
        { id: 'hinterhalt~2', type: 'participates', to: 'wache', props: { initiative: 15 } },
        { id: 'hinterhalt~3', type: 'participates', to: 'brak', props: { initiative: 9 } },
      ],
    }),
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

  /* T-455, E-208 a: vor Kampfbeginn stehen der Leitung alle Teilnehmer mit
     Ziel und Werten da; die Spielerin bekommt nur die eigene Figur, die
     Leitung einer anderen Runde ebenso wenig wie sie. */
  it('gives the GM the tactics and every combatant with target and values before the fight; the player and the GM of another campaign stay sieved', async () => {
    const lies = async (wer: string) => (await get(wer, '/api/entities/hinterhalt')).json() as Entity;
    for (const wer of ['leitung', 'mitleitung']) {
      const e = await lies(wer);
      expect(((e.components?.['Tactics'] as { tactics?: { id: string }[] } | undefined)?.tactics ?? []).map((t) => t.id)).toEqual(['t-1']);
      const teilnehmer = (e.relations ?? []).filter((r) => r.type === 'participates');
      expect(teilnehmer.map((r) => r.to).sort()).toEqual(['brak', 'vogt', 'wache']);
      expect(teilnehmer.find((r) => r.to === 'vogt')?.props).toEqual({ initiative: 12, note: 'runs at half HP' });
    }
    for (const wer of ['brak', 'fremd']) {
      const e = await lies(wer);
      expect(e.components?.['Tactics']).toBeUndefined();
      const teilnehmer = (e.relations ?? []).filter((r) => r.type === 'participates');
      /* Die eigene Figur steht immer; die Gegner erst, wenn sie aufgedeckt sind. */
      expect(teilnehmer.map((r) => r.to).filter((z) => z === 'vogt' || z === 'wache')).toEqual([]);
      expect(teilnehmer.some((r) => (r.props as { note?: string } | undefined)?.note)).toBe(false);
    }
  });

  /* Was die Leitung liest, schreibt sie zurück — und verliert dabei
     nichts: kein Feld der Leitung, keinen Teilnehmer. Vorher kam eine
     gesiebte Begegnung aus der Artikelseite zurück und nahm die
     zurückgehaltenen Kanten mit. */
  it('loses no held-back field or edge when the GM saves what they read', async () => {
    const gelesen = (await get('leitung', '/api/entities/hinterhalt')).json() as Entity;
    const res = await put('leitung', '/api/entities/hinterhalt', { ...gelesen, components: { ...gelesen.components, Description: { description: 'Fog over the ford.' } } });
    expect(res.statusCode).toBe(200);
    const danach = (await repo.getEntity('hinterhalt'))!;
    expect((danach.relations ?? []).filter((r) => r.type === 'participates').map((r) => r.to).sort()).toEqual(['brak', 'vogt', 'wache']);
    expect(((danach.components?.['Tactics'] as { tactics?: { id: string }[] } | undefined)?.tactics ?? []).map((t) => t.id)).toEqual(['t-1']);
    expect((danach.components?.['Description'] as { description?: string } | undefined)?.description).toBe('Fog over the ford.');
  });
});
