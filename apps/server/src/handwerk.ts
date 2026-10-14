/**
 * **Handwerk im Web** (T-128, REQ-184): der Fertigungsauftrag.
 *
 * Ein Auftrag ist eine **Instanz des Rezepts** (`CraftingOrder`,
 * `instanceOf` aufs Rezept): er liest Werkzeug, SG, Zeit, Material und
 * Ertrag beim Rezept und hält selbst Fortschritt, Ausgang und Proben. Wer
 * fertigt, sagt die Kante `crafting` vom Fertigenden zum Auftrag. Das
 * Material bleibt in den Inventaren von Figur und Gruppe und ist für den
 * Auftrag **reserviert** (`holds.props.reservedFor`, T-127).
 *
 * Geschrieben wird nur hier und nicht über `PUT`: ein Ausgang, den jemand
 * in der Maske setzt, hätte kein Material abgerechnet. Die Routen prüfen
 * selbst, wer darf — die eigene Figur fertigt, die Leitung bestätigt und
 * entscheidet; die Regeln stehen an der Kampagne (`craftRulesOf`).
 * Was sich ändert, geht über das Repository und damit über den Live-Kanal
 * (T-116) an jeden, der es sehen darf.
 */
import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  addToInventory,
  applyRoll,
  applySettlement,
  craftCheck,
  craftRulesOf,
  CRAFTING_RELATION,
  currentCampaign,
  entityName,
  insideOf,
  knows,
  nextId,
  ORDER_COMPONENT,
  orderNeed,
  RECIPE_COMPONENT,
  recipeLearned,
  reserveIn,
  reservedPieces,
  resolveInstance,
  rollResult,
  settlePieces,
  STATUS_COMPONENT,
  tableRole,
  templateOf,
  typeChain,
  primaryInterface,
  type Entity,
  type OrderOutcome,
  type ReservedPiece,
  type Return,
  type validateEntity,
} from '@nw/model';
import type { User } from './auth.js';
import type { Repository } from './repo.js';

const ORDER_TYPE = 'CraftingOrder';
const PARTY_RELATION = 'memberOfParty';

interface Stand {
  alle: Entity[];
  map: Map<string, Entity>;
}

export interface HandwerkDeps {
  repo: Repository;
  viewerOf: (request: FastifyRequest) => Promise<User | null>;
  roh: () => Promise<Stand>;
  sieve: (request: FastifyRequest, entities: Entity[], bestand?: Map<string, Entity>) => Promise<Entity[]>;
  schreibeGeprueft: (entity: Entity) => Promise<{ stored: Entity } | { issues: ReturnType<typeof validateEntity> }>;
  kampagnenEbene: (map: Map<string, Entity>, kampagne: Entity | null) => Promise<Entity | null>;
}

/** Eine Probe, wie sie am Auftrag steht. */
interface Probe {
  total: number;
  nat?: number;
  dc: number;
  result: 'critSuccess' | 'success' | 'failure' | 'critFailure' | 'pending' | 'rejected';
  /** Bei `pending`: was sie ergäbe. */
  would?: string;
  by: string;
  at: string;
  note?: string;
}

const carriesOf = (e: Entity | undefined): string | null => (e?.relations ?? []).find((r) => r.type === 'carries')?.to ?? null;
const partiesOf = (e: Entity): string[] => (e.relations ?? []).filter((r) => r.type === PARTY_RELATION).map((r) => r.to);
const neueKante = (inv: string, art: string) => `${inv}~${art}-${randomUUID().slice(0, 8)}`;

export function registerHandwerk(app: FastifyInstance, deps: HandwerkDeps): void {
  const { repo, viewerOf, roh, sieve, schreibeGeprueft, kampagnenEbene } = deps;

  /** Wer am Tisch leitet: Verwaltung, `gm` und `co-gm` der laufenden Kampagne. */
  function leitet(user: User, kampagne: Entity | null): boolean {
    if (user.isAdmin) return true;
    const rolle = kampagne ? tableRole({ roles: user.roles ?? {} }, kampagne.id) : null;
    return rolle === 'gm' || rolle === 'co-gm';
  }

  /**
   * **Die Inventare, aus denen eine Figur Material nimmt:** ihr eigenes und
   * das ihrer Gruppen (T-127), dazu die Behälter darin. Ein Stück im
   * Rucksack der Gruppe ist so gut wie eines lose in der Truhe.
   */
  function inventareVon(actor: Entity, map: Map<string, Entity>): string[] {
    const traeger = [actor, ...partiesOf(actor).map((p) => map.get(p)).filter((x): x is Entity => !!x)];
    const raus = new Set<string>();
    for (const t of traeger) {
      const inv = carriesOf(t);
      if (!inv) continue;
      raus.add(inv);
      for (const h of map.get(inv)?.relations ?? []) if (h.type === 'holds') for (const i of insideOf(h.to, map)) raus.add(i);
    }
    return [...raus];
  }

  /** Wem ein Inventar gehört (der Träger), mit Namen. */
  function besitzer(map: Map<string, Entity>): Map<string, { id: string; name: string }> {
    const raus = new Map<string, { id: string; name: string }>();
    for (const e of map.values()) {
      for (const r of e.relations ?? []) if (r.type === 'carries') raus.set(r.to, { id: e.id, name: entityName(e) });
    }
    return raus;
  }

  /** Was das Rezept braucht: je Gegenstand Menge und ob es verbraucht wird. */
  function bedarf(rezept: Entity, map: Map<string, Entity>) {
    return (rezept.relations ?? [])
      .filter((r) => r.type === 'needs')
      .map((r) => ({
        item: r.to,
        name: entityName(map.get(r.to)) || r.to,
        qty: Math.max(1, Number(r.props?.['qty']) || 1),
        consumed: r.props?.['consumed'] !== false,
      }));
  }

  /** Der Auftrag aufgelöst, sein Rezept, wer fertigt. */
  function auftrag(order: Entity, map: Map<string, Entity>) {
    const aufgeloest = resolveInstance(map, order);
    const rezept = templateOf(map, order);
    const actor = [...map.values()].find((e) => (e.relations ?? []).some((r) => r.type === CRAFTING_RELATION && r.to === order.id)) ?? null;
    const karte = order.components?.[ORDER_COMPONENT] ?? {};
    const rolls = (Array.isArray(karte['rolls']) ? karte['rolls'] : []) as Probe[];
    return {
      aufgeloest,
      rezept,
      actor,
      progress: Math.max(0, Number(karte['progress']) || 0),
      outcome: (typeof karte['outcome'] === 'string' ? karte['outcome'] : 'open') as OrderOutcome,
      started: typeof karte['started'] === 'string' ? karte['started'] : '',
      rolls,
    };
  }

  /** Die für diesen Auftrag reservierten Stücke, in allen Inventaren. */
  function reserviert(orderId: string, map: Map<string, Entity>): ReservedPiece[] {
    const raus: ReservedPiece[] = [];
    for (const e of map.values()) if (primaryInterface(e) === 'Inventory') raus.push(...reservedPieces(e, orderId));
    return raus;
  }

  async function istAuftrag(e: Entity | undefined): Promise<boolean> {
    if (!e) return false;
    return typeChain(await repo.getRegistry(), primaryInterface(e)).includes(ORDER_TYPE);
  }

  /** Der Auftrag mit allem, was die Seite zeigt. */
  function auftragsSicht(order: Entity, stand: Stand, user: User, kampagne: Entity | null) {
    const a = auftrag(order, stand.map);
    const need = orderNeed(a.aufgeloest);
    const check = craftCheck(a.aufgeloest, { get: (id) => stand.map.get(id), campaign: kampagne, actor: a.actor });
    const namen = besitzer(stand.map);
    const bed = bedarf(a.aufgeloest, stand.map);
    const leitung = leitet(user, kampagne);
    const eigen = !!a.actor && (user.actorIds ?? []).includes(a.actor.id);
    const offen = a.outcome === 'open';
    const wartet = a.rolls.some((r) => r.result === 'pending');
    const ertrag = (a.aufgeloest.relations ?? []).find((r) => r.type === 'yields');
    return {
      id: order.id,
      name: entityName(order),
      actor: a.actor ? { id: a.actor.id, name: entityName(a.actor) } : null,
      recipe: a.rezept ? { id: a.rezept.id, name: entityName(a.rezept) } : null,
      progress: a.progress,
      needed: need.needed,
      unit: need.unit,
      outcome: a.outcome,
      started: a.started,
      rolls: a.rolls,
      check: { tool: check.tool, ability: check.ability, dc: check.dc },
      yields: ertrag
        ? { id: ertrag.to, name: entityName(stand.map.get(ertrag.to)) || ertrag.to, count: Math.max(1, Number(a.aufgeloest.components?.[RECIPE_COMPONENT]?.['yieldCount']) || 1) }
        : null,
      reserved: reserviert(order.id, stand.map).map((p) => ({
        ...p,
        name: entityName(stand.map.get(p.item)) || p.item,
        owner: namen.get(p.inventory)?.name ?? '',
        consumed: bed.find((b) => b.item === p.item)?.consumed ?? true,
      })),
      onFailure: a.aufgeloest.components?.[RECIPE_COMPONENT]?.['onFailure'] ?? 'halfLost',
      may: {
        roll: offen && !wartet && (leitung || eigen) && (need.unit === 'checks' || a.progress >= need.needed),
        work: offen && (leitung || eigen) && need.unit === 'days' && a.progress < need.needed,
        confirm: offen && wartet && leitung,
        abort: offen && (leitung || eigen),
        fail: offen && leitung,
      },
    };
  }

  /**
   * **Was an einem Rezept oder Auftrag zum Handwerk gehört.** Am Rezept:
   * die Regeln, wer es fertigen kann (eigene Figuren; die Leitung jede
   * Figur ihrer Gruppen), ob gelernt, und das freie Material je Figur in
   * ihren Inventaren und denen ihrer Gruppe; dazu die Aufträge darauf. Am
   * Auftrag: Fortschritt, Proben, Reserviertes und was jetzt geht.
   */
  app.get<{ Params: { id: string } }>('/api/crafting/:id', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return reply.code(401).send({ error: 'Nicht angemeldet' });
    const stand = await roh();
    const registry = await repo.getRegistry();
    const roh1 = stand.map.get(request.params.id);
    const [e] = roh1 ? await sieve(request, [roh1], stand.map) : [];
    if (!e || !roh1) return reply.code(404).send({ error: 'Nicht gefunden' });
    const kampagne = currentCampaign(stand.map, registry.settings ?? null);
    const rules = craftRulesOf(kampagne);
    const leitung = leitet(user, kampagne);
    if (await istAuftrag(roh1)) {
      return { kind: 'order', rules, leitet: leitung, order: auftragsSicht(roh1, stand, user, kampagne) };
    }
    if (!typeChain(registry, primaryInterface(roh1)).includes(RECIPE_COMPONENT)) {
      return reply.code(404).send({ error: 'Kein Rezept.' });
    }
    const bed = bedarf(roh1, stand.map);
    const need = orderNeed(roh1);
    /* Wer fertigen kann: die eigenen Figuren; die Leitung dazu jede Figur in einer Gruppe der Kampagne. */
    const ids = new Set(user.actorIds ?? []);
    if (leitung && kampagne) {
      const gruppen = new Set(
        stand.alle.filter((g) => (g.relations ?? []).some((r) => r.type === 'partyOf' && r.to === kampagne.id)).map((g) => g.id),
      );
      for (const f of stand.alle) if (partiesOf(f).some((p) => gruppen.has(p))) ids.add(f.id);
    }
    const figuren = await sieve(request, [...ids].map((i) => stand.map.get(i)).filter((x): x is Entity => !!x), stand.map);
    const namen = besitzer(stand.map);
    const items = new Set(bed.map((b) => b.item));
    const actors = figuren.map((f) => {
      const roheFigur = stand.map.get(f.id) ?? f;
      const stock = inventareVon(roheFigur, stand.map).flatMap((inv) =>
        (stand.map.get(inv)?.relations ?? [])
          .filter((r) => r.type === 'holds' && items.has(r.to) && !r.props?.['reservedFor'])
          .map((r) => ({
            item: r.to,
            inventory: inv,
            owner: namen.get(inv)?.name ?? '',
            edge: r.id,
            qty: Math.max(1, Number(r.props?.['qty']) || 1),
          })),
      );
      const check = craftCheck(roh1, { get: (id) => stand.map.get(id), campaign: kampagne, actor: roheFigur });
      return {
        id: f.id,
        name: entityName(f),
        learned: recipeLearned(stand.map, roh1, (info) => knows(stand.map, info, roheFigur.id)),
        check: { tool: check.tool, ability: check.ability, dc: check.dc },
        stock,
      };
    });
    /* Die Aufträge auf dieses Rezept, die dieser Betrachter sieht. */
    const auftraege = stand.alle.filter((o) => (o.relations ?? []).some((r) => r.type === 'instanceOf' && r.to === roh1.id));
    const sichtbar = (await sieve(request, auftraege, stand.map)).filter((o) => primaryInterface(o) === ORDER_TYPE);
    const orders = sichtbar.map((o) => {
      const a = auftrag(stand.map.get(o.id) ?? o, stand.map);
      return { id: o.id, name: entityName(o), actor: a.actor ? entityName(a.actor) : '', progress: a.progress, outcome: a.outcome };
    });
    const ertrag = (roh1.relations ?? []).find((r) => r.type === 'yields');
    return {
      kind: 'recipe',
      rules,
      leitet: leitung,
      recipe: {
        id: roh1.id,
        name: entityName(roh1),
        unit: need.unit,
        needed: need.needed,
        onFailure: roh1.components?.[RECIPE_COMPONENT]?.['onFailure'] ?? 'halfLost',
        yields: ertrag ? { id: ertrag.to, name: entityName(stand.map.get(ertrag.to)) || ertrag.to } : null,
      },
      needs: bed,
      actors,
      orders,
    };
  });

  /** Schreiben, oder mit den Gründen abweisen. */
  async function schreib(e: Entity): Promise<string | null> {
    const r = await schreibeGeprueft(e);
    return 'issues' in r ? r.issues.map((i) => i.message).join('; ') : null;
  }

  /**
   * **Einen Auftrag starten** (T-128): `recipe`, `actor`, `materials` als
   * `{ inventory, edge, qty }`. Spielende starten für ihre Figur und nur
   * gelernte Rezepte (REQ-218), mit allem Material, das verbraucht wird;
   * die Leitung startet für jede Figur und auch mit Lücken (D55).
   */
  app.post<{ Body: { recipe?: unknown; actor?: unknown; materials?: unknown } | null }>('/api/crafting', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return reply.code(401).send({ error: 'Nicht angemeldet' });
    const stand = await roh();
    const registry = await repo.getRegistry();
    const kampagne = currentCampaign(stand.map, registry.settings ?? null);
    const leitung = leitet(user, kampagne);
    const rezept = stand.map.get(String(request.body?.recipe ?? ''));
    const [sichtbar] = rezept ? await sieve(request, [rezept], stand.map) : [];
    if (!rezept || !sichtbar || !typeChain(registry, primaryInterface(rezept)).includes(RECIPE_COMPONENT) || (await istAuftrag(rezept))) {
      return reply.code(404).send({ error: 'Kein Rezept.' });
    }
    const actor = stand.map.get(String(request.body?.actor ?? ''));
    if (!actor) return reply.code(404).send({ error: 'Diese Figur gibt es nicht.' });
    if (!leitung && !(user.actorIds ?? []).includes(actor.id)) return reply.code(403).send({ error: 'Nur für die eigene Figur.' });
    if (!leitung && !recipeLearned(stand.map, rezept, (info) => knows(stand.map, info, actor.id))) {
      return reply.code(403).send({ error: 'Dieses Rezept hat die Figur noch nicht gelernt.' });
    }

    const roh2 = Array.isArray(request.body?.materials) ? (request.body.materials as unknown[]) : [];
    const wahl = roh2
      .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
      .map((m) => ({ inventory: String(m['inventory'] ?? ''), edge: String(m['edge'] ?? ''), qty: Math.trunc(Number(m['qty']) || 0) }))
      .filter((m) => m.qty > 0);
    const erlaubt = new Set(inventareVon(actor, stand.map));
    const bed = bedarf(rezept, stand.map);
    const gewaehlt = new Map<string, number>();
    for (const m of wahl) {
      if (!erlaubt.has(m.inventory)) return reply.code(403).send({ error: 'Material nur aus dem Inventar der Figur und ihrer Gruppe.' });
      const kante = (stand.map.get(m.inventory)?.relations ?? []).find((r) => r.id === m.edge && r.type === 'holds');
      if (!kante || !bed.some((b) => b.item === kante.to)) return reply.code(422).send({ error: 'Das braucht dieses Rezept nicht.' });
      gewaehlt.set(kante.to, (gewaehlt.get(kante.to) ?? 0) + m.qty);
    }
    const fehlt = bed.filter((b) => b.consumed && (gewaehlt.get(b.item) ?? 0) < b.qty);
    if (fehlt.length && !leitung) {
      return reply.code(422).send({ error: `Es fehlt: ${fehlt.map((b) => `${b.qty - (gewaehlt.get(b.item) ?? 0)} × ${b.name}`).join(', ')}.` });
    }
    const zuViel = bed.find((b) => (gewaehlt.get(b.item) ?? 0) > b.qty);
    if (zuViel) return reply.code(422).send({ error: `Mehr ${zuViel.name} als das Rezept braucht.` });

    const neueId = (): string => `e_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    let id = neueId();
    while (stand.map.has(id)) id = neueId();

    /* Zuerst reservieren (im Speicher): sagt ein Stück nein, ist noch nichts geschrieben. */
    const inventare = new Map<string, Entity>();
    for (const m of wahl) {
      const inv = inventare.get(m.inventory) ?? stand.map.get(m.inventory);
      if (!inv) return reply.code(404).send({ error: 'Dieses Inventar gibt es nicht.' });
      const r = reserveIn(inv, m.edge, m.qty, id, neueKante(inv.id, 'holds'));
      if ('refused' in r) {
        const warum = { missing: 'Das Stück ist weg — neu laden.', reserved: 'Das Stück ist schon reserviert.', short: 'So viele liegen dort nicht.' };
        return reply.code(409).send({ error: warum[r.refused] });
      }
      inventare.set(inv.id, r.inventory);
    }

    const name = `${entityName(rezept)} (${entityName(actor)})`;
    const ebene = await kampagnenEbene(stand.map, kampagne);
    const order: Entity = {
      id,
      interfaces: [ORDER_TYPE],
      name,
      components: {
        Identity: { name, id: nextId(stand.alle, ORDER_TYPE) },
        [ORDER_COMPONENT]: { progress: 0, outcome: 'open', started: new Date().toISOString().slice(0, 10), rolls: [] },
        /* Ein Auftrag ist ein Stand am Tisch, keine Vorbereitung. */
        [STATUS_COMPONENT]: { status: 'ready' },
      },
      relations: [
        { id: `${id}~instanceOf`, type: 'instanceOf', to: rezept.id, props: {} },
        ...(ebene ? [{ id: `${id}~inLayer`, type: 'inLayer', to: ebene.id, props: {} }] : []),
      ],
    };
    const fehler = await schreib(order);
    if (fehler) return reply.code(422).send({ error: fehler });
    if (!user.isAdmin && !leitung) await repo.addAuthored(user.id, id);
    for (const inv of inventare.values()) {
      const f = await schreib(inv);
      if (f) return reply.code(422).send({ error: f });
    }
    const f2 = await schreib({
      ...actor,
      relations: [...(actor.relations ?? []), { id: neueKante(actor.id, CRAFTING_RELATION), type: CRAFTING_RELATION, to: id, props: {} }],
    });
    if (f2) return reply.code(422).send({ error: f2 });
    await repo.appendEvent('crafting.started', id, { recipe: rezept.id, actor: actor.id, materials: wahl, by: user.id });
    return { id };
  });

  /**
   * **Abrechnen** (T-128): das reservierte Material nach `how` — bei Erfolg
   * verbraucht (was nicht verbraucht wird, kommt zurück) und der Ertrag ins
   * Inventar der Figur (sonst ihrer Gruppe); beim Abbruch alles zurück;
   * beim Misserfolg nach der Regel.
   */
  async function abrechnen(order: Entity, map: Map<string, Entity>, how: 'success' | Return): Promise<string | null> {
    const a = auftrag(order, map);
    const bed = bedarf(a.aufgeloest, map);
    const stuecke = reserviert(order.id, map);
    const ergebnis = settlePieces(stuecke, (item) => bed.find((b) => b.item === item)?.consumed ?? true, how);
    const jeInventar = new Map<string, Map<string, number>>();
    for (const { piece, keep } of ergebnis) {
      const m = jeInventar.get(piece.inventory) ?? new Map<string, number>();
      m.set(piece.edge, keep);
      jeInventar.set(piece.inventory, m);
    }
    const neu = new Map<string, Entity>();
    for (const [inv, keep] of jeInventar) {
      const e = map.get(inv);
      if (e) neu.set(inv, applySettlement(e, keep));
    }
    if (how === 'success' && a.actor) {
      const ertrag = (a.aufgeloest.relations ?? []).find((r) => r.type === 'yields');
      const anzahl = Math.max(1, Number(a.aufgeloest.components?.[RECIPE_COMPONENT]?.['yieldCount']) || 1);
      const ziel = carriesOf(a.actor) ?? partiesOf(a.actor).map((p) => carriesOf(map.get(p))).find((x) => !!x) ?? null;
      const inv = ziel ? (neu.get(ziel) ?? map.get(ziel)) : undefined;
      if (ertrag && inv) neu.set(inv.id, addToInventory(inv, ertrag.to, anzahl, neueKante(inv.id, 'holds')));
    }
    for (const inv of neu.values()) {
      const f = await schreib(inv);
      if (f) return f;
    }
    await repo.appendEvent('crafting.settled', order.id, { how, pieces: ergebnis.map((x) => ({ item: x.piece.item, qty: x.piece.qty, keep: x.keep })) });
    return null;
  }

  /** Den Auftrag mit neuer Karte schreiben (nur die eigene Karte ändert sich). */
  async function setzeAuftrag(order: Entity, karte: Record<string, unknown>): Promise<string | null> {
    return schreib({ ...order, components: { ...(order.components ?? {}), [ORDER_COMPONENT]: { ...(order.components?.[ORDER_COMPONENT] ?? {}), ...karte } } });
  }

  /** Für die Aktionen: der Auftrag, wer fragt, ob er leitet oder fertigt. */
  async function vorbereiten(request: FastifyRequest<{ Params: { id: string } }>) {
    const user = await viewerOf(request);
    if (!user) return { ok: false, code: 401, error: 'Nicht angemeldet' } as const;
    const stand = await roh();
    const registry = await repo.getRegistry();
    const order = stand.map.get(request.params.id);
    const [sichtbar] = order ? await sieve(request, [order], stand.map) : [];
    if (!order || !sichtbar || !(await istAuftrag(order))) return { ok: false, code: 404, error: 'Kein Auftrag.' } as const;
    const kampagne = currentCampaign(stand.map, registry.settings ?? null);
    const a = auftrag(order, stand.map);
    const leitung = leitet(user, kampagne);
    const eigen = !!a.actor && (user.actorIds ?? []).includes(a.actor.id);
    if (!leitung && !eigen) return { ok: false, code: 403, error: 'Das ist nicht dein Auftrag.' } as const;
    if (a.outcome !== 'open') return { ok: false, code: 409, error: 'Dieser Auftrag ist abgeschlossen.' } as const;
    return { ok: true, user, stand, order, kampagne, a, leitung, rules: craftRulesOf(kampagne) } as const;
  }

  /** Eine Probe wirken lassen: Fortschritt, Ausgang, und wo es endet, abrechnen. */
  async function wirken(order: Entity, stand: Stand, kampagne: Entity | null, probe: Probe): Promise<string | null> {
    const a = auftrag(order, stand.map);
    const need = orderNeed(a.aufgeloest);
    const ergebnis = probe.result === 'pending' || probe.result === 'rejected' ? 'failure' : probe.result;
    const wirkung = applyRoll({ progress: a.progress, outcome: a.outcome }, ergebnis, need, craftRulesOf(kampagne), a.aufgeloest.components?.[RECIPE_COMPONENT]?.['onFailure']);
    const rolls = [...a.rolls.filter((r) => r.result !== 'pending'), { ...probe, note: wirkung.note }];
    if (wirkung.settle) {
      const f = await abrechnen(order, stand.map, wirkung.settle);
      if (f) return f;
    }
    return setzeAuftrag(order, { progress: wirkung.progress, outcome: wirkung.outcome, rolls });
  }

  /**
   * **Eine Probe eintragen** (`total`, `nat` für die natürliche 20 oder 1).
   * Gilt sofort für die Leitung, sonst nach `Campaign.craftConfirm`: mit
   * `gm` wartet sie (`pending`), bis die Leitung sie bestätigt. Bei
   * Arbeitstagen erst, wenn die Tage gearbeitet sind.
   */
  app.post<{ Params: { id: string }; Body: { total?: unknown; nat?: unknown } | null }>('/api/crafting/:id/roll', async (request, reply) => {
    const v = await vorbereiten(request);
    if (!v.ok) return reply.code(v.code).send({ error: v.error });
    const total = Number(request.body?.total);
    if (!Number.isFinite(total)) return reply.code(400).send({ error: 'Das Ergebnis der Probe fehlt.' });
    const natRoh = Number(request.body?.nat);
    const nat = natRoh === 1 || natRoh === 20 ? natRoh : undefined;
    const need = orderNeed(v.a.aufgeloest);
    if (need.unit === 'days' && v.a.progress < need.needed) return reply.code(409).send({ error: 'Erst die Tage arbeiten.' });
    if (v.a.rolls.some((r) => r.result === 'pending')) return reply.code(409).send({ error: 'Eine Probe wartet noch auf die Leitung.' });
    const dc = craftCheck(v.a.aufgeloest, { get: (id) => v.stand.map.get(id), campaign: v.kampagne, actor: v.a.actor }).dc;
    const result = rollResult(total, dc, nat);
    const probe: Probe = { total, ...(nat ? { nat } : {}), dc, result, by: v.user.name, at: new Date().toISOString() };
    if (!v.leitung && v.rules.confirm === 'gm') {
      const f = await setzeAuftrag(v.order, { rolls: [...v.a.rolls, { ...probe, result: 'pending', would: result }] });
      return f ? reply.code(422).send({ error: f }) : { pending: true, result };
    }
    const f = await wirken(v.order, v.stand, v.kampagne, probe);
    return f ? reply.code(422).send({ error: f }) : { pending: false, result };
  });

  /** **Die Leitung bestätigt** (oder verwirft) die wartende Probe. */
  app.post<{ Params: { id: string }; Body: { accept?: unknown } | null }>('/api/crafting/:id/confirm', async (request, reply) => {
    const v = await vorbereiten(request);
    if (!v.ok) return reply.code(v.code).send({ error: v.error });
    if (!v.leitung) return reply.code(403).send({ error: 'Proben bestätigt die Leitung.' });
    const wartend = v.a.rolls.find((r) => r.result === 'pending');
    if (!wartend) return reply.code(409).send({ error: 'Keine Probe wartet.' });
    if (request.body?.accept === false) {
      const rolls = v.a.rolls.map((r) => (r === wartend ? { ...r, result: 'rejected' as const, note: 'Not accepted by the GM.' } : r));
      const f = await setzeAuftrag(v.order, { rolls });
      return f ? reply.code(422).send({ error: f }) : { ok: true };
    }
    const result = (wartend.would ?? rollResult(wartend.total, wartend.dc, wartend.nat)) as Probe['result'];
    const probe: Probe = { total: wartend.total, ...(wartend.nat ? { nat: wartend.nat } : {}), dc: wartend.dc, result, by: wartend.by, at: wartend.at };
    const f = await wirken(v.order, v.stand, v.kampagne, probe);
    return f ? reply.code(422).send({ error: f }) : { ok: true, result };
  });

  /** **Einen Arbeitstag** (oder mehrere) eintragen — nur, wo das Rezept in Tagen zählt. */
  app.post<{ Params: { id: string }; Body: { days?: unknown } | null }>('/api/crafting/:id/work', async (request, reply) => {
    const v = await vorbereiten(request);
    if (!v.ok) return reply.code(v.code).send({ error: v.error });
    const need = orderNeed(v.a.aufgeloest);
    if (need.unit !== 'days') return reply.code(409).send({ error: 'Dieses Rezept zählt Proben, nicht Tage.' });
    const tage = Math.max(1, Math.trunc(Number(request.body?.days) || 1));
    const f = await setzeAuftrag(v.order, { progress: Math.min(need.needed, v.a.progress + tage) });
    return f ? reply.code(422).send({ error: f }) : { ok: true };
  });

  /** **Abbrechen:** alles Reservierte kommt zurück. */
  app.post<{ Params: { id: string } }>('/api/crafting/:id/abort', async (request, reply) => {
    const v = await vorbereiten(request);
    if (!v.ok) return reply.code(v.code).send({ error: v.error });
    const f = (await abrechnen(v.order, v.stand.map, 'all')) ?? (await setzeAuftrag(v.order, { outcome: 'aborted' }));
    return f ? reply.code(422).send({ error: f }) : { ok: true };
  });

  /**
   * **Die Leitung erklärt den Auftrag für misslungen** — für die Regel
   * `custom` und für alles, was am Tisch anders kam: `return` sagt, was
   * zurückkommt (`all`, `half`, `none`).
   */
  app.post<{ Params: { id: string }; Body: { return?: unknown } | null }>('/api/crafting/:id/fail', async (request, reply) => {
    const v = await vorbereiten(request);
    if (!v.ok) return reply.code(v.code).send({ error: v.error });
    if (!v.leitung) return reply.code(403).send({ error: 'Das entscheidet die Leitung.' });
    const r = String(request.body?.return ?? 'none');
    const how: Return = r === 'all' || r === 'half' ? r : 'none';
    const f = (await abrechnen(v.order, v.stand.map, how)) ?? (await setzeAuftrag(v.order, { outcome: 'failed' }));
    return f ? reply.code(422).send({ error: f }) : { ok: true };
  });
}
