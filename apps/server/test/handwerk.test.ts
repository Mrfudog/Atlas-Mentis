import { beforeEach, describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { CAMPAIGN_SETTING, type Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

/* Der Fertigungsauftrag (T-128, T-165): starten mit Material aus Figur
   und Gruppe (reserviert), Proben als Kreise, Bestätigung durch die
   Leitung, Abschluss verbraucht und liefert, Abbruch gibt frei,
   Misserfolg nach der Regel der Kampagne — angewandt beim Klick,
   abgerechnet beim Abschluss. Erfundene Artikel, kein Buchinhalt. */

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
      components: { Recipe: { dc: 12, checks: 2, yieldCount: 2, onFailure: 'All materials are lost.' } },
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
const put = (wer: string, url: string, payload: unknown = {}) => app.inject({ method: 'PUT', url, payload: payload as object, headers: { cookie: cookies[wer] ?? '' } });
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
    expect(sicht.rules).toMatchObject({ failure: 'halfLost', critSuccess: 'asSuccess', critFailure: 'asFailure', confirm: 'gm', campaign: { id: 'k' } });
    expect(sicht.rules.sentences[0]).toBe('On a failed check: the work fails and half the materials are lost.');
    // Was die Quelle sagt, steht da — und gilt nicht (T-165).
    expect(sicht.recipe.sourceFailure).toBe('All materials are lost.');
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
    // Je nötige Probe ein leerer Kreis.
    expect(sicht.order.circles.map((c: { mark: unknown; open: boolean }) => [c.mark, c.open])).toEqual([[null, true], [null, true]]);
    expect(sicht.order.reserved).toHaveLength(3);
    expect(sicht.order.may).toMatchObject({ mark: true, roll: true, abort: true, confirm: false, fail: false, finish: false });
  });

  it('ein ungelerntes Rezept startet die Spielerin nicht, und fehlendes Material auch nicht', async () => {
    expect((await post('s', '/api/crafting', { recipe: 'geheim', actor: 'f', materials: [{ inventory: 'inv-f', edge: 'h1', qty: 1 }] })).statusCode).toBe(403);
    const r = await post('s', '/api/crafting', { recipe: 'salbe', actor: 'f', materials: [{ inventory: 'inv-f', edge: 'h1', qty: 1 }] });
    expect(r.statusCode).toBe(422);
    expect(r.json().error).toContain('Moonleaf');
  });

  it('Proben: die Spielerin würfelt, die Leitung bestätigt; der Abschluss verbraucht und liefert', async () => {
    const id = await starten();
    const p = await post('s', `/api/crafting/${id}/roll`, { total: 15 });
    expect(p.json()).toMatchObject({ pending: true, result: 'success' });
    const wartet = (await get('s', `/api/crafting/${id}`)).json().order;
    expect(wartet.circles[0]).toMatchObject({ mark: 'success', pending: true, total: 15, dc: 12 });
    expect(wartet).toMatchObject({ progress: 0, waiting: 1 });
    expect((await post('s', `/api/crafting/${id}/confirm`, {})).statusCode).toBe(403);
    expect((await post('l', `/api/crafting/${id}/confirm`, {})).statusCode).toBe(200);
    expect((await get('l', `/api/crafting/${id}`)).json().order).toMatchObject({ progress: 1, outcome: 'open' });

    await post('l', `/api/crafting/${id}/roll`, { total: 13 });
    const o = (await get('l', `/api/crafting/${id}`)).json().order;
    // Entschieden, aber noch nicht abgerechnet: das Material ist weiter reserviert.
    expect(o).toMatchObject({ progress: 2, outcome: 'open', result: 'succeeded', settle: 'success', may: { finish: true, roll: false } });
    expect(o.circles).toHaveLength(2);
    expect((await holdsVon('inv-f')).some((h) => h.props?.['reservedFor'] === id)).toBe(true);
    expect((await post('s', `/api/crafting/${id}/finish`)).statusCode).toBe(200);
    expect((await get('l', `/api/crafting/${id}`)).json().order.outcome).toBe('succeeded');
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
    expect((await put('l', `/api/crafting/${id}/checks/0`, { mark: null })).statusCode).toBe(409);
  });

  it('am Server würfeln (T-181): W20 plus Attribut aus dem Statblock der Figur, der Wurf steht im Log', async () => {
    const id = await starten();
    // Ohne Statblock keine Zahl: dann bleibt das Eintragen.
    const ohne = await post('s', `/api/crafting/${id}/roll`, { roll: true });
    expect(ohne.statusCode).toBe(422);
    await repo.putEntity(art('sb-f', 'Statblock', 'Ash stats', 'statblock-0001', {
      components: { Statblock: { prof: 2 }, Abilities: { int: 16 } },
      relations: [{ id: 'sbf~1', type: 'belongsTo', to: 'f', props: {} }],
    }));
    const p = await post('s', `/api/crafting/${id}/roll`, { roll: true });
    expect(p.statusCode, p.body).toBe(200);
    const { roll, result } = p.json() as { roll: { expr: string; total: number; entered?: boolean; label: string }; result: string };
    expect(roll.expr).toBe('1d20+3');
    expect(roll.entered).toBeUndefined();
    expect(roll.total).toBeGreaterThanOrEqual(4);
    expect(roll.total).toBeLessThanOrEqual(23);
    expect(result).toBe(roll.total >= 12 ? (roll.total - 3 === 20 ? 'critSuccess' : 'success') : roll.total - 3 === 1 ? 'critFailure' : 'failure');
    const kreis = (await get('s', `/api/crafting/${id}`)).json().order.circles[0];
    expect(kreis.total).toBe(roll.total);
    const log = await repo.listEvents({ name: 'roll', subject: id });
    expect(log).toHaveLength(1);
    expect((log[0]!.payload as { label: string }).label).toBe('Crafting check (INT) vs DC 12');
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

  it('Misserfolg nach der Vorgabe der Kampagne, nicht des Rezepts (halfLost: die abgerundete Hälfte zurück)', async () => {
    const id = await starten();
    await post('l', `/api/crafting/${id}/roll`, { total: 5 });
    const o = (await get('l', `/api/crafting/${id}`)).json().order;
    expect(o).toMatchObject({ outcome: 'open', result: 'failed', settle: 'half' });
    // Angewandt, aber noch nicht verbucht: je Stück, was verloren ginge.
    expect(o.reserved.map((r: { item: string; qty: number; lost: number }) => `${r.item}:${r.qty}-${r.lost}`).sort()).toEqual(['kraut:1-1', 'kraut:2-1', 'moerser:1-0']);
    expect(o.lines).toEqual([{ index: 0, note: 'Failure — the work fails, half the materials are lost.' }]);
    expect((await post('l', `/api/crafting/${id}/finish`)).statusCode).toBe(200);
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
    const o = (await get('s', `/api/crafting/${id}`)).json().order;
    expect(o).toMatchObject({ progress: 0, outcome: 'open', result: 'open' });
    // Der Fehlschlag zählt nicht: zwei Kreise fehlen weiter.
    expect(o.circles.map((c: { mark: unknown }) => c.mark)).toEqual(['failure', null, null]);
    expect((await holdsVon('inv-f')).filter((h) => h.props?.['reservedFor'] === id)).toHaveLength(2);
  });

  it('die Regel der Kampagne: alles verloren bei der natürlichen 1, die Leitung entscheidet sonst', async () => {
    await aufbauen({ craftFailure: 'custom', craftCritFailure: 'materialsLost' });
    const id = await starten();
    await post('l', `/api/crafting/${id}/roll`, { total: 5 });
    expect((await get('l', `/api/crafting/${id}`)).json().order).toMatchObject({ outcome: 'open', may: { fail: true } });
    await post('l', `/api/crafting/${id}/roll`, { total: 9, nat: 1 });
    expect((await get('l', `/api/crafting/${id}`)).json().order).toMatchObject({ result: 'failed', settle: 'none' });
    expect((await post('l', `/api/crafting/${id}/finish`)).statusCode).toBe(200);
    expect((await get('l', `/api/crafting/${id}`)).json().order.outcome).toBe('failed');
    // Kraut weg, der Mörser kommt zurück.
    const f = await holdsVon('inv-f');
    expect(f.filter((h) => h.to === 'kraut').reduce((n, h) => n + Number(h.props?.['qty']), 0)).toBe(3);
    expect(f.find((h) => h.to === 'moerser')?.props).toEqual({ qty: 1, tier: 'pack' });
  });

  it('Kreise per Klick: ✓, ✗, leer — ein ✗ wendet die Regel an, Zurückklicken nimmt sie zurück', async () => {
    await aufbauen({ craftConfirm: 'player' });
    const id = await starten();
    const sicht = async () => (await get('s', `/api/crafting/${id}`)).json().order;
    expect((await put('s', `/api/crafting/${id}/checks/0`, { mark: 'success' })).statusCode).toBe(200);
    expect(await sicht()).toMatchObject({ progress: 1, result: 'open' });
    expect((await put('s', `/api/crafting/${id}/checks/0`, { mark: 'failure' })).json()).toMatchObject({ outcome: 'failed' });
    const gescheitert = await sicht();
    expect(gescheitert).toMatchObject({ progress: 0, result: 'failed', settle: 'half', may: { finish: true } });
    // Nach dem Ende keine leeren Kreise mehr.
    expect(gescheitert.circles).toHaveLength(1);
    // Zurück auf leer: die Regel ist zurückgenommen, nichts verbucht.
    expect((await put('s', `/api/crafting/${id}/checks/0`, { mark: null })).json()).toMatchObject({ outcome: 'open' });
    const zurueck = await sicht();
    expect(zurueck).toMatchObject({ progress: 0, result: 'open', settle: null });
    expect(zurueck.circles.map((c: { mark: unknown }) => c.mark)).toEqual([null, null]);
    expect((await holdsVon('inv-f')).filter((h) => h.props?.['reservedFor'] === id)).toHaveLength(2);
    // Unsinn und ein Kreis, den es nicht gibt.
    expect((await put('s', `/api/crafting/${id}/checks/0`, { mark: 'critSuccess' })).statusCode).toBe(400);
    expect((await put('s', `/api/crafting/${id}/checks/7`, { mark: 'success' })).statusCode).toBe(409);
    expect((await post('s', `/api/crafting/${id}/finish`)).statusCode).toBe(409);
    // Ein fremdes Konto setzt keinen Kreis.
    await repo.putUser({ id: 'u_x', name: 'gast', passwordHash: await hashPassword(PW), isAdmin: false, actorIds: [], roles: { k: 'player' } });
    cookies['x'] = await anmelden('gast');
    expect((await put('x', `/api/crafting/${id}/checks/0`, { mark: 'success' })).statusCode).toBe(403);
  });

  it('ein Kreis der Spielerin wartet auf die Leitung, verwerfen leert ihn', async () => {
    const id = await starten();
    await put('s', `/api/crafting/${id}/checks/0`, { mark: 'success' });
    expect((await get('l', `/api/crafting/${id}`)).json().order).toMatchObject({ progress: 0, waiting: 1, may: { confirm: true } });
    expect((await post('l', `/api/crafting/${id}/confirm`, { accept: false })).statusCode).toBe(200);
    const o = (await get('l', `/api/crafting/${id}`)).json().order;
    expect(o).toMatchObject({ waiting: 0, progress: 0 });
    expect(o.circles.map((c: { mark: unknown }) => c.mark)).toEqual([null, null]);
  });

  it('nach Tagen: erst arbeiten, dann ein Kreis; Fortschritt verloren heisst neue Tage', async () => {
    await aufbauen({ craftFailure: 'progressLost', craftConfirm: 'player' });
    const r = (await repo.getEntity('salbe'))!;
    await repo.putEntity({ ...r, components: { ...r.components, Recipe: { dc: 12, days: 2 } } });
    const id = await starten();
    const sicht = async () => (await get('s', `/api/crafting/${id}`)).json().order;
    expect(await sicht()).toMatchObject({ unit: 'days', daysLeft: 2, may: { work: true, roll: false } });
    expect((await sicht()).circles).toEqual([expect.objectContaining({ mark: null, open: false })]);
    expect((await put('s', `/api/crafting/${id}/checks/0`, { mark: 'success' })).statusCode).toBe(409);
    await post('s', `/api/crafting/${id}/work`, { days: 2 });
    expect(await sicht()).toMatchObject({ daysLeft: 0, progress: 2, may: { work: false, roll: true } });
    await put('s', `/api/crafting/${id}/checks/0`, { mark: 'failure' });
    expect(await sicht()).toMatchObject({ daysLeft: 2, progress: 0, result: 'open', may: { work: true } });
    await post('s', `/api/crafting/${id}/work`, { days: 5 });
    await put('s', `/api/crafting/${id}/checks/1`, { mark: 'success' });
    expect(await sicht()).toMatchObject({ result: 'succeeded', settle: 'success' });
    // Den ✗ zurücknehmen: kein Verlust mehr, die Tage reichen, der ✓ entscheidet allein.
    await put('s', `/api/crafting/${id}/checks/0`, { mark: null });
    const o = await sicht();
    expect(o.circles[0]).toMatchObject({ mark: null, ignored: false });
    expect(o).toMatchObject({ result: 'succeeded', lines: [{ index: 1, note: 'Success — the work is done.' }] });
  });
});

describe('Handwerksübersicht (T-196)', () => {
  beforeEach(async () => {
    await aufbauen();
    const zusatz: Entity[] = [
      art('beruf', 'Trade', 'Herbalism', 'trade-0001', { components: { Trade: { tools: ['Herb Kit'] } } }),
      art('kit', 'Item', 'Herb Kit', 'item-0010', { components: { Item: { itemType: 'tool' } } }),
      art('sb', 'Statblock', 'Ash', 'statblock-0001', {
        components: { Proficiencies: { proficient: ['Herb Kit'] } },
        relations: [{ id: 'sb~1', type: 'belongsTo', to: 'f' }],
      }),
    ];
    for (const e of zusatz) await repo.putEntity(e);
    for (const id of ['salbe', 'geheim']) {
      const r = (await repo.getEntity(id))!;
      await repo.putEntity({ ...r, components: { ...r.components, Recipe: { ...(r.components['Recipe'] ?? {}), trade: 'Herbalism' } } });
    }
  });

  it('der Beruf zeigt Werkzeuge, Rezepte und Material', async () => {
    const res = await get('l', '/api/crafting/beruf');
    expect(res.statusCode).toBe(200);
    const s = res.json();
    expect(s.kind).toBe('trade');
    expect(s.trade.tools).toEqual([{ name: 'Herb Kit', id: 'kit' }]);
    expect(s.recipes.map((r: { id: string }) => r.id)).toEqual(['salbe', 'geheim']);
    expect(s.recipes[0]).toMatchObject({ dc: 12, checks: 2, tools: ['Herb Kit'], yields: { id: 'trank', name: 'Draught' } });
    expect(s.materials[0]).toMatchObject({ item: 'kraut', name: 'Moonleaf', recipes: 2, qty: 4 });
  });

  it('ein Werkzeug zeigt, was man damit fertigt; ein anderer Gegenstand nichts', async () => {
    const w = (await get('l', '/api/crafting/kit')).json();
    expect(w.kind).toBe('tool');
    expect(w.trades).toEqual([{ id: 'beruf', name: 'Herbalism' }]);
    expect(w.recipes).toHaveLength(2);
    expect((await get('l', '/api/crafting/kraut')).json()).toEqual({ kind: 'none' });
  });

  it('die Figur sieht je geübtem Werkzeug ihre Rezepte, gelernt oder nicht', async () => {
    const s = (await get('s', '/api/crafting/f')).json();
    expect(s.kind).toBe('actor');
    expect(s.tools).toHaveLength(1);
    const gelernt = Object.fromEntries(s.tools[0].recipes.map((r: { id: string; learned?: boolean }) => [r.id, r.learned]));
    expect(gelernt).toEqual({ salbe: true, geheim: false });
  });

  it('ein Werkzeug, das die Figur beim Hintergrund gewählt hat, zählt (T-239)', async () => {
    /* Der Statblock nennt das Werkzeug nicht; die Figur hat es beim
       Hintergrund gewählt (`chose`). Bis T-239 galt sie als ungeübt. */
    const sb = (await repo.getEntity('sb'))!;
    await repo.putEntity({ ...sb, components: { ...sb.components, Proficiencies: { proficient: [] } } });
    await repo.putEntity(
      art('hg', 'Background', 'Artisan', 'background-0001', {
        components: { Choices: { choices: [{ id: 'tools', kind: 'proficiency', count: 1, from: { values: ['Herb Kit', 'Smith Tools'] } }] } },
      }),
    );
    const f = (await repo.getEntity('f'))!;
    await repo.putEntity({
      ...f,
      relations: [
        ...(f.relations ?? []),
        { id: 'f~hg', type: 'hasBackground', to: 'hg' },
        { id: 'f~wahl', type: 'chose', to: 'hg', props: { choice: 'tools', picks: ['Herb Kit'] } },
      ],
    });
    const s = (await get('s', '/api/crafting/f')).json();
    expect(s.tools.map((w: { name: string }) => w.name)).toEqual(['Herb Kit']);
    expect(s.recipes.every((r: { toolOk: boolean }) => r.toolOk)).toBe(true);
  });

  it('kennt Blaupausen nach der Regel der Kampagne (T-280)', async () => {
    /* Nur Beigebracht (Vorgabe): „geheim“ ist nicht gelernt. */
    let s = (await get('s', '/api/crafting/f')).json();
    expect(Object.fromEntries(s.recipes.map((r: { id: string; learned?: boolean }) => [r.id, r.learned]))).toEqual({ salbe: true, geheim: false });
    /* Kibbles: alles von Anfang an. */
    await aufbauen({ craftLearning: 'all' });
    s = (await get('s', '/api/crafting/f')).json();
    expect(s.recipes.every((r: { learned?: boolean }) => r.learned === true)).toBe(true);
    /* Nach Seltenheit: der Trank ist gewöhnlich, die Figur beherrscht kein Herb Kit (ohne die Zusätze dieser Gruppe). */
    await aufbauen({ craftLearning: 'rarity' });
    s = (await get('s', '/api/crafting/f')).json();
    const geheim = s.recipes.find((r: { id: string }) => r.id === 'geheim');
    expect(geheim.learned).toBe(geheim.toolOk);
  });

  it('der Reiter Crafting (T-247): alle Blaupausen, freies Material der Figur und Gruppe, ihre Aufträge', async () => {
    const id = await starten();
    const s = (await get('s', '/api/crafting/f')).json();
    expect(s.recipes.map((r: { id: string; toolOk: boolean }) => [r.id, r.toolOk])).toEqual([['salbe', true], ['geheim', true]]);
    // Reserviertes zählt nicht: 5 − 2 im Gepäck, 1 − 1 in der Truhe.
    expect(s.stock['kraut']).toEqual({ qty: 3, where: ['Ash'] });
    expect(s.orders).toEqual([expect.objectContaining({ id, recipe: { id: 'salbe', name: 'Draught recipe' }, progress: 0, needed: 2, outcome: 'open' })]);
  });

  it('fremdes Material und fremde Aufträge sieht nur die Figur selbst und die Leitung', async () => {
    await repo.putUser({ id: 'u_x', name: 'andere', passwordHash: await hashPassword(PW), isAdmin: false, actorIds: [], roles: { k: 'player' } });
    cookies['x'] = await anmelden('andere');
    const s = (await get('x', '/api/crafting/f')).json();
    expect(s.stock).toEqual({});
    expect(s.orders).toEqual([]);
  });
});
