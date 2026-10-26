/**
 * **Die Übersicht der Vorgabeformen** (T-394, E-165, REQ-333):
 * `GET /api/inventory/shapes` — die Ebenen mit der Karte `ShapeDefaults`,
 * die in der laufenden Kampagne gelten, ihre Gruppen und je sichtbarem
 * Gegenstand, welche Form gilt und woher; `PUT …/groups/:id` und
 * `PUT …/items/:id` ändern die Karte einer Ebene, die der Betrachter
 * schreibt. Gerechnet wird wie beim Lesen eines Gegenstands
 * (`defaultShapeOf`), damit die Übersicht nie etwas anderes sagt als der
 * Artikel.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  SHAPE_DEFAULTS_CARD,
  defaultShapeOf,
  entityName,
  indexShapeDefaults,
  mergeShapeDefaults,
  primaryInterface,
  isLayer,
  isShapesLayer,
  resolvedStack,
  shapeDefaultsOf,
  typeChain,
  withShapeGroup,
  withShapeItem,
  type Entity,
  type Registry,
  type ShapeGroup,
  type ShapeItem,
  type ValidationIssue,
} from '@nw/model';
import { RevisionConflict } from './repo.js';

interface Stand {
  map: Map<string, Entity>;
}

export interface VorgabeformenDeps {
  roh: () => Promise<Stand>;
  registry: () => Promise<Registry>;
  kampagne: (map: Map<string, Entity>, registry: Registry) => Entity | null;
  sieve: (request: FastifyRequest, entities: Entity[], bestand?: Map<string, Entity>) => Promise<Entity[]>;
  /** Der Gegenstand, wie er in der Kampagne gilt (Fassung, Ergänzung). */
  geltend: (e: Entity, map: Map<string, Entity>) => Promise<Entity>;
  angemeldet: (request: FastifyRequest) => Promise<boolean>;
  /** Darf dieser Betrachter diese Ebene schreiben? */
  schreibt: (request: FastifyRequest, layerId: string) => Promise<boolean>;
  /** Gegen die gelesene Revision; wirft `RevisionConflict`, wenn jemand dazwischen schrieb. */
  schreibeGeprueft: (e: Entity, erwartet: number | null) => Promise<{ stored: Entity } | { issues: ValidationIssue[] }>;
  /** Die Ebene frisch aus dem Speicher (nach einem Konflikt). */
  frisch: (id: string) => Promise<Entity | null>;
}

/** Die Ebenen der Kampagne mit Vorgabeformen, in der Reihenfolge des Stapels (die spezifischste zuletzt). */
function formEbenen(map: Map<string, Entity>, kampagne: Entity | null): Entity[] {
  if (!kampagne) return [];
  return resolvedStack(map, kampagne).filter(isShapesLayer);
}

const zeilen = (v: unknown): string[] | null | undefined => {
  if (v === null) return null;
  if (typeof v === 'string') return v.split(/[/\n]/).map((z) => z.trim()).filter(Boolean);
  if (Array.isArray(v)) return v.filter((z): z is string => typeof z === 'string').map((z) => z.trim()).filter(Boolean);
  return undefined;
};
const itemKarte = (e: Entity): Record<string, unknown> => (e.components?.['Item'] as Record<string, unknown> | undefined) ?? {};
const zahl = (v: unknown): number | null | undefined => (v === null ? null : typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.trunc(v) : undefined);
const text = (v: unknown): string | null | undefined => (v === null || v === '' ? null : typeof v === 'string' ? v : undefined);

export function registerVorgabeformen(app: FastifyInstance, deps: VorgabeformenDeps): void {
  const { roh, registry, kampagne: kampagneVon, sieve, geltend, angemeldet, schreibt, schreibeGeprueft, frisch } = deps;

  app.get<{ Querystring: { only?: string } }>('/api/inventory/shapes', async (request, reply) => {
    if (!(await angemeldet(request))) return reply.code(401).send({ error: 'Not signed in.' });
    const stand = await roh();
    const reg = await registry();
    const kampagne = kampagneVon(stand.map, reg);
    const ebenen = formEbenen(stand.map, kampagne);
    const daten = ebenen.map((l) => ({ l, d: shapeDefaultsOf(l) }));
    const gemischt = mergeShapeDefaults(daten.map((x) => x.d));
    const idx = indexShapeDefaults(gemischt);

    /* Je Gruppe und je Gegenstand: welche Ebene sagt es zuletzt. */
    const gruppeAus = new Map<string, string>();
    const eintragAus = new Map<string, string>();
    for (const { l, d } of daten) {
      for (const g of d.groups) gruppeAus.set(g.id, l.id);
      for (const e of d.items) eintragAus.set(e.id, l.id);
    }

    const layers = await Promise.all(
      ebenen.map(async (l) => ({ id: l.id, name: entityName(l), type: primaryInterface(l), writable: await schreibt(request, l.id) })),
    );
    const ziel = [...layers].reverse().find((l) => l.writable)?.id ?? null;
    const campaign = kampagne ? { id: kampagne.id, name: entityName(kampagne) } : null;
    /* Nur die Gruppen (für die Wahl am Gegenstand): ohne den Gang über jeden Gegenstand. */
    if (request.query.only === 'groups') {
      return { campaign, layers, target: ziel, groups: gemischt.groups.map((g) => ({ ...g, ref: undefined, count: 0, layer: gruppeAus.get(g.id) })), items: [] };
    }

    const istGegenstand = (e: Entity) => typeChain(reg, primaryInterface(e)).includes('Item');
    const kandidaten = [...stand.map.values()].filter(istGegenstand);
    const gesehen = await sieve(request, kandidaten, stand.map);
    const geltende = new Map<string, Entity>();
    for (const e of gesehen) geltende.set(e.id, await geltend(e, stand.map));
    const sichtbar = new Set(gesehen.map((e) => e.id));
    const lookup = { item: (id: string) => geltende.get(id) ?? stand.map.get(id) };

    /* Die Eigenschaften (`hasProperty`) zum Erkennen der Gruppe — nur die, die der Betrachter sieht. */
    const eigenschaftsIds = new Set<string>();
    for (const e of gesehen) for (const r of e.relations ?? []) if (r.type === 'hasProperty') eigenschaftsIds.add(r.to);
    const eigenschaften = new Map(
      (await sieve(request, [...eigenschaftsIds].map((id) => stand.map.get(id)).filter((x): x is Entity => !!x), stand.map)).map((x) => [x.id, entityName(x)]),
    );
    const zaehler = new Map<string, number>();
    const items = gesehen.map((roh0) => {
      const e = geltende.get(roh0.id) ?? roh0;
      const s = defaultShapeOf(e, idx, lookup);
      if (s.group) zaehler.set(s.group, (zaehler.get(s.group) ?? 0) + 1);
      const eintrag = idx.items.get(roh0.id);
      const ref = s.ref && sichtbar.has(s.ref) ? s.ref : undefined;
      return {
        id: roh0.id,
        name: entityName(roh0),
        type: primaryInterface(roh0),
        ...(typeof itemKarte(e)['itemType'] === 'string' ? { itemType: itemKarte(e)['itemType'] as string } : {}),
        ...(typeof itemKarte(e)['weight'] === 'number' ? { weight: itemKarte(e)['weight'] as number } : {}),
        ...(() => {
          const p = (roh0.relations ?? []).filter((r) => r.type === 'hasProperty').map((r) => eigenschaften.get(r.to)).filter((n): n is string => !!n);
          return p.length ? { properties: p } : {};
        })(),
        rows: s.rows,
        stackSize: s.stackSize,
        source: s.source,
        ...(s.group ? { group: s.group } : {}),
        ...(ref ? { ref, refName: entityName(stand.map.get(ref)) } : {}),
        /* Was im Untermodul eigens für ihn steht — die lokale Überschreibung. */
        ...(eintrag ? { set: { ...eintrag, ...(eintrag.ref && !sichtbar.has(eintrag.ref) ? { ref: undefined } : {}) }, setIn: eintragAus.get(roh0.id) } : {}),
      };
    });

    const groups = gemischt.groups
      .slice()
      .sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || a.name.localeCompare(b.name))
      .map((g) => ({
        ...g,
        ...(g.ref && !sichtbar.has(g.ref) ? { ref: undefined } : g.ref ? { refName: entityName(stand.map.get(g.ref)) } : {}),
        count: zaehler.get(g.id) ?? 0,
        layer: gruppeAus.get(g.id),
      }));

    return {
      campaign,
      layers,
      target: ziel,
      groups,
      items: items.sort((a, b) => a.name.localeCompare(b.name)),
    };
  });

  /** Die Karte einer Ebene ändern, durch `validateEntity`. */
  async function aendern(
    request: FastifyRequest,
    layerId: string | undefined,
    aenderung: (karte: Record<string, unknown> | undefined) => Record<string, unknown>,
    nurZaehlen = false,
  ): Promise<{ code: number; body: unknown }> {
    const stand = await roh();
    let id = layerId;
    if (id) {
      /* **Geschrieben wird in die Ebene selbst**, nicht in eine Kampagne:
         die Formen gehören dem Modul, eine Kampagne schaltet es nur auf
         (und passt es mit einer eigenen Ebene darüber an). Ob sie gerade
         irgendwo aufgeschaltet ist, spielt beim Schreiben keine Rolle. */
      const l = stand.map.get(id);
      if (!l || !isLayer(l) || !isShapesLayer(l)) {
        return { code: 404, body: { error: 'This is not a Default shapes layer. Name the layer of the mechanic Default shapes, or one that already carries shapes.' } };
      }
      if (!(await schreibt(request, id))) {
        return { code: 403, body: { error: 'You do not write in this layer. Ask the administration or its owner to add you as an editor.' } };
      }
    } else {
      /* Ohne Angabe: die spezifischste Formebene der laufenden Kampagne, die man schreibt. */
      const reg = await registry();
      const ziele: string[] = [];
      for (const l of formEbenen(stand.map, kampagneVon(stand.map, reg))) if (await schreibt(request, l.id)) ziele.push(l.id);
      id = ziele[ziele.length - 1];
      if (!id) {
        return { code: 403, body: { error: 'No default-shapes layer you write is turned on in this campaign. Turn on Inventory, or ask the administration to assign you its Default shapes layer.' } };
      }
    }
    /* **Gegen die gelesene Revision** — zwei Änderungen an derselben Karte
       zur selben Zeit gingen sonst eine verloren (die Karte ist eine Liste
       für viele Gegenstände). Bei einem Konflikt neu lesen und die eigene
       Änderung auf den neuen Stand legen. */
    let l: Entity | null = stand.map.get(id) ?? null;
    for (let versuch = 0; versuch < 5 && l; versuch += 1) {
      const karte = aenderung(l.components?.[SHAPE_DEFAULTS_CARD] as Record<string, unknown> | undefined);
      if (nurZaehlen) return { code: 200, body: { layer: id } };
      try {
        const r = await schreibeGeprueft({ ...l, components: { ...l.components, [SHAPE_DEFAULTS_CARD]: karte } }, l.revision ?? null);
        if ('issues' in r) return { code: 422, body: { error: 'The change does not fit the layer. Check the reference item and the shape.', issues: r.issues } };
        return { code: 200, body: { layer: id, card: karte } };
      } catch (error) {
        if (!(error instanceof RevisionConflict)) throw error;
        l = await frisch(id);
      }
    }
    return { code: 409, body: { error: 'Someone else changed these shapes at the same moment. Reload the page and try again.' } };
  }

  app.put<{ Params: { id: string }; Body: Record<string, unknown> | null }>('/api/inventory/shapes/groups/:id', async (request, reply) => {
    const b = request.body ?? {};
    const patch: Partial<Record<keyof ShapeGroup, unknown>> = {};
    for (const k of ['name', 'section', 'rule', 'note', 'ref'] as const) if (text(b[k]) !== undefined) patch[k] = text(b[k]);
    if (zeilen(b['rows']) !== undefined) patch.rows = zeilen(b['rows']);
    if (zahl(b['stackSize']) !== undefined) patch.stackSize = zahl(b['stackSize']);
    if (typeof b['carryable'] === 'boolean' || b['carryable'] === null) patch.carryable = b['carryable'];
    if (typeof b['rank'] === 'number' || b['rank'] === null) patch.rank = b['rank'];
    const r = await aendern(request, typeof b['layer'] === 'string' ? b['layer'] : undefined, (k) => withShapeGroup(k, request.params.id, patch as never));
    return reply.code(r.code).send(r.body);
  });

  app.put<{ Params: { id: string }; Body: Record<string, unknown> | null }>('/api/inventory/shapes/items/:id', async (request, reply) => {
    const b = request.body ?? {};
    const stand = await roh();
    const ding = stand.map.get(request.params.id);
    if (!ding || !(await sieve(request, [ding], stand.map)).length) return reply.code(404).send({ error: 'No such item.' });
    const patch: Partial<Record<keyof ShapeItem, unknown>> = {};
    if (text(b['group']) !== undefined) patch.group = text(b['group']);
    if (text(b['ref']) !== undefined) patch.ref = text(b['ref']);
    if (b['rows'] !== undefined) patch.rows = Array.isArray(b['rows']) && b['rows'].length === 0 ? [] : zeilen(b['rows']);
    if (zahl(b['stackSize']) !== undefined) patch.stackSize = zahl(b['stackSize']);
    if (patch.ref === request.params.id) return reply.code(400).send({ error: 'An item cannot be its own reference item. Choose another item or clear the reference.' });
    const r = await aendern(request, typeof b['layer'] === 'string' ? b['layer'] : undefined, (k) => withShapeItem(k, request.params.id, patch as never));
    return reply.code(r.code).send(r.body);
  });

  /**
   * **Viele Werte auf einmal** (T-394 Schritt 5, E-127): Gruppen und Werte
   * je Gegenstand werden Feld für Feld über die Karte gelegt
   * (`mergeShapeDefaults`) — ein Schreibvorgang statt zweitausend. Mit
   * `dryRun` wird nur gezählt, was neu wäre und was sich ändert.
   */
  app.put<{ Body: { layer?: unknown; shapeGroups?: unknown; shapeItems?: unknown; dryRun?: unknown } | null }>('/api/inventory/shapes', async (request, reply) => {
    const b = request.body ?? {};
    const neu = shapeDefaultsOf({ id: '_', name: '', interfaces: [], components: { [SHAPE_DEFAULTS_CARD]: { shapeGroups: b.shapeGroups, shapeItems: b.shapeItems } } } as Entity);
    let zaehlung = { groups: { added: 0, changed: 0 }, items: { added: 0, changed: 0 } };
    const r = await aendern(request, typeof b.layer === 'string' ? b.layer : undefined, (karte) => {
      const alt = shapeDefaultsOf({ id: '_', name: '', interfaces: [], components: { [SHAPE_DEFAULTS_CARD]: karte ?? {} } } as Entity);
      const ag = new Map(alt.groups.map((g) => [g.id, JSON.stringify(g)]));
      const ai = new Map(alt.items.map((e) => [e.id, JSON.stringify(e)]));
      const zusammen = mergeShapeDefaults([alt, neu]);
      zaehlung = { groups: { added: 0, changed: 0 }, items: { added: 0, changed: 0 } };
      for (const g of zusammen.groups) if (!ag.has(g.id)) zaehlung.groups.added++; else if (ag.get(g.id) !== JSON.stringify(g)) zaehlung.groups.changed++;
      for (const e of zusammen.items) if (!ai.has(e.id)) zaehlung.items.added++; else if (ai.get(e.id) !== JSON.stringify(e)) zaehlung.items.changed++;
      return { ...(karte ?? {}), shapeGroups: zusammen.groups, shapeItems: zusammen.items };
    }, b.dryRun === true);
    return reply.code(r.code).send(r.code === 200 ? { ...(r.body as object), ...zaehlung, dryRun: b.dryRun === true } : r.body);
  });
}

