/**
 * **Karten finden** (T-202): die Kartenliste unter Play › Maps und wo eine
 * Karte vorkommt.
 *
 * - `GET /api/maps` — jede Karte, die der Betrachter sieht, als Baum
 *   (`mapTree`: Unterkarten unter ihrer Karte), mit Bild, Art, Marken und
 *   Ebenen. Gefiltert wird auf der Seite: Karten sind wenige, und ein
 *   Filter, der Zeilen herausnimmt, darf die Einrückung nicht zerreissen.
 * - `GET /api/maps/:id/uses` — Sitzungen, Szenen und Kämpfe, in denen die
 *   Karte vorkommt (`mapUses`), gesiebt: „liegt in drei Sitzungen“ verriete
 *   sonst drei Artikel.
 *
 * Gesiebt wird wie überall (`sieve`, zuerst der Stapel): was nicht im
 * Stapel steht oder was jemand nicht sehen darf, steht nicht in der Liste.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { entityName, isMap, LAYER_RELATION, mapImage, mapTree, mapUses, primaryInterface, type Entity } from '@nw/model';

interface Stand {
  alle: Entity[];
  map: Map<string, Entity>;
}

export interface KartenlisteDeps {
  roh: () => Promise<Stand>;
  sieve: (request: FastifyRequest, entities: Entity[], bestand?: Map<string, Entity>) => Promise<Entity[]>;
}

/** Eine Zeile der Kartenliste. */
export interface KartenZeile {
  id: string;
  name: string;
  /** Das Kartenbild (`Image.image`), leer ohne. */
  image: string;
  kind: string;
  tags: string[];
  layers: { id: string; name: string }[];
  depth: number;
  parent: string | null;
}

export function registerKartenliste(app: FastifyInstance, deps: KartenlisteDeps): void {
  const { roh, sieve } = deps;

  app.get('/api/maps', async (request) => {
    const stand = await roh();
    const karten = await sieve(request, stand.alle.filter(isMap), stand.map);
    /* Die Namen der Ebenen nur, wo der Betrachter die Ebene sieht. */
    const ebenenIds = new Set(
      karten.flatMap((k) => (k.relations ?? []).filter((r) => r.type === LAYER_RELATION).map((r) => r.to)),
    );
    const ebenen = new Map(
      (
        await sieve(
          request,
          [...ebenenIds].map((id) => stand.map.get(id)).filter((e): e is Entity => !!e),
          stand.map,
        )
      ).map((e) => [e.id, entityName(e)]),
    );
    const maps: KartenZeile[] = mapTree(karten).map(({ map, depth, parent }) => {
      const info = (map.components?.['Map'] ?? {}) as { kind?: unknown };
      const tags = (map.components?.['Tags'] as { tags?: unknown } | undefined)?.tags;
      return {
        id: map.id,
        name: entityName(map),
        image: mapImage(map),
        kind: typeof info.kind === 'string' ? info.kind : '',
        tags: Array.isArray(tags) ? tags.filter((t): t is string => typeof t === 'string') : [],
        layers: (map.relations ?? [])
          .filter((r) => r.type === LAYER_RELATION && ebenen.has(r.to))
          .map((r) => ({ id: r.to, name: ebenen.get(r.to)! })),
        depth,
        parent,
      };
    });
    return { maps };
  });

  app.get<{ Params: { id: string } }>('/api/maps/:id/uses', async (request, reply) => {
    const stand = await roh();
    const da = stand.map.get(request.params.id);
    const [karte] = da && isMap(da) ? await sieve(request, [da], stand.map) : [];
    if (!da || !karte) return reply.code(404).send({ error: 'Nicht gefunden' });
    /* Gefragt wird am ungesiebten Stand (auch `mapOf` an der rohen Karte),
       gezeigt wird nur, was der Betrachter sieht. */
    const uses = mapUses(stand.alle, da);
    const kandidaten = [...new Set(uses.map((u) => u.id))]
      .map((id) => stand.map.get(id))
      .filter((e): e is Entity => !!e);
    const sichtbar = new Map((await sieve(request, kandidaten, stand.map)).map((e) => [e.id, e]));
    return {
      uses: uses
        .filter((u) => sichtbar.has(u.id))
        .map((u) => ({ id: u.id, name: entityName(sichtbar.get(u.id)), type: primaryInterface(sichtbar.get(u.id)!), via: u.via })),
    };
  });
}
