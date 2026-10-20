/**
 * **Enhancements an einem Stück** (T-300, E-107): die Leitung gibt einer
 * Figur einen +1-Dolch, indem sie an deren Stück von „Dagger" die
 * Eigenschaft „+1 Weapon" hängt.
 *
 * - `POST /api/entities/:id/enhancements` `{enhancement}` — anhängen.
 *   Geprüft gegen `Item.appliesTo` (`enhancementRefusal`); nur an einem
 *   Stück (einer Instanz), denn am Grundgegenstand wäre jeder Dolch +1.
 * - `DELETE /api/entities/:id/enhancements/:enhancement` — abnehmen.
 * - `GET /api/entities/:id/enhancements` — was sich anhängen liesse: jedes
 *   sichtbare Enhancement mit Aufpreis und ob es passt, dazu ob dieses
 *   Konto anhängen darf (`may`). Die Oberfläche bietet an, was hier steht.
 *
 * **Wer darf:** die Leitung der laufenden Kampagne (und die Verwaltung).
 * Steht `Campaign.enhancementsBy` auf `players`, auch wer das Stück
 * schreibt — vorbereitet für das Handwerk (T-300 Punkt 4). Geschrieben wird
 * über den gewöhnlichen Weg (`schreibeGeprueft`), also aufgelöst geprüft
 * und ausgedünnt gespeichert; Name und Preis rechnet erst das Lesen (D8).
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  ENCHANTED_RELATION,
  currentCampaign,
  enhancementRefusal,
  enhancementsByOf,
  entityName,
  enhancementFits,
  isEnhancement,
  resolveInstance,
  surchargeOf,
  templateChain,
  coinText,
  type Entity,
  type validateEntity,
} from '@nw/model';
import type { User } from './auth.js';
import type { Repository } from './repo.js';
import { leitetTisch } from './wuerfe.js';

interface Stand {
  alle: Entity[];
  map: Map<string, Entity>;
}

export interface AufwertungDeps {
  repo: Repository;
  viewerOf: (request: FastifyRequest) => Promise<User | null>;
  roh: () => Promise<Stand>;
  sieve: (request: FastifyRequest, entities: Entity[], bestand?: Map<string, Entity>) => Promise<Entity[]>;
  darfSchreiben: (request: FastifyRequest, id: string) => Promise<boolean>;
  schreibeGeprueft: (entity: Entity) => Promise<{ stored: Entity } | { issues: ReturnType<typeof validateEntity> }>;
}

export function registerAufwertung(app: FastifyInstance, deps: AufwertungDeps): void {
  const { repo, viewerOf, roh, sieve, darfSchreiben, schreibeGeprueft } = deps;

  /** Das Stück, wenn dieses Konto daran Enhancements ändern darf — sonst die Antwort. */
  async function stueck(
    request: FastifyRequest,
    id: string,
  ): Promise<{ stand: Stand; piece: Entity } | { code: number; error: string }> {
    const user = await viewerOf(request);
    if (!user) return { code: 401, error: 'Nicht angemeldet' };
    const stand = await roh();
    const piece = stand.map.get(id);
    const [sichtbar] = piece ? await sieve(request, [piece], stand.map) : [];
    if (!piece || !sichtbar) return { code: 404, error: 'Dieses Stück gibt es nicht.' };
    const kampagne = currentCampaign(stand.map, (await repo.getRegistry()).settings ?? null);
    const leitung = leitetTisch(user, kampagne?.id ?? null);
    /* Spielende (wenn die Kampagne es erlaubt) an einem Stück, das sie
       schreiben oder das in einem Inventar liegt, das sie schreiben — ihr
       eigenes Gepäck also. */
    const halter = stand.alle.filter((e) => (e.relations ?? []).some((r) => r.type === 'holds' && r.to === id)).map((e) => e.id);
    let spielende = false;
    if (!leitung && enhancementsByOf(kampagne) === 'players') {
      for (const h of [id, ...halter]) if ((spielende = await darfSchreiben(request, h))) break;
    }
    if (!leitung && !spielende) return { code: 403, error: 'Enhancements hängt die Leitung an.' };
    return { stand, piece };
  }

  app.get<{ Params: { id: string } }>('/api/entities/:id/enhancements', async (request, reply) => {
    const s = await stueck(request, request.params.id);
    const may = !('code' in s);
    if ('code' in s && s.code !== 403) return reply.code(s.code).send({ error: s.error });
    const stand = 'code' in s ? await roh() : s.stand;
    const piece = stand.map.get(request.params.id)!;
    const kette = templateChain(stand.map, piece);
    const basis = kette.length ? resolveInstance(stand.map, kette[kette.length - 1]!) : null;
    const dran = new Set((piece.relations ?? []).filter((r) => r.type === ENCHANTED_RELATION).map((r) => r.to));
    const kandidaten = basis ? await sieve(request, stand.alle.filter((e) => isEnhancement(e) && !dran.has(e.id)), stand.map) : [];
    const options = kandidaten
      .map((e) => {
        const a = surchargeOf(e);
        const teile = a ? [a.mult !== 1 ? `× ${a.mult}` : '', a.add ? `+ ${coinText(a.add)}` : ''].filter(Boolean).join(' ') : '';
        return { id: e.id, name: entityName(e), fits: enhancementFits(e, basis!), ...(teile ? { surcharge: teile } : {}) };
      })
      .sort((a, b) => Number(b.fits) - Number(a.fits) || a.name.localeCompare(b.name));
    return { may, piece: !!basis, options };
  });

  app.post<{ Params: { id: string }; Body: { enhancement?: unknown } | undefined }>(
    '/api/entities/:id/enhancements',
    async (request, reply) => {
      const s = await stueck(request, request.params.id);
      if ('code' in s) return reply.code(s.code).send({ error: s.error });
      const ziel = typeof request.body?.enhancement === 'string' ? request.body.enhancement : '';
      /* Was man nicht sieht, hängt man nicht an — sonst läse man über das
         Stück, was verborgen ist. */
      const e = s.stand.map.get(ziel);
      const [sichtbar] = e ? await sieve(request, [e], s.stand.map) : [];
      if (!e || !sichtbar) return reply.code(404).send({ error: 'Dieses Enhancement gibt es nicht.' });
      const nein = enhancementRefusal(s.stand.map, s.piece, ziel);
      if (nein) return reply.code(400).send({ error: nein });
      const neu: Entity = {
        ...s.piece,
        relations: [
          ...(s.piece.relations ?? []),
          { id: `${s.piece.id}~${ENCHANTED_RELATION}-${ziel}`, type: ENCHANTED_RELATION, to: ziel, props: {} },
        ],
      };
      const r = await schreibeGeprueft(neu);
      if ('issues' in r) return reply.code(422).send({ error: 'Validierung fehlgeschlagen', issues: r.issues });
      return reply.code(201).send(r.stored);
    },
  );

  app.delete<{ Params: { id: string; enhancement: string } }>(
    '/api/entities/:id/enhancements/:enhancement',
    async (request, reply) => {
      const s = await stueck(request, request.params.id);
      if ('code' in s) return reply.code(s.code).send({ error: s.error });
      const ohne = (s.piece.relations ?? []).filter(
        (r) => !(r.type === ENCHANTED_RELATION && r.to === request.params.enhancement),
      );
      if (ohne.length === (s.piece.relations ?? []).length) {
        return reply.code(404).send({ error: 'Dieses Enhancement hängt nicht daran.' });
      }
      const r = await schreibeGeprueft({ ...s.piece, relations: ohne });
      if ('issues' in r) return reply.code(422).send({ error: 'Validierung fehlgeschlagen', issues: r.issues });
      return reply.send(r.stored);
    },
  );
}
