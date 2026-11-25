import { beforeEach, describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { CAMPAIGN_SETTING, type Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

/* Die Sperre (T-134): reserviertes Material eines laufenden Auftrags
   verkauft, verschiebt, verbraucht oder löscht kein PUT und kein DELETE —
   frei wird es durch Abschluss, Abbruch, Löschen des Auftrags oder die Leitung.
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
      components: { Recipe: { dc: 12, checks: 2, yieldCount: 2, onFailure: 'Half the materials are lost.' } },
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


const put = (wer: string, e: Entity) => app.inject({ method: 'PUT', url: `/api/entities/${e.id}`, payload: e as object, headers: { cookie: cookies[wer] ?? '' } });
const del = (wer: string, id: string) => app.inject({ method: 'DELETE', url: `/api/entities/${id}`, headers: { cookie: cookies[wer] ?? '' } });
const ohne = (e: Entity, weg: (r: NonNullable<Entity['relations']>[number]) => boolean): Entity => ({ ...e, relations: (e.relations ?? []).filter((r) => !weg(r)) });

describe('Reservierte Stücke am Server (T-134)', () => {
  beforeEach(async () => aufbauen());

  it('verkaufen oder verbrauchen per PUT geht nicht, mit dem Namen des Auftrags', async () => {
    const id = await starten();
    const inv = (await repo.getEntity('inv-f'))!;
    const r = await put('s', ohne(inv, (h) => h.props?.['reservedFor'] === id && h.to === 'kraut'));
    expect(r.statusCode).toBe(423);
    expect(r.json().error).toContain('Moonleaf is reserved for crafting order');
    expect(r.json().error).toContain(String((await repo.getEntity(id))?.name ?? ''));
    // Die Menge ändern ist dasselbe.
    const weniger = { ...inv, relations: (inv.relations ?? []).map((h) => (h.props?.['reservedFor'] === id && h.to === 'kraut' ? { ...h, props: { ...h.props, qty: 1 } } : h)) };
    expect((await put('s', weniger)).statusCode).toBe(423);
    expect((await holdsVon('inv-f')).filter((h) => h.props?.['reservedFor'] === id)).toHaveLength(2);
  });

  it('das Freie daneben ändert sich, und umräumen im Raster auch', async () => {
    const id = await starten();
    const inv = (await repo.getEntity('inv-f'))!;
    const neu = {
      ...inv,
      relations: (inv.relations ?? []).flatMap((h) => (h.id === 'h1' ? [] : h.props?.['reservedFor'] === id ? [{ ...h, props: { ...h.props, gx: 0, gy: 0 } }] : [h])),
    };
    const r = await put('s', neu);
    expect(r.statusCode, r.body).toBe(200);
  });

  it('verschieben in ein anderes Inventar geht nicht, eine Reservierung erfinden auch nicht', async () => {
    const id = await starten();
    const g = (await repo.getEntity('inv-g'))!;
    const r = await put('s', ohne(g, (h) => h.props?.['reservedFor'] === id));
    expect(r.statusCode).toBe(423);
    const f = (await repo.getEntity('inv-f'))!;
    const erfunden = { ...f, relations: (f.relations ?? []).map((h) => (h.id === 'h1' ? { ...h, props: { ...h.props, reservedFor: id } } : h)) };
    const e = await put('s', erfunden);
    expect(e.statusCode).toBe(423);
    expect(e.json().error).toContain('only a crafting order reserves materials');
  });

  it('löschen: das Inventar und der Gegenstand nicht; der Auftrag gibt beim Gehen frei', async () => {
    const id = await starten();
    expect((await del('s', 'inv-g')).statusCode).toBe(423);
    // Den Gegenstand hat sie angelegt (D72) — und darf ihn trotzdem nicht löschen, solange er reserviert liegt.
    await repo.addAuthored('u_s', 'kraut');
    const k = await del('s', 'kraut');
    expect(k.statusCode).toBe(423);
    expect(k.json().error).toContain('Moonleaf is reserved');
    // Einen Auftrag ohne Ebene löscht die Verwaltung (T-098).
    await repo.putUser({ id: 'u_a', name: 'verwaltung', passwordHash: await hashPassword(PW), isAdmin: true, actorIds: [], roles: {} });
    cookies['a'] = await anmelden('verwaltung');
    expect((await del('a', id)).statusCode).toBe(200);
    expect((await holdsVon('inv-f')).some((h) => h.props?.['reservedFor'])).toBe(false);
    expect((await holdsVon('inv-g'))[0]?.props).toEqual({ qty: 1, tier: 'pack' });
  });

  it('nach dem Abbruch ist alles frei; die Leitung darf vorher schon', async () => {
    const id = await starten();
    const g = (await repo.getEntity('inv-g'))!;
    const r = await put('l', ohne(g, (h) => h.props?.['reservedFor'] === id));
    expect(r.statusCode, r.body).toBe(200);
    expect((await post('s', `/api/crafting/${id}/abort`)).statusCode).toBe(200);
    const f = (await repo.getEntity('inv-f'))!;
    expect((await put('s', ohne(f, (h) => h.to === 'kraut'))).statusCode).toBe(200);
  });
});
