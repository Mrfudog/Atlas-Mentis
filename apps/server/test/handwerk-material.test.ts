import { beforeEach, describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { CAMPAIGN_SETTING, type Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

/* Materialien erst beim Start wählen (T-197): die Materialwahl je
   Bestandteil mit Gründen, eine Materialgruppe statt eines Gegenstands,
   Ersatz nach einer Regel, die die Kampagne spielt. Erfundene Artikel. */

const PW = 'nebel-wacht-am-tor';
const art = (id: string, typ: string, name: string, extra: Partial<Entity> = {}): Entity => ({
  id, interfaces: [typ], name, components: { Identity: { name, id: `${typ.toLowerCase()}-${id}` }, ...(extra.components ?? {}) }, relations: extra.relations ?? [],
});
const stoff = (id: string, name: string, materialType: string, rarity: string) =>
  art(id, 'Material', name, { components: { Material: { materialType }, Item: { rarity } } });
const holds = (id: string, to: string, qty: number) => ({ id, type: 'holds', to, props: { qty, tier: 'pack' } });

function bestand(mitRegel: boolean): Entity[] {
  return [
    stoff('r-u', 'Uncommon Glow Reagent', 'reagent', 'uncommon'),
    stoff('r-c', 'Common Glow Reagent', 'reagent', 'common'),
    stoff('k-u', 'Uncommon Bitterleaf', 'herb', 'uncommon'),
    stoff('k-c', 'Common Bitterleaf', 'herb', 'common'),
    art('grp', 'MaterialGroup', 'Any reagent, uncommon or better', { components: { MaterialGroup: { materialTypes: ['reagent'], rarityMin: 'uncommon' } } }),
    art('sub', 'Substitution', 'Herbs for reagents', { components: { Substitution: { replaces: ['reagent'], with: ['herb'], rarity: 'same' } } }),
    art('tonic', 'Recipe', 'Glow tonic', {
      components: { Recipe: { dc: 12, checks: 1 } },
      relations: [
        { id: 't~1', type: 'needs', to: 'r-u', props: { qty: 1 } },
        { id: 't~2', type: 'needs', to: 'grp', props: { qty: 1 } },
        { id: 't~3', type: 'knowledge', to: 'info', props: {} },
      ],
    }),
    art('info', 'Information', 'How to brew', { relations: [{ id: 'i~1', type: 'knownBy', to: 'f', props: {} }] }),
    art('k', 'Campaign', 'Run', { relations: mitRegel ? [{ id: 'k~s', type: 'allowsSubstitution', to: 'sub' }] : [] }),
    art('g', 'Party', 'Band', { relations: [{ id: 'g~1', type: 'partyOf', to: 'k' }, { id: 'g~2', type: 'carries', to: 'inv-g' }] }),
    art('f', 'Creature', 'Ash', { relations: [{ id: 'f~1', type: 'memberOfParty', to: 'g' }, { id: 'f~2', type: 'carries', to: 'inv-f' }] }),
    art('inv-f', 'Inventory', 'Ash’s pack', { relations: [holds('h1', 'r-c', 2), holds('h2', 'k-u', 2), holds('h3', 'k-c', 1)] }),
    art('inv-g', 'Inventory', 'Band chest', { relations: [holds('h4', 'r-u', 1)] }),
  ];
}

let app: ReturnType<typeof buildApp>;
let repo: InMemoryRepository;
const cookies: Record<string, string> = {};

async function aufbauen(mitRegel: boolean) {
  const registry = { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), [CAMPAIGN_SETTING]: 'k' } };
  repo = new InMemoryRepository(registry, bestand(mitRegel));
  app = buildApp({ repo });
  await repo.putUser({ id: 'u_l', name: 'leitung', passwordHash: await hashPassword(PW), isAdmin: false, actorIds: [], roles: { k: 'gm' } });
  await repo.putUser({ id: 'u_s', name: 'spielerin', passwordHash: await hashPassword(PW), isAdmin: false, actorIds: ['f'], roles: { k: 'player' } });
  for (const [k, name] of [['l', 'leitung'], ['s', 'spielerin']] as const) {
    const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PW } });
    cookies[k] = `nw_session=${res.cookies.find((c) => c.name === 'nw_session')?.value ?? ''}`;
  }
}

const get = (wer: string, url: string) => app.inject({ method: 'GET', url, headers: { cookie: cookies[wer] ?? '' } });
const post = (wer: string, url: string, payload: unknown) => app.inject({ method: 'POST', url, payload: payload as object, headers: { cookie: cookies[wer] ?? '' } });

type Wahl = { key: string; options: { edge: string; via?: { id: string } }[]; rejected: { edge: string; reason: string }[] };

describe('Materialwahl beim Start (T-197)', () => {
  describe('ohne Ersatzregel', () => {
    beforeEach(async () => aufbauen(false));

    it('nennt je Bestandteil, was passt, und was nicht, mit Grund', async () => {
      const r = await get('l', '/api/crafting/tonic/materials?actor=f');
      expect(r.statusCode, r.body).toBe(200);
      const [genau, gruppe] = r.json().needs as Wahl[];
      expect(genau!.options.map((o) => o.edge)).toEqual(['h4']);
      // Dieselbe Materialart, andere Seltenheit: naheliegend, mit Grund.
      expect(genau!.rejected).toEqual([expect.objectContaining({ edge: 'h1', reason: 'not Uncommon Glow Reagent' })]);
      expect(gruppe!.options.map((o) => o.edge)).toEqual(['h4']);
      expect(gruppe!.rejected.find((x) => x.edge === 'h1')?.reason).toBe('rarity common, below uncommon');
      // Ein Kraut ist ohne Ersatzregel kein naheliegendes Reagenz.
      expect(gruppe!.rejected.map((x) => x.edge)).toEqual(['h1']);
      expect(r.json().substitutions).toEqual([]);
    });

    it('fragt nur für die eigene Figur', async () => {
      await repo.putUser({ id: 'u_x', name: 'fremd', passwordHash: await hashPassword(PW), isAdmin: false, actorIds: [], roles: { k: 'player' } });
      const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name: 'fremd', password: PW } });
      const c = `nw_session=${res.cookies.find((x) => x.name === 'nw_session')?.value ?? ''}`;
      expect((await app.inject({ method: 'GET', url: '/api/crafting/tonic/materials?actor=f', headers: { cookie: c } })).statusCode).toBe(403);
    });

    it('lehnt beim Start ein Stück ab, das nicht passt, und sagt warum', async () => {
      const r = await post('s', '/api/crafting', {
        recipe: 'tonic',
        actor: 'f',
        materials: [
          { inventory: 'inv-g', edge: 'h4', qty: 1, need: 't~1' },
          { inventory: 'inv-f', edge: 'h1', qty: 1, need: 't~2' },
        ],
      });
      expect(r.statusCode).toBe(422);
      expect(r.json().error).toContain('rarity common, below uncommon');
    });
  });

  describe('mit „Herbs for reagents"', () => {
    beforeEach(async () => aufbauen(true));

    it('bietet das Kraut gleicher Seltenheit als Ersatz an, das gewöhnliche nicht', async () => {
      const w = (await get('s', '/api/crafting/tonic/materials?actor=f')).json();
      expect(w.substitutions).toEqual([{ id: 'sub', name: 'Herbs for reagents', does: 'herb of the same rarity may stand in for one reagent.' }]);
      const [genau, gruppe] = w.needs as Wahl[];
      expect(genau!.options.find((o) => o.edge === 'h2')?.via?.id).toBe('sub');
      expect(genau!.rejected.find((x) => x.edge === 'h3')?.reason).toBe('not Uncommon Glow Reagent; as Herbs for reagents: rarity common, needs uncommon');
      expect(gruppe!.options.map((o) => o.edge).sort()).toEqual(['h2', 'h4']);
    });

    it('reserviert je Bestandteil und rechnet beim Abbruch zurück', async () => {
      const r = await post('s', '/api/crafting', {
        recipe: 'tonic',
        actor: 'f',
        materials: [
          { inventory: 'inv-f', edge: 'h2', qty: 1, need: 't~1' },
          { inventory: 'inv-g', edge: 'h4', qty: 1, need: 't~2' },
        ],
      });
      expect(r.statusCode, r.body).toBe(200);
      const id = r.json().id as string;
      const f = (await repo.getEntity('inv-f'))?.relations ?? [];
      expect(f.find((h) => h.props?.['reservedFor'] === id)?.props).toMatchObject({ qty: 1, forNeed: 't~1', reservedFor: id });
      const sicht = (await get('s', `/api/crafting/${id}`)).json();
      expect(sicht.order.reserved.find((p: { item: string }) => p.item === 'k-u')).toMatchObject({ for: 'Uncommon Glow Reagent', consumed: true });
      expect((await post('s', `/api/crafting/${id}/abort`, {})).statusCode).toBe(200);
      const nach = (await repo.getEntity('inv-f'))?.relations ?? [];
      expect(nach.some((h) => h.props?.['forNeed'] || h.props?.['reservedFor'])).toBe(false);
      expect(nach.filter((h) => h.to === 'k-u').reduce((s, h) => s + Number(h.props?.['qty']), 0)).toBe(2);
    });
  });
});
