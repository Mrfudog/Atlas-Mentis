/**
 * **Kaufen und Verkaufen im Laden** (T-133): `POST /api/shops/:id/buy`
 * und `POST /api/shops/:id/sell`.
 *
 * Der Preis wird **hier** gerechnet (`shopWares` für die kaufende Figur,
 * D8) — was die Maske schickt, ist Ware, Menge und Figur, nie ein Betrag.
 * Gehandelt wird für eine eigene Figur (D74, wie beim Inventar), die
 * Leitung handelt für jede. Laden und Inventar werden gegen die gelesene
 * Revision geschrieben: kaufen zwei gleichzeitig die letzte Laterne, geht
 * einer leer aus, statt dass beide sie bekommen. **Was gekauft wird,
 * entsteht als Instanz** des Grundartikels (`newInstance`, T-150) in der
 * Ebene der Kampagne — ausser es wächst ein loser Stapel desselben; eine
 * beliebige Instanz, die ganz verkauft ist, fällt wieder weg. Jeder Handel steht im
 * Protokoll (`shop.bought`, `shop.sold`) — wer, was, wie viel, der Preis
 * und woher jeder Abschlag kam.
 */
import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  buyWare,
  currentCampaign,
  entityName,
  insideOf,
  isInstance,
  newInstance,
  nextId,
  primaryInterface,
  sellPiece,
  SHOP_TYPE,
  shopWares,
  withVersionPrices,
  resolveArticle,
  tableRole,
  typeChain,
  type Entity,
  type TradeRefusal,
  type validateEntity,
} from '@nw/model';
import type { User } from './auth.js';
import { RevisionConflict, type Repository } from './repo.js';
import { reservierteSperre } from './reservierung.js';

interface Stand {
  alle: Entity[];
  map: Map<string, Entity>;
}

export interface LadenDeps {
  repo: Repository;
  viewerOf: (request: FastifyRequest) => Promise<User | null>;
  roh: () => Promise<Stand>;
  sieve: (request: FastifyRequest, entities: Entity[], bestand?: Map<string, Entity>) => Promise<Entity[]>;
  schreibeGeprueft: (
    entity: Entity,
    erwartet?: number | null,
  ) => Promise<{ stored: Entity } | { issues: ReturnType<typeof validateEntity> }>;
  kampagnenEbene: (map: Map<string, Entity>, kampagne: Entity | null) => Promise<Entity | null>;
}

/** Was die Ablehnung heisst — die Maske sagt es auf Englisch, der Code steht dabei. */
const GRUND: Record<TradeRefusal, string> = {
  missing: 'Diese Ware oder dieses Stück gibt es hier nicht.',
  unavailable: 'Der Laden gibt das gerade nicht her.',
  soldOut: 'Ausverkauft.',
  tooFew: 'So viele sind nicht da.',
  noPrice: 'Ohne Preis wird nicht gehandelt.',
  tooPoor: 'Zu wenig Geld.',
  reserved: 'Das Stück ist reserviert.',
  notEmpty: 'Im Behälter liegt noch etwas.',
};

/** Die Inventare einer Figur: das, das sie trägt, und die Behälter darin. */
export function inventareDerFigur(figur: Entity, map: ReadonlyMap<string, Entity>): string[] {
  const inv = (figur.relations ?? []).find((r) => r.type === 'carries')?.to;
  if (!inv) return [];
  const raus = new Set([inv]);
  for (const h of map.get(inv)?.relations ?? []) if (h.type === 'holds') for (const i of insideOf(h.to, map)) raus.add(i);
  return [...raus];
}

export function registerLaden(app: FastifyInstance, deps: LadenDeps): void {
  const { repo, viewerOf, roh, sieve, schreibeGeprueft, kampagnenEbene } = deps;

  /**
   * Was beide Routen zuerst fragen: angemeldet, der Laden sichtbar und ein
   * Laden, die Figur eine eigene (oder die Leitung handelt). Gibt den
   * frischen Laden und die Figur zurück oder schon die Antwort.
   */
  async function vorbereiten(
    request: FastifyRequest<{ Params: { id: string }; Body: { actor?: unknown } | null }>,
  ): Promise<{ fehler: { code: number; error: string } } | { user: User; stand: Stand; laden: Entity; figur: Entity; kampagne: Entity | null; leitet: boolean }> {
    const user = await viewerOf(request);
    if (!user) return { fehler: { code: 401, error: 'Nicht angemeldet' } };
    const stand = await roh();
    const registry = await repo.getRegistry();
    const roherLaden = stand.map.get(request.params.id);
    const [sichtbar] = roherLaden ? await sieve(request, [roherLaden], stand.map) : [];
    if (!roherLaden || !sichtbar || !typeChain(registry, primaryInterface(roherLaden)).includes(SHOP_TYPE)) {
      return { fehler: { code: 404, error: 'Kein Laden.' } };
    }
    const kampagne = currentCampaign(stand.map, registry.settings ?? null);
    const rolle = kampagne ? tableRole({ roles: user.roles ?? {} }, kampagne.id) : null;
    const leitet = user.isAdmin || rolle === 'gm' || rolle === 'co-gm';
    const actorId = String(request.body?.actor ?? '');
    const figur = stand.map.get(actorId);
    if (!figur) return { fehler: { code: 400, error: 'Für wen? Die Figur fehlt.' } };
    /* Wie beim Inventar (D74): die eigene Figur, und die Leitung für jede. */
    if (!leitet && !(user.actorIds ?? []).includes(figur.id)) return { fehler: { code: 403, error: 'Das ist nicht deine Figur.' } };
    /* Frisch gelesen: gegen diese Revision wird geschrieben. */
    const laden = (await repo.getEntity(roherLaden.id)) ?? roherLaden;
    return { user, stand, laden, figur, kampagne, leitet };
  }

  /**
   * Laden, dann Inventar — jeweils gegen die gelesene Revision. Vorher fragt
   * die Sperre für reservierte Stücke (T-134), dieselbe wie an jedem `PUT`:
   * `sellPiece` lässt Reserviertes schon liegen, aber die Regel steht an
   * einer Stelle und nicht an jeder Route ein bisschen.
   */
  async function schreiben(neu: Entity[], alt: Map<string, Entity>, user: User): Promise<{ code: number; error: string; issues?: unknown } | null> {
    for (const e of neu) {
      const gesperrt = await reservierteSperre(repo, user, alt.get(e.id), e);
      if (gesperrt) return { code: 409, error: gesperrt };
    }
    try {
      for (const e of neu) {
        const r = await schreibeGeprueft(e, alt.get(e.id)?.revision ?? null);
        if ('issues' in r) return { code: 422, error: 'Validierung fehlgeschlagen', issues: r.issues };
      }
    } catch (fehler) {
      if (fehler instanceof RevisionConflict) return { code: 409, error: 'Inzwischen hat sich etwas geändert — noch einmal versuchen.' };
      throw fehler;
    }
    return null;
  }

  app.post<{ Params: { id: string }; Body: { actor?: unknown; edge?: unknown; qty?: unknown } | null }>(
    '/api/shops/:id/buy',
    async (request, reply) => {
      const v = await vorbereiten(request);
      if ('fehler' in v) return reply.code(v.fehler.code).send({ error: v.fehler.error });
      const { user, stand, laden, figur, kampagne, leitet } = v;
      /* Gerechnet in der Preissicht (T-139): die Ware mit dem Preis ihrer
         geltenden Fassung, etwa aus „AI generated prices". */
      const registry = await repo.getRegistry();
      const map = withVersionPrices(new Map(stand.map).set(laden.id, laden), kampagne, registry);
      const offer = shopWares(laden, { entities: map, buyer: figur }).find((w) => w.edge === String(request.body?.edge ?? ''));
      const item = offer ? stand.map.get(offer.item) : undefined;
      /* Eine Ware, die dieser Betrachter nicht sieht, gibt es für ihn nicht —
         gesiebt wird die geltende Fassung, das Original steht nicht im Spiel. */
      const geltend = item ? resolveArticle(stand.map, item, kampagne, registry) : undefined;
      if (!offer || !item || !geltend || !(await sieve(request, [geltend], stand.map)).length) {
        return reply.code(409).send({ error: GRUND.missing, refused: 'missing' });
      }
      const invId = (figur.relations ?? []).find((r) => r.type === 'carries')?.to;
      const inventar = invId ? await repo.getEntity(invId) : undefined;
      if (!inventar) return reply.code(409).send({ error: 'Diese Figur trägt noch kein Inventar.', refused: 'noInventory' });
      const qty = Number(request.body?.qty ?? 1);
      /* Das neue Stück: eine Instanz des Grundartikels (T-150). Führt der
         Laden schon ein eigenes Stück (eine angekaufte Instanz), wandert
         genau dieses — eine Instanz einer Instanz wäre ein Umweg ohne Grund. */
      const neueId = (): string => `e_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
      let stueckId = neueId();
      while (map.has(stueckId)) stueckId = neueId();
      const eigenesStueck = isInstance(item);
      const r = buyWare(
        laden,
        inventar,
        offer,
        Number.isFinite(qty) ? qty : 1,
        { edge: `${inventar.id}~holds-${randomUUID().slice(0, 8)}`, to: eigenesStueck ? item.id : stueckId },
        map,
      );
      if ('refused' in r) return reply.code(409).send({ error: GRUND[r.refused], refused: r.refused });
      let angelegt: string | undefined;
      if (r.created && !eigenesStueck) {
        const ebene = await kampagnenEbene(stand.map, kampagne);
        const stueck = newInstance(item, { id: stueckId, number: nextId(stand.alle, primaryInterface(item)), layer: ebene?.id ?? null });
        const geschrieben = await schreibeGeprueft(stueck, null);
        if ('issues' in geschrieben) return reply.code(422).send({ error: 'Validierung fehlgeschlagen', issues: geschrieben.issues });
        angelegt = stueckId;
        /* Das Stück gehört zur eigenen Figur (D74): wer es kauft, darf es gravieren. */
        if (!user.isAdmin && !leitet) await repo.addAuthored(user.id, stueckId);
      }
      const neu = r.shop === laden ? [r.inventory] : [r.shop, r.inventory];
      const fehler = await schreiben(neu, new Map([[laden.id, laden], [inventar.id, inventar]]), user);
      if (fehler) {
        /* Ohne Kauf kein Stück: was eben angelegt wurde, hält niemand. */
        if (angelegt) await repo.deleteEntity(angelegt);
        return reply.code(fehler.code).send(fehler);
      }
      const anzahl = Math.max(1, Math.trunc(qty) || 1);
      await repo.appendEvent('shop.bought', laden.id, {
        actor: figur.id,
        item: offer.item,
        edge: offer.edge,
        qty: anzahl,
        unit: r.unit,
        total: r.total,
        ...(offer.list !== undefined ? { list: offer.list } : {}),
        ...(offer.base !== undefined ? { base: offer.base } : {}),
        steps: offer.steps,
        piece: r.piece,
        ...(angelegt ? { created: true } : {}),
        inventory: inventar.id,
        by: user.id,
      });
      return {
        item: { id: offer.item, name: entityName(item) },
        piece: r.piece,
        qty: anzahl,
        unit: r.unit,
        total: r.total,
        copper: r.inventory.components?.['Inventory']?.['copper'] ?? 0,
      };
    },
  );

  app.post<{ Params: { id: string }; Body: { actor?: unknown; inventory?: unknown; edge?: unknown; qty?: unknown } | null }>(
    '/api/shops/:id/sell',
    async (request, reply) => {
      const v = await vorbereiten(request);
      if ('fehler' in v) return reply.code(v.fehler.code).send({ error: v.fehler.error });
      const { user, stand, laden, figur, kampagne } = v;
      /* Verkauft wird aus dem Inventar der Figur und den Behältern darin — nicht aus dem der Gruppe. */
      const invId = String(request.body?.inventory ?? '');
      if (!inventareDerFigur(figur, stand.map).includes(invId)) {
        return reply.code(403).send({ error: 'Dieses Inventar gehört nicht dieser Figur.' });
      }
      const inventar = await repo.getEntity(invId);
      if (!inventar) return reply.code(409).send({ error: GRUND.missing, refused: 'missing' });
      const qty = Number(request.body?.qty ?? 1);
      const preise = withVersionPrices(stand.map, kampagne, await repo.getRegistry());
      const r = sellPiece(laden, inventar, String(request.body?.edge ?? ''), Number.isFinite(qty) ? qty : 1, preise);
      if ('refused' in r) return reply.code(409).send({ error: GRUND[r.refused], refused: r.refused });
      const neu = r.shop === laden ? [r.inventory] : [r.shop, r.inventory];
      const fehler = await schreiben(neu, new Map([[laden.id, laden], [inventar.id, inventar]]), user);
      if (fehler) return reply.code(fehler.code).send(fehler);
      const stueck = (inventar.relations ?? []).find((x) => x.id === String(request.body?.edge ?? ''))?.to;
      /* Eine beliebige Instanz, die niemand mehr hält, fällt weg (T-150) — der Laden zählt den Grundartikel. */
      if (r.orphan) await repo.deleteEntity(r.orphan);
      await repo.appendEvent('shop.sold', laden.id, {
        actor: figur.id,
        item: r.item,
        ...(stueck && stueck !== r.item ? { piece: stueck } : {}),
        qty: r.qty,
        unit: r.unit,
        total: r.total,
        /* Woher der Ankaufspreis kommt (E-045): heute immer die Hälfte. */
        rule: 'half',
        inventory: inventar.id,
        by: user.id,
      });
      return {
        item: { id: r.item, name: entityName(stand.map.get(r.item)) },
        qty: r.qty,
        unit: r.unit,
        total: r.total,
        copper: r.inventory.components?.['Inventory']?.['copper'] ?? 0,
      };
    },
  );
}
