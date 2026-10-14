import { beforeEach, describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { CAMPAIGN_SETTING, type Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

/* Der Fertigungsauftrag (T-128): starten mit Material aus Figur und
   Gruppe (reserviert), Proben, Bestätigung durch die Leitung, Erfolg
   verbraucht, Abbruch gibt frei, Misserfolg nach der Regel der Kampagne.
   Erfundene Artikel, kein Buchinhalt. */

const PW = 'nebel-wacht-am-tor';
const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] as string[] } });
const art = (id: string, typ: string, name: string, nr: string, extra: Partial<Entity> = {}): Entity => ({
  id, interfaces: [typ], name, components: { ...ident(name, nr), ...(extra.components ?? {}) }, relations: extra.relations ?? [],
});
const holds = (id: string, to: string, qty: number) => ({ id, type: 'holds', to, props: { qty, tier: 'pack' } });

function bestand(kampagne: Record<string, unknown> = {}): Entity[] {
  return [
    art('kraut', 'Item', 'Moonleaf', 'item-0001'),
    art('moerser', 'Item', 'Mortar', 'item-0002'),
    art('trank', 'Item', 'Draught', 'item-0003'),
    art('salbe', 'Recipe', 'Draught recipe', 'recipe-0001', {
      components: { Recipe: { dc: 12, checks: 2, yieldCount: 2, onFailure: 'halfLost' } },
      relations: [
        { id: 's~1', type: 'needs', to: 'kraut', props: { qty: 3 } },
        { id: 's~2', type: 'needs', to: 'moerser', props: { qty: 1, consumed: false } },
        { id: 's~3', type: 'yields', to: 'trank', props: {} },
        { id: 's~4', type: 'knowledge', to: 'info', props: {} },
      ],
    }),
    art('geheim', 'Recipe', 'Unknown recipe', 'recipe-0002', { relations: [{ id: 'x~1', type: 'needs', to: 'kraut', props: { qty: 1 } }] }),
    art('info', 'Information', 'How to brew', 'information-0001', { relations: [{ id: 'i~1', type: 'knownBy', to: 'f', props: {} }] }),
    art('k', 'Campaign', 'Run', 'campaign-0001', { components: { Campaign: kampagne } }),
    art('g', 'Party', 'Band', 'party-0001', { relations: [{ id: 'g~1', type: 'partyOf', to: 'k' }, { id: 'g~2', type: 'carries', to: 'inv-g' }] }),
    art('f', 'Creature', 'Ash', 'creature-0001', { relations: [{ id: 'f~1', type: 'memberOfParty', to: 'g' }, { id: 'f~2', type: 'carries', to: 'inv-f' }] }),
    art('inv-f', 'Inventory', 'Ash’s pack', 'inventory-0001', { relations: [holds('h1', 'kraut', 5), holds('h2', 'moerser', 1)] }),
    art('inv-g', 'Inventory', 'Band chest', 'inventory-0002', { relations: [holds('h3', 'kraut', 1)] }),
  ];
}

let app: ReturnType<typeof buildApp>;
let repo: InMemoryRepository;
const cookies: Record<string, string> = {};

async function anmelden(name: string): Promise<string> {
  const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PW } });
  return `nw_session=${res.cookies.find((c) => c.name === 'nw_session')?.value ?? ''}`;
}

async function aufbauen(kampagne: Record<string, unknown> = {}) {
  const registry = { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), [CAMPAIGN_SETTING]: 'k' } };
  repo = new InMemoryRepository(registry, bestand(kampagne));
  app = buildApp({ repo });
  await repo.putUser({ id: 'u_l', name: 'leitung', passwordHash: await hashPassword(PW), isAdmin: false, actorIds: [], roles: { k: 'gm' } });
  await repo.putUser({ id: 'u_s', name: 'spielerin', passwordHash: await hashPassword(PW), isAdmin: false, actorIds: ['f'], roles: { k: 'player' } });
  cookies['l'] = await anmelden('leitung');
  cookies['s'] = await anmelden('spielerin');
}

const post = (wer: string, url: string, payload: unknown = {}) => app.inject({ method: 'POST', url, payload: payload as object, headers: { cookie: cookies[wer] ?? '' } });
const get = (wer: string, url: string) => app.inject({ method: 'GET', url, headers: { cookie: cookies[wer] ?? '' } });
const holdsVon = async (inv: string) => ((await repo.getEntity(inv))?.relations ?? []).filter((r) => r.type === 'holds');

/** Die Spielerin startet mit 2 Kraut aus dem Gepäck, 1 aus der Truhe der Gruppe und dem Mörser. */
async function starten(): Promise<string> {
  const r = await post('s', '/api/crafting', {
    recipe: 'salbe',
    actor: 'f',
    materials: [
      { inventory: 'inv-f', edge: 'h1', qty: 2 },
      { inventory: 'inv-g', edge: 'h3', qty: 1 },
      { inventory: 'inv-f', edge: 'h2', qty: 1 },
    ],
  });
  expect(r.statusCode, r.body).toBe(200);
  return r.json().id as string;
}

describe('Fertigungsauftrag (T-128)', () => {
  beforeEach(async () => aufbauen());

  it('am Rezept: gelernt, freies Material aus Figur und Gruppe', async () => {
    const r = await get('s', '/api/crafting/salbe');
    expect(r.statusCode).toBe(200);
    const sicht = r.json();
    expect(sicht.kind).toBe('recipe');
    expect(sicht.rules).toEqual({ failure: 'recipe', critSuccess: 'asSuccess', critFailure: 'asFailure', confirm: 'gm' });
    expect(sicht.actors).toHaveLength(1);
    expect(sicht.actors[0]).toMatchObject({ id: 'f', learned: true });
    expect(sicht.actors[0].stock.map((s: { owner: string; qty: number }) => `${s.owner}:${s.qty}`).sort()).toEqual(['Ash:1', 'Ash:5', 'Band:1']);
  });

  it('starten reserviert, teilt den Stapel und ist eine Instanz des Rezepts', async () => {
    const id = await starten();
    const auftrag = await repo.getEntity(id);
    expect(auftrag?.interfaces).toEqual(['CraftingOrder']);
    expect(auftrag?.relations?.find((r) => r.type === 'instanceOf')?.to).toBe('salbe');
    // Was das Rezept sagt, steht nicht am Auftrag — es wird gelesen.
    expect(auftrag?.components?.['Recipe']).toBeUndefined();
    const f = await holdsVon('inv-f');
    expect(f.find((h) => h.id === 'h1')?.props).toMatchObject({ qty: 3 });
    expect(f.filter((h) => h.props?.['reservedFor'] === id).map((h) => [h.to, h.props?.['qty']])).toEqual(
      expect.arrayContaining([['kraut', 2], ['moerser', 1]]),
    );
    expect((await holdsVon('inv-g'))[0]?.props).toMatchObject({ qty: 1, reservedFor: id });
    expect((await repo.getEntity('f'))?.relations?.some((r) => r.type === 'crafting' && r.to === id)).toBe(true);

    const sicht = (await get('s', `/api/crafting/${id}`)).json();
    expect(sicht.order).toMatchObject({ unit: 'checks', needed: 2, progress: 0, outcome: 'open', check: { dc: 12 } });
    expect(sicht.order.reserved).toHaveLength(3);
    expect(sicht.order.may).toMatchObject({ roll: true, abort: true, confirm: false, fail: false });
  });

  it('ein ungelerntes Rezept startet die Spielerin nicht, und fehlendes Material auch nicht', async () => {
    expect((await post('s', '/api/crafting', { recipe: 'geheim', actor: 'f', materials: [{ inventory: 'inv-f', edge: 'h1', qty: 1 }] })).statusCode).toBe(403);
    const r = await post('s', '/api/crafting', { recipe: 'salbe', actor: 'f', materials: [{ inventory: 'inv-f', edge: 'h1', qty: 1 }] });
    expect(r.statusCode).toBe(422);
    expect(r.json().error).toContain('Moonleaf');
  });

  it('Proben: die Spielerin würfelt, die Leitung bestätigt; Erfolg verbraucht und liefert', async () => {
    const id = await starten();
    const p = await post('s', `/api/crafting/${id}/roll`, { total: 15 });
    expect(p.json()).toMatchObject({ pending: true, result: 'success' });
    expect((await get('s', `/api/crafting/${id}`)).json().order.may.roll).toBe(false);
    expect((await post('s', `/api/crafting/${id}/confirm`, {})).statusCode).toBe(403);
    expect((await post('l', `/api/crafting/${id}/confirm`, {})).statusCode).toBe(200);
    expect((await get('l', `/api/crafting/${id}`)).json().order).toMatchObject({ progress: 1, outcome: 'open' });

    await post('l', `/api/crafting/${id}/roll`, { total: 13 });
    const o = (await get('l', `/api/crafting/${id}`)).json().order;
    expect(o).toMatchObject({ progress: 2, outcome: 'succeeded' });
    expect(o.rolls).toHaveLength(2);
    const f = await holdsVon('inv-f');
    // Kraut verbraucht, Mörser zurück (nicht verbraucht), zwei Tränke dazu.
    expect(f.some((h) => h.props?.['reservedFor'])).toBe(false);
    expect(f.find((h) => h.to === 'kraut')?.props?.['qty']).toBe(3);
    expect(f.find((h) => h.to === 'moerser')?.props?.['qty']).toBe(1);
    // Der Ertrag ist ein Stück: eine Instanz des Tranks (T-150), kein Verweis auf den Grundartikel.
    expect(f.some((h) => h.to === 'trank')).toBe(false);
    const ertrag = f.find((h) => !['kraut', 'moerser'].includes(h.to));
    expect(ertrag?.props?.['qty']).toBe(2);
    const stueck = await repo.getEntity(ertrag!.to);
    expect(stueck?.relations?.find((r) => r.type === 'instanceOf')?.to).toBe('trank');
    expect(stueck?.components?.['Status']?.['status']).toBe('ready');
    expect(await holdsVon('inv-g')).toEqual([]);
    // Danach ist er abgeschlossen.
    expect((await post('l', `/api/crafting/${id}/roll`, { total: 20 })).statusCode).toBe(409);
  });

  it('ein gekauftes Stück (Instanz) zählt als Material seines Grundartikels (T-150)', async () => {
    await repo.putEntity(art('kraut-1', 'Item', 'Moonleaf', 'item-0004', { relations: [{ id: 'k1~i', type: 'instanceOf', to: 'kraut', props: {} }] }));
    const inv = (await repo.getEntity('inv-f'))!;
    await repo.putEntity({ ...inv, relations: [...(inv.relations ?? []), holds('h4', 'kraut-1', 3)] });
    const sicht = (await get('s', '/api/crafting/salbe')).json();
    const vorrat = sicht.actors.find((a: { id: string }) => a.id === 'f').stock as { item: string; edge: string }[];
    expect(vorrat.find((x) => x.edge === 'h4')?.item).toBe('kraut');
    const r = await post('s', '/api/crafting', {
      recipe: 'salbe',
      actor: 'f',
      materials: [
        { inventory: 'inv-f', edge: 'h4', qty: 3 },
        { inventory: 'inv-f', edge: 'h2', qty: 1 },
      ],
    });
    expect(r.statusCode, r.body).toBe(200);
    expect((await post('s', `/api/crafting/${r.json().id}/abort`)).statusCode).toBe(200);
    expect((await holdsVon('inv-f')).find((h) => h.to === 'kraut-1')?.props?.['qty']).toBe(3);
  });

  it('Abbruch gibt alles frei', async () => {
    const id = await starten();
    expect((await post('s', `/api/crafting/${id}/abort`)).statusCode).toBe(200);
    expect((await holdsVon('inv-f')).some((h) => h.props?.['reservedFor'])).toBe(false);
    expect((await holdsVon('inv-f')).filter((h) => h.to === 'kraut').reduce((n, h) => n + Number(h.props?.['qty']), 0)).toBe(5);
    expect((await holdsVon('inv-g'))[0]?.props).toEqual({ qty: 1, tier: 'pack' });
    expect((await get('s', `/api/crafting/${id}`)).json().order.outcome).toBe('aborted');
  });

  it('Misserfolg nach der Vorgabe: dem Rezept folgen (halfLost: die abgerundete Hälfte zurück)', async () => {
    const id = await starten();
    await post('l', `/api/crafting/${id}/roll`, { total: 5 });
    expect((await get('l', `/api/crafting/${id}`)).json().order.outcome).toBe('failed');
    const kraut = (await holdsVon('inv-f')).filter((h) => h.to === 'kraut').reduce((n, h) => n + Number(h.props?.['qty']), 0);
    // 3 frei, von den 2 reservierten 1 zurück; aus der Truhe (1) nichts.
    expect(kraut).toBe(4);
    expect(await holdsVon('inv-g')).toEqual([]);
  });

  it('die Regel der Kampagne: kein Fortschritt — der Auftrag läuft weiter', async () => {
    await aufbauen({ craftFailure: 'noProgress', craftConfirm: 'player' });
    const id = await starten();
    const r = await post('s', `/api/crafting/${id}/roll`, { total: 5 });
    expect(r.json()).toMatchObject({ pending: false, result: 'failure' });
    expect((await get('s', `/api/crafting/${id}`)).json().order).toMatchObject({ progress: 0, outcome: 'open' });
    expect((await holdsVon('inv-f')).filter((h) => h.props?.['reservedFor'] === id)).toHaveLength(2);
  });

  it('die Regel der Kampagne: alles verloren bei der natürlichen 1, die Leitung entscheidet sonst', async () => {
    await aufbauen({ craftFailure: 'custom', craftCritFailure: 'materialsLost' });
    const id = await starten();
    await post('l', `/api/crafting/${id}/roll`, { total: 5 });
    expect((await get('l', `/api/crafting/${id}`)).json().order).toMatchObject({ outcome: 'open', may: { fail: true } });
    await post('l', `/api/crafting/${id}/roll`, { total: 9, nat: 1 });
    expect((await get('l', `/api/crafting/${id}`)).json().order.outcome).toBe('failed');
    // Kraut weg, der Mörser kommt zurück.
    const f = await holdsVon('inv-f');
    expect(f.filter((h) => h.to === 'kraut').reduce((n, h) => n + Number(h.props?.['qty']), 0)).toBe(3);
    expect(f.find((h) => h.to === 'moerser')?.props).toEqual({ qty: 1, tier: 'pack' });
  });
});
